#!/usr/bin/env node
/**
 * EL ESTADO DEL TABLERO SE DERIVA — WS-01, REG-416.
 *
 * ── EL DEFECTO QUE CIERRA ───────────────────────────────────────────────────
 *
 * `docs/product/AUSCULTA-MASTER-BOARD.md` es el tablero que lee una persona. Su
 * cabecera dice, con todas las letras:
 *
 *   > el estado sale del **código leído hoy**, no de la documentación ni de un
 *   > checkpoint anterior.
 *
 * Y el estado estaba escrito a mano. En el momento de escribir esto, la ficha
 * decía SHA `ba9d7a2f`, fecha 29-ago y «movimientos del 29-ago-2026», con el
 * árbol quince REG por delante. El censo del programa —`requisitos.ts`, que SÍ
 * es máquina— decía otra cosa.
 *
 * Dos respuestas a «¿en qué estado está WS-04?»: la del censo y la de la prosa.
 * Es el invariante de arquitectura del producto —una fuente de verdad por
 * entidad— incumplido sobre el propio programa, y con el agravante de que el
 * guardián `el-tablero-del-loop-no-miente` ya había escrito el diagnóstico para
 * `MASTER_STATE.json`: *«mientras no lo derive un script, va a volver a pasar»*.
 *
 * ── QUÉ SE DERIVA Y QUÉ NO ──────────────────────────────────────────────────
 *
 * Se deriva el ESTADO: cuántos requisitos hay en cada estado, cuáles siguen
 * internamente accionables, y qué desbloquea a los que están bloqueados fuera.
 * Eso sale de `requisitos.ts` y no de la memoria de nadie.
 *
 * NO se deriva el CRITERIO: qué se hace a continuación, por qué un bloqueo es
 * aceptable, qué decide el dueño. Eso se sigue escribiendo a mano, porque el
 * criterio no sale de un `grep` — es la misma línea que trazó REG-241.
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 *
 *   node scripts/programa/tablero-derivado.mjs            # escribe el bloque
 *   node scripts/programa/tablero-derivado.mjs --verificar # falla si está viejo
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const TABLERO = 'docs/product/AUSCULTA-MASTER-BOARD.md'
export const INICIO = '<!-- CENSO-DERIVADO:INICIO -->'
export const FIN = '<!-- CENSO-DERIVADO:FIN -->'

/** Estados que un humano puede cerrar sin pedirle nada a nadie. */
const INTERNAMENTE_ACCIONABLES = ['NOT_STARTED', 'PARTIAL', 'PREPARED', 'IMPLEMENTED_NOT_PROVEN']

export function censo() {
  const salida = execFileSync('npx', ['tsx', '--eval', `
    import { REQUISITOS } from './src/lib/programa/requisitos.ts'
    process.stdout.write(JSON.stringify(REQUISITOS.map(r => ({
      id: r.id, ws: r.ws, estado: r.estado,
      desbloqueaCon: r.desbloqueaCon ?? null,
    }))))
  `], { encoding: 'utf8' })
  return JSON.parse(salida)
}

export function generar(rs = censo()) {
  const porEstado = {}
  for (const r of rs) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1

  const accionables = rs.filter(r => INTERNAMENTE_ACCIONABLES.includes(r.estado))
  const bloqueados = rs.filter(r => r.estado === 'BLOCKED_EXTERNAL')

  const l = []
  l.push(INICIO)
  l.push('')
  l.push('> **Este bloque se DERIVA de `src/lib/programa/requisitos.ts`.** No se edita a')
  l.push('> mano: `node scripts/programa/tablero-derivado.mjs` lo reescribe y su guardián')
  l.push('> falla si está viejo. Lo que sigue escribiéndose a mano es el CRITERIO —qué se')
  l.push('> hace a continuación y por qué—, que no sale de un `grep`.')
  l.push('')
  l.push(`**${rs.length} requisitos.**`)
  l.push('')
  l.push('| Estado | Cuántos |')
  l.push('|---|---|')
  for (const [e, n] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
    l.push(`| \`${e}\` | ${n} |`)
  }
  l.push('')
  l.push(`### Internamente accionables — ${accionables.length}`)
  l.push('')
  l.push('Lo que se puede cerrar sin pedirle nada a nadie. Si esta lista está vacía, el')
  l.push('trabajo interno se acabó.')
  l.push('')
  l.push('| Requisito | Estado |')
  l.push('|---|---|')
  for (const r of accionables) l.push(`| \`${r.id}\` | \`${r.estado}\` |`)
  l.push('')
  l.push(`### Bloqueados fuera — ${bloqueados.length}, con lo que los desbloquea`)
  l.push('')
  l.push('| Requisito | Qué falta, y no es código |')
  l.push('|---|---|')
  for (const r of bloqueados) {
    const q = (r.desbloqueaCon ?? '—').replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 220)
    l.push(`| \`${r.id}\` | ${q} |`)
  }
  l.push('')
  l.push(FIN)
  return l.join('\n')
}

export const INICIO_COMPUERTAS = '<!-- COMPUERTAS-DERIVADAS:INICIO -->'
export const FIN_COMPUERTAS = '<!-- COMPUERTAS-DERIVADAS:FIN -->'

/**
 * LAS COMPUERTAS, DERIVADAS — REG-441.
 *
 * La sección se titulaba «Compuertas medidas en este SHA — **no citadas de
 * memoria**» y citaba de memoria: decía un trinquete de 96 cuando el techo
 * llevaba días en 95, y 10 844 casos cuando el árbol tenía 12 019.
 *
 * Es la cuarta vez este mes —con REG-424, REG-428 y REG-438— que **la garantía
 * mejor explicada es la que nadie fue a comprobar**. Un título que promete no
 * citar de memoria no impide citar de memoria; un guardián sí.
 *
 * ── LO QUE SE DERIVA Y LO QUE NO ────────────────────────────────────────────
 *
 * Se derivan los TECHOS y los conteos del árbol, que se leen de un archivo.
 * **No se deriva el resultado de correr la suite**: eso exige correrla, y meter
 * una corrida de tres minutos dentro de un generador de documentación lo
 * convertiría en algo que nadie ejecuta.
 *
 * Así que el resultado sigue siendo una FOTO, y se dice que lo es, con su
 * comando al lado para que cualquiera la repita. Lo que ya no puede pasar es que
 * la foto cite un techo distinto del que el trinquete comprueba hoy.
 */
export function compuertas() {
  const leer = (r) => JSON.parse(readFileSync(r, 'utf8'))
  const techoLint = leer('docs/audit/lint-techo.json')
  const techosDiseno = leer('scripts/design/techos-de-diseno.json')
  const estado = leer('agent-state/MASTER_STATE.json')
  const sello = leer('src/lib/clinical/invariantes-clinicos.json')
  return {
    techoLint: techoLint.errores ?? null,
    casosDeclarados: estado.derivado?.casosDePrueba ?? null,
    archivosDePrueba: estado.derivado?.archivosDePrueba ?? null,
    ultimaREG: estado.derivado?.ultimaREG ?? null,
    archivosSellados: sello.archivos?.length ?? null,
    casosSellados: sello.totalCasos ?? null,
    metricasDeDiseno: Object.keys(techosDiseno.techos ?? {}).length,
  }
}

export function generarCompuertas(c = compuertas()) {
  const l = []
  l.push(INICIO_COMPUERTAS)
  l.push('')
  l.push('> **Los TECHOS de este bloque se DERIVAN.** `node scripts/programa/tablero-derivado.mjs`')
  l.push('> los reescribe y su guardián falla si están viejos. Antes de REG-441 esta sección se')
  l.push('> titulaba «no citadas de memoria» y citaba un trinquete de 96 cuando llevaba días en 95.')
  l.push('>')
  l.push('> **El RESULTADO de correr la suite no se deriva**: exige correrla, y una corrida de tres')
  l.push('> minutos dentro de un generador de documentación es algo que nadie ejecuta. Sigue siendo')
  l.push('> una foto, y por eso lleva su comando al lado.')
  l.push('')
  l.push('| Compuerta | Techo o cota derivada | Cómo se repite |')
  l.push('|---|---|---|')
  l.push(`| Trinquete de lint | **${c.techoLint}** — sólo puede bajar | \`node scripts/lint-trinquete.mjs\` |`)
  l.push(`| Casos declarados en el árbol | **${c.casosDeclarados}** en ${c.archivosDePrueba} archivos | \`node scripts/agent-state/actualizar.mjs\` |`)
  l.push(`| Sellado clínico | **${c.archivosSellados} archivos · ${c.casosSellados} casos**, no pueden encoger | \`npx vitest run src/__tests__/clinical-safety-gate.test.ts\` |`)
  l.push(`| Trinquete de diseño | ${c.metricasDeDiseno} métricas, todas al techo | \`node scripts/design/trinquete-de-diseno.mjs\` |`)
  l.push(`| Última reparación en el ledger | **${c.ultimaREG}** | \`docs/audit/regression-ledger.md\` |`)
  l.push('| Compila | `npx tsc --noEmit` · `npm run build` | con los placeholders `NEXT_PUBLIC_FIREBASE_*` |')
  l.push('| Navegador real | **no ejecutado** | ver WS-05 |')
  l.push('')
  l.push(FIN_COMPUERTAS)
  return l.join('\n')
}

/** Mete o sustituye el bloque en el tablero. */
export function aplicar(texto = readFileSync(TABLERO, 'utf8'), bloque = generar()) {
  texto = aplicarCompuertas(texto)
  const i = texto.indexOf(INICIO)
  const j = texto.indexOf(FIN)
  if (i >= 0 && j > i) return texto.slice(0, i) + bloque + texto.slice(j + FIN.length)
  /* La primera vez va justo después del encabezado, antes de la prosa. */
  const trasTitulo = texto.indexOf('\n## ')
  return texto.slice(0, trasTitulo) + '\n\n' + bloque + '\n' + texto.slice(trasTitulo)
}

/**
 * Igual que `aplicar`, para el bloque de compuertas. La primera vez se mete
 * justo debajo del encabezado de su sección, que ya existe y lleva su prosa.
 */
export function aplicarCompuertas(texto, bloque = generarCompuertas()) {
  const i = texto.indexOf(INICIO_COMPUERTAS)
  const j = texto.indexOf(FIN_COMPUERTAS)
  if (i >= 0 && j > i) return texto.slice(0, i) + bloque + texto.slice(j + FIN_COMPUERTAS.length)
  const titulo = texto.indexOf('## Compuertas medidas')
  if (titulo < 0) return texto
  const finLinea = texto.indexOf('\n', titulo)
  return texto.slice(0, finLinea + 1) + '\n' + bloque + '\n' + texto.slice(finLinea + 1)
}

if (process.argv[1]?.endsWith('tablero-derivado.mjs')) {
  const actual = readFileSync(TABLERO, 'utf8')
  const nuevo = aplicar(actual)
  if (process.argv.includes('--verificar')) {
    if (actual !== nuevo) {
      process.stderr.write('El tablero está viejo. Corre: node scripts/programa/tablero-derivado.mjs\n')
      process.exit(1)
    }
    process.stdout.write('El tablero coincide con el censo.\n')
  } else {
    writeFileSync(TABLERO, nuevo)
    process.stdout.write('Tablero actualizado desde el censo.\n')
  }
}
