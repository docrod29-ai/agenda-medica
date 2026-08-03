/**
 * Genera `public/version.txt` a partir de `public/sw.js`.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `ServiceWorkerRegister` comprobaba si el navegador tenía una versión vieja
 * descargando **`/sw.js` entero**, con `cache: 'no-store'`, en **cada carga de
 * página** — sólo para leer `nexusmed-v(\d+)`.
 *
 * Ese archivo llegó a pesar **276 KB** porque la bitácora de cada versión se iba
 * acumulando en un comentario de la línea 8. Un cuarto de megabyte de egreso por
 * visita, por usuario, para averiguar una cifra de tres dígitos.
 *
 * ── POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO ─────────────────────────────────
 *
 * Dos sitios donde escribir la versión son dos sitios que se desincronizan, y
 * ésta gobierna la purga de caché: si `version.txt` dijera una cosa y `sw.js`
 * otra, el navegador purgaría en bucle o no purgaría nunca. La fuente de verdad
 * sigue siendo `sw.js`; esto sólo la copia.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')
const sw = readFileSync(resolve(RAIZ, 'public/sw.js'), 'utf8')
const m = sw.match(/nexusmed-v\d+/)

if (!m) {
  // Fallar aquí es correcto: sin versión, la purga de caché deja de funcionar y
  // los médicos se quedarían con la aplicación vieja sin que nadie se entere.
  console.error('[version-sw] no se encontró `nexusmed-vNNN` en public/sw.js')
  process.exit(1)
}

writeFileSync(resolve(RAIZ, 'public/version.txt'), m[0] + '\n', 'utf8')
console.log(`[version-sw] public/version.txt → ${m[0]}`)
