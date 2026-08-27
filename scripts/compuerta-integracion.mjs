/**
 * COMPUERTA DE INTEGRACIÓN — un solo push, y verde.
 *
 * ── EL DÍA QUE ESTO NACIÓ (27-ago-2026) ──────────────────────────────────────
 *
 * Cuatro lotes de trabajo se integraron con merges remotos consecutivos:
 *
 *     06:38  1d9a55f3  integrate: Patient Experience, WhatsApp and waitlist…  ROJO
 *     06:39  ffc21823  integrate: H-01 physician prescription authority       verde
 *     06:41  fa346c4b  integrate: H-03–H-07 consultation recovery safeguards  verde
 *     06:43  47e2a01d  reconcile: assign unique REG-323–REG-330               verde
 *
 * Cada push disparó un Preview sobre un estado que nadie había construido.
 * `1d9a55f3` no compilaba:
 *
 *     src/lib/firestore.ts(246,14): error TS2304: Cannot find name 'idIdempotente'
 *     src/lib/firestore.ts(246,54): error TS2304: Cannot find name 'claveDeEspera'
 *     src/lib/firestore.ts(249,9):  error TS2304: Cannot find name 'runTransaction'
 *
 * El merge conservó la LLAMADA de una rama y los IMPORTS de la otra. Las líneas
 * no se solapaban, así que `git` fusionó limpio y no dijo nada. **Un conflicto
 * semántico no lo caza git: lo caza el compilador.**
 *
 * Y lo que lo puso verde a las 06:39 NO fue arreglar los tres imports: fue que
 * el merge siguiente REVIRTIÓ la rama entera —`createWaitlistEntry` idempotente,
 * `lista-espera.ts`, `urgencia.ts` y cinco archivos de prueba se fueron con
 * ella—. El verde se compró tirando el trabajo, y nadie lo vio porque el
 * semáforo sólo mira el último commit.
 *
 * De ahí las dos reglas que esta compuerta impone:
 *
 *   1. **El estado intermedio no se publica.** Se integra en local, se verifica
 *      entero, y se empuja UNA vez. Vercel no debe ver un árbol que nadie miró.
 *   2. **Lo que se declaró integrado tiene que estar.** No basta con que el
 *      commit sea ancestro: un merge puede tenerlo de ancestro y haber tirado su
 *      contenido. Es «el dato tiene que LLEGAR» aplicado a una integración.
 *
 * ── NO SILENCIA NADA ─────────────────────────────────────────────────────────
 *
 * Esta compuerta no toca Vercel, no desactiva Previews, no escribe
 * `ignoreCommand`, no baja ningún techo. Sólo se niega a bendecir un árbol que
 * no ha pasado por lo mismo que va a pasar en el Preview.
 *
 *   node scripts/compuerta-integracion.mjs
 *   node scripts/compuerta-integracion.mjs --manifiesto ops/integracion/<lote>.json
 *   node scripts/compuerta-integracion.mjs --rapido    # sin vitest (NO habilita push)
 */
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const args = process.argv.slice(2)
const RAPIDO = args.includes('--rapido')
const iManifiesto = args.indexOf('--manifiesto')
const MANIFIESTO = iManifiesto >= 0 ? args[iManifiesto + 1] : null

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()

const pasos = []
let rojo = false

function paso(letra, titulo, fn) {
  process.stdout.write(`\n── ${letra} · ${titulo} ${'─'.repeat(Math.max(0, 58 - titulo.length))}\n`)
  try {
    const nota = fn()
    pasos.push({ letra, titulo, estado: 'VERDE', nota: nota ?? '' })
    console.log(`   VERDE${nota ? ' — ' + nota : ''}`)
  } catch (e) {
    rojo = true
    const motivo = (e && e.message) ? e.message : String(e)
    pasos.push({ letra, titulo, estado: 'ROJO', nota: motivo })
    console.error(`   ROJO — ${motivo}`)
  }
}

const correr = (cmd) => execSync(cmd, { stdio: 'inherit' })

// ── A · rama de integración local ───────────────────────────────────────────
paso('A', 'rama de integración local', () => {
  const rama = git('rev-parse', '--abbrev-ref', 'HEAD')
  if (rama === 'HEAD') throw new Error('HEAD desacoplado: una integración se hace sobre una rama con nombre')
  if (rama === 'main') throw new Error('esto es `main`. Integrar sobre main es exactamente lo que la compuerta impide')

  const sucio = git('status', '--porcelain')
  if (sucio) throw new Error(`el árbol tiene ${sucio.split('\n').length} cambio(s) sin commitear; se integra lo que está commiteado`)

  // Estados intermedios ya publicados: no es un fallo del árbol de hoy, pero es
  // LA causa del incidente, así que se dice en voz alta.
  let publicados = 0
  try {
    const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
    publicados = Number(git('rev-list', '--count', `${upstream}..HEAD`))
    if (publicados === 0) console.log(`   nota: ${upstream} ya está a la altura de HEAD`)
    else console.log(`   nota: ${publicados} commit(s) por publicar sobre ${upstream} — deben irse en UN push`)
  } catch {
    console.log('   nota: la rama aún no existe en el remoto — es el caso ideal, un solo push al final')
  }
  return `rama ${rama}, árbol limpio`
})

// ── B · todo lo previsto, aplicado ──────────────────────────────────────────
paso('B', 'todo lo previsto está aplicado', () => {
  if (!MANIFIESTO) return 'sin manifiesto de lote: no se puede comprobar (declarado, no asumido)'
  if (!existsSync(MANIFIESTO)) throw new Error(`no existe ${MANIFIESTO}`)
  const m = JSON.parse(readFileSync(MANIFIESTO, 'utf8'))

  const faltan = []
  for (const c of (m.commits ?? [])) {
    const sha = typeof c === 'string' ? c : c.sha
    try { git('merge-base', '--is-ancestor', sha, 'HEAD') }
    catch { faltan.push(`${sha} no es ancestro de HEAD`) }
  }

  // El ancestro NO basta: `1d9a55f3` tenía de ancestro la rama cuyo contenido
  // acababa de romper, y `ffc21823` la revirtió entera conservando la ancestría.
  // Por eso el manifiesto puede exigir SÍMBOLOS que deben seguir vivos.
  for (const s of (m.simbolos_que_deben_seguir_vivos ?? [])) {
    const salida = execSync(
      `git grep -l ${JSON.stringify(s.simbolo)} -- ${JSON.stringify(s.archivo)} || true`,
      { encoding: 'utf8' }
    ).trim()
    if (!salida) faltan.push(`el símbolo '${s.simbolo}' ya no está en ${s.archivo} — la integración lo perdió`)
  }

  if (faltan.length) throw new Error('la integración NO llegó entera:\n     · ' + faltan.join('\n     · '))
  return `${(m.commits ?? []).length} commit(s) y ${(m.simbolos_que_deben_seguir_vivos ?? []).length} símbolo(s) verificados`
})

// ── C · conflictos resueltos DE VERDAD ──────────────────────────────────────
paso('C', 'sin conflictos ni marcadores', () => {
  const sinFusionar = git('diff', '--name-only', '--diff-filter=U')
  if (sinFusionar) throw new Error(`rutas sin fusionar:\n     · ${sinFusionar.split('\n').join('\n     · ')}`)

  // Los marcadores se buscan al principio de línea y con longitud exacta: `git
  // grep` sobre el árbol versionado, para no leer node_modules ni .next.
  const marcadores = execSync(
    String.raw`git grep -nE '^(<{7}|={7}|>{7})( |$)' -- 'src' 'scripts' 'docs' '*.ts' '*.tsx' '*.mjs' '*.json' || true`,
    { encoding: 'utf8' }
  ).trim()
  if (marcadores) throw new Error(`marcadores de conflicto vivos:\n     · ${marcadores.split('\n').slice(0, 10).join('\n     · ')}`)
  return 'sin rutas sin fusionar, sin marcadores'
})

// ── D · derivados regenerados ───────────────────────────────────────────────
paso('D', 'derivados regenerados', () => {
  correr('npm run version-sw')
  const sucio = git('status', '--porcelain')
  if (sucio) {
    throw new Error(
      'regenerar los derivados cambió el árbol; commitea el resultado y vuelve a pasar:\n     · ' +
      sucio.split('\n').join('\n     · ')
    )
  }
  return 'version.txt del service worker al día'
})

// ── E · tipos, pruebas, lint, blancos ───────────────────────────────────────
paso('E', 'tsc --noEmit', () => {
  // PRIMERO, y aparte de `next build`: tsc typechequea TAMBIÉN las pruebas, que
  // Next no mira. REG-326 documenta un tsc rojo que el build no veía.
  correr('npx tsc --noEmit')
  return 'cero errores de tipo, pruebas incluidas'
})

paso('E', 'vitest', () => {
  if (RAPIDO) throw new Error('saltado por --rapido: la compuerta NO habilita el push')
  correr('npx vitest run')
  return 'suite entera en verde'
})

paso('E', 'trinquete de lint', () => {
  correr('node scripts/lint-trinquete.mjs')
  return 'el techo no sube'
})

paso('E', 'git diff --check', () => {
  correr('git --no-pager diff --check HEAD')
  return 'sin blancos rotos ni marcadores'
})

// ── F · el build que de verdad importa ──────────────────────────────────────
paso('F', 'build equivalente al Preview de Vercel', () => {
  // Es el ÚNICO build de la compuerta, a propósito. Tener además un `npm run
  // build` a secas invitaría a creer que su verde vale lo mismo, y ese es
  // justamente el desnivel que nos costó el Preview rojo.
  correr('node scripts/preview-equivalente.mjs')
  return 'compila sin heredar entorno local'
})

// ── G · el veredicto ────────────────────────────────────────────────────────
console.log('\n\n══ COMPUERTA DE INTEGRACIÓN ═════════════════════════════════════')
for (const p of pasos) console.log(`  ${p.estado === 'VERDE' ? '·' : '✗'} ${p.letra} · ${p.titulo}: ${p.estado}`)
console.log('═════════════════════════════════════════════════════════════════')

if (rojo) {
  console.error('\nROJO. Este árbol NO se empuja: publicarlo es publicar un Preview rojo.')
  console.error('Arregla lo de arriba y vuelve a pasar la compuerta ENTERA.\n')
  process.exit(1)
}

if (RAPIDO) {
  console.error('\n--rapido: la compuerta no ha corrido entera, así que no autoriza ningún push.\n')
  process.exit(1)
}

const rama = git('rev-parse', '--abbrev-ref', 'HEAD')
console.log('\nVERDE. G · un solo push, del checkpoint íntegro:\n')
console.log(`    git push -u origin ${rama}\n`)
console.log('Un push por integración. Si hace falta un segundo, es que había un')
console.log('estado intermedio — y ese es el que rompe Previews.\n')
