/**
 * ¿ESTA EVIDENCIA APLICA A ESTE PACIENTE?
 *
 * ── EL HUECO QUE CIERRA (WS-09) ──────────────────────────────────────────────
 *
 * El programa lo tenía como `NOT_STARTED`, y no era «parcial»: `grep aplicabilidad`
 * sobre `src/` no devolvía **nada**. La adaptación al paciente era sólo por
 * prompt —«personaliza por edad, comorbilidades y alergias»— sin compuerta
 * determinista, sin cruce, y sin forma de decir «este paciente no cumple la
 * población del estudio».
 *
 * ── LA DECISIÓN DE DISEÑO MÁS IMPORTANTE: NO EXISTE EL VEREDICTO «APLICA» ────
 *
 * El veredicto máximo que este motor puede dar es **`nada_lo_excluye`**.
 *
 * No es humildad decorativa: es lo único honesto. Un criterio se lee en prosa,
 * este motor sólo entiende con certeza unos pocos patrones, y lo que no entiende
 * queda `no_evaluable`. Decir «aplica» significaría «he leído y comprobado todos
 * los criterios», que es falso siempre. `nada_lo_excluye` dice exactamente lo que
 * hizo: buscó motivos para excluir a este paciente y no encontró ninguno **de los
 * que sabe buscar** — y trae la cuenta de los que no supo leer.
 *
 * ── LAS CIFRAS SALEN DEL CRITERIO, NUNCA DE AQUÍ ────────────────────────────
 *
 * Este módulo **no define ni un solo umbral clínico**. Cuando un criterio dice
 * «mayores de 65 años» o «TFG < 30», el número sale del texto del estudio. Si el
 * estudio dijera otro número, el veredicto cambiaría — y hay un caso del golden
 * que lo prueba cambiando la cifra del criterio.
 *
 * Es la regla 1 de seguridad clínica: ninguna cifra se inventa.
 *
 * ── AUSENCIA DE DATO NO ES DATO DE AUSENCIA ─────────────────────────────────
 *
 * El caso que importa: un estudio que **excluye embarazadas** y una paciente cuyo
 * embarazo no consta. La respuesta correcta **no** es «aplica»: es
 * `datos_insuficientes`. Que nadie lo haya anotado no significa que no lo esté.
 *
 * Lo mismo con la función renal caduca: una TFG fuera de ventana (REG-375) **no
 * decide** un criterio renal. Un número viejo no es un número.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * **No decide conducta.** Dice si el paciente cabe en la población del estudio.
 * Que la evidencia aplique no significa que el tratamiento esté indicado, y que
 * no aplique no significa que esté contraindicado: las dos cosas las decide el
 * médico. Este motor no habla con ningún motor de dosis.
 *
 * Módulo PURO.
 */

/** Las dimensiones que este motor sabe leer con certeza. Todo lo demás, no. */
export type Dimension =
  | 'edad' | 'embarazo' | 'funcion_renal' | 'alergia'
  /** WS-09 — el criterio nombra una enfermedad que el paciente tiene o no. */
  | 'comorbilidad'
  /** WS-09 — el criterio nombra un fármaco que el paciente toma o ha tomado. */
  | 'terapia_previa'

export type Veredicto =
  /** El paciente satisface el criterio. */
  | 'cumple'
  /** El paciente NO lo satisface, y consta. */
  | 'no_cumple'
  /** Se reconoció la dimensión y falta el dato del paciente para decidir. */
  | 'datos_insuficientes'
  /** No se reconoció el criterio. No se intenta adivinar qué dice. */
  | 'no_evaluable'

export type Clase = 'inclusion' | 'exclusion'

export interface CriterioEvaluado {
  /** El criterio TAL CUAL viene del estudio. No se reescribe ni se resume. */
  readonly texto: string
  readonly clase: Clase
  readonly dimension: Dimension | null
  readonly veredicto: Veredicto
  /** Por qué salió ese veredicto, en palabras que el médico pueda contrastar. */
  readonly porQue: string
}

/**
 * Lo que el motor sabe del paciente.
 *
 * **Un campo ausente significa «no consta», nunca «no».** Por eso `embarazo` es
 * `boolean | undefined` y no `boolean`: un `false` por omisión convertiría a
 * todas las pacientes en no embarazadas.
 */
export interface EstadoDelPaciente {
  readonly edadEnAnios?: number
  readonly embarazo?: boolean
  /**
   * Filtrado glomerular con su vigencia. `vigente: false` (REG-375) hace que un
   * criterio renal salga `datos_insuficientes`: un número viejo no es un número.
   */
  readonly tfg?: { readonly valor: number; readonly vigente: boolean }
  /** Alérgenos del expediente, ya normalizados por quien los tenga. */
  readonly alergenos?: readonly string[]
  /**
   * Los problemas VIGENTES del paciente, tal como se escribieron.
   *
   * Vienen de `problemasActivos`, que ya excluye lo descartado y lo resuelto: un
   * criterio que excluya diabéticos no puede casar contra una diabetes que el
   * médico descartó.
   */
  readonly problemas?: readonly string[]
  /**
   * Lo que el paciente TOMA o ha tomado, tal como se escribió.
   *
   * Cubre las dos caras del mismo criterio —«tratamiento previo con X» y
   * «pacientes en tratamiento con X»—, que en un resumen se escriben igual y
   * distinguirlas exigiría leer el tiempo verbal. No se intenta: la dimensión se
   * llama `terapia_previa` y su frase dice exactamente qué se comprobó.
   */
  readonly medicamentos?: readonly string[]
}

export interface Aplicabilidad {
  readonly veredicto: 'no_aplica' | 'datos_insuficientes' | 'nada_lo_excluye'
  readonly criterios: readonly CriterioEvaluado[]
  /** Cuántos criterios no se supieron leer. Se cuenta, no se esconde. */
  readonly noLeidos: number
  /**
   * `true` cuando los criterios se sacaron de la PROSA de un resumen y no de una
   * lista declarada por el estudio. Cambia lo que se puede afirmar: no se
   * revisaron los criterios del estudio, se reconocieron frases sueltas.
   */
  readonly desdeResumen?: boolean
  readonly porQue: string
}

/* ── lectura de criterios ─────────────────────────────────────────────────── */

/** Sin acentos y en minúsculas: los criterios llegan escritos de mil maneras. */
function plano(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * LOS PATRONES VAN EN LOS DOS IDIOMAS, Y NO ES UN ADORNO.
 *
 * Los criterios estructurados llegan en español —los escribe el producto— y los
 * resúmenes de PubMed llegan en **inglés**. Un motor que sólo leyera español
 * declararía `no_evaluable` el 100 % de los resúmenes reales y parecería
 * prudente cuando en realidad estaría ciego.
 */
const EDAD_MINIMA = /(?:>=|≥|mayores?\s+de|a\s+partir\s+de|desde\s+los)\s*(\d{1,3})\s*anos|(?:aged?|age)\s*(?:>=|≥)?\s*(\d{1,3})\s*(?:years?)?\s*(?:or\s+older|and\s+older|or\s+above|and\s+above)|older\s+than\s*(\d{1,3})\s*years?/
const EDAD_MAXIMA = /(?:<=|≤|<|menores?\s+de|hasta\s+los)\s*(\d{1,3})\s*anos|younger\s+than\s*(\d{1,3})\s*years?|under\s+(?:the\s+age\s+of\s+)?(\d{1,3})\s*years?/
const EDAD_RANGO = /(\d{1,3})\s*(?:a|-|–|to)\s*(\d{1,3})\s*(?:anos|years)/
const EMBARAZO = /embaraz|gestant|gestacion|lactan|pregnan|lactat|breastfeed/
const RENAL = /(?:tfg|egfr|gfr|depuracion|aclaramiento|filtrado\s+glomerular|creatinine\s+clearance)[^0-9]{0,28}(<|<=|≤|menor\s+(?:de|a)|below|less\s+than)\s*(\d{1,3})/
const ALERGIA = /(?:alergia\s+(?:conocida\s+)?a|allergic\s+to|allergy\s+to)\s+(?:la\s+|el\s+|los\s+|las\s+)?([a-z][a-z\s]{2,30}?)(?:\s*[,.)]|$)/

/**
 * COMORBILIDAD y TERAPIA PREVIA — WS-09.
 *
 * Los dos capturan **el término que nombran**, no una enfermedad de catálogo: el
 * motor no sabe qué es una comorbilidad, sabe que el criterio dice «pacientes
 * con X» y va a mirar si X está en la lista de problemas del paciente. Un
 * vocabulario propio aquí sería criterio clínico inventado, y lo que falte de él
 * no se vigilaría sin que nadie lo supiera (regla 5).
 *
 * Por eso el patrón exige la PREPOSICIÓN («con», «with», «de novo» no cuela):
 * sin ella, «pacientes reclutados en 12 centros» daría una comorbilidad llamada
 * «reclutados».
 */
const COMORBILIDAD = /(?:pacientes?\s+con|diagn[oó]stico\s+de|historia\s+de|antecedente\s+de|patients?\s+with|history\s+of|known)\s+(?:la\s+|el\s+|los\s+|las\s+)?([a-z][a-z\s]{2,34}?)(?:\s*[,.);]|$)/
const TERAPIA_PREVIA = /(?:tratamiento\s+(?:previo\s+)?con|tratados?\s+(?:previamente\s+)?con|en\s+tratamiento\s+con|uso\s+(?:previo\s+)?de|prior\s+(?:treatment|therapy)\s+with|previously\s+treated\s+with|receiving|on\s+treatment\s+with)\s+(?:la\s+|el\s+|los\s+|las\s+)?([a-z][a-z\s]{2,30}?)(?:\s*[,.);]|$)/

/** Palabras que marcan una frase como criterio de EXCLUSIÓN, en los dos idiomas. */
const DICE_EXCLUSION = /exclu|excluid|no\s+se\s+incluyeron|not\s+eligible/

/**
 * Reconoce la dimensión de un criterio, o `null`.
 *
 * Sólo dispara con patrones que llevan su propio número o su propio término. La
 * regla 5 de seguridad clínica —señalar de menos, nunca de más— se aplica aquí:
 * un criterio que no encaje **no se interpreta**, se declara `no_evaluable`.
 */
export function dimensionDe(texto: string): Dimension | null {
  const t = plano(texto)
  if (RENAL.test(t)) return 'funcion_renal'
  if (EDAD_MINIMA.test(t) || EDAD_MAXIMA.test(t) || EDAD_RANGO.test(t)) return 'edad'
  if (EMBARAZO.test(t)) return 'embarazo'
  if (ALERGIA.test(t)) return 'alergia'
  /* Después de alergia a propósito: «alergia conocida a penicilina» también casa
     con COMORBILIDAD por el «conocida», y la alergia es la lectura correcta. */
  if (TERAPIA_PREVIA.test(t)) return 'terapia_previa'
  if (COMORBILIDAD.test(t)) return 'comorbilidad'
  return null
}

/**
 * Palabras que cierran el término: lo que viene después ya no es su nombre.
 *
 * Sin esto, «previously treated with rituximab were excluded» capturaba
 * «rituximab were excluded» y no casaba con «Rituximab 375 mg/m²» — el paciente
 * SÍ lo tomaba y el motor decía que no. Se vio al escribir el caso, no después.
 */
const CIERRA_EL_TERMINO = /\b(?:were|was|is|are|had|have|has|will|who|whom|which|that|and|or|for|from|in|at|prior|previously|fueron|fue|es|son|que|quienes|con|sin|para|de|del|la|el|los|las|y|o)\b/

/** Corta el término en la primera palabra que no puede ser parte de su nombre. */
function recortaTermino(t: string): string {
  const m = CIERRA_EL_TERMINO.exec(t)
  return (m && m.index > 0 ? t.slice(0, m.index) : t).trim()
}

/**
 * ¿Nombra el criterio algo que está en esta lista del paciente?
 *
 * Dos pasadas, y las dos hacen falta:
 *
 *  1. **Contención**, igual que las alergias: «diabetes» contra «diabetes
 *     mellitus tipo 2» tiene que casar, porque el expediente y el resumen nunca
 *     escriben lo mismo igual.
 *  2. **Por palabra**, para lo que la contención no alcanza: un término de
 *     varias palabras no está contenido en la entrada del expediente ni al
 *     revés, y sin esto un fármaco reconocido correctamente se declararía
 *     ausente.
 *
 * El mínimo de cuatro letras en la segunda pasada no es cosmético: sin él,
 * partículas como «con» o «de» casarían con cualquier cosa y el motor señalaría
 * de más — que es lo que la regla 5 prohíbe.
 */
function nombraAlgoDe(termino: string, lista: readonly string[]): string | null {
  const t = recortaTermino(plano(termino))
  if (t.length < 3) return null
  for (const x of lista) {
    const p = plano(x).trim()
    if (!p) continue
    if (p.includes(t) || t.includes(p)) return x
  }
  const palabras = t.split(/\s+/).filter(w => w.length >= 4)
  for (const x of lista) {
    const p = plano(x).trim()
    if (p && palabras.some(w => p.includes(w))) return x
  }
  return null
}

/** Criterio que habla de una enfermedad del paciente. */
function evaluarComorbilidad(t: string, p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  const m = COMORBILIDAD.exec(t)
  if (!m) return { v: 'no_evaluable', porQue: 'No se pudo leer de qué condición habla.' }
  const termino = m[1].trim()
  if (!p.problemas) {
    return { v: 'datos_insuficientes', porQue: `El criterio habla de «${termino}» y no consta la lista de problemas del paciente.` }
  }
  const hallado = nombraAlgoDe(termino, p.problemas)
  return {
    v: hallado ? 'cumple' : 'no_cumple',
    porQue: hallado
      ? `El expediente registra «${hallado}», que el criterio nombra como «${termino}».`
      : `El criterio pide «${termino}» y no está entre los ${p.problemas.length} problemas vigentes del expediente.`,
  }
}

/** Criterio que habla de un fármaco que el paciente toma o ha tomado. */
function evaluarTerapiaPrevia(t: string, p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  const m = TERAPIA_PREVIA.exec(t)
  if (!m) return { v: 'no_evaluable', porQue: 'No se pudo leer de qué tratamiento habla.' }
  const termino = m[1].trim()
  if (!p.medicamentos) {
    return { v: 'datos_insuficientes', porQue: `El criterio habla de tratamiento con «${termino}» y no consta la lista de medicamentos.` }
  }
  const hallado = nombraAlgoDe(termino, p.medicamentos)
  return {
    v: hallado ? 'cumple' : 'no_cumple',
    porQue: hallado
      ? `El expediente registra «${hallado}», que el criterio nombra como «${termino}».`
      : `El criterio pide tratamiento con «${termino}» y no consta entre los ${p.medicamentos.length} medicamentos del expediente.`,
  }
}

/** ¿Satisface el paciente lo que dice este criterio de edad? */
function evaluarEdad(t: string, p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  if (p.edadEnAnios === undefined) {
    return { v: 'datos_insuficientes', porQue: 'El criterio habla de edad y el expediente no la trae.' }
  }
  const rango = EDAD_RANGO.exec(t)
  if (rango) {
    const [, desde, hasta] = rango.map(Number)
    const dentro = p.edadEnAnios >= desde && p.edadEnAnios <= hasta
    return {
      v: dentro ? 'cumple' : 'no_cumple',
      porQue: `El paciente tiene ${p.edadEnAnios} años y el criterio pide entre ${desde} y ${hasta}.`,
    }
  }
  const minima = EDAD_MINIMA.exec(t)
  if (minima) {
    const corte = Number(minima.slice(1).find(x => x !== undefined))
    return {
      v: p.edadEnAnios >= corte ? 'cumple' : 'no_cumple',
      porQue: `El paciente tiene ${p.edadEnAnios} años y el criterio pide ${corte} o más.`,
    }
  }
  const maxima = EDAD_MAXIMA.exec(t)
  if (maxima) {
    const corte = Number(maxima.slice(1).find(x => x !== undefined))
    return {
      v: p.edadEnAnios < corte ? 'cumple' : 'no_cumple',
      porQue: `El paciente tiene ${p.edadEnAnios} años y el criterio pide menos de ${corte}.`,
    }
  }
  return { v: 'no_evaluable', porQue: 'Se reconoció que habla de edad, pero no la forma del corte.' }
}

function evaluarRenal(t: string, p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  const m = RENAL.exec(t)
  if (!m) return { v: 'no_evaluable', porQue: 'No se pudo leer el corte de función renal.' }
  const corte = Number(m[2])
  if (!p.tfg) {
    return { v: 'datos_insuficientes', porQue: 'El criterio pide función renal y el expediente no la trae.' }
  }
  if (!p.tfg.vigente) {
    /* REG-375: fuera de ventana no decide. Un número viejo no es un número. */
    return {
      v: 'datos_insuficientes',
      porQue: 'La función renal del expediente está fuera de la ventana de vigencia: no se usa para decidir.',
    }
  }
  return {
    v: p.tfg.valor < corte ? 'cumple' : 'no_cumple',
    porQue: `La TFG del paciente es ${p.tfg.valor} y el criterio habla de menos de ${corte}.`,
  }
}

function evaluarEmbarazo(p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  if (p.embarazo === undefined) {
    /**
     * EL CASO QUE JUSTIFICA TODO EL MÓDULO. Que nadie lo haya anotado no
     * significa que no lo esté, y un estudio que excluye embarazadas no puede
     * darse por aplicable a una paciente cuyo embarazo no consta.
     */
    return { v: 'datos_insuficientes', porQue: 'El embarazo no consta en el expediente. No consta ≠ no lo está.' }
  }
  return {
    v: p.embarazo ? 'cumple' : 'no_cumple',
    porQue: p.embarazo ? 'El expediente registra embarazo.' : 'El expediente registra que no cursa embarazo.',
  }
}

function evaluarAlergia(t: string, p: EstadoDelPaciente): { v: Veredicto; porQue: string } {
  const m = ALERGIA.exec(t)
  if (!m) return { v: 'no_evaluable', porQue: 'No se pudo leer a qué alergia se refiere.' }
  const alergeno = m[1].trim()
  if (!p.alergenos) {
    return { v: 'datos_insuficientes', porQue: `El criterio habla de alergia a ${alergeno} y no consta la lista de alergias.` }
  }
  const tiene = p.alergenos.some(a => plano(a).includes(alergeno) || alergeno.includes(plano(a)))
  return {
    v: tiene ? 'cumple' : 'no_cumple',
    porQue: tiene
      ? `El expediente registra alergia a ${alergeno}.`
      : `El expediente no registra alergia a ${alergeno} entre las ${p.alergenos.length} anotadas.`,
  }
}

/** Evalúa UN criterio contra el estado del paciente. */
export function evaluarCriterio(texto: string, clase: Clase, p: EstadoDelPaciente): CriterioEvaluado {
  const dimension = dimensionDe(texto)
  const t = plano(texto)
  const r =
    dimension === 'edad' ? evaluarEdad(t, p)
    : dimension === 'funcion_renal' ? evaluarRenal(t, p)
    : dimension === 'embarazo' ? evaluarEmbarazo(p)
    : dimension === 'alergia' ? evaluarAlergia(t, p)
    : dimension === 'comorbilidad' ? evaluarComorbilidad(t, p)
    : dimension === 'terapia_previa' ? evaluarTerapiaPrevia(t, p)
    : { v: 'no_evaluable' as Veredicto, porQue: 'Este motor no sabe leer este criterio. No se interpreta.' }
  return { texto, clase, dimension, veredicto: r.v, porQue: r.porQue }
}

/* ── el veredicto de conjunto ─────────────────────────────────────────────── */

/**
 * ¿Cabe este paciente en la población del estudio?
 *
 * El orden de decisión no es arbitrario:
 *
 *  1. **Excluir gana.** Si el paciente satisface un criterio de exclusión, o
 *     incumple uno de inclusión, no aplica. Punto.
 *  2. **La duda gana a la tranquilidad.** Si algún criterio quedó en
 *     `datos_insuficientes`, el conjunto es `datos_insuficientes` — nunca se
 *     redondea hacia «no lo excluye» porque lo demás saliera bien.
 *  3. **Y lo máximo es `nada_lo_excluye`**, con la cuenta de lo que no se leyó.
 */
export function aplicabilidad(
  criterios: readonly { texto: string; clase: Clase }[],
  paciente: EstadoDelPaciente,
): Aplicabilidad {
  const evaluados = criterios.map(c => evaluarCriterio(c.texto, c.clase, paciente))
  const noLeidos = evaluados.filter(c => c.veredicto === 'no_evaluable').length

  const excluye = evaluados.filter(
    c => (c.clase === 'exclusion' && c.veredicto === 'cumple') ||
         (c.clase === 'inclusion' && c.veredicto === 'no_cumple'),
  )
  if (excluye.length > 0) {
    return {
      veredicto: 'no_aplica',
      criterios: evaluados,
      noLeidos,
      porQue: `Este paciente queda fuera de la población: ${excluye.map(c => c.porQue).join(' ')}`,
    }
  }

  const dudosos = evaluados.filter(c => c.veredicto === 'datos_insuficientes')
  if (dudosos.length > 0) {
    return {
      veredicto: 'datos_insuficientes',
      criterios: evaluados,
      noLeidos,
      porQue: `Falta un dato para saber si aplica: ${dudosos.map(c => c.porQue).join(' ')}`,
    }
  }

  return {
    veredicto: 'nada_lo_excluye',
    criterios: evaluados,
    noLeidos,
    porQue: noLeidos > 0
      ? `Nada de lo que este motor sabe leer excluye a este paciente. Quedan ${noLeidos} criterios sin leer.`
      : 'Nada de lo que este motor sabe leer excluye a este paciente.',
  }
}

/**
 * Cuando la población del estudio **no se conoce** (`Declarado.conocido: false`),
 * la respuesta no es «aplica»: es que no hay contra qué comprobarlo.
 */
export function sinPoblacionDeclarada(motivo: string): Aplicabilidad {
  return {
    veredicto: 'datos_insuficientes',
    criterios: [],
    noLeidos: 0,
    porQue: `El estudio no declara su población (${motivo}): no hay contra qué comprobar a este paciente.`,
  }
}

/* ── el camino del resumen de PubMed ──────────────────────────────────────── */

/**
 * Saca de un resumen las frases que este motor SABE leer.
 *
 * ── POR QUÉ ESTO NO ES «LA LISTA DE CRITERIOS DEL ESTUDIO» ───────────────────
 *
 * Un resumen no trae criterios estructurados: trae prosa. Lo que sale de aquí son
 * las frases en las que se reconoció una dimensión, y **nada más**. Las demás no
 * se cuentan como «criterios sin leer» —serían decenas, y el aviso se volvería
 * ruido— pero tampoco se dan por leídas: por eso el resultado que las usa lleva
 * `desdeResumen`, y su frase dice de dónde salió.
 *
 * La clase se decide por la palabra: una frase que dice «excluded» o «se
 * excluyeron» es de exclusión. Es una heurística, y por eso sólo se aplica a
 * frases cuya dimensión ya se reconoció.
 */
export function criteriosDelResumen(resumen: string): { texto: string; clase: Clase }[] {
  return resumen
    .split(/(?<=[.;])\s+/)
    .map(f => f.trim())
    .filter(f => f.length > 0 && dimensionDe(f) !== null)
    .map(f => ({ texto: f, clase: DICE_EXCLUSION.test(plano(f)) ? ('exclusion' as const) : ('inclusion' as const) }))
}

/**
 * Aplicabilidad a partir del resumen de un artículo.
 *
 * Es el camino que existe hoy de verdad: los artículos llegan de PubMed con su
 * resumen, y la población estructurada todavía no la produce nadie.
 */
export function aplicabilidadDesdeResumen(resumen: string, paciente: EstadoDelPaciente): Aplicabilidad {
  const criterios = criteriosDelResumen(resumen)
  if (criterios.length === 0) {
    return {
      veredicto: 'datos_insuficientes',
      criterios: [],
      noLeidos: 0,
      desdeResumen: true,
      porQue: 'En el resumen no se reconoció ninguna frase sobre la población que este motor sepa leer.',
    }
  }
  return { ...aplicabilidad(criterios, paciente), desdeResumen: true }
}

/** Una frase para la pantalla. Describe; no recomienda. */
export function comoSeDiceLaAplicabilidad(a: Aplicabilidad): string {
  const de = a.desdeResumen ? ' (según lo que dice el resumen)' : ''
  if (a.veredicto === 'no_aplica') return `Este paciente queda fuera de la población del estudio${de}`
  if (a.veredicto === 'datos_insuficientes') return `No se puede saber si aplica a este paciente${de}`
  return a.noLeidos > 0
    ? `Nada lo excluye${de} · ${a.noLeidos} criterios sin leer`
    : `Nada lo excluye${de}`
}

export const POR_QUE_NO_EXISTE_APLICA =
  'El veredicto máximo es «nada lo excluye» y no «aplica». Decir «aplica» afirmaría ' +
  'haber leído y comprobado TODOS los criterios, y este motor sólo entiende con ' +
  'certeza unos pocos patrones: lo que no entiende queda no_evaluable y se cuenta. ' +
  'Un motor que redondea su ignorancia hacia arriba es peor que no tenerlo.'

export const DE_DONDE_SALEN_LAS_CIFRAS =
  'De ninguna parte de este archivo. Cuando un criterio dice «mayores de 65 años» o ' +
  '«TFG < 30», el número sale del texto del estudio; si el estudio dijera otro, el ' +
  'veredicto cambiaría. Este módulo no define ni un solo umbral clínico.'

export const LO_QUE_NO_DECIDE =
  'Si el paciente cabe en la población del estudio. NO si el tratamiento está ' +
  'indicado: que la evidencia aplique no lo indica, y que no aplique no lo ' +
  'contraindica. Eso lo decide el médico, y este motor no habla con ninguno de dosis.'
