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

/**
 * ANTES DE COMPARAR: ¿ES `origin/main` EL `main` DE VERDAD?
 *
 * Este guion compara contra la copia LOCAL de `origin/main`. Si nadie ha hecho
 * `fetch` desde hace rato, esa copia es de otro día y todo lo que diga el guion
 * es de otro día — sin avisar.
 *
 * Pasó exactamente eso: informó «Fusión contra main: LIMPIA» varias veces
 * seguidas mientras `main` ya había avanzado (entró el #406) y el PR estaba
 * `dirty` en GitHub con doce trozos en conflicto. Un guion que existe para
 * medir conflictos y no ve los que hay es peor que no tenerlo.
 *
 * Se pregunta al remoto por el SHA real. Si no coincide, se para: el número
 * correcto se saca después de un `fetch`, no antes.
 */
{
  const local = spawnSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).stdout.trim()
  const remoto = spawnSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8' })
  const shaRemoto = (remoto.stdout || '').split(/\s+/)[0]
  if (!shaRemoto) {
    console.error('\n  No se pudo preguntar al remoto por `main`. Sin eso, cualquier número puede ser viejo.\n')
    process.exit(2)
  }
  if (shaRemoto !== local) {
    console.error(`\n  La copia local de \`origin/main\` está ATRASADA:`)
    console.error(`    local  ${local}`)
    console.error(`    remoto ${shaRemoto}`)
    console.error('\n  Comparar así daría un número de otro día. Corre `git fetch origin main` y repite.\n')
    process.exit(2)
  }
}

/**
 * CUANDO EL OTRO CARRIL YA ENTRÓ EN `main`, ESTA CUENTA DEJA DE SIGNIFICAR ALGO.
 *
 * La resta «conflictos míos con la otra rama MENOS los que ya tenía main» sólo
 * dice algo mientras la otra rama esté FUERA de `main`. En cuanto se fusiona,
 * `main` la contiene, sus conflictos con ella bajan a cero, y **todos** los
 * míos pasan a contarse como «añadidos por este carril» — quince, veinticuatro,
 * el número que sea. Ninguno lo añadí yo: lo que pasa es que esta rama todavía
 * no se ha puesto encima del `main` nuevo.
 *
 * Se detecta y se dice. El número honesto en ese momento es el de abajo, el de
 * los conflictos contra `main`.
 */
const yaEnMain = (rama) =>
  spawnSync('git', ['merge-base', '--is-ancestor', rama, 'origin/main']).status === 0

let anadidosTotal = 0
let algunaYaEntro = false
for (const otra of otras) {
  const mios = conflictos('HEAD', otra)
  if (yaEnMain(otra)) {
    algunaYaEntro = true
    console.log(`\n  ${otra}`)
    console.log(`    YA ESTÁ EN main. La cuenta de «añadidos» no aplica: main la contiene,`)
    console.log(`    así que sus conflictos con ella son 0 y todos los de esta rama parecerían míos.`)
    console.log(`    Conflictos de esta rama con ella: ${mios.length} — mírese contra main, abajo.`)
    continue
  }
  const pre = conflictos('origin/main', otra)
  const anadidos = mios.filter(f => !pre.includes(f))
  anadidosTotal += anadidos.length
  console.log(`\n  ${otra}`)
  console.log(`    preexistentes con main: ${pre.length} · con esta rama: ${mios.length} · AÑADIDOS: ${anadidos.length}`)
  anadidos.forEach(f => console.log(`      + ${f}`))
}

const contraMain = conflictos('origin/main', 'HEAD')
console.log(`\n  Fusión contra main: ${contraMain.length === 0 ? 'LIMPIA' : contraMain.length + ' conflictos'}`)
contraMain.forEach(f => console.log(`      · ${f}`))

if (algunaYaEntro) {
  console.log(`\n  CROSS_LANE_CONFLICT: la cuenta de «añadidos» ya no aplica —el otro carril entró`)
  console.log(`  en main—. Lo que hay que mirar son los ${contraMain.length} conflictos contra main de aquí arriba.\n`)
} else {
  console.log(`\n  CROSS_LANE_CONFLICT añadidos por este carril: ${anadidosTotal}\n`)
}
