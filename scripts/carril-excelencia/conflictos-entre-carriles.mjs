#!/usr/bin/env node
/**
 * ¿CUÁNTOS CONFLICTOS AÑADE ESTE CARRIL AL OTRO?
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El encargo pide mantener `CROSS_LANE_CONFLICT = none`. La
 * `CERTIFICACION-FINAL.md` lo afirmó a mano en su día —y era cierto entonces—
 * y catorce commits después **había dejado de serlo sin que nada avisara**. Un
 * número escrito a mano envejece en silencio; medido no.
 *
 * ── QUÉ CUENTA, Y POR QUÉ ASÍ ───────────────────────────────────────────────
 *
 * No basta con contar los conflictos de esta rama contra la otra: **muchos ya
 * existen entre `main` y la otra rama**, y no son de nadie que trabaje aquí. Lo
 * que importa es la RESTA — los que este carril añade.
 *
 * Se compara contra **todas** las ramas vivas del otro carril, porque el número
 * depende de cuál se mire y quedarse con la más favorable sería elegir la
 * respuesta.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No resuelve nada. Las dos ramas están en vuelo y traer la del otro carril
 * sería meterse en su trabajo. Esto informa; fusionar lo decide el dueño.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   node scripts/carril-excelencia/conflictos-entre-carriles.mjs
 */
import { execSync, spawnSync } from 'node:child_process'

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/**
 * `git merge-tree --write-tree` SALE CON CÓDIGO ≠ 0 CUANDO HAY CONFLICTOS.
 *
 * La primera versión de este guion usaba `execSync` dentro de un `try/catch`:
 * al haber conflictos, `execSync` lanzaba, el `catch` devolvía `[]` y el guion
 * informaba **cero conflictos en todo**. O sea: el instrumento escrito para
 * cazar un cero falso escrito a mano producía un cero falso propio. Se cazó
 * porque los números de la medición manual estaban al lado.
 *
 * `spawnSync` no lanza: devuelve la salida y el código, y aquí el código ≠ 0 es
 * **información**, no un fallo.
 */
const conflictos = (a, b) => {
  const r = spawnSync('git', ['merge-tree', '--write-tree', a, b], { encoding: 'utf8' })
  const salida = (r.stdout || '')
  if (r.error) {
    console.error(`  No se pudo comparar ${a} con ${b}: ${r.error.message}`)
    process.exit(2)
  }
  return salida.split('\n').filter(l => l.startsWith('CONFLICT'))
    .map(l => l.replace(/.*in /, '').trim()).sort()
}

const otras = sh('git branch -r')
  .split('\n').map(s => s.trim())
  .filter(s => /master-completion/.test(s))

if (!otras.length) {
  console.error('  No se encontró ninguna rama del otro carril. Sin comparación no hay número.')
  process.exit(2)
}

let anadidosTotal = 0
for (const otra of otras) {
  const pre = conflictos('origin/main', otra)
  const mios = conflictos('HEAD', otra)
  const anadidos = mios.filter(f => !pre.includes(f))
  anadidosTotal += anadidos.length
  console.log(`\n  ${otra}`)
  console.log(`    preexistentes con main: ${pre.length} · con esta rama: ${mios.length} · AÑADIDOS: ${anadidos.length}`)
  anadidos.forEach(f => console.log(`      + ${f}`))
}

const contraMain = conflictos('origin/main', 'HEAD')
console.log(`\n  Fusión contra main: ${contraMain.length === 0 ? 'LIMPIA' : contraMain.length + ' conflictos'}`)
contraMain.forEach(f => console.log(`      · ${f}`))

console.log(`\n  CROSS_LANE_CONFLICT añadidos por este carril: ${anadidosTotal}\n`)
