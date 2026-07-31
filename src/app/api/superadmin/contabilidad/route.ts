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
import { claseDeCuenta, cuentaComoIngreso } from '@/lib/authz/fundador'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { PLANES, type ClavePlan } from '@/lib/planes-ia'

type Any = Record<string, unknown>

// Supuestos (ajustables por env). costo por crédito ≈ lo que te cuesta 1 crédito
// de IA (Haiku/Sonnet/Opus rondan ~$1.5 MXN por crédito). Infra fija mensual.
const COSTO_CREDITO_MXN = Number(process.env.COSTO_CREDITO_MXN ?? '1.5')
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
    const [clinicsSnap, paysSnap] = await Promise.all([
      adminDb.collection('clinics').get(),
      adminDb.collection('platform_payments').get(),
    ])

    // ── Ingresos por mes (histórico) + pagos del mes seleccionado ──
    const ingresoPorMes = new Map<string, number>()
    let numPagosMes = 0
    let ingresoTotalHist = 0
    paysSnap.docs.forEach(d => {
      const p = d.data() as Any
      if (p.livemode !== true) return  // solo ingresos REALES (excluye pagos de prueba)
      const monto = Number(p.monto ?? 0)
      if (!(monto > 0)) return
      const mes = mesDe(String(p.fecha ?? p.createdAt ?? ''))
      ingresoPorMes.set(mes, (ingresoPorMes.get(mes) ?? 0) + monto)
      ingresoTotalHist += monto
      if (mes === mesSel) numPagosMes++
    })
    const ingresoMes = ingresoPorMes.get(mesSel) ?? 0
    const porMes = ultimosMeses(12, mesSel).map(mes => ({ mes, ingresos: Math.round(ingresoPorMes.get(mes) ?? 0) }))

    // ── Por cliente: plan, ingreso histórico, créditos del mes, costo IA, margen ──
    const pagadoPorClinica = new Map<string, number>()
    paysSnap.docs.forEach(d => {
      const p = d.data() as Any
      if (p.livemode !== true) return  // solo pagos REALES confirmados (Stripe en prueba → livemode:false o ausente → no es ingreso real)
      pagadoPorClinica.set(String(p.clinicId ?? ''), (pagadoPorClinica.get(String(p.clinicId ?? '')) ?? 0) + Number(p.monto ?? 0))
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
      const costoIA = creditos * COSTO_CREDITO_MXN
      const mrr = activa ? precioPlan(plan) : 0
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
        ingresoTotal: Math.round(pagadoPorClinica.get(cid) ?? 0),
        creditos: Math.round(creditos * 10) / 10,
        costoIA: Math.round(costoIA),
        margen: mrr > 0 ? Math.round(((mrr - costoIA) / mrr) * 100) : null,
      }
    }))
    clientes.sort((a, b) => b.mrr - a.mrr || b.ingresoTotal - a.ingresoTotal)

    // ── Costos y utilidad del mes ──
    const costoIA = creditosMesTotal * COSTO_CREDITO_MXN
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
        ingresoTotalHist: Math.round(ingresoTotalHist),
        numPagosMes,
      },
      porMes,
      porPlan: [...porPlan.entries()]
        .filter(([, v]) => v.cantidad > 0)
        .map(([plan, v]) => ({ plan, label: labelPlan(plan), cantidad: v.cantidad, mrr: Math.round(v.mrr) }))
        .sort((a, b) => b.mrr - a.mrr),
      clientes,
      supuestos: { costoPorCreditoMXN: COSTO_CREDITO_MXN, infraMensualMXN: INFRA_MENSUAL_MXN, stripePct: STRIPE_PCT, iva: IVA },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
