#!/usr/bin/env node
/**
 * DERIVA EL CATÁLOGO DE PLAUSIBILIDAD DEL DOCUMENTO DEL DUEÑO — REG-601.
 *
 * ── POR QUÉ ESTO NO SE TECLEA A MANO ────────────────────────────────────────
 *
 * Son ~200 analitos con dos cifras cada uno. Teclearlos es una tarea mecánica
 * larga, y las tareas mecánicas largas es donde se cuela el dígito cambiado:
 * una ferritina con un cero de menos no rompe nada, no falla ninguna prueba, y
 * convierte un límite de captura en otro.
 *
 * Aquí los números salen del documento del médico dueño
 * (`docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md`) leídos por máquina. La
 * afirmación «estas cifras son las suyas» deja de ser una promesa y pasa a ser
 * algo que `--verificar` refuta.
 *
 * Uso:
 *   node scripts/laboratorio/catalogo-d045.mjs             # regenera el JSON
 *   node scripts/laboratorio/catalogo-d045.mjs --verificar # falla si difiere
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DOC = resolve(RAIZ, 'docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md')
const SALIDA = resolve(RAIZ, 'src/lib/expediente/laboratorio/catalogo-d045.json')

/** «1 000 000» y «1,000,000» son el mismo número; «-1» y «1.000» también. */
function aNumero(txt) {
  const limpio = String(txt).replace(/\s| |,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null
  return Number(limpio)
}

const lineas = readFileSync(DOC, 'utf8').split('\n')
const filas = []
let seccion = null
let dentroDeTabla = false

for (const linea of lineas) {
  const h2 = linea.match(/^##\s+(\d+)\.\s+(.+?)\s*$/)
  if (h2) { seccion = { numero: Number(h2[1]), titulo: h2[2] }; dentroDeTabla = false; continue }
  if (/^\|\s*Analito\s*\|/.test(linea)) { dentroDeTabla = true; continue }
  if (dentroDeTabla && /^\|\s*-/.test(linea)) continue
  if (!linea.startsWith('|')) { dentroDeTabla = false; continue }
  if (!dentroDeTabla || !seccion) continue

  const celdas = linea.split('|').slice(1, -1).map(c => c.trim())
  if (celdas.length !== 4) continue
  const [nombre, unidad, min, max] = celdas
  const nMin = aNumero(min), nMax = aNumero(max)
  if (nMin === null || nMax === null) continue
  filas.push({ seccion: seccion.numero, tituloSeccion: seccion.titulo, nombre, unidad, min: nMin, max: nMax })
}

/**
 * El documento repite analitos entre secciones a propósito (LDH está en hígado y
 * en hemólisis; la vitamina D en nutrición y en metabolismo mineral). Se
 * comprueba que las cifras COINCIDEN: si un día divergen, es un error del
 * documento y hay que preguntárselo al dueño, no elegir una.
 */
const porNombre = new Map()
const discrepancias = []
for (const f of filas) {
  const clave = f.nombre.toLowerCase()
  const previa = porNombre.get(clave)
  if (!previa) { porNombre.set(clave, f); continue }
  if (previa.unidad !== f.unidad || previa.min !== f.min || previa.max !== f.max) {
    discrepancias.push(`«${f.nombre}»: §${previa.seccion} dice ${previa.min}–${previa.max} ${previa.unidad} y §${f.seccion} dice ${f.min}–${f.max} ${f.unidad}`)
  }
}
if (discrepancias.length > 0) {
  console.error('El documento se contradice a sí mismo. NO se elige una: se le pregunta al dueño.')
  for (const d of discrepancias) console.error('  · ' + d)
  process.exit(1)
}

const salida = {
  _generado: 'DERIVADO. No editar a mano: sale de docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md',
  _comoSeRegenera: 'node scripts/laboratorio/catalogo-d045.mjs',
  _porQue: 'Los límites de plausibilidad son cifras clínicas del médico dueño (D-045). Leerlos por máquina hace falsable la afirmación de que son los suyos.',
  filas,
}
const texto = JSON.stringify(salida, null, 2) + '\n'

if (process.argv.includes('--verificar')) {
  let actual = ''
  try { actual = readFileSync(SALIDA, 'utf8') } catch { /* no existe */ }
  if (actual !== texto) {
    console.error('El catálogo derivado está viejo. Corre: node scripts/laboratorio/catalogo-d045.mjs')
    process.exit(1)
  }
  console.log(`  Catálogo al día: ${filas.length} filas, ${porNombre.size} analitos distintos.`)
  process.exit(0)
}

writeFileSync(SALIDA, texto)
console.log(`  ${filas.length} filas leídas del documento · ${porNombre.size} analitos distintos · sin contradicciones.`)
