/**
 * Regenera `especialidades.json` desde el LEXICON_MEDICO.csv del Dr.
 *
 * ── POR QUÉ EXISTÍA EL HUECO ─────────────────────────────────────────────────
 *
 * El archivo tenía la ESTRUCTURA de su corpus —las 79 especialidades— pero sólo
 * 35 términos cargados: 65 especialidades estaban completamente vacías. Y el
 * prompt es lo ÚNICO que cambia lo que el reconocedor OYE, así que dictar de
 * nefrología, hematología o neonatología no sesgaba nada.
 *
 * Su CSV trae los 1 400 con su categoría y su prioridad. Esto sólo los pasa a la
 * forma que el módulo espera: no se inventa ni un término ni se reclasifica
 * ninguno — la prioridad que él puso es la que manda el orden del presupuesto.
 *
 * Uso: npx tsx scripts/asr-importar-lexicon.ts <ruta al LEXICON_MEDICO.csv>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const CSV = process.argv[2]
if (!CSV) { console.error('Falta la ruta del LEXICON_MEDICO.csv'); process.exit(1) }

const DESTINO = 'src/lib/asr/data/especialidades.json'

/** Lector de CSV que respeta las comillas: los alias llevan comas dentro. */
function leerCsv(ruta: string): Record<string, string>[] {
  const texto = readFileSync(ruta, 'utf8')
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const cab = filas.shift()!
  return filas.filter(f => f.length === cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])))
}

interface Especialidad {
  critical_terms: string[]
  high_priority_terms: string[]
  normal_terms: string[]
}

const actual = JSON.parse(readFileSync(DESTINO, 'utf8')) as {
  version: string
  strategy: unknown
  specialties: Record<string, Especialidad>
}

const filas = leerCsv(CSV)
const salida: Record<string, Especialidad> = {}
// Se conservan TODAS las especialidades que ya estaban, aunque el CSV no traiga
// ninguna: quitar una cambiaría en silencio a qué contextos puede apuntar el
// médico.
for (const k of Object.keys(actual.specialties)) {
  salida[k] = { critical_terms: [], high_priority_terms: [], normal_terms: [] }
}

let fuera = 0
for (const f of filas) {
  const cat = (f.category ?? '').trim()
  const termino = (f.term ?? '').trim()
  if (!cat || !termino) continue
  if (!salida[cat]) salida[cat] = { critical_terms: [], high_priority_terms: [], normal_terms: [] }
  const destino = f.priority === 'critical' ? 'critical_terms'
    : f.priority === 'high' ? 'high_priority_terms' : 'normal_terms'
  // Un término que ya está no se repite: gastaría presupuesto dos veces.
  if (!salida[cat][destino].includes(termino)) salida[cat][destino].push(termino)
  else fuera++
}

writeFileSync(DESTINO, JSON.stringify({ ...actual, specialties: salida }, null, 2) + '\n')

const cuenta = (k: keyof Especialidad) => Object.values(salida).reduce((n, e) => n + e[k].length, 0)
const vacias = Object.entries(salida).filter(([, e]) => !e.critical_terms.length && !e.high_priority_terms.length && !e.normal_terms.length)
console.log(`
  especialidades ......... ${Object.keys(salida).length}
  críticos ............... ${cuenta('critical_terms')}
  prioridad alta ......... ${cuenta('high_priority_terms')}
  normales ............... ${cuenta('normal_terms')}
  TOTAL .................. ${cuenta('critical_terms') + cuenta('high_priority_terms') + cuenta('normal_terms')}
  duplicados descartados . ${fuera}
  especialidades vacías .. ${vacias.length}${vacias.length ? ' → ' + vacias.map(([k]) => k).join(', ') : ''}
`)
