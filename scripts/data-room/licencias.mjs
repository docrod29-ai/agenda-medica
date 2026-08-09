/**
 * LICENCIAS DE LAS DEPENDENCIAS — para la sala de datos (§N3 del charter).
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * En una diligencia debida, la pregunta no es «¿qué licencias usan?» sino
 * «¿puedo comprobarlo yo?». Un documento que afirma «ninguna GPL» sin el comando
 * que lo demuestra vale lo mismo que no decir nada.
 *
 * Esto lo puede correr el comprador, sin acceso a nada más que el repositorio.
 *
 * ── QUÉ BUSCA ────────────────────────────────────────────────────────────────
 *
 * Copyleft fuerte —GPL, AGPL, SSPL, BUSL— en un producto SaaS médico obliga a
 * publicar el código o a renegociar la licencia. No tenerlas es un requisito de
 * compra, no una virtud: por eso se comprueba, no se declara.
 *
 * LGPL NO cuenta: permite enlace dinámico sin contagiar.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * Sólo mira las dependencias DIRECTAS. El árbol completo necesita un SBOM
 * formal (CycloneDX o SPDX), que está declarado como pendiente en el índice.
 * Decirlo aquí evita que este número se lea como más de lo que es.
 */
import { readFileSync } from 'node:fs'

const COPYLEFT_FUERTE = /GPL|AGPL|SSPL|BUSL/i
const ES_LGPL = /LGPL/i

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const todas = { ...pkg.dependencies, ...pkg.devDependencies }

const conteo = new Map()
const problematicas = []
const noLeidas = []

for (const nombre of Object.keys(todas)) {
  let licencia = '(no leída)'
  try {
    const p = JSON.parse(readFileSync(`node_modules/${nombre}/package.json`, 'utf8'))
    licencia = typeof p.license === 'string' ? p.license : (p.license?.type ?? '(sin campo)')
  } catch {
    noLeidas.push(nombre)
  }
  conteo.set(licencia, (conteo.get(licencia) ?? 0) + 1)
  if (COPYLEFT_FUERTE.test(licencia) && !ES_LGPL.test(licencia)) {
    problematicas.push(`${nombre} → ${licencia}`)
  }
}

console.log(`\nDependencias directas: ${Object.keys(todas).length}`)
console.log(`  (${Object.keys(pkg.dependencies ?? {}).length} de producción · ${Object.keys(pkg.devDependencies ?? {}).length} de desarrollo)\n`)

for (const [lic, n] of [...conteo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${lic}`)
}

if (noLeidas.length) {
  console.log(`\n  ${noLeidas.length} sin leer (¿falta npm install?): ${noLeidas.slice(0, 5).join(', ')}`)
}

if (problematicas.length) {
  console.log(`\n  ⚠ COPYLEFT FUERTE — revisar antes de vender:`)
  for (const p of problematicas) console.log(`     ${p}`)
  process.exit(1)
}

console.log('\n  ✓ Ninguna licencia copyleft fuerte (GPL/AGPL/SSPL/BUSL) en dependencias directas.')
console.log('    NOTA: sólo directas. El árbol completo requiere un SBOM formal — pendiente.\n')
