/**
 * Arnés de VALIDACIÓN de la IA clínica — métricas deterministas.
 *
 * "La única cosa" que más acerca a NexusMED a clase mundial (hallazgo del panel:
 * IA con ingeniería fuerte pero SIN ciencia/medición). Este módulo NO llama al
 * modelo: dado un conjunto ORO (casos de referencia validados por un médico) y las
 * salidas generadas, calcula exactitud por campo, tasa de error y una proxy de
 * ALUCINACIÓN (campos afirmados por la IA sin respaldo en la entrada/oro).
 *
 * El estudio real lo corre el Dr. con sus datos de-identificados; aquí está el
 * instrumento de medición, PURO y testeable.
 */

export interface CasoOro {
  id: string
  /** Texto de entrada (transcripción/contexto) del que se generó la nota. */
  entrada: string
  /** Campos esperados validados por un médico (clave → valor de referencia). */
  esperado: Record<string, string>
  /** Campos que NO deben aparecer (para medir sobre-generación), opcional. */
  prohibidos?: string[]
}

export interface SalidaGenerada {
  id: string
  campos: Record<string, string>
}

export interface ResultadoCaso {
  id: string
  correctos: string[]     // campos esperados presentes y equivalentes
  incorrectos: string[]   // campos esperados presentes pero distintos
  faltantes: string[]     // campos esperados ausentes
  alucinaciones: string[] // campos generados sin sustento en entrada ni en el oro
}

/** Normaliza para comparar (acentos, mayúsculas, espacios, puntuación suave). */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Equivalencia laxa: igualdad normalizada o contención (uno dentro del otro). */
export function equivalente(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x && !y) return true
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * Evalúa UN caso: compara los campos generados contra el oro y detecta
 * alucinaciones (valor generado cuyo contenido NO está en la entrada ni en el oro).
 */
export function evaluarCaso(oro: CasoOro, gen: SalidaGenerada): ResultadoCaso {
  const correctos: string[] = [], incorrectos: string[] = [], faltantes: string[] = [], alucinaciones: string[] = []
  const entradaNorm = norm(oro.entrada)
  const oroValores = Object.values(oro.esperado).map(norm)

  for (const [campo, esperado] of Object.entries(oro.esperado)) {
    const g = gen.campos[campo]
    if (g == null || norm(g) === '') { faltantes.push(campo); continue }
    if (equivalente(g, esperado)) correctos.push(campo)
    else incorrectos.push(campo)
  }

  // Campos prohibidos que aparecieron
  for (const p of oro.prohibidos ?? []) {
    if (gen.campos[p] != null && norm(gen.campos[p]) !== '') alucinaciones.push(p)
  }

  // Alucinación: valor generado (en un campo no esperado) cuyo contenido no está en
  // la entrada ni coincide con ningún valor del oro → afirmación sin sustento.
  for (const [campo, valor] of Object.entries(gen.campos)) {
    if (campo in oro.esperado) continue
    const v = norm(valor)
    if (!v) continue
    const enEntrada = v.split(' ').filter(w => w.length > 3).some(w => entradaNorm.includes(w))
    const enOro = oroValores.some(ov => ov.includes(v) || v.includes(ov))
    if (!enEntrada && !enOro && !alucinaciones.includes(campo)) alucinaciones.push(campo)
  }

  return { id: oro.id, correctos, incorrectos, faltantes, alucinaciones }
}

export interface ResumenEvaluacion {
  casos: number
  camposEsperados: number
  correctos: number
  incorrectos: number
  faltantes: number
  alucinaciones: number
  /** correctos / camposEsperados (0..1). */
  exactitudCampo: number
  /** (incorrectos + faltantes) / camposEsperados (0..1). */
  tasaError: number
  /** alucinaciones / casos (promedio por caso). */
  alucinacionesPorCaso: number
}

function r3(n: number): number { return Math.round(n * 1000) / 1000 }

/** Agrega los resultados de varios casos en métricas globales. */
export function resumirEvaluacion(resultados: ResultadoCaso[]): ResumenEvaluacion {
  let correctos = 0, incorrectos = 0, faltantes = 0, alucinaciones = 0
  for (const r of resultados) {
    correctos += r.correctos.length
    incorrectos += r.incorrectos.length
    faltantes += r.faltantes.length
    alucinaciones += r.alucinaciones.length
  }
  const camposEsperados = correctos + incorrectos + faltantes
  const casos = resultados.length
  return {
    casos,
    camposEsperados,
    correctos, incorrectos, faltantes, alucinaciones,
    exactitudCampo: camposEsperados ? r3(correctos / camposEsperados) : 0,
    tasaError: camposEsperados ? r3((incorrectos + faltantes) / camposEsperados) : 0,
    alucinacionesPorCaso: casos ? r3(alucinaciones / casos) : 0,
  }
}

/** Corre la evaluación completa sobre un set oro + sus salidas generadas. */
export function evaluarConjunto(oro: CasoOro[], generadas: SalidaGenerada[]): { resultados: ResultadoCaso[]; resumen: ResumenEvaluacion } {
  const porId = new Map(generadas.map(g => [g.id, g]))
  const resultados = oro.map(c => evaluarCaso(c, porId.get(c.id) ?? { id: c.id, campos: {} }))
  return { resultados, resumen: resumirEvaluacion(resultados) }
}
