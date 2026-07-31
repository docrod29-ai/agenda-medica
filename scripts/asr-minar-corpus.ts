/**
 * Extrae vocabulario de las 6 000 FRASES del corpus del Dr.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ──────────────────────────────────────────────
 *
 * El léxico se había construido sólo con su `LEXICON_MEDICO.csv` (1 400
 * términos, muy desigual: ventilación mecánica 3, sedación 1). Pero el corpus
 * trae además **6 000 frases clínicas reales**, escritas por él, agrupadas por
 * especialidad — y de ahí no se había sacado una sola palabra.
 *
 * ── LO QUE SE EXTRAE Y LO QUE NO ─────────────────────────────────────────────
 *
 * **Sí:** siglas y unidades tal como él las escribe (PEEP, PaCO₂, CVVHDF, RASS,
 * VExUS, mcg/kg/min) y los términos que son PROPIOS de una especialidad — los
 * que aparecen ahí y casi no aparecen en las demás. Eso último es lo que hace
 * útil el sesgo: una palabra que sale en las 78 categorías no distingue nada.
 *
 * **No:** nada inventado. Cada término sale literal de una frase suya. Y nada
 * genérico: las palabras que usa cualquier especialidad se descartan, porque
 * gastarían presupuesto sin cambiar lo que el reconocedor espera.
 *
 * Uso: npx tsx scripts/asr-minar-corpus.ts <MASTER_6000_FRASES_UNICAS.csv> [--aplicar]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const CSV = process.argv[2]
const APLICAR = process.argv.includes('--aplicar')
if (!CSV) { console.error('Falta el MASTER_6000_FRASES_UNICAS.csv'); process.exit(1) }
const DESTINO = 'src/lib/asr/data/especialidades.json'

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

/** Palabras que usa cualquier especialidad: gastarían presupuesto sin sesgar nada. */
const GENERICAS = new Set(`el la los las un una unos unas de del al a en con por para sin sobre
  y o u e que se su sus le les lo me te nos es son fue era hay ha han este esta estos estas
  paciente pacientes se inicia continua mantiene ajusta reporta refiere niega presenta observa
  registra indica evalua valora dia dias hora horas turno pase nota manana tarde noche
  mas menos muy poco mucho bien mal alto bajo mayor menor igual segun tras luego ante
  actual actualmente hoy ayer control controles cada por sin ni tambien ademas aun
  cuadro estado manejo plan via dosis total nivel niveles valor valores cifra cifras`
  .split(/\s+/).filter(Boolean))

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Números escritos: la normalización ya los convierte, no son vocabulario. */
const NUMEROS = new Set(`cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce
  trece catorce quince dieciseis veinte treinta cuarenta cincuenta sesenta setenta ochenta
  noventa cien ciento mil primera segunda tercera primer segundo tercero`.split(/\s+/).filter(Boolean))

/**
 * Fuera las formas VERBALES y los sustantivos de relleno de UNA palabra.
 *
 * «titular», «añadida», «iniciada», «documenta», «Indicar», «activa» salían como
 * si fueran términos médicos: son el verbo con el que él redacta la frase, no lo
 * que dice la frase. Meterlos gastaría presupuesto sesgando al reconocedor hacia
 * conjugaciones — que es lo que ya sabe hacer solo.
 *
 * Sólo aplica a términos de UNA palabra que no sean sigla ni unidad: en
 * «documenta canulación» la palabra que importa va dentro y el compuesto sí
 * entra.
 */
const VERBAL = /(ar|er|ir|ado|ada|ados|adas|ido|ida|idos|idas|ando|iendo|aba|ando|amos|aron|arse)$/
const RELLENO = new Set(`objetivo datos tamaño imagen numero modo delta fuga baja alta media
  antes despues bolo total parcial global local general inicial final previa previo
  presente ausente positiva negativa positivo negativo indicar documenta registra
  titular activa activo pasiva pasivo mayor menor nueva nuevo`.split(/\s+/).filter(Boolean))

/** ¿Vale la pena como término? */
function util(t: string): boolean {
  if (t.includes(' ')) {
    /**
     * Un compuesto que EMPIEZA con el verbo de redacción tampoco sirve:
     * «documenta canulación», «Indicar aislamiento». Lo que vale es el
     * sustantivo, y ése ya entra por su cuenta.
     */
    const primera = norm(t.split(' ')[0])
    return !(RELLENO.has(primera) || (VERBAL.test(primera) && !/[0-9/]/.test(primera)))
  }
  if (esSigla(t)) return true               // siglas y unidades siempre
  const n = norm(t)
  if (NUMEROS.has(n) || RELLENO.has(n)) return false
  // Una palabra suelta con terminación verbal es cómo se redacta, no qué se dice.
  if (VERBAL.test(n) && !/[0-9/]/.test(t)) return false
  return true
}

/** Una sigla o unidad tal como él la escribe: PEEP, PaCO2, CVVHDF, mcg/kg/min, x10³. */
const esSigla = (t: string): boolean =>
  /^[A-Za-z][A-Za-z0-9₀-₉·/%-]{1,14}$/.test(t)
  && (/[A-Z]{2,}/.test(t) || /[A-Z].*[0-9₀-₉]/.test(t) || t.includes('/'))
  && !/^\d+$/.test(t)

const filas = leerCsv(CSV)
const porCat = new Map<string, string[]>()
for (const f of filas) {
  const c = (f.category ?? '').trim()
  if (!c) continue
  if (!porCat.has(c)) porCat.set(c, [])
  porCat.get(c)!.push(f.canonical_text ?? '')
}

/** Cuenta un término por categoría y en cuántas categorías aparece. */
const enCat = new Map<string, Map<string, number>>()
const categorias = new Map<string, Set<string>>()

for (const [cat, frases] of porCat) {
  const cuenta = new Map<string, number>()
  for (const frase of frases) {
    const candidatos: string[] = []
    /**
     * Se trocea por PUNTUACIÓN primero, y los bigramas sólo se forman DENTRO de
     * un mismo trozo.
     *
     * La primera versión partía la frase quitando comas y puntos, así que dos
     * palabras separadas por una coma quedaban pegadas en el arreglo y salían
     * como si fueran un término: «mmHg bicarbonato», «venoso flujo». Un bigrama
     * que cruza una pausa no es un término, es un accidente de dónde cayó la
     * coma.
     */
    for (const trozo of frase.split(/[,.;:()¿?¡!]+/)) {
      const palabras = trozo.split(/\s+/).filter(Boolean)
      for (let i = 0; i < palabras.length; i++) {
        const p = palabras[i].replace(/^[«"']+|[»"']+$/g, '')
        if (!p) continue
        if (esSigla(p)) { candidatos.push(p); continue }
        const limpia = (x: string) => x.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ-]/g, '')
        const a = limpia(p)
        if (a.length < 4 || GENERICAS.has(norm(a))) continue
        candidatos.push(a)
        const sig = palabras[i + 1]
        if (sig === undefined) continue
        const b = limpia(sig)
        if (b.length >= 3 && !GENERICAS.has(norm(b))) candidatos.push(`${a} ${b}`)
      }
    }
    for (const t of new Set(candidatos)) cuenta.set(t, (cuenta.get(t) ?? 0) + 1)
  }
  enCat.set(cat, cuenta)
  for (const t of cuenta.keys()) {
    const k = norm(t)
    if (!categorias.has(k)) categorias.set(k, new Set())
    categorias.get(k)!.add(cat)
  }
}

const actual = JSON.parse(readFileSync(DESTINO, 'utf8')) as {
  version: string; strategy: unknown
  specialties: Record<string, { critical_terms: string[]; high_priority_terms: string[]; normal_terms: string[] }>
}

const nuevos: Record<string, string[]> = {}
for (const [cat, cuenta] of enCat) {
  if (!actual.specialties[cat]) continue
  const yaTengo = new Set(Object.values(actual.specialties[cat]).flat().map(norm))
  /**
   * Fuera los TROZOS de un término compuesto.
   *
   * La primera versión sacaba «driving» y «pressure» por separado, y «veno»,
   * «venoso» y «veno venoso» los tres. Un trozo suelto no es un término médico:
   * ocupa presupuesto y encima puede sesgar hacia la palabra partida, que es
   * justo lo contrario de lo que se busca.
   *
   * Si una palabra aparece casi siempre dentro de un compuesto que también se
   * capturó, se queda sólo el compuesto.
   */
  const compuestos = [...cuenta.keys()].filter(t => t.includes(' '))
  const esTrozo = (t: string): boolean => {
    if (t.includes(' ')) return false
    const n = cuenta.get(t) ?? 0
    return compuestos.some(c => {
      const partes = c.split(' ')
      return partes.includes(t) && (cuenta.get(c) ?? 0) >= n * 0.8
    })
  }

  const propios = [...cuenta.entries()]
    .filter(([t]) => !esTrozo(t) && util(t))
    // Al menos DOS frases: una sola aparición puede ser un giro suelto.
    .filter(([t, n]) => n >= 2 && !yaTengo.has(norm(t)))
    // PROPIO de la especialidad: en 3 categorías o menos. Lo que sale en todas
    // no distingue nada y gastaría presupuesto.
    .filter(([t]) => (categorias.get(norm(t))?.size ?? 99) <= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
  // Tope por especialidad: el presupuesto son 224 tokens, no hace falta más.
  if (propios.length) nuevos[cat] = propios.slice(0, 25)
}

const total = Object.values(nuevos).reduce((n, v) => n + v.length, 0)
console.log(`\n  categorías con términos nuevos: ${Object.keys(nuevos).length}   ·   términos: ${total}\n`)
const MUESTRA = process.argv.includes('--todo') ? Object.keys(nuevos) : ['Ventilación mecánica', 'Gasometría y ácido-base', 'Sedación y analgesia', 'ECMO', 'SDRA y pronación', 'Renal y electrolitos']
for (const c of MUESTRA) {
  if (nuevos[c]) console.log(`  ${c}\n    ${nuevos[c].slice(0, 12).join(' · ')}\n`)
}

if (APLICAR) {
  for (const [cat, ts] of Object.entries(nuevos)) actual.specialties[cat].high_priority_terms.push(...ts)
  writeFileSync(DESTINO, JSON.stringify(actual, null, 2) + '\n')
  const cuentaTotal = Object.values(actual.specialties).reduce((n, e) => n + e.critical_terms.length + e.high_priority_terms.length + e.normal_terms.length, 0)
  console.log(`  APLICADO. El léxico pasa a ${cuentaTotal} términos.\n`)
} else {
  console.log('  (prueba en seco — añade --aplicar para escribirlo)\n')
}
