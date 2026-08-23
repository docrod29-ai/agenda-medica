/**
 * QUÉ VERSIÓN ESTÁ CORRIENDO — porque sin ella no se distingue una regresión.
 *
 * ── POR QUÉ NO VIVE EN EL KERNEL PURO ────────────────────────────────────────
 *
 * `firma.ts` recibe la versión como dato y no la busca: así se puede probar con
 * versiones inventadas y el módulo sigue siendo puro. Este archivo es el único
 * que toca el disco, y por eso está aparte.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * De `public/version.txt`, que es la misma fuente que ya usa `/api/health` y que
 * `scripts/version-sw.mjs` mantiene al día con la caché del service worker. Una
 * segunda fuente de versión —una variable de entorno, un `package.json`— se
 * desincronizaría del despliegue real, y entonces la firma diría «v1170» de algo
 * que corre en v1171.
 *
 * Sólo servidor.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esEtiqueta } from './taxonomia'

/**
 * Cuando no se puede leer.
 *
 * `desconocida` y no una cadena vacía: entra en la firma como cualquier otra
 * versión, así que un incidente con versión desconocida se agrupa aparte y se
 * NOTA. Vaciar el componente lo habría fundido con los demás en silencio.
 */
export const VERSION_DESCONOCIDA = 'desconocida'

let cache: string | null = null

/** La versión del despliegue. Se lee una vez: no cambia mientras el proceso vive. */
export function versionDeApp(): string {
  if (cache) return cache
  try {
    const v = readFileSync(join(process.cwd(), 'public', 'version.txt'), 'utf8').trim().toLowerCase()
    cache = esEtiqueta(v) ? v : VERSION_DESCONOCIDA
  } catch {
    cache = VERSION_DESCONOCIDA
  }
  return cache
}

/** SÓLO para pruebas. */
export function olvidarVersionEnCache(): void {
  cache = null
}
