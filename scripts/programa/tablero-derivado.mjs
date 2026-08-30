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

/** Mete o sustituye el bloque en el tablero. */
export function aplicar(texto = readFileSync(TABLERO, 'utf8'), bloque = generar()) {
  const i = texto.indexOf(INICIO)
  const j = texto.indexOf(FIN)
  if (i >= 0 && j > i) return texto.slice(0, i) + bloque + texto.slice(j + FIN.length)
  /* La primera vez va justo después del encabezado, antes de la prosa. */
  const trasTitulo = texto.indexOf('\n## ')
  return texto.slice(0, trasTitulo) + '\n\n' + bloque + '\n' + texto.slice(trasTitulo)
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
