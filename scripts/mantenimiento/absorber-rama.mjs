#!/usr/bin/env node
/**
 * ABSORBER UNA RAMA DE OTRA RUTINA SIN PERDER NI DUPLICAR NADA.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El 9-ago-2026 quedaron **34 ramas** de rutinas autónomas con código clínico
 * sin fusionar. Todas nacieron de puntos distintos de `main` y todas chocan en
 * los mismos cuatro sitios de CONTABILIDAD:
 *
 *   · `public/sw.js` y `public/version.txt` — la versión, que siempre es la mía
 *   · `src/lib/clinical/invariantes-clinicos.json` — el sello, que es UNIÓN
 *   · `docs/audit/regression-ledger.md` — el registro, que es UNIÓN
 *   · `src/lib/calidad/familias-de-defecto.ts` — la clasificación, UNIÓN
 *
 * Y todas traen un **número de REG ya ocupado**, porque cada rutina numeró
 * contra el `main` que veía. Resolver eso 34 veces a ojo es cómo se cuela un
 * error; peor, es cómo se pierde una reparación clínica entera — que es
 * exactamente lo que pasó con REG-264 (ver REG-267).
 *
 * ── LO QUE HACE, Y LO QUE DELIBERADAMENTE NO ────────────────────────────────
 *
 * Resuelve la contabilidad y **para**. No fusiona el código: si un fichero de
 * `src/` que no sea el sello queda en conflicto, se planta y lo dice. Un
 * conflicto en lógica clínica lo mira una persona, no un script.
 *
 * Tampoco decide el número nuevo: lo calcula como «el primero libre» y lo
 * IMPRIME, para que quien lo ejecuta lo vea antes de que se escriba en un
 * documento que se enseña.
 *
 * Uso:  node scripts/mantenimiento/absorber-rama.mjs <rama>
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const leer = (p) => readFileSync(p, 'utf8')

const rama = process.argv[2]
if (!rama) { console.error('  Falta la rama.'); process.exit(2) }

/** Los REG que un ledger declara, leyendo la línea ENTERA del encabezado. */
const regsDe = (texto) => new Set(
  (texto.match(/^## REG-.*$/gm) || [])
    .flatMap(l => [...l.matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))),
)

/* ── 1. Los ficheros de contabilidad, que se resuelven solos ─────────────── */

const MIOS = ['public/sw.js', 'public/version.txt']
const UNION = ['src/lib/clinical/invariantes-clinicos.json']

const enConflicto = sh('git diff --name-only --diff-filter=U').split('\n').filter(Boolean)

/**
 * Cualquier conflicto en `src/` que NO sea el sello es lógica: se para.
 *
 * Ésta es la línea que impide que este script se convierta en el problema que
 * intenta resolver.
 */
const logica = enConflicto.filter(f => f.startsWith('src/') && !UNION.includes(f))
if (logica.length) {
  console.error('\n  CONFLICTO EN LÓGICA — esto no lo resuelve un script:\n')
  for (const f of logica) console.error(`     · ${f}`)
  console.error('\n  Míralo a mano. `git merge --abort` deja todo como estaba.\n')
  process.exit(1)
}

for (const f of enConflicto) {
  if (MIOS.includes(f)) { sh(`git checkout --ours ${f} && git add ${f}`); continue }
  if (UNION.includes(f)) continue          // se trata abajo
  sh(`git checkout --ours ${f} && git add ${f}`)   // ledger, familias, tableros
}

/* ── 2. El sello: UNIÓN, y sólo de ficheros que existan ──────────────────── */

if (existsSync('src/lib/clinical/invariantes-clinicos.json')) {
  sh('git checkout --ours src/lib/clinical/invariantes-clinicos.json')
  const mio = JSON.parse(leer('src/lib/clinical/invariantes-clinicos.json'))
  const suyo = JSON.parse(sh(`git show ${rama}:src/lib/clinical/invariantes-clinicos.json`))
  const tengo = new Set(mio.archivos.map(a => a.archivo))
  /**
   * `existsSync` no sobra: un sello puede nombrar un fichero que se fue con su
   * rama, y entonces la compuerta clínica protegería el vacío (REG-267).
   */
  const nuevos = suyo.archivos.filter(a => !tengo.has(a.archivo) && existsSync(a.archivo))
  mio.archivos.push(...nuevos)
  mio.totalCasos = mio.archivos.reduce((s, a) => s + a.minCasos, 0)
  writeFileSync('src/lib/clinical/invariantes-clinicos.json', JSON.stringify(mio, null, 2) + '\n')
  sh('git add src/lib/clinical/invariantes-clinicos.json')
  console.log(`  sello  +${nuevos.length}: ${nuevos.map(a => a.archivo.split('/').pop()).join(', ') || '—'}`)
}

/* ── 3. El número: cuál trae la rama, y cuál está libre ──────────────────── */

const mios = regsDe(leer('docs/audit/regression-ledger.md'))
const suyos = regsDe(sh(`git show ${rama}:docs/audit/regression-ledger.md`))
const chocan = [...suyos].filter(n => !mios.has(n)).length === 0
  ? []
  : [...suyos].filter(n => !mios.has(n))

let libre = Math.max(...mios) + 1
console.log(`\n  REG de la rama que YO no tengo: ${chocan.join(', ') || 'ninguno'}`)
console.log(`  primer número libre: REG-${libre}`)
console.log(`\n  Falta a mano: la entrada del ledger, su familia y el sello del`)
console.log(`  fichero de pruebas. El código ya está fusionado.\n`)
