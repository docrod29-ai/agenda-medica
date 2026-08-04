/**
 * GET /api/superadmin/contabilidad?mes=YYYY-MM
 *
 * Panel de CONTABILIDAD del dueño de la plataforma: ingresos (suscripciones +
 * recargas), IVA contenido, costos (IA, infraestructura, comisiones Stripe),
 * utilidad y margen — global, por mes, por plan y por cliente. Todo para que el
 * dueño/contador lleve el control y prepare la declaración del SAT.
 *
 * Los ingresos salen de `platform_payments` (los registra el webhook de Stripe).
 * El costo de IA se estima con los créditos consumidos por cada consultorio.
 * Solo superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { mrrDe } from '@/lib/finanzas/mrr'
import { churnDelMes } from '@/lib/finanzas/churn'
import { claseDeCuenta, cuentaComoIngreso } from '@/lib/authz/fundador'
import { adminDb } from '@/lib/firebase-admin'
import { desdeVentana, alcanceDePagos, alcanceDeClinicas, TOPE_CLINICAS, TOPE_PAGOS } from '@/lib/ops/alcance'
import { verificarSuperadmin } from '@/lib/superadmin'
import { efectivoDe, esDineroReal, tipoDeAsiento, type EstadoDisputa } from '@/lib/finanzas/movimientos'
import { PLANES, type ClavePlan } from '@/lib/planes-ia'
import { costoIADelMes, costoPorClinica, type AsientoCosto } from '@/lib/finanzas/costo-ia-contable'

type Any = Record<string, unknown>

/**
 * EL SUPUESTO VIEJO, QUE AHORA ES SÓLO EL RESPALDO.
 *
 * Hasta la v978 la contabilidad valoraba la IA a `créditos × 1.5 MXN` — una
 * cifra de memoria, sin fuente y sin fecha — teniendo al lado el libro de costos
 * con el gasto REAL de cada llamada. Ahora se mide; esto sólo se usa cuando no
 * hay tipo de cambio configurado, y la pantalla dice cuál de las dos se ve.
 */
const COSTO_CREDITO_MXN = Number(process.env.COSTO_CREDITO_MXN ?? '1.5')
/**
 * MXN por USD. **Sin valor por omisión, a propósito.**
 *
 * Lo pone el dueño o su contador (el del DOF del día que declara). Escribir aquí
 * un 17 o un 20 de memoria daría una conversión que en pantalla se ve igual de
 * exacta que la buena, y sobre esa cifra se decide un precio.
 */
const TIPO_CAMBIO = Number(process.env.TIPO_CAMBIO_USD_MXN ?? '') || null
const INFRA_MENSUAL_MXN = Number(process.env.INFRA_MENSUAL_MXN ?? '1500')
const STRIPE_PCT = 0.036
const STRIPE_FIJA = 3
const IVA = 0.16

const mesDe = (iso: string) => (iso || '').slice(0, 7)
const precioPlan = (plan: string): number => (PLANES[plan as ClavePlan]?.precioMXN ?? 0)
const labelPlan = (plan: string): string => (PLANES[plan as ClavePlan]?.nombre ?? plan)

function ultimosMeses(n: number, hasta: string): string[] {
  const [y, m] = hasta.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  const mesSel = req.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7)

  try {
    /**
     * ACOTADAS, igual que en la consola de clientes.
     *
     * Aquí había los mismos dos `.get()` sin `limit` ni `where`. Doce meses
     * cubren el año fiscal y la comparación interanual, que es para lo que se
     * mira esta pantalla; el histórico completo vive en Stripe, que es su sitio
     * — la consola no es el libro mayor.
     *
     * Y el alcance viaja en la respuesta: un ingreso recortado que se llama
     * «histórico» es un número sobre el que se toman decisiones de precio.
     */
    /**
     * EL LIBRO DE COSTOS DEL MES — el dato que existía y no se leía.
     *
     * `ts` se guarda en ISO, así que el mes es un prefijo de cadena y el rango
     * [mes-01, mes-32) ordena igual sin necesitar índice compuesto (el mismo
     * truco que usa la consola de costos).
     *
     * Si falla, NO se cae la contabilidad: se sigue con el supuesto y se dice.
     */
    const asientosIA: AsientoCosto[] = await adminDb.collection('platform_cost_ledger')
      .where('ts', '>=', `${mesSel}-01`)
      .where('ts', '<', `${mesSel}-32`)
      .limit(5000)
      .get()
      .then(q => q.docs.map(d => d.data() as AsientoCosto))
      .catch(() => [])
    const costoIAPorClinica = costoPorClinica(asientosIA, TIPO_CAMBIO)

    const desdeVent = desdeVentana(Date.now())
    const [clinicsSnap, paysSnap] = await Promise.all([
      adminDb.collection('clinics').limit(TOPE_CLINICAS).get(),
      adminDb.collection('platform_payments').where('fecha', '>=', desdeVent).limit(TOPE_PAGOS).get(),
    ])
    const alcance = {
      cobros: alcanceDePagos(desdeVent, paysSnap.size),
      consultorios: alcanceDeClinicas(clinicsSnap.size),
    }

    // ── Ingresos por mes (histórico) + pagos del mes seleccionado ──
    /**
     * INGRESO **NETO**: cobros menos reembolsos menos contracargos.
     *
     * Antes esto hacía `if (!(monto > 0)) return`, es decir, descartaba todo lo
     * que no fuera un cobro — mientras `pagadoPorClinica`, veinte líneas más
     * abajo, sí sumaba los negativos. Dos respuestas a «cuánto entró», y la que
     * se mira primero era la optimista.
     *
     * Con el webhook asentando ya reembolsos y contracargos (P0-3), esa asimetría
     * habría dejado las devoluciones INVISIBLES justo en el número grande. El
     * signo lo pone `efectivoDe`, que es el único sitio donde se define.
     */
    const ingresoPorMes = new Map<string, number>()
    let numPagosMes = 0
    let ingresoTotalHist = 0
    let devueltoHist = 0
    let disputasAbiertas = 0
    paysSnap.docs.forEach(d => {
      const p = d.data() as Any
      if (!esDineroReal(p)) return  // solo dinero REAL (excluye Stripe en modo prueba)
      // Los asientos anteriores a este cambio no llevan `tipo`: eran todos cobros
      // y así se leen. Tratarlos como desconocidos mostraría una caída de ingresos
      // que nunca ocurrió.
      const tipo = tipoDeAsiento(p)
      const efectivo = efectivoDe({ tipo, monto: Number(p.monto ?? 0), estadoDisputa: p.estadoDisputa as EstadoDisputa | undefined })
      if (efectivo === 0 && tipo === 'cobro') return
      const mes = mesDe(String(p.fecha ?? p.createdAt ?? ''))
      ingresoPorMes.set(mes, (ingresoPorMes.get(mes) ?? 0) + efectivo)
      ingresoTotalHist += efectivo
      if (efectivo < 0) devueltoHist += -efectivo
      if (tipo === 'contracargo' && p.estadoDisputa === 'abierta') disputasAbiertas++
      // Un reembolso NO es un pago: si contara aquí, «pagos del mes» subiría cada
      // vez que se devuelve dinero.
      if (mes === mesSel && tipo === 'cobro') numPagosMes++
    })
    const ingresoMes = ingresoPorMes.get(mesSel) ?? 0
    const porMes = ultimosMeses(12, mesSel).map(mes => ({ mes, ingresos: Math.round(ingresoPorMes.get(mes) ?? 0) }))

    // ── Por cliente: plan, ingreso histórico, créditos del mes, costo IA, margen ──
    const pagadoPorClinica = new Map<string, number>()
    paysSnap.docs.forEach(d => {
      const p = d.data() as Any
      if (!esDineroReal(p)) return  // solo pagos REALES (Stripe en prueba no es ingreso)
      /**
       * MISMA definición de signo que el ingreso global, y por el MISMO motivo.
       *
       * Aquí se sumaba `Number(p.monto)` en crudo. Los movimientos se guardan
       * SIEMPRE en positivo —el signo lo decide el tipo, no quien escribe— así
       * que sin esta línea un reembolso habría subido el "ingreso histórico" del
       * cliente al que se le devolvió el dinero. Es la asimetría que este cambio
       * vino a cerrar, reaparecida veinte líneas más abajo.
       */
      const efectivo = efectivoDe({
        tipo: tipoDeAsiento(p),
        monto: Number(p.monto ?? 0),
        estadoDisputa: p.estadoDisputa as EstadoDisputa | undefined,
      })
      pagadoPorClinica.set(String(p.clinicId ?? ''), (pagadoPorClinica.get(String(p.clinicId ?? '')) ?? 0) + efectivo)
    })

    let creditosMesTotal = 0
    const porPlan = new Map<string, { cantidad: number; mrr: number }>()

    const clientes = await Promise.all(clinicsSnap.docs.map(async d => {
      const c = d.data() as Any
      const cid = d.id
      const plan = String(c.plan ?? 'trial')
      // El fundador y las cortesías no son ingreso, pero no son lo mismo: la
      // cortesía es un cliente al que se sirve gratis (su costo SÍ es de
      // operación), el fundador está construyendo el producto (I+D). Antes ambos
      // caían en el mismo `paseLibre !== true` y el margen salía revuelto.
      // El documento de la clínica guarda `ownerId`, no correo: al fundador se
      // le reconoce porque la clínica es SUYA — el mismo criterio que ya usa el
      // botón «Entrar con mi cuenta» de la consola.
      const clase = claseDeCuenta(c, String(c.ownerId ?? '') === acc.uid)
      const activa = String(c.status ?? '') === 'active' && cuentaComoIngreso(clase)
      let creditos = 0
      try {
        const ia = (await adminDb.doc(`clinics/${cid}/secretos/ia`).get()).data()
        creditos = Number(ia?.uso?.[mesSel]?.creditos ?? 0)
      } catch { /* 0 */ }
      creditosMesTotal += creditos
      /**
       * Medido si se puede; supuesto si no hay tipo de cambio. Un consultorio
       * sin asientos este mes cuesta 0 de verdad, no «desconocido»: si no llamó
       * a la IA, no gastó.
       */
      const costoIA = TIPO_CAMBIO ? (costoIAPorClinica.get(cid) ?? 0) : creditos * COSTO_CREDITO_MXN
      /**
       * EL MRR YA NO ES EL PRECIO DE LISTA.
       *
       * Antes: `precioPlan(plan)`. Dos errores en direcciones opuestas —que se
       * compensan y hacen que el total parezca razonable mientras cada línea
       * está mal—: el ANUAL se sobrestimaba (el catálogo dice 12 meses al precio
       * de 10, así que su ingreso mensual es ×10/12) y el MULTI-MÉDICO se
       * subestimaba (los asientos adicionales se cobran aparte y no se sumaban).
       *
       * Los dos datos ya estaban en el documento de la clínica: `ciclo` lo
       * escribe el webhook desde que se venden anualidades, y
       * `medicosContratados` es lo que la suscripción cobra.
       */
      const desglose = mrrDe({ plan, ciclo: c.ciclo as string | undefined, medicosContratados: Number(c.medicosContratados ?? 1) })
      const mrr = activa ? desglose.mensual : 0
      // acumular por plan
      const pp = porPlan.get(plan) ?? { cantidad: 0, mrr: 0 }
      if (activa) { pp.cantidad++; pp.mrr += mrr }
      porPlan.set(plan, pp)
      return {
        id: cid,
        nombre: String(c.nombreClinica || c.nombreMedico || 'Sin nombre'),
        plan, planLabel: labelPlan(plan),
        activa,
        mrr,
        // Para que el tablero pueda explicar la cifra en vez de sólo darla: de
        // dónde sale, cuántos asientos cobra y cuánto descuenta el anual.
        mrrCiclo: desglose.ciclo,
        mrrAsientos: activa ? desglose.asientos : 0,
        mrrExtras: activa ? desglose.extras : 0,
        mrrDescuentoAnual: activa ? desglose.descuentoAnual : 0,
        ingresoTotal: Math.round(pagadoPorClinica.get(cid) ?? 0),
        creditos: Math.round(creditos * 10) / 10,
        costoIA: Math.round(costoIA),
        margen: mrr > 0 ? Math.round(((mrr - costoIA) / mrr) * 100) : null,
      }
    }))
    clientes.sort((a, b) => b.mrr - a.mrr || b.ingresoTotal - a.ingresoTotal)

    // ── Costos y utilidad del mes ──
    const ia = costoIADelMes(asientosIA, creditosMesTotal, COSTO_CREDITO_MXN, TIPO_CAMBIO)
    const costoIA = ia.mxn
    const costoStripe = ingresoMes * STRIPE_PCT + numPagosMes * STRIPE_FIJA
    const costoInfra = INFRA_MENSUAL_MXN
    const costoTotal = costoIA + costoStripe + costoInfra
    // El IVA no es tuyo (lo trasladas al SAT): la utilidad se calcula sobre el
    // ingreso SIN IVA.
    const ivaMes = ingresoMes * (IVA / (1 + IVA))
    const ingresoSinIva = ingresoMes - ivaMes
    const utilidad = ingresoSinIva - costoTotal
    const margen = ingresoSinIva > 0 ? utilidad / ingresoSinIva : 0

    const mrrTotal = clientes.reduce((s, c) => s + c.mrr, 0)
    const activas = clientes.filter(c => c.activa).length

    return NextResponse.json({
      alcance,
      ok: true,
      mes: mesSel,
      resumen: {
        ingresoMes: Math.round(ingresoMes),
        ivaMes: Math.round(ivaMes),
        ingresoSinIva: Math.round(ingresoSinIva),
        costoIA: Math.round(costoIA),
        costoStripe: Math.round(costoStripe),
        costoInfra: Math.round(costoInfra),
        costoTotal: Math.round(costoTotal),
        utilidad: Math.round(utilidad),
        margen: Math.round(margen * 1000) / 10,
        mrr: Math.round(mrrTotal),
        activas,
        clinicas: clientes.length,
        creditosMes: Math.round(creditosMesTotal * 10) / 10,
        /**
         * Ya NO es «histórico»: es el de la ventana leída. El nombre viejo se
         * conserva para no romper la pantalla, pero `alcance.cobros.etiqueta`
         * dice de cuándo a cuándo — un ingreso recortado que se llama histórico
         * es el recorte silencioso otra vez.
         */
        ingresoTotalHist: Math.round(ingresoTotalHist),
        /**
         * Lo devuelto se publica APARTE, no sólo restado.
         *
         * Un neto más bajo sin decir por qué se lee como «vendimos menos». Que
         * el dueño vea la cifra de devoluciones y las disputas sin resolver es
         * la diferencia entre un mal mes y un problema de cobranza.
         */
        devueltoHist: Math.round(devueltoHist),
        disputasAbiertas,
        numPagosMes,
        /**
         * BAJAS DEL MES — la cifra que faltaba al lado del MRR.
         *
         * El MRR dice cuánto entra; esto dice si se sostiene. Un producto con
         * MRR creciente y bajas altas está reemplazando clientes tan rápido
         * como los pierde, y eso no se ve en ninguna suma: se ve dividiendo.
         */
        churn: churnDelMes(
          clinicsSnap.docs.map(d => {
            const c = d.data() as Any
            return {
              status: String(c.status ?? ''),
              canceladaEn: c.canceladaEn ? String(c.canceladaEn) : null,
              // El MRR perdido con una baja es lo que ESA suscripción cobraba:
              // su ciclo y sus asientos, igual que el MRR de arriba. Con el
              // precio de lista, una baja anual multi-médico se contaba mal en
              // las dos direcciones a la vez.
              mrr: mrrDe({ plan: String(c.plan ?? 'trial'), ciclo: c.ciclo as string | undefined, medicosContratados: Number(c.medicosContratados ?? 1) }).mensual,
              // La prueba abandonada, que no contaba nadie.
              trialEndsAt: c.trialEndsAt ? String(c.trialEndsAt) : null,
            }
          }),
          mesSel,
        ),
      },
      porMes,
      porPlan: [...porPlan.entries()]
        .filter(([, v]) => v.cantidad > 0)
        .map(([plan, v]) => ({ plan, label: labelPlan(plan), cantidad: v.cantidad, mrr: Math.round(v.mrr) }))
        .sort((a, b) => b.mrr - a.mrr),
      clientes,
      /**
       * DINERO QUE NO SE PUEDE ATRIBUIR A NADIE.
       *
       * Los pagos sin clínica caían en un bucket con clave vacía que la tabla
       * por cliente no recorre: entraban en el ingreso global y desaparecían del
       * detalle. Un descuadre invisible es peor que uno grande, porque no se
       * puede investigar. Ahora se cuentan y se dicen.
       */
      huerfanos: (() => {
        const importe = pagadoPorClinica.get('') ?? 0
        const n = paysSnap.docs.filter(d => !String((d.data() as Any).clinicId ?? '')).length
        return { cantidad: n, importe, nota: n ? 'Hay pagos que no se pudieron atribuir a ningún consultorio. Están sumados en el ingreso global pero no aparecen en la tabla por cliente.' : '' }
      })(),
      supuestos: { costoPorCreditoMXN: COSTO_CREDITO_MXN, infraMensualMXN: INFRA_MENSUAL_MXN, stripePct: STRIPE_PCT, iva: IVA },
      /**
       * DE DÓNDE SALE EL COSTO DE IA. La pantalla lo enseña.
       *
       * Un tablero que no distingue lo medido de lo supuesto los presenta igual,
       * y entonces un supuesto acaba sosteniendo una decisión de precio.
       */
      costoIAFuente: {
        fuente: ia.fuente, usdMedido: Math.round(ia.usdMedido * 100) / 100,
        conCosto: ia.conCosto, sinTarifa: ia.sinTarifa,
        tipoCambio: TIPO_CAMBIO, aviso: ia.aviso,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
