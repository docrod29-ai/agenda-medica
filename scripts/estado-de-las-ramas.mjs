/**
 * QUÉ ESTÁN HACIENDO LAS OTRAS RAMAS — se corre ANTES de elegir en qué trabajar.
 *
 * ── POR QUÉ EXISTE (8-ago-2026, T-1) ─────────────────────────────────────────
 *
 * El bucle autónomo arranca de `main` en cada disparo. Desde `main`, el ítem de
 * mayor score y el siguiente REG libre son **siempre los mismos** mientras nada
 * se fusione, así que cada disparo elige lo mismo, le pone el mismo número y
 * abre una rama nueva. Ninguno ve el trabajo de los otros.
 *
 * El resultado, medido hoy: **22 PRs abiertos, catorce titulados «REG-192 …
 * (v1074)»** sobre reparaciones distintas, y dos «REG-194 … (v1076)». El número
 * de regresión y la versión del service worker existen para **acotar un lote de
 * notas clínicas** cuando algo sale mal; repetidos sobre cambios distintos ya no
 * acotan nada — que es justo lo que REG-191 acababa de reparar para IEC 62304.
 *
 * Fusionar o cerrar es del dueño (T-1). Mirar antes de elegir, no.
 *
 * ── QUÉ CONTESTA ─────────────────────────────────────────────────────────────
 *
 *   1. Cuál es el siguiente REG libre **de verdad** — el máximo sobre `main` Y
 *      sobre todas las ramas vivas, no sobre `main` solo.
 *   2. Lo mismo para la versión del service worker.
 *   3. Qué ramas tocan cada módulo, para no reimplementar lo ya resuelto: la
 *      comprobación que faltaba se hacía al fallar el `git push`, cuando el
 *      trabajo ya estaba hecho.
 *
 * NO decide nada ni escribe nada. Sólo lee refs y las imprime.
 *
 *   node scripts/estado-de-las-ramas.mjs
 *   node scripts/estado-de-las-ramas.mjs negaciones.ts   # y quién la toca
 */
import { execFileSync } from 'node:child_process'

const git = (...args) => {
  try {
    // `stderr` ignorado: una rama vieja sin el ledger hace ruido y no es un fallo.
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    // Una rama sin ese archivo no es un error: es información («no lo toca»).
    return ''
  }
}

const ramas = git('branch', '-r', '--format=%(refname:short)')
  .split('\n')
  .map(r => r.trim())
  .filter(r => r && !r.includes('->'))

const maxDe = (texto, re) => {
  const n = [...texto.matchAll(re)].map(m => Number(m[1]))
  return n.length ? Math.max(...n) : 0
}

const filas = ramas.map(rama => ({
  rama,
  reg: maxDe(git('show', `${rama}:docs/audit/regression-ledger.md`), /^## REG-(\d+)/gm),
  sw: maxDe(git('show', `${rama}:public/version.txt`), /nexusmed-v(\d+)/g),
}))

const maxReg = Math.max(0, ...filas.map(f => f.reg))
const maxSw = Math.max(0, ...filas.map(f => f.sw))
const enMain = filas.find(f => f.rama === 'origin/main') ?? { reg: 0, sw: 0 }

console.log(`\n  Ramas vivas: ${filas.length}\n`)
console.log(`  REG en main: ${enMain.reg}   ·  REG en alguna rama: ${maxReg}`)
console.log(`  sw  en main: ${enMain.sw}   ·  sw  en alguna rama: ${maxSw}\n`)
console.log(`  SIGUIENTE LIBRE →  REG-${maxReg + 1}  ·  nexusmed-v${maxSw + 1}\n`)

if (maxReg > enMain.reg) {
  const pendientes = maxReg - enMain.reg
  console.log(
    `  ⚠  Hay ${pendientes} número(s) de regresión gastados en ramas sin fusionar.\n`
    + `     Tomarlos de main los repetiría, y un REG repetido deja de acotar el\n`
    + `     lote de notas afectado (T-1 en agent-state/OWNER_DECISIONS_REQUIRED.md).\n`,
  )
}

/**
 * Segundo modo: quién toca este archivo. Es la pregunta que evita reimplementar
 * lo que otra rama ya resolvió — que es lo que pasó el 7 y el 8 de agosto.
 */
const objetivo = process.argv[2]
if (objetivo) {
  console.log(`  Ramas que tocan «${objetivo}» respecto a main:\n`)
  let ninguna = true
  for (const { rama } of filas) {
    if (rama === 'origin/main') continue
    const tocados = git('diff', '--name-only', 'origin/main', rama)
    const hit = tocados.split('\n').filter(l => l.includes(objetivo))
    if (!hit.length) continue
    ninguna = false
    const asunto = git('log', '-1', '--format=%s', rama).trim()
    console.log(`    ${rama}\n      ${asunto}\n      ${hit.join('\n      ')}\n`)
  }
  if (ninguna) console.log('    ninguna.\n')
}
