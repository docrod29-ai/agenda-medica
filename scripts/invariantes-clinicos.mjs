#!/usr/bin/env node
/**
 * Runner del job `clinical-safety` (unidad Nexus OS E0-11).
 *
 * Escribe en stdout, separadas por espacio, las rutas de los archivos de test
 * que son INVARIANTES protegidos, para que el CI pueda hacer:
 *
 *   npx vitest run src/__tests__/clinical-safety-gate.test.ts $(node scripts/invariantes-clinicos.mjs)
 *
 * POR QUÉ LEE EL JSON Y NO EL .ts: este script corre con `node` pelado en el
 * workflow, sin transpilar TypeScript. El sello ya es la lista derivada y
 * `clinical-safety-gate.test.ts` (que corre en el mismo comando) es quien
 * verifica que el sello siga sincronizado con el registro y con el ledger.
 * `scripts/` está excluido de tsconfig.json, así que esto no entra al typecheck.
 *
 * Si un archivo del sello no existe, se emite igual: vitest sale con código ≠0
 * ante una ruta inexistente, y ese rojo es exactamente el que se busca.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sello = JSON.parse(readFileSync(resolve(RAIZ, 'src/lib/clinical/invariantes-clinicos.json'), 'utf8'))

const rutas = sello.archivos.map((a) => a.archivo)
if (rutas.length === 0) {
  // Un sello vacío haría que el job corriera cero tests y pasara en verde:
  // fail-closed antes que dar una falsa sensación de protección.
  console.error('[E0-11] El sello de invariantes está vacío. El gate no protegería nada.')
  process.exit(1)
}
process.stdout.write(rutas.join(' '))
