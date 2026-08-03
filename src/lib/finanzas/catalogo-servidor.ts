/**
 * EL CATÁLOGO VIGENTE, DEL LADO DEL SERVIDOR — para que la caja cobre lo mismo
 * que dice el escaparate.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El catálogo editable existe, está probado, se puede cambiar desde la consola
 * del dueño… y llega **sólo a la vitrina**: `/api/planes` y la página `/precios`.
 *
 * Los tres sitios donde el número se convierte en dinero o en producto seguían
 * leyendo la constante del código:
 *
 *   · `ai-keys.ts` → `entitlementsDe`: el CUPO DE CRÉDITOS que se le entrega al
 *     consultorio. El Dr. sube el cupo del plan Clínica, la página de precios lo
 *     anuncia, y el médico que paga sigue recibiendo el de fábrica.
 *   · `stripe/asientos` → el precio BASE con el que se calcula el cobro mensual
 *     por médico. La consola dice $949 y la cuenta se hace con $899.
 *   · `consultor-evidencia` → el tope de créditos que corta la IA a media
 *     consulta.
 *
 * Un ajuste que no llega al cobro ni a la entrega no es un ajuste: es un letrero.
 * Y la forma en que se rompe es la peor — nadie ve un error, simplemente el
 * recibo y la página de precios dicen cosas distintas, y el que lo nota es el
 * cliente.
 *
 * ── POR QUÉ HAY CACHÉ, Y POR QUÉ ES CORTA ────────────────────────────────────
 *
 * `entitlementsDe` corre en cada comprobación de créditos, o sea muchas veces
 * por consulta. Una lectura de Firestore ahí es una factura y una latencia que
 * no hacen falta: un precio no cambia cada minuto.
 *
 * Sesenta segundos, el MISMO número que el `revalidate` de `/api/planes`, y a
 * propósito: dos retrasos distintos harían que durante un rato la página
 * pública y el cobro discreparan, que es exactamente el defecto que esto viene a
 * cerrar. Un minuto de retraso entre «guardar» y «cobrar» es nada; una
 * discrepancia permanente entre las dos, no.
 *
 * ── QUÉ PASA SI FIRESTORE NO RESPONDE ────────────────────────────────────────
 *
 * Se usan los valores de FÁBRICA y se sigue. Cortarle la IA a un intensivista a
 * las tres de la mañana porque no se pudo leer un precio sería una respuesta
 * mucho peor que cobrar con la tarifa del mes pasado. Es el mismo criterio que
 * ya toma `/api/planes` cuando la base falla, y el mismo que toma la cartera de
 * créditos: **falla abierto**.
 */
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { catalogoEfectivo, type CatalogoGuardado } from '@/lib/finanzas/catalogo-planes'
import { PLANES, type ClavePlan, type PlanCreditos } from '@/lib/planes-ia'
/**
 * Importación de TIPO a propósito: `ai-keys` importa de este módulo, así que
 * traer el valor crearía un ciclo en tiempo de ejecución. Un `import type` se
 * borra al compilar y no existe cuando el programa corre.
 */
import type { NivelIA } from '@/lib/ai-keys'

/** El mismo minuto que el `revalidate` de `/api/planes`. Ver arriba. */
export const TTL_MS = 60_000

let cache: { planes: Record<ClavePlan, PlanCreditos>; version: number; deFabrica: boolean; expira: number } | null = null

/** Vacía la caché. La llama la ruta que GUARDA el catálogo, para no esperar el minuto. */
export function olvidarCatalogo(): void {
  cache = null
}

/**
 * El catálogo vigente. Nunca lanza.
 *
 * `ahoraMs` se inyecta para poder probar la caducidad sin tocar el reloj.
 */
export async function catalogoVigente(ahoraMs = Date.now()): Promise<{
  planes: Record<ClavePlan, PlanCreditos>
  version: number
  deFabrica: boolean
}> {
  if (cache && cache.expira > ahoraMs) return cache
  try {
    const snap = await adminDb.collection('platform_config').doc('catalogo_planes').get()
    const efectivo = catalogoEfectivo(snap.exists ? (snap.data() as CatalogoGuardado) : null)
    cache = { planes: efectivo.planes, version: efectivo.version, deFabrica: efectivo.deFabrica, expira: ahoraMs + TTL_MS }
    return cache
  } catch (e) {
    /**
     * NO se cachea el fallo: si Firestore vuelve en tres segundos, el precio
     * correcto debe entrar enseguida. Cachear el error alargaría un problema de
     * un instante a un minuto entero de cobros con la tarifa equivocada.
     */
    safeLog.warn('[catalogo-servidor] cayendo a fábrica:', String(e).slice(0, 120))
    return { planes: PLANES, version: 0, deFabrica: true }
  }
}

/** El plan vigente por clave (`agenda`/`clinica`/`premium`/`hospital`). */
export async function planVigentePorClave(c: ClavePlan): Promise<PlanCreditos> {
  const { planes } = await catalogoVigente()
  return planes[c] ?? planes.clinica ?? PLANES.clinica
}

/**
 * El plan vigente por nivel de IA.
 *
 * Reproduce la MISMA correspondencia que `planPorNivel` del código —premium→
 * premium, todo lo demás→clínica— a propósito: si aquí se decidiera otra cosa,
 * el cupo entregado y el cupo anunciado volverían a divergir por un camino
 * nuevo, que es justo lo que se está cerrando.
 */
export async function planVigentePorNivel(n: NivelIA): Promise<PlanCreditos> {
  return planVigentePorClave(n === 'premium' ? 'premium' : 'clinica')
}

export const POR_QUE_LA_CAJA_LEE_EL_MISMO_CATALOGO =
  'Un ajuste que no llega al cobro ni a la entrega no es un ajuste: es un ' +
  'letrero. Y se rompe de la peor forma — nadie ve un error, simplemente el ' +
  'recibo y la página de precios dicen cosas distintas, y el que lo nota es el ' +
  'cliente.'
