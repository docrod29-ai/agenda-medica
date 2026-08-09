#!/usr/bin/env node
/**
 * EL TABLERO DEL LOOP SE DERIVA, NO SE RECUERDA — REG-241.
 *
 * ── EL PROBLEMA, EN PALABRAS DEL PROPIO TABLERO ─────────────────────────────
 *
 * `agent-state/MASTER_STATE.json` decía v1030 cuando producción iba en v1079.
 * Se puso al día. Volvió a decir v1084 con producción en v1096. Se puso al día.
 * Volvió a decir v1096 con producción en v1121.
 *
 * El archivo mismo ya había escrito el diagnóstico correcto:
 *
 *   «La causa no es descuido: es que actualizarlo depende de que yo me acuerde.
 *    Mientras no lo derive un script, va a volver a pasar.»
 *
 * Y volvió a pasar. Tres veces.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * El charter V7 §3.3 y §26 piden que el programa sea **reanudable**: que si se
 * acaba el crédito o se cae la sesión, se retome donde se quedó. El dueño lo
 * pidió con esas palabras: «si se acaban los tokens guarda el avance y cuando
 * te ponga 1 sigue donde te quedaste».
 *
 * Un tablero que miente rompe exactamente eso. Un tablero que dice v1096
 * cuando hay v1121 hace que la siguiente sesión reconstruya trabajo ya hecho —
 * o peor, que lo dé por pendiente y lo pise.
 *
 * ── LO QUE HACE ─────────────────────────────────────────────────────────────
 *
 * Lee la VERDAD del repositorio —no la memoria de nadie— y reescribe los campos
 * derivables:
 *
 *   · versión desplegada  ← public/version.txt
 *   · REG cerradas        ← docs/audit/regression-ledger.md
 *   · nº de pruebas       ← el conteo de `it(`/`test(` del árbol de pruebas
 *   · rama activa         ← git
 *   · trabajo sin subir   ← git status
 *   · actualizado         ← la fecha que se le pase (o la del último commit)
 *
 * Lo que NO deriva —la iteración en curso, los bloqueos, las decisiones del
 * dueño— lo deja intacto: eso es criterio, y el criterio no se deriva de un
 * `grep`.
 *
 * Uso:  node scripts/agent-state/actualizar.mjs
 *       node scripts/agent-state/actualizar.mjs --verificar   (sólo comprueba)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ESTADO = join(RAIZ, 'agent-state', 'MASTER_STATE.json')

const sh = (cmd) => {
  try { return execSync(cmd, { cwd: RAIZ, encoding: 'utf8' }).trim() } catch { return '' }
}

/** La versión que está DESPLEGADA, según el archivo que sirve producción. */
function versionEnDisco() {
  try { return readFileSync(join(RAIZ, 'public', 'version.txt'), 'utf8').trim() } catch { return null }
}

/**
 * Todos los REG del ledger, por número.
 *
 * OJO con las cabeceras COMBINADAS: existe `## REG-179 / REG-180` porque las
 * dos salieron del mismo recuadro naranja. Un regex que sólo mire el primer
 * número **pierde el segundo** — y así fue como este mismo script informó de
 * 88 REG cuando eran 89, y de un REG-180 «clasificado pero inexistente».
 *
 * Se leen TODOS los `REG-\d+` de la línea del encabezado.
 */
function regsDelLedger() {
  const t = readFileSync(join(RAIZ, 'docs', 'audit', 'regression-ledger.md'), 'utf8')
  const nums = [...t.matchAll(/^##[^\n]*/gm)]
    .flatMap(l => [...l[0].matchAll(/REG-(\d+)/g)].map(m => Number(m[1])))
  const unicos = [...new Set(nums)]
  return { total: unicos.length, ultima: unicos.length ? Math.max(...unicos) : null }
}

/**
 * Cuenta casos de prueba con el MISMO regex que usa el sello clínico.
 *
 * Usar dos formas de contar daría dos cifras distintas para lo mismo, y la
 * primera vez que no cuadraran nadie sabría cuál creer.
 */
const RE_CASO = /^\s*(?:it|test)(?:\.each\([^)]*\))?\s*[(`]/gm
function contarPruebas(dir = join(RAIZ, 'src'), acc = { archivos: 0, casos: 0 }) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) contarPruebas(p, acc)
    else if (/\.test\.tsx?$/.test(e)) {
      acc.archivos++
      acc.casos += (readFileSync(p, 'utf8').match(RE_CASO) ?? []).length
    }
  }
  return acc
}

function derivar() {
  const pruebas = contarPruebas()
  const reg = regsDelLedger()
  return {
    ultimaVersionEnProduccion: versionEnDisco(),
    ramaActual: sh('git rev-parse --abbrev-ref HEAD') || null,
    trabajoLocalSinSubir: sh('git status --porcelain').split('\n').filter(Boolean).slice(0, 20),
    /** Fecha del último commit: no se inventa «hoy», se lee del repositorio. */
    actualizado: (sh('git log -1 --format=%cs') || '').trim() || null,
    derivado: {
      regsEnElLedger: reg.total,
      ultimaREG: reg.ultima ? `REG-${reg.ultima}` : null,
      archivosDePrueba: pruebas.archivos,
      casosDePrueba: pruebas.casos,
      /** El techo del trinquete vive en su propio script; aquí sólo se apunta. */
      lint: 'ver scripts/lint-trinquete.mjs',
    },
  }
}

const soloVerificar = process.argv.includes('--verificar')
const actual = JSON.parse(readFileSync(ESTADO, 'utf8'))
const nuevo = derivar()

const desfasado =
  actual.ultimaVersionEnProduccion !== nuevo.ultimaVersionEnProduccion ||
  actual.derivado?.ultimaREG !== nuevo.derivado.ultimaREG

if (soloVerificar) {
  if (desfasado) {
    console.error(
      `  El tablero del loop está DESFASADO.\n` +
      `     dice: ${actual.ultimaVersionEnProduccion} / ${actual.derivado?.ultimaREG ?? '—'}\n` +
      `      es:  ${nuevo.ultimaVersionEnProduccion} / ${nuevo.derivado.ultimaREG}\n\n` +
      `  Arréglalo con: node scripts/agent-state/actualizar.mjs\n`)
    process.exit(1)
  }
  console.log(`  Tablero al día: ${nuevo.ultimaVersionEnProduccion} · ${nuevo.derivado.ultimaREG}`)
  process.exit(0)
}

/* Se escriben SÓLO los campos derivables. La iteración en curso, los bloqueos y
   las decisiones del dueño son criterio, y el criterio no sale de un grep. */
writeFileSync(ESTADO, JSON.stringify({ ...actual, ...nuevo }, null, 2) + '\n')
console.log(
  `  Tablero derivado del repositorio:\n` +
  `     versión   ${nuevo.ultimaVersionEnProduccion}\n` +
  `     última    ${nuevo.derivado.ultimaREG}  (${nuevo.derivado.regsEnElLedger} en el ledger)\n` +
  `     pruebas   ${nuevo.derivado.casosDePrueba} en ${nuevo.derivado.archivosDePrueba} archivos\n` +
  `     rama      ${nuevo.ramaActual}\n`)
