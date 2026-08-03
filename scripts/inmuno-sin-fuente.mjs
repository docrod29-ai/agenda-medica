/**
 * Extrae las recomendaciones de inmuno SIN fuente declarada y genera la tabla
 * de revisión que el Dr. tiene que llenar (decisión 10, 3-ago-2026).
 *
 * Lee las llamadas `rec(titulo, detalle, sev[, fuente])` del código: las que no
 * traen el cuarto argumento están retenidas y no salen a la clínica.
 *
 *   node scripts/inmuno-sin-fuente.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FUENTES = ['src/lib/inmuno/recomendaciones.ts', 'src/lib/inmuno/farmacos.ts']
const filas = []

for (const ruta of FUENTES) {
  const s = readFileSync(ruta, 'utf8')
  // Recorre cada `rec(` y corta en el paréntesis de cierre de su mismo nivel.
  for (let i = s.indexOf('rec('); i !== -1; i = s.indexOf('rec(', i + 1)) {
    if (/[\w.]/.test(s[i - 1] ?? '')) continue      // recsFarmacos(, etc.
    let nivel = 0, enStr = null, j = i + 3
    for (; j < s.length; j++) {
      const c = s[j]
      if (enStr) { if (c === enStr && s[j - 1] !== '\\') enStr = null; continue }
      if (c === "'" || c === '`' || c === '"') { enStr = c; continue }
      if ('([{'.includes(c)) nivel++
      else if (')]}'.includes(c)) { nivel--; if (nivel === 0) break }
    }
    const args = s.slice(i + 4, j)
    // Comas de primer nivel = separadores de argumento.
    let n = 0, lvl = 0, str = null, partes = [''], k = 0
    for (const c of args) {
      if (str) { partes[k] += c; if (c === str) str = null; continue }
      if (c === "'" || c === '`' || c === '"') { str = c; partes[k] += c; continue }
      if ('([{'.includes(c)) lvl++
      else if (')]}'.includes(c)) lvl--
      if (c === ',' && lvl === 0) { partes[++k] = ''; n++; continue }
      partes[k] += c
    }
    if (n >= 3) continue                             // tiene fuente
    const limpio = (t) => (t ?? '').trim().replace(/^['"`]|['"`]$/g, '').replace(/\s+/g, ' ')
    const linea = s.slice(0, i).split('\n').length
    filas.push({
      archivo: ruta.replace('src/lib/inmuno/', ''), linea,
      titulo: limpio(partes[0]).slice(0, 90),
      detalle: limpio(partes[1]).slice(0, 220),
      sev: limpio(partes[2]),
    })
  }
}

const cab = '| # | Archivo:línea | Título | Detalle | Sev | FUENTE | Población | Condición | Excepciones | Fecha | Versión | Evidencia | Revisor |'
const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|'
const cuerpo = filas.map((f, i) =>
  `| ${i + 1} | \`${f.archivo}:${f.linea}\` | ${f.titulo} | ${f.detalle} | ${f.sev} | | | | | | | | |`)

writeFileSync('docs/maintenance/INMUNO-RECOMENDACIONES-SIN-FUENTE.md', `# Inmuno — recomendaciones RETENIDAS por no tener fuente

**Generado por \`node scripts/inmuno-sin-fuente.mjs\`. No editar a mano la parte de
arriba: se regenera.** Las columnas vacías son las que hay que llenar.

Decisión 10 del Dr. (3-ago-2026): estas **${filas.length}** recomendaciones NO se
muestran en la salida clínica hasta que tengan fuente, población, condiciones de
aplicación, excepciones, fecha, versión y revisor. **No están borradas**: siguen
en el código, retenidas en estado \`UNSOURCED / NOT_FOR_CLINICAL_DISPLAY\`.

Basta con añadir el cuarto argumento a la llamada \`rec(...)\` para que vuelva a
salir. Una por una, según se revise.

${cab}
${sep}
${cuerpo.join('\n')}
`)
console.log(`${filas.length} recomendaciones sin fuente → docs/maintenance/INMUNO-RECOMENDACIONES-SIN-FUENTE.md`)
