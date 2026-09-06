/**
 * Arnés de VALIDACIÓN de la IA clínica — métricas deterministas.
 *
 * "La única cosa" que más acerca a Ausculta a clase mundial (hallazgo del panel:
 * IA con ingeniería fuerte pero SIN ciencia/medición). Este módulo NO llama al
 * modelo: dado un conjunto ORO (casos de referencia validados por un médico) y las
 * salidas generadas, calcula exactitud por campo, tasa de error y una proxy de
 * ALUCINACIÓN (campos afirmados por la IA sin respaldo en la entrada/oro).
 *
 * El estudio real lo corre el Dr. con sus datos de-identificados; aquí está el
 * instrumento de medición, PURO y testeable.
 */

import type { LoMedido } from './contratos-de-evaluacion'

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
/**
 * ¿Qué proporción del contenido NO tiene respaldo en la entrada ni en el oro?
 *
 * Se mira palabra a palabra, no «alguna». Una nota clínica alucinada casi nunca
 * es un texto entero inventado: es un texto correcto con dos palabras de más —
 * «con nefropatía estadio 4»— y ésas son las que cambian el tratamiento.
 *
 * El umbral es de MÉTODO, no clínico: por debajo de un tercio de palabras sin
 * respaldo se acepta como variación de redacción (artículos, sinónimos, orden).
 * Por encima, hay contenido nuevo que nadie dijo.
 */
export const PROPORCION_SIN_RESPALDO = 1 / 3

/** Palabras que no aportan contenido: su ausencia en la entrada no significa nada. */
const VACIAS = new Set([
  'con', 'sin', 'para', 'por', 'que', 'del', 'las', 'los', 'una', 'uno', 'como',
  'este', 'esta', 'muy', 'mas', 'pero', 'sus', 'era', 'son', 'fue', 'hay',
])

export function sinSustento(valorNorm: string, entradaNorm: string, avaladoNorm = ''): boolean {
  const palabras = valorNorm.split(/\s+/).filter(w => w.length > 3 && !VACIAS.has(w))
  if (palabras.length === 0) return false
  const huerfanas = palabras.filter(w => !entradaNorm.includes(w) && !avaladoNorm.includes(w))
  return huerfanas.length / palabras.length > PROPORCION_SIN_RESPALDO
}

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

  /**
   * ── EL DETECTOR NO CAZABA LA ALUCINACIÓN QUE IMPORTA (6-ago-2026, REG-197) ─
   *
   * Medido con el propio motor antes de tocarlo, sobre la entrada «El paciente
   * tiene diabetes» y el oro «diabetes mellitus tipo 2»:
   *
   *   · «diabetes con nefropatía estadio 4 y retinopatía proliferativa»
   *     en un campo nuevo ................................ NO se detectaba
   *   · «diabetes mellitus tipo 2 con nefropatía estadio 4»
   *     dentro del campo esperado ........................ NO se detectaba
   *   · «lupus eritematoso sistémico» ..................... sí (caso fácil)
   *
   * Dos fallos que se sumaban:
   *
   * 1. **`some()` en vez de proporción.** Bastaba UNA palabra de más de tres
   *    letras presente en la entrada para dar por sustentado TODO el valor. Con
   *    «diabetes» dentro, la nefropatía y la retinopatía entraban gratis.
   * 2. **Los campos esperados no se revisaban.** `if (campo in oro.esperado)
   *    continue` los saltaba entero, así que lo inventado PEGADO a un dato
   *    correcto era invisible.
   *
   * Y ésa es justo la alucinación peligrosa: la que viaja adherida a algo cierto.
   * La invención total —sin una palabra en común— es la fácil, y era la única
   * que caía. Un arnés que sólo caza lo fácil mide la tranquilidad, no el riesgo.
   */
  for (const [campo, valor] of Object.entries(gen.campos)) {
    const v = norm(valor)
    if (!v) continue
    /** Lo que el oro ya avala para este campo no cuenta como añadido. */
    const avalado = campo in oro.esperado ? norm(oro.esperado[campo]) : ''
    /**
     * ── NO SE SALTA POR SER «EQUIVALENTE» ─────────────────────────────────
     *
     * Éste es el caso más peligroso y el que más costaba ver: el modelo
     * devuelve el diagnóstico CORRECTO **con un añadido inventado** —«diabetes
     * mellitus tipo 2 con nefropatía estadio 4»— y `equivalente()` lo da por
     * bueno porque contiene lo esperado. El arnés lo contaba como acierto.
     *
     * La equivalencia decide si el campo es CORRECTO; no decide si además
     * trae contenido que nadie dijo. Son dos preguntas distintas y antes las
     * respondía una sola.
     */
    /**
     * ── QUE EL GENERADO CONTENGA EL ORO NO LO ABSUELVE ───────────────────────
     *
     * Aquí se saltaba con `v.includes(ov)`: si el texto generado CONTIENE el
     * valor del oro, se daba por respaldado. Pero «diabetes mellitus tipo 2
     * **con nefropatía estadio 4**» contiene «diabetes mellitus tipo 2» — y es
     * justo el caso que hay que cazar. Contener el oro no significa no traer
     * nada de más: significa lo contrario.
     *
     * Se conserva el sentido útil: que el generado esté CONTENIDO en algún
     * valor del oro (es un subconjunto, no añade nada).
     */
    const contenidoEnElOro = oroValores.some(ov => ov.includes(v))
    if (contenidoEnElOro) continue
    if (!sinSustento(v, entradaNorm, avalado)) continue
    if (!alucinaciones.includes(campo)) alucinaciones.push(campo)
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

/* ═══════════════════════════════════════════════════════════════════════════
   LO QUE ESTE ARNÉS LE ENTREGA A LA COMPUERTA — REG-550, generalizado en REG-551.

   La compuerta que compara contra el umbral decidido vive en
   `contratos-de-evaluacion.ts`, con el tipo `Umbral` al que aplica. Aquí sólo
   queda la TRADUCCIÓN: qué mide este arnés y cómo se llama cada eje.

   ── CÓMO SE TRADUCE CADA EJE, Y POR QUÉ ASÍ ─────────────────────────────────

   El médico decidió (D-029) sobre «medicamentos o diagnósticos dictados que
   faltan» y «medicamentos añadidos». Este arnés mide CAMPOS. La traducción es de
   quien escribe el código, así que se dice entera y se elige siempre la lectura
   MÁS ESTRICTA — nunca la que hace pasar más fácil:

    · **perdida** ← `tasaError` = (faltantes + incorrectos) / esperados. Se
      cuentan también los INCORRECTOS. Un campo que llegó cambiado tampoco
      llegó: la enalapril que sale como enalaprilato no está «presente con
      matices», está mal. Contarlo dentro es más duro que la lectura literal de
      la palabra «perdida», y ése es el lado por el que se quiere errar.

    · **alucinacion** ← `alucinacionesPorCaso`. Con el umbral en cero el
      denominador da igual; se deja el promedio por caso para que el día que
      alguien lo suba por encima de cero, el número siga significando algo.
   ═════════════════════════════════════════════════════════════════════════ */

/** Lo que el arnés midió, traducido a los nombres de eje que usó el médico. */
export function medirEjes(r: ResumenEvaluacion): Record<string, number> {
  return { perdida: r.tasaError, alucinacion: r.alucinacionesPorCaso }
}

/** El escalón mínimo medible de cada eje. Un umbral por debajo no se ejerce. */
export function resolucionDelConjunto(r: ResumenEvaluacion): Record<string, number> {
  return {
    perdida: r.camposEsperados > 0 ? 1 / r.camposEsperados : 1,
    alucinacion: r.casos > 0 ? 1 / r.casos : 1,
  }
}

/** Lo que la compuerta necesita para juzgar una evaluación de campos. */
export function loMedidoDeLaNota(r: ResumenEvaluacion): LoMedido {
  return { hayConjunto: r.casos > 0, ejes: medirEjes(r), resolucion: resolucionDelConjunto(r) }
}
