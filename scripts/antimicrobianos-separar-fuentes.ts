/**
 * Separa la pauta de FICHA de la de GUÍA donde el texto se etiqueta a sí mismo.
 *
 * A8: `RULE_SOURCE_SEPARATION` es una regla HARD del dataset —«guardar la dosis
 * de FDA/ficha y la de guía/PK-PD en campos SEPARADOS»— y once entradas la
 * incumplen: las dos dosis viven en una sola cadena, copiada en los dos campos.
 *
 * ── LO QUE SE SEPARA Y LO QUE NO ─────────────────────────────────────────────
 *
 * **Sólo donde el propio texto pone el marcador.** «FDA label: 2.5 g q8h en 2 h;
 * IDSA AMR sugiere 2.5 g q8h en 3 h» se corta solo: no hay que interpretar
 * nada, hay que leer dónde el autor puso la etiqueta.
 *
 * Lo que NO lleva marcador se queda fusionado y declarado. Ceftriaxona dice
 * «Meningitis commonly uses 2 g q12h (syndrome-specific guideline/label
 * context)» — «guideline/label» a la vez: no se sabe de cuál es, y adivinarlo
 * sería exactamente lo que la regla prohíbe.
 *
 * Uso: npx tsx scripts/antimicrobianos-separar-fuentes.ts [--aplicar]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')
const RUTA = 'src/lib/antimicrobianos/v4/data/dosing-v3-verificado.json'

/** Marcadores de cada bando, tal como los escribe el dataset. */
const FICHA = /\b(FDA label|Label standard|Legacy FDA label|FDA uUTI[^:]*|Label|label pathway)\s*:/i
// El marcador de guía puede ser largo: «IDSA AMR 2026 high-dose pathway:» son
// 31 caracteres. Un margen corto dejaba fuera justo a la tigeciclina, donde las
// dos pautas SÍ difieren (50 mg q12h de ficha contra 100 de la pauta alta).
const GUIA = /\b(IDSA[^:]{0,40})\s*:|(\bIDSA AMR suggests\b)/i

interface Farmaco {
  drug: string
  label_regimen: string
  guideline_regimen: string
  [k: string]: unknown
}
const datos = JSON.parse(readFileSync(RUTA, 'utf8')) as { drugs: Farmaco[]; [k: string]: unknown }

/**
 * Corta en el punto donde empieza el otro bando.
 *
 * Devuelve `null` si no encuentra los DOS marcadores: sin los dos no hay nada
 * que separar, sólo un texto con una cita dentro.
 */
function separar(texto: string): { ficha: string; guia: string } | null {
  const mF = texto.match(FICHA)
  const mG = texto.match(GUIA)
  if (!mF || !mG || mF.index === undefined || mG.index === undefined) return null
  if (mF.index === mG.index) return null

  const [primero, segundo] = mF.index < mG.index ? [mF, mG] : [mG, mF]
  const corte = segundo.index!
  // Se busca el separador REAL más cercano por la izquierda (punto o punto y
  // coma): cortar en el marcador partiría la frase a media palabra.
  const antes = texto.slice(0, corte)
  const sep = Math.max(antes.lastIndexOf('. '), antes.lastIndexOf('; '))
  const fin = sep > 0 ? sep + 1 : corte
  const a = texto.slice(0, fin).trim().replace(/[;,]$/, '')
  const b = texto.slice(fin).trim().replace(/^[;,.]\s*/, '')
  if (!a || !b) return null
  return mF.index < mG.index ? { ficha: a, guia: b } : { ficha: b, guia: a }
}

const separados: string[] = []
const siguenFusionados: string[] = []

for (const f of datos.drugs) {
  const t = (f.label_regimen ?? '').trim()
  const esFusion = /\b(fda|label)\b/i.test(t) && /\b(idsa|guideline|guidance)\b/i.test(t)
  if (!esFusion) continue
  const r = separar(t)
  if (!r) { siguenFusionados.push(f.drug); continue }
  separados.push(f.drug)
  console.log(`\n■ ${f.drug}`)
  console.log(`   FICHA : ${r.ficha}`)
  console.log(`   GUÍA  : ${r.guia}`)
  if (APLICAR) { f.label_regimen = r.ficha; f.guideline_regimen = r.guia }
}

console.log(`\n  separadas: ${separados.length}   ·   siguen fusionadas: ${siguenFusionados.length}`)
for (const d of siguenFusionados) console.log(`     ${d}`)
if (APLICAR) {
  writeFileSync(RUTA, JSON.stringify(datos, null, 2) + '\n')
  console.log('\n  APLICADO. Recuerda actualizar HUELLA_DATASET.\n')
} else {
  console.log('\n  (prueba en seco — añade --aplicar)\n')
}
