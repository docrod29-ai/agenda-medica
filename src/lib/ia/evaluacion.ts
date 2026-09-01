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

import { esperaAlMedico, type Umbral } from './contratos-de-evaluacion'

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
 * LA COMPUERTA DEL UMBRAL — el número decidido se APLICA, no sólo se declara.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El 31-ago-2026 el médico dueño fijó el primero de los quince umbrales de IA
 * (D-029, REG-446): para `nota-consulta`, hasta 1 de cada 100 campos dictados
 * puede perderse, y CERO inventados. Quedó escrito en el contrato, con su
 * fuente y sus dos ejes.
 *
 * Y ahí se paró. El contrato lo **declaraba** y nadie corría la evaluación
 * contra él: el arnés medía por un lado, el número vivía por otro, y entre los
 * dos no había función alguna. Un umbral que no reprueba nada es exactamente lo
 * que el propio contrato llama una métrica decorativa — sólo que esta vez la
 * decoración la habríamos puesto nosotros, encima de una decisión que el médico
 * sí tomó.
 *
 * Es la familia «escrito y sin conectar» de la regla *el dato tiene que LLEGAR*,
 * aplicada a un número en vez de a un campo.
 *
 * ── CÓMO SE TRADUCE CADA EJE A LO QUE EL ARNÉS MIDE ─────────────────────────
 *
 * El médico decidió sobre «medicamentos o diagnósticos dictados que faltan» y
 * «medicamentos añadidos». El arnés mide campos. La traducción es de quien
 * escribe el código, así que se dice entera y se elige siempre la lectura MÁS
 * ESTRICTA — nunca la que hace pasar más fácil:
 *
 *  · **perdida** ← `resumen.tasaError` = (faltantes + incorrectos) / esperados.
 *    Se cuentan también los INCORRECTOS, no sólo los ausentes. Un campo que
 *    llegó cambiado tampoco llegó: la enalapril que sale como enalaprilato no
 *    está «presente con matices», está mal. Contarlo dentro es más duro que la
 *    lectura literal de la palabra «perdida», y ése es el lado por el que se
 *    quiere errar.
 *
 *  · **alucinacion** ← `resumen.alucinacionesPorCaso`. Con el umbral en cero el
 *    denominador da igual; se deja el promedio por caso para que el día que
 *    alguien lo suba por encima de cero, el número siga significando algo.
 *
 * ── LO QUE NO ES VERDE ──────────────────────────────────────────────────────
 *
 * Tres cosas que un lector distraído leería como «pasa» y aquí no lo son:
 *
 *  1. **Un umbral que todavía espera al médico.** `NEEDS_CLINICAL_REVIEW` no es
 *     permiso: es una decisión sin tomar. Catorce de las quince capacidades
 *     están así hoy.
 *  2. **Un conjunto vacío.** Cero casos dan cero errores y cero alucinaciones.
 *     Si borrar el corpus pusiera la compuerta en verde, la compuerta mediría
 *     el corpus y no el producto.
 *  3. **Un eje que este arnés no sabe medir.** Si mañana el contrato declara un
 *     eje nuevo, la compuerta lo dice en vez de ignorarlo. Ausencia de medida no
 *     es medida de ausencia.
 *
 * ── LO QUE ESTA COMPUERTA **NO** HACE ───────────────────────────────────────
 *
 * No mide el producto con pacientes reales, y el número que produce no es la
 * tasa de alucinación de Ausculta: el conjunto es sintético, pequeño y nuestro.
 * Y —lo importante— **es demasiado pequeño para ejercer el 1 % que el médico
 * fijó**: con cuatro campos esperados, el escalón más pequeño que se puede medir
 * es 25 %, veinticinco veces el umbral. Hoy la compuerta se comporta, en el eje
 * `perdida`, como si el umbral fuera cero. Eso es más estricto, no más laxo, y
 * por eso se aplica igual — pero se DECLARA en cada lectura
 * (`elConjuntoNoAlcanzaElUmbral`), porque nadie debe creer que el 1 % está
 * puesto a prueba. Para ejercerlo de verdad hacen falta ≥ 100 campos esperados,
 * y ese conjunto no existe todavía.
   ═════════════════════════════════════════════════════════════════════════ */

/** Los ejes que este arnés sabe medir. Cualquier otro se declara no medible. */
export type NombreDeEje = 'perdida' | 'alucinacion'

export const EJES_MEDIBLES: readonly NombreDeEje[] = Object.freeze(['perdida', 'alucinacion'])

export interface EjeMedido {
  readonly nombre: string
  /** `null` cuando este arnés no sabe medir el eje que el contrato declara. */
  readonly medido: number | null
  readonly umbral: number
  readonly veredicto: 'pasa' | 'reprueba' | 'no_se_puede_medir'
  /** El escalón más pequeño distinto de cero que este conjunto puede medir. */
  readonly resolucion: number
  /** El conjunto es tan pequeño que no puede distinguir el umbral del cero. */
  readonly elConjuntoNoAlcanzaElUmbral: boolean
}

export type Veredicto =
  /** Todos los ejes medidos quedan en o por debajo de su umbral. */
  | 'pasa'
  /** Al menos un eje se pasó. */
  | 'reprueba'
  /** El umbral lo tiene que fijar alguien con cédula. No es permiso. */
  | 'sin_umbral_decidido'
  /** No se midió nada: cero casos. No es permiso. */
  | 'sin_conjunto'
  /** El contrato declara un eje que este arnés no sabe medir. No es permiso. */
  | 'sin_ejes_medibles'

export interface LecturaDeLaCompuerta {
  readonly veredicto: Veredicto
  readonly ejes: readonly EjeMedido[]
  readonly porQue: string
}

/** Lo que el arnés midió, traducido a los nombres de eje que usó el médico. */
export function medirEjes(r: ResumenEvaluacion): Record<NombreDeEje, number> {
  return {
    perdida: r.tasaError,
    alucinacion: r.alucinacionesPorCaso,
  }
}

/** El escalón mínimo medible de cada eje. Un umbral por debajo no se ejerce. */
export function resolucionDelConjunto(r: ResumenEvaluacion): Record<NombreDeEje, number> {
  return {
    perdida: r.camposEsperados > 0 ? 1 / r.camposEsperados : 1,
    alucinacion: r.casos > 0 ? 1 / r.casos : 1,
  }
}

export const UN_SOLO_NUMERO_CUBRE_LOS_DOS_EJES =
  'El contrato declara un umbral único, sin ejes. Se aplica el MISMO número a '
  + 'los dos: repartirlo sería inventar una asimetría que nadie decidió.'

export const PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE =
  'El umbral de esta capacidad todavía lo tiene que fijar alguien con cédula. '
  + 'NEEDS_CLINICAL_REVIEW no es permiso: es una decisión sin tomar, y una '
  + 'compuerta que la leyera como aprobada convertiría el hueco en un visto bueno.'

export const PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE =
  'Cero casos dan cero errores y cero alucinaciones. Si borrar el corpus pusiera '
  + 'la compuerta en verde, la compuerta mediría el corpus y no el producto.'

/**
 * Aplica el umbral decidido a lo que el arnés midió.
 *
 * Nunca devuelve `pasa` por omisión: si falta el umbral, falta el conjunto o
 * falta la medida de un eje, lo dice con su propio veredicto.
 */
export function aplicarUmbral(umbral: Umbral, resumen: ResumenEvaluacion): LecturaDeLaCompuerta {
  if (esperaAlMedico(umbral)) {
    return { veredicto: 'sin_umbral_decidido', ejes: [], porQue: PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE }
  }

  if (resumen.casos === 0) {
    return { veredicto: 'sin_conjunto', ejes: [], porQue: PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE }
  }

  const medido = medirEjes(resumen)
  const resolucion = resolucionDelConjunto(resumen)

  const declarados = umbral.ejes ?? EJES_MEDIBLES.map(nombre => ({
    nombre, valor: umbral.valor, porQue: UN_SOLO_NUMERO_CUBRE_LOS_DOS_EJES,
  }))

  const ejes: EjeMedido[] = declarados.map(e => {
    const sabeMedirlo = (EJES_MEDIBLES as readonly string[]).includes(e.nombre)
    if (!sabeMedirlo) {
      return {
        nombre: e.nombre, medido: null, umbral: e.valor,
        veredicto: 'no_se_puede_medir', resolucion: 1, elConjuntoNoAlcanzaElUmbral: false,
      }
    }
    const nombre = e.nombre as NombreDeEje
    const m = medido[nombre]
    const res = resolucion[nombre]
    return {
      nombre,
      medido: m,
      umbral: e.valor,
      veredicto: m <= e.valor ? 'pasa' : 'reprueba',
      resolucion: res,
      elConjuntoNoAlcanzaElUmbral: e.valor > 0 && e.valor < res,
    }
  })

  const reprobados = ejes.filter(e => e.veredicto === 'reprueba')
  if (reprobados.length > 0) {
    return {
      veredicto: 'reprueba',
      ejes,
      porQue: reprobados.map(e => `${e.nombre}: ${e.medido} > ${e.umbral}`).join('; '),
    }
  }

  const sinMedir = ejes.filter(e => e.veredicto === 'no_se_puede_medir')
  if (sinMedir.length > 0) {
    return {
      veredicto: 'sin_ejes_medibles',
      ejes,
      porQue:
        `El contrato declara ${sinMedir.map(e => `«${e.nombre}»`).join(', ')} y este arnés no sabe medirlo. `
        + 'Ausencia de medida no es medida de ausencia: no se da por bueno.',
    }
  }

  const noEjercidos = ejes.filter(e => e.elConjuntoNoAlcanzaElUmbral)
  return {
    veredicto: 'pasa',
    ejes,
    porQue: noEjercidos.length === 0
      ? 'Todos los ejes quedan en o por debajo de su umbral.'
      : `Pasa, pero el conjunto es demasiado pequeño para ejercer ${noEjercidos.map(e => `«${e.nombre}»`).join(', ')}: `
        + `el escalón mínimo medible (${noEjercidos.map(e => e.resolucion).join(', ')}) es mayor que el umbral. `
        + 'De hecho se está aplicando como si fuera cero.',
  }
}

/**
 * EL ÚNICO SITIO DONDE SE DEFINE «VERDE».
 *
 * Existe para que ningún llamador escriba `veredicto !== 'reprueba'` y convierta
 * los tres huecos —umbral pendiente, conjunto vacío, eje sin medir— en un visto
 * bueno por descuido.
 */
export function esVerde(l: LecturaDeLaCompuerta): boolean {
  return l.veredicto === 'pasa'
}

export const LO_QUE_ESTA_COMPUERTA_NO_HACE: readonly string[] = Object.freeze([
  'No mide el producto con pacientes reales: el conjunto es sintético, pequeño y nuestro. El número que da NO es la tasa de alucinación de Ausculta.',
  'No ejerce el 1 % que fijó el médico: con cuatro campos esperados el escalón mínimo medible es 25 %. Hoy se comporta como un cero en el eje `perdida` —más estricto, no más laxo— y lo declara en cada lectura.',
  'No corre en producción ni bloquea una nota. Es una compuerta del CI: dice si las defensas deterministas siguen en pie entre una versión y la siguiente.',
  'No sabe si la traducción de eje a métrica es la que el médico tenía en la cabeza. Se eligió la lectura más estricta y se dejó escrita para que él la pueda desmentir.',
])
