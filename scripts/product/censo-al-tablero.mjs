#!/usr/bin/env node
/**
 * EL TABLERO ENSEÑA LAS METAS — escribe en el tablero el bloque derivado del censo.
 *
 * Uso:  npx tsx scripts/product/censo-al-tablero.mjs [--comprobar]
 *
 * Sin argumentos reescribe el bloque marcado de
 * `docs/product/AUSCULTA-MASTER-BOARD.md`. Con `--comprobar` no escribe: sale
 * con código 1 si el tablero está atrasado, que es lo que hace útil correrlo
 * en una compuerta sin arriesgarse a que modifique el árbol.
 *
 * Por qué existe: `src/lib/programa/requisitos.ts`, sección EL CENSO DICHO EN PROSA.
 * Regla del repositorio que lo obliga: lo derivable se deriva (REG-241).
 *
 * Se corre con `tsx` porque el censo es TypeScript. El GUARDIÁN no depende de
 * tsx —vitest importa el .ts directamente—, así que CI no necesita esta
 * herramienta: la necesita quien regenera.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { bloqueDelCenso, MARCA_INICIO, MARCA_FIN } from '../../src/lib/programa/requisitos.ts'

const TABLERO = 'docs/product/AUSCULTA-MASTER-BOARD.md'
const comprobar = process.argv.includes('--comprobar')

const actual = readFileSync(TABLERO, 'utf8')
const bloque = bloqueDelCenso()

const i = actual.indexOf(MARCA_INICIO)
const f = actual.indexOf(MARCA_FIN)

let siguiente
if (i === -1 || f === -1) {
  // Primera vez: el bloque se añade al final, sin tocar una línea de la prosa
  // que escribe el otro carril. La superficie de conflicto es una sola.
  siguiente = actual.trimEnd() + '\n\n' + bloque + '\n'
} else {
  siguiente = actual.slice(0, i) + bloque + actual.slice(f + MARCA_FIN.length)
}

if (siguiente === actual) {
  console.log('El tablero ya está al día con el censo.')
  process.exit(0)
}

if (comprobar) {
  console.error(`::error::EL_TABLERO_NO_ENSENA_EL_CENSO — corre: npx tsx scripts/product/censo-al-tablero.mjs`)
  process.exit(1)
}

writeFileSync(TABLERO, siguiente)
console.log(`Actualizado ${TABLERO} con el bloque derivado del censo.`)
