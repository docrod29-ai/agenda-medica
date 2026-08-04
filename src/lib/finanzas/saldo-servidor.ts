/**
 * EL SALDO, LEÍDO DE VERDAD: recargas de Firestore − gasto del libro de costos.
 *
 * La aritmética vive en `saldo-proveedores.ts` (pura, probable). Aquí sólo se
 * traen los dos datos que hacen falta, y se traen de las dos fuentes que ya
 * existen — no se inventa un contador nuevo que habría que mantener al día.
 *
 * Ver `saldo-proveedores.ts` para por qué el saldo se LLEVA y no se consulta al
 * proveedor, y por qué la cifra se llama estimada en todas partes.
 */
import { adminDb } from '@/lib/firebase-admin'
import { leerCostos } from './cost-ledger-server'
import { saldoDe, type Recarga, type SaldoProveedor, type ConsumoProveedor } from './saldo-proveedores'

/** Los proveedores que se vigilan. Si se añade uno, se añade aquí y ya. */
export const PROVEEDORES_VIGILADOS = ['assemblyai', 'anthropic', 'openai'] as const

/**
 * Sobre cuántos días se mide el ritmo de gasto.
 *
 * Treinta: menos capta un pico —una tarde de muchas consultas— y proyecta un
 * agotamiento que no va a pasar, lo que enseña a ignorar el aviso.
 */
export const DIAS_DE_RITMO = 30

const iso = (ms: number) => new Date(ms).toISOString()

/** Las recargas que el dueño ha registrado. Colección de plataforma, no clínica. */
export async function leerRecargas(): Promise<Recarga[]> {
  const snap = await adminDb.collection('platform_recargas').limit(500).get()
  return snap.docs.map(d => {
    const x = d.data() as Record<string, unknown>
    return {
      proveedor: String(x.proveedor ?? ''),
      montoUsd: Number(x.montoUsd ?? 0),
      fecha: String(x.fecha ?? ''),
      ...(x.referencia ? { referencia: String(x.referencia) } : {}),
    }
  }).filter(r => r.proveedor && Number.isFinite(r.montoUsd))
}

/**
 * Lo gastado por proveedor en la ventana de ritmo.
 *
 * **Los asientos sin costo NO se cuentan como cero.** Un modelo sin tarifa deja
 * `costoUsd: null`, y sumarlo como cero haría ver un gasto menor del real — que
 * en un aviso de saldo significa avisar tarde.
 */
export async function consumoPorProveedor(ahoraMs: number): Promise<Map<string, ConsumoProveedor>> {
  const desde = iso(ahoraMs - DIAS_DE_RITMO * 86_400_000)
  const eventos = await leerCostos(desde, iso(ahoraMs))
  const m = new Map<string, ConsumoProveedor>()
  for (const e of eventos) {
    if (typeof e.costoUsd !== 'number') continue
    const p = String(e.proveedor ?? '')
    const prev = m.get(p) ?? { proveedor: p, usdGastado: 0, diasMedidos: DIAS_DE_RITMO }
    prev.usdGastado += e.costoUsd
    m.set(p, prev)
  }
  return m
}

/** El saldo de cada proveedor vigilado, listo para avisar o para pintar. */
export async function saldosDeProveedores(ahoraMs: number): Promise<SaldoProveedor[]> {
  const [recargas, consumo] = await Promise.all([leerRecargas(), consumoPorProveedor(ahoraMs)])
  return PROVEEDORES_VIGILADOS.map(p => saldoDe(p, recargas, consumo.get(p) ?? null))
}
