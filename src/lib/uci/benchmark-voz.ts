/**
 * BENCHMARK DE VOZ — charter §41.
 *
 * Mide cuánto entiende de verdad el dictado de UCI comparando lo que el
 * transcriptor devolvió contra lo que **realmente se dijo** (el «gold»).
 *
 * ── POR QUÉ NO BASTA EL WER ──────────────────────────────────────────────────
 *
 * La tasa de error de palabra (WER) trata «el» y «norepinefrina» como si
 * valieran lo mismo. En un pase de visita no valen lo mismo: perder un artículo
 * no cambia nada y perder «PEEP» arruina el dato.
 *
 * Por eso la métrica que manda es la **exactitud por término clínico**, y el WER
 * se reporta al lado sólo como referencia comparable con la literatura.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * **No corrige nada.** Mide. Las confusiones que encuentre son material para
 * `CONFUSIONES_CONOCIDAS`, pero meterlas ahí es una decisión con revisión, no un
 * efecto secundario de medir.
 *
 * Y **no puntúa lo que no se le dio como gold**: si el gold no contiene un
 * término clínico, ese término no cuenta ni a favor ni en contra.
 *
 * Módulo PURO.
 */

/** Normaliza para comparar: minúsculas, sin acentos, sin puntuación, un espacio. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Un punto, una coma o un guion ENTRE DÍGITOS son parte del número («8.5»,
    // «6-8») y se conservan; en cualquier otro sitio son puntuación y estorban.
    // Sin esta distinción, «ocho.» contaba como una palabra distinta de «ocho» y
    // el WER salía inflado por comas que nadie pronuncia.
    .replace(/(?<=\d)[.,](?=\d)/g, '\u0001')
    .replace(/(?<=\d)-(?=\d)/g, '\u0002')
    .replace(/[^\p{L}\p{N}\s\u0001\u0002]/gu, ' ')
    .replace(/\u0001/g, '.')
    .replace(/\u0002/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export const palabras = (s: string): string[] =>
  normalizar(s).split(' ').filter(w => w !== '')

/**
 * Distancia de edición entre listas de palabras (Levenshtein).
 *
 * Se implementa sobre PALABRAS, no caracteres: «peep» vs «pip» es un error, no
 * dos. Es lo que hace que el número sea comparable con la literatura de ASR.
 */
export function distanciaPalabras(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const fila = [i]
    for (let j = 1; j <= b.length; j++) {
      fila[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], fila[j - 1])
    }
    prev = fila
  }
  return prev[b.length]
}

/** Tasa de error de palabra. 0 = perfecto. Puede pasar de 1 si sobra texto. */
export function wer(gold: string, hipotesis: string): number {
  const g = palabras(gold)
  if (g.length === 0) return palabras(hipotesis).length === 0 ? 0 : 1
  return distanciaPalabras(g, palabras(hipotesis)) / g.length
}

export interface TerminoEvaluado {
  termino: string
  /** ¿Estaba en el gold? Si no, no se evalúa. */
  enGold: boolean
  /** ¿Apareció en la transcripción? */
  acertado: boolean
}

export interface ResultadoFrase {
  id: string
  gold: string
  transcripcion: string
  wer: number
  terminos: TerminoEvaluado[]
  /** Términos clínicos del gold que NO aparecieron. Lo accionable. */
  perdidos: string[]
}

/**
 * Evalúa UNA frase.
 *
 * @param terminosClinicos vocabulario a vigilar. Sale del vocabulario que la
 *   aplicación ya conoce; **no se inventa aquí**.
 */
export function evaluarFrase(
  id: string,
  gold: string,
  transcripcion: string,
  terminosClinicos: readonly string[],
): ResultadoFrase {
  const g = ' ' + normalizar(gold) + ' '
  const h = ' ' + normalizar(transcripcion) + ' '

  const terminos: TerminoEvaluado[] = terminosClinicos.map(t => {
    const n = normalizar(t)
    const enGold = n !== '' && g.includes(' ' + n + ' ')
    return { termino: t, enGold, acertado: enGold && h.includes(' ' + n + ' ') }
  })

  return {
    id, gold, transcripcion,
    wer: wer(gold, transcripcion),
    terminos,
    perdidos: terminos.filter(t => t.enGold && !t.acertado).map(t => t.termino),
  }
}

export interface ReporteVoz {
  frases: number
  /** WER medio sobre las frases evaluadas. */
  werMedio: number
  /** Términos clínicos presentes en algún gold. */
  terminosEvaluados: number
  terminosAcertados: number
  /** LA métrica que manda: aciertos / evaluados. `null` si no hubo ninguno. */
  exactitudClinica: number | null
  /** Términos que más se pierden, del peor al mejor. Material para el diccionario. */
  ranking: { termino: string; veces: number; perdidas: number; exactitud: number }[]
  /** Frases sin ningún término clínico: no aportan a la métrica que manda. */
  frasesSinTerminos: string[]
}

export const NO_CORRIGE =
  'El benchmark MIDE, no corrige. Las confusiones que encuentre son material para ' +
  'el diccionario de correcciones, pero meterlas ahí es una decisión revisada, no ' +
  'un efecto secundario de medir.'

/** Agrega los resultados de todas las frases. */
export function reporteVoz(resultados: readonly ResultadoFrase[]): ReporteVoz {
  const porTermino = new Map<string, { veces: number; perdidas: number }>()
  const sinTerminos: string[] = []
  let sumaWer = 0

  for (const r of resultados) {
    sumaWer += r.wer
    const enGold = r.terminos.filter(t => t.enGold)
    if (enGold.length === 0) sinTerminos.push(r.id)
    for (const t of enGold) {
      const e = porTermino.get(t.termino) ?? { veces: 0, perdidas: 0 }
      e.veces++
      if (!t.acertado) e.perdidas++
      porTermino.set(t.termino, e)
    }
  }

  let evaluados = 0, acertados = 0
  const ranking = [...porTermino.entries()].map(([termino, e]) => {
    evaluados += e.veces
    acertados += e.veces - e.perdidas
    return {
      termino, veces: e.veces, perdidas: e.perdidas,
      exactitud: (e.veces - e.perdidas) / e.veces,
    }
  }).sort((a, b) => a.exactitud - b.exactitud || b.veces - a.veces)

  return {
    frases: resultados.length,
    werMedio: resultados.length === 0 ? 0 : sumaWer / resultados.length,
    terminosEvaluados: evaluados,
    terminosAcertados: acertados,
    exactitudClinica: evaluados === 0 ? null : acertados / evaluados,
    ranking,
    frasesSinTerminos: sinTerminos,
  }
}

/**
 * ¿Hay suficiente material para que el número signifique algo?
 *
 * No fija una nota de aprobado —eso sería un umbral clínico-operativo que nadie
 * ha decidido—; sólo dice si la muestra es tan pequeña que el porcentaje
 * engañaría.
 */
export function muestraSuficiente(r: ReporteVoz, minimoFrases = 50): { basta: boolean; motivo: string } {
  if (r.frases < minimoFrases) {
    return {
      basta: false,
      motivo: `Con ${r.frases} frase${r.frases !== 1 ? 's' : ''} el porcentaje se mueve demasiado ` +
        `con cada acierto. A partir de ${minimoFrases} el número empieza a significar algo.`,
    }
  }
  if (r.terminosEvaluados === 0) {
    return { basta: false, motivo: 'Ninguna frase contiene términos clínicos que vigilar.' }
  }
  return { basta: true, motivo: `${r.frases} frases · ${r.terminosEvaluados} términos evaluados.` }
}
