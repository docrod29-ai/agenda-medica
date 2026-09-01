/**
 * GET / PUT  /api/superadmin/simulador
 *
 * ¿Este plan gana o pierde dinero, y a partir de cuántas notas?
 *
 * ── DE DÓNDE SALE CADA CIFRA ─────────────────────────────────────────────────
 *
 *  · El costo de IA por nota se MIDE del libro de costos: es lo que ya se gastó
 *    de verdad, no una estimación de tokens. El motor de cada nota se deduce de
 *    los créditos que cobró, que es el mismo número con el que se le cobró al
 *    médico.
 *  · Todo lo demás —comisión de pago, infraestructura, soporte, mensajería, tipo
 *    de cambio— lo carga el dueño aquí, porque este sistema no puede medirlo.
 *    Nace vacío a propósito: una cifra recordada de memoria produce un margen
 *    que parece exacto y miente, y de ese margen sale el precio de venta.
 *
 * Sólo el dueño.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { safeLog } from '@/lib/security/sanitize'
import { catalogoEfectivo, type CatalogoGuardado } from '@/lib/finanzas/catalogo-planes'
import { PLANES_ORDEN } from '@/lib/planes-ia'
import { PROCEDENCIA_POR_MOTOR } from '@/lib/ia/procedencia-motor'
import {
  simular, PERFILES, OTROS_COSTOS_VACIOS,
  type CostoMedidoPorNota, type OtrosCostosMensuales,
} from '@/lib/finanzas/simulador'

export const runtime = 'nodejs'

const REF_PARAMS = () => adminDb.collection('platform_config').doc('simulador')
const REF_CATALOGO = () => adminDb.collection('platform_config').doc('catalogo_planes')

/** Cuántos usuarios se simulan. Los tres tamaños del charter. */
const TAMANOS = [100, 500, 1000] as const

/**
 * El motor de una nota, deducido de los créditos que cobró.
 *
 * Es el mismo número con el que se le cobró al médico, así que si esto se
 * desincroniza del catálogo de motores, la factura del cliente también estaría
 * mal — o sea que no puede desincronizarse en silencio.
 */
type ClaveMotorMedido = 'rapida' | 'estandar' | 'maxima'

function motorDeCreditos(creditos: number): ClaveMotorMedido | null {
  if (creditos === 1) return 'rapida'
  if (creditos === 3) return 'estandar'
  if (creditos === 10) return 'maxima'
  return null
}

/** Mínimo de llamadas para que un promedio signifique algo. */
const MUESTRA_MINIMA = 5

async function costoMedido(): Promise<CostoMedidoPorNota> {
  const vacio: CostoMedidoPorNota = {
    rapida: null, estandar: null, maxima: null,
    muestras: { rapida: 0, estandar: 0, maxima: 0 },
  }
  try {
    const snap = await adminDb.collection('platform_cost_ledger')
      .where('feature', '==', 'procesar').orderBy('ts', 'desc').limit(2000).get()

    const suma = { rapida: 0, estandar: 0, maxima: 0 }
    const n = { rapida: 0, estandar: 0, maxima: 0 }
    for (const d of snap.docs) {
      const usd = d.get('costoUsd')
      // Sin costo NO se promedia: son las llamadas cuyo modelo no tiene tarifa
      // cargada, y meterlas como cero abarataría el promedio en silencio.
      if (typeof usd !== 'number' || !Number.isFinite(usd)) continue
      const motor = motorDeCreditos(Number(d.get('creditos') ?? 0))
      if (!motor) continue
      suma[motor] += usd
      n[motor] += 1
    }
    const prom = (m: keyof typeof suma) => (n[m] >= MUESTRA_MINIMA ? suma[m] / n[m] : null)
    return { rapida: prom('rapida'), estandar: prom('estandar'), maxima: prom('maxima'), muestras: n }
  } catch (e) {
    safeLog.warn('[simulador] sin libro de costos:', String(e).slice(0, 120))
    return vacio
  }
}

interface ParamsGuardados extends OtrosCostosMensuales { usdMxn?: number | null }

export async function GET(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response
  try {
    const [pSnap, cSnap, medido] = await Promise.all([
      REF_PARAMS().get(), REF_CATALOGO().get(), costoMedido(),
    ])
    const p = (pSnap.exists ? pSnap.data() : {}) as ParamsGuardados
    const otros: OtrosCostosMensuales = { ...OTROS_COSTOS_VACIOS, ...p }
    const usdMxn = typeof p.usdMxn === 'number' && p.usdMxn > 0 ? p.usdMxn : null
    const planes = catalogoEfectivo(cSnap.exists ? (cSnap.data() as CatalogoGuardado) : null).planes

    const matriz = PLANES_ORDEN.filter(c => planes[c].creditos > 0).map(clave => ({
      clave,
      nombre: planes[clave].nombre,
      precioMXN: planes[clave].precioMXN,
      porPerfil: PERFILES.map(perfil => ({
        perfil: perfil.clave,
        etiqueta: perfil.etiqueta,
        // Un solo usuario: el margen POR CLIENTE es lo que dice si el plan
        // aguanta. Los tamaños de abajo sólo escalan lo mismo.
        unitario: simular({ precioMXN: planes[clave].precioMXN, usuarios: 1, perfil, costoNota: medido, usdMxn, otros }),
      })),
      porTamano: TAMANOS.map(usuarios => ({
        usuarios,
        resultado: simular({
          precioMXN: planes[clave].precioMXN, usuarios,
          perfil: PERFILES.find(x => x.clave === 'normal')!, costoNota: medido, usdMxn, otros,
        }),
      })),
    }))

    /**
     * QUÉ CORRE DEBAJO DE CADA NIVEL — sólo para este panel de superadmin.
     *
     * El médico ya no ve proveedor ni modelo (#345): elige la INTENCIÓN clínica y
     * el router resuelve el cómputo. Pero un promedio de «$0.60 USD por nota
     * Máxima» no se puede juzgar sin saber qué se está pagando, así que la
     * procedencia interna aterriza AQUÍ, que es su destinatario legítimo.
     *
     * Es orientativa: el costo real se calcula con el id de modelo que devuelve
     * el proveedor en cada llamada, no con esta etiqueta.
     */
    const procedencia = Object.fromEntries(
      (['rapida', 'estandar', 'maxima'] as const).map(m => [m, PROCEDENCIA_POR_MOTOR[m].etiquetaAuditoria]),
    )
    return NextResponse.json({ ok: true, medido, procedencia, otros, usdMxn, perfiles: PERFILES, tamanos: TAMANOS, matriz })
  } catch (e) {
    safeLog.error('[superadmin/simulador]', String(e).slice(0, 200))
    return NextResponse.json({ ok: false, error: 'No se pudo calcular la simulación.' }, { status: 500 })
  }
}

/** Guarda los costos que este sistema no puede medir. Los carga el dueño. */
export async function PUT(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response
  let cuerpo: ParamsGuardados
  try { cuerpo = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  /**
   * Sólo entran números positivos. Un cero se guardaría como «la comisión de
   * pago es cero», que es una afirmación, no un dato ausente — y el simulador
   * dejaría de avisar de que falta.
   */
  const limpio: Record<string, number> = {}
  for (const k of ['comisionPagoPct', 'infraPorUsuario', 'soportePorUsuario', 'mensajeriaPorUsuario', 'usdMxn'] as const) {
    const v = Number((cuerpo as unknown as Record<string, unknown>)[k])
    if (Number.isFinite(v) && v > 0) limpio[k] = v
  }
  try {
    await REF_PARAMS().set({ ...limpio, actualizadoEn: new Date().toISOString(), actualizadoPor: acceso.email })
    return NextResponse.json({ ok: true, guardado: limpio })
  } catch (e) {
    safeLog.error('[superadmin/simulador] guardado', String(e).slice(0, 200))
    return NextResponse.json({ ok: false, error: 'No se pudo guardar.' }, { status: 500 })
  }
}
