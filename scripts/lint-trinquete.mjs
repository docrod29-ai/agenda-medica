/**
 * GATE DE LINT CON TRINQUETE.
 *
 * A1 de la auditoría maestra: el repo tiene 135 errores de lint, así que exigir
 * CERO haría nacer el gate en rojo — y un gate que nadie puede poner en verde se
 * marca `continue-on-error` y deja de proteger. Es exactamente lo que pasó con
 * el gate de ADRs (E0-03) hasta que se le puso trinquete.
 *
 * Así que la deuda se CONGELA y sólo puede bajar:
 *
 *   · más errores que el techo  → falla, y dice cuáles se añadieron
 *   · menos                     → falla también, pidiendo bajar el techo
 *
 * Lo segundo no es capricho: si el techo no se baja al arreglar algo, el margen
 * ganado se lo come el siguiente descuido sin que nadie se entere. Un trinquete
 * que no se aprieta es un tope.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const TECHO = 'docs/audit/lint-techo.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

let salida = ''
try {
  salida = execSync('npx eslint src -f json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (e) {
  // eslint sale con código 1 cuando hay errores: la salida sigue siendo válida.
  salida = e.stdout ?? ''
}
if (!salida.trim()) {
  console.error('El analizador no devolvió nada. Un gate que no mide no protege: se falla.')
  process.exit(1)
}

const informe = JSON.parse(salida)
const errores = informe.reduce((n, f) => n + f.errorCount, 0)
/** Por archivo, para poder decir DÓNDE se añadió el error, no sólo que subió. */
const porArchivo = Object.fromEntries(
  informe.filter(f => f.errorCount > 0)
    .map(f => [f.filePath.replace(process.cwd() + '/', ''), f.errorCount]),
)

if (ACTUALIZAR || !existsSync(TECHO)) {
  writeFileSync(TECHO, JSON.stringify({ errores, porArchivo }, null, 2) + '\n')
  console.log(`\n  Techo fijado en ${errores} errores.\n`)
  process.exit(0)
}

const techo = JSON.parse(readFileSync(TECHO, 'utf8'))

if (errores > techo.errores) {
  console.error(`\n  LINT: ${errores} errores, el techo son ${techo.errores}. Se añadieron ${errores - techo.errores}.\n`)
  for (const [f, n] of Object.entries(porArchivo)) {
    const antes = techo.porArchivo[f] ?? 0
    if (n > antes) console.error(`     ${f}  ${antes} → ${n}`)
  }
  console.error('\n  Arréglalos, o justifica el cambio de techo con `node scripts/lint-trinquete.mjs --actualizar`.\n')
  process.exit(1)
}

if (errores < techo.errores) {
  console.error(`\n  LINT: bajaste a ${errores} (el techo son ${techo.errores}). APRIETA EL TRINQUETE:\n`)
  console.error('     node scripts/lint-trinquete.mjs --actualizar\n')
  console.error('  Si no se baja el techo, el margen ganado se lo come el siguiente descuido.\n')
  process.exit(1)
}

console.log(`\n  LINT: ${errores} errores, igual que el techo. Sin deuda nueva.\n`)
