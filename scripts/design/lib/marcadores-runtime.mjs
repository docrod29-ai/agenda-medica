/**
 * MARCADORES DE RUNTIME — fingerprinting de módulos dentro de chunks minificados.
 *
 * Nace en V15-PERF-001, 5ª rebanada. Los marcadores de path que Turbopack
 * deja como claves ("[project]/…") NO sobreviven en los chunks más
 * minificados: el chunk de página de /consulta (~219 KB) y el del
 * diccionario (~103 KB) salían de la atribución casi sin nombres. Lo que SÍ
 * sobrevive a la minificación son los LITERALES de cadena.
 *
 * Cada candidato se fingerprintea con sus literales más distintivos, leídos
 * de su PROPIA fuente al momento de correr — no hay tabla a mano que se
 * pudra cuando alguien reescriba un texto.
 *
 * Caveats medidos (no teóricos):
 *   - Un literal que sólo vive en un COMENTARIO no sobrevive al build: los
 *     comentarios se quitan antes de extraer (así se escondió
 *     medical-vocabulary.ts en la primera corrida — sus doce marcadores más
 *     largos eran ejemplos de JSDoc).
 *   - Turbopack sacude exports no usados: un módulo puede estar PRESENTE en
 *     el chunk con sus marcadores ausentes si éstos viven en un export que
 *     nadie del grafo eager importa (le pasó a los prompts de sesgo de
 *     medical-vocabulary, que viajan con el pipeline diferido). Un MISS
 *     nombra lo que NO viaja; no exonera al módulo entero.
 */
import fs from 'node:fs'

/**
 * Literales de cadena simples (sin escapes ni interpolación), 14-90 chars.
 * Los comentarios se quitan ANTES — ver caveat de cabecera.
 */
export function literalesDe(texto) {
  const sinComentarios = texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
  const re = /(["'])((?:(?!\1)[^\\\n]){14,90})\1/g
  const vistos = new Set()
  let m
  while ((m = re.exec(sinComentarios)) !== null) vistos.add(m[2])
  return [...vistos]
}

/**
 * Elige los marcadores de un candidato: frases (≥2 espacios) primero.
 * Fuera: rutas, CSS (se repite idéntico entre componentes), y los falsos
 * literales que el regex pesca ENTRE dos comillas de código JSX (contienen
 * {}, `, => — ésos no sobreviven a la minificación y sólo queman
 * presupuesto de marcadores).
 */
export function marcadoresDe(literales) {
  const sirve = (s) =>
    !/^(@\/|\.\.?\/|https?:|use )/i.test(s) &&
    !/[{}"'`]|=>|color-mix|var\(--|rgba?\(|linear-gradient/.test(s) &&
    !/fontSize|fontWeight|padding|margin|cursor|flexWrap|alignItems|borderRadius|display|lineHeight/.test(s)
  const utiles = literales.filter(sirve)
  const frases = utiles.filter(s => (s.match(/ /g) || []).length >= 2)
  const base = frases.length >= 3
    ? frases
    : [...frases, ...utiles.filter(s => !frases.includes(s))]
  return base.sort((a, b) => b.length - a.length).slice(0, 12)
}

/** El minificador puede escapar lo no-ASCII: se busca crudo Y escapado. */
export function variantesDe(marcador) {
  if (!/[\u0080-\uffff]/.test(marcador)) return [marcador]
  const escapado = marcador.replace(/[\u0080-\uffff]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  return [marcador, escapado]
}

/**
 * Tabla candidato → marcadores, con los duplicados entre candidatos fuera:
 * un literal compartido por dos archivos no acusa a ninguno.
 */
export function tablaDeMarcadores(candidatos, leer = (ruta) => fs.readFileSync(ruta, 'utf8')) {
  const porCandidato = new Map()
  const conteoGlobal = new Map()
  for (const ruta of candidatos) {
    let fuente
    try { fuente = leer(ruta) } catch { continue }
    const lits = marcadoresDe(literalesDe(fuente))
    porCandidato.set(ruta, lits)
    for (const l of lits) conteoGlobal.set(l, (conteoGlobal.get(l) || 0) + 1)
  }
  for (const [ruta, lits] of porCandidato) {
    porCandidato.set(ruta, lits.filter(l => conteoGlobal.get(l) === 1))
  }
  return porCandidato
}

/**
 * Acusa candidatos DENTRO de un chunk por sus literales de runtime.
 * Un candidato está PRESENTE si ≥2 de sus marcadores aparecen (≥1 si sólo
 * tiene 1-2): un literal suelto puede ser coincidencia; dos del mismo
 * archivo, no.
 */
export function acusarPorRuntime(textoChunk, tabla) {
  const presentes = []
  for (const [ruta, marcadores] of tabla) {
    if (marcadores.length === 0) continue
    let golpes = 0
    for (const marcador of marcadores) {
      if (variantesDe(marcador).some(v => textoChunk.includes(v))) golpes++
    }
    const umbral = marcadores.length <= 2 ? 1 : 2
    if (golpes >= umbral) presentes.push({ modulo: ruta, golpes, de: marcadores.length })
  }
  return presentes.sort((a, b) => b.golpes / b.de - a.golpes / a.de)
}
