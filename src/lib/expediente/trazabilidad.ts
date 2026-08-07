/**
 * ¿DE DÓNDE SALIÓ ESTO? — trazabilidad nota ↔ dictado (§B10 del charter).
 *
 * ── LA PREGUNTA QUE UN MÉDICO NO PUEDE CONTESTAR SOLO ────────────────────────
 *
 * Frente a una nota generada, la duda no es «¿está bien redactada?». Es:
 *
 *     «¿de dónde sacó la IA esto?»
 *
 * Hoy la única forma de contestarla es **volver a oír la consulta entera**. Y un
 * médico que tiene que reescuchar veinte minutos para comprobar una línea no
 * comprueba: firma.
 *
 * Este módulo enlaza cada afirmación de la nota con **el fragmento del dictado
 * que la sostiene**. El médico resalta y ve de dónde salió.
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y ES IMPORTANTE ─────────────────────────────
 *
 * **No dice que la afirmación sea verdad.** Dice que hay un fragmento que la
 * sostiene. Son cosas distintas: el paciente pudo equivocarse, o el reconocedor
 * pudo transcribir mal. Lo que esto elimina es una clase concreta y frecuente
 * —la frase que **nadie dijo**— no todas.
 *
 * Tampoco elige por el médico. Cuando no encuentra respaldo **lo dice**, en vez
 * de enlazar al fragmento menos malo. Un enlace inventado sería peor que ninguno:
 * daría por comprobado justo lo que hay que comprobar.
 *
 * ── POR QUÉ ES DETERMINISTA ──────────────────────────────────────────────────
 *
 * Podría pedírsele al modelo que citara sus fuentes. No se hace: un modelo que
 * inventa una frase también puede inventar de dónde la sacó, y entonces el
 * enlace **certifica la alucinación en vez de delatarla**. El emparejamiento se
 * hace sobre el texto, con reglas que se pueden leer.
 *
 * Módulo PURO, sin dependencias.
 */

export interface Segmento {
  /** El texto del fragmento, tal como se dictó. */
  texto: string
  /** Posición en el dictado, para poder resaltarlo. */
  desde: number
  hasta: number
  /** Índice del segmento, estable dentro de un mismo dictado. */
  i: number
}

export interface Respaldo {
  /** La afirmación de la nota. */
  afirmacion: string
  /** El fragmento que la sostiene, si lo hay. */
  segmento?: Segmento
  /** Proporción de palabras de contenido halladas: 0 a 1. */
  cobertura: number
  /** Palabras de la afirmación que NO aparecen en ningún fragmento. */
  huerfanas: readonly string[]
  estado: 'respaldada' | 'parcial' | 'sin_respaldo'
}

/**
 * Umbral de MÉTODO, no clínico.
 *
 * Por encima de esta proporción de palabras de contenido halladas, se considera
 * que el fragmento sostiene la afirmación. Por debajo de `MINIMO_PARCIAL` no se
 * enlaza nada.
 *
 * Los dos números salen de la misma idea que ya usa el arnés de alucinación
 * (`PROPORCION_SIN_RESPALDO`): una nota inventada casi nunca es un texto entero
 * falso — es un texto correcto **con dos palabras de más**, y ésas son las que
 * cambian el tratamiento.
 */
export const COBERTURA_RESPALDADA = 0.7
export const MINIMO_PARCIAL = 0.35

/** Palabras sin contenido: su ausencia en el dictado no significa nada. */
const VACIAS = new Set([
  'con', 'sin', 'para', 'por', 'que', 'del', 'las', 'los', 'una', 'uno', 'como',
  'este', 'esta', 'esto', 'muy', 'mas', 'pero', 'sus', 'era', 'son', 'fue', 'hay',
  'the', 'and', 'refiere', 'presenta', 'paciente', 'niega', 'segun', 'sobre',
  'desde', 'hasta', 'entre', 'cuando', 'donde', 'porque', 'tambien', 'ademas',
])

/**
 * LO QUE EL PACIENTE DICE ↔ LO QUE EL MÉDICO ESCRIBE.
 *
 * ── EL FALSO POSITIVO QUE HABRÍA MATADO ESTA FUNCIÓN ────────────────────────
 *
 * Medido sobre una nota realista, el motor marcaba como «nadie dijo»:
 *
 *     cefalea          ← «dolor de cabeza»
 *     colecistectomía  ← «me operaron de la vesícula»
 *     madre            ← «mi mamá»
 *
 * Las tres son **traducciones correctas** que un médico hace al redactar. Un
 * aviso que las señala se aprende a cerrar en dos consultas, y entonces deja de
 * proteger de lo que sí importa — que en esa misma nota era «nefropatía
 * diabética estadio 4», inventada de cero.
 *
 * ── LA REGLA DE ESTA TABLA, Y POR QUÉ ES ESTRECHA ───────────────────────────
 *
 * Sólo **sinónimos entre el habla del paciente y el término técnico**. Nunca una
 * inferencia clínica. «Dolor de cabeza» ES cefalea; «cada mañana» NO es «cada 24
 * horas» —eso es una interpretación de la pauta— y por eso se sigue marcando.
 *
 * Es lingüística, no medicina. Y es exactamente el tipo de activo que no viene
 * con ninguna API: la tabla del español que se habla en un consultorio mexicano.
 */
const SINONIMOS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['cefalea', ['dolor', 'cabeza']],
  ['colecistectomia', ['vesicula']],
  ['apendicectomia', ['apendice']],
  ['histerectomia', ['matriz']],
  ['madre', ['mama', 'jefa']],
  ['padre', ['papa', 'jefe']],
  ['pirosis', ['agruras', 'acidez']],
  ['disnea', ['falta', 'aire', 'ahogo']],
  ['emesis', ['vomito', 'vomitos']],
  ['nausea', ['asco', 'nauseas']],
  ['artralgia', ['dolor', 'articulaciones', 'coyunturas']],
  ['mialgia', ['dolor', 'musculos', 'cuerpo']],
  ['astenia', ['cansancio', 'debilidad']],
  ['adinamia', ['sin', 'fuerzas', 'decaido']],
  ['diaforesis', ['sudor', 'sudoracion']],
  ['prurito', ['comezon']],
  ['disuria', ['arde', 'orinar', 'ardor']],
  ['poliuria', ['orina', 'mucho']],
  ['polidipsia', ['sed']],
  ['epistaxis', ['sangrado', 'nariz']],
  ['hiporexia', ['sin', 'hambre', 'apetito']],
  ['lumbalgia', ['dolor', 'espalda', 'cintura']],
  ['odinofagia', ['dolor', 'garganta', 'tragar']],
  ['rinorrea', ['escurrimiento', 'moco', 'nariz']],
  ['mareo', ['mareos', 'vahido']],
  ['sincope', ['desmayo', 'desmaye']],
  ['convulsion', ['ataque', 'convulsiones']],
  ['edema', ['hinchado', 'hinchazon', 'inflamado']],
]

/**
 * ¿Esta palabra técnica está respaldada por el habla del paciente?
 *
 * Basta con que **una** de las palabras del habla aparezca en el dictado:
 * «dolor de cabeza» puede dictarse como «me duele la cabeza», y exigir las dos
 * devolvería el falso positivo por otra puerta.
 */
function respaldadaPorSinonimo(palabra: string, enDictado: ReadonlySet<string>): boolean {
  for (const [tecnica, habla] of SINONIMOS) {
    if (palabra === tecnica && habla.some(h => enDictado.has(h))) return true
  }
  return false
}

/**
 * Misma palabra con otra terminación: «tomo» ↔ «toma», «operaron» ↔ «operar».
 *
 * Se exige raíz de 5 letras y palabras de 6 o más, para no emparejar «dolor»
 * con «dolencia» ni cosas peores. Es un apaño de conjugación, no un lematizador:
 * dicho así porque un lematizador de verdad es otra decisión.
 */
function mismaRaiz(a: string, b: string): boolean {
  if (a.length < 6 || b.length < 6) return false
  return a.slice(0, 5) === b.slice(0, 5)
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:()¿?¡!"']/g, ' ').replace(/\s+/g, ' ').trim()

/** Las palabras que de verdad cargan significado clínico. */
function contenido(texto: string): string[] {
  return norm(texto).split(/\s+/).filter(w => w.length > 3 && !VACIAS.has(w))
}

/**
 * Parte el dictado en fragmentos localizables.
 *
 * Se corta por puntuación fuerte y salto de línea. No por conectores: aquí
 * interesa **poder señalar** un trozo del dictado, no separar ideas — para eso
 * están los motores de negación, temporalidad, experienciador y certeza.
 */
export function segmentar(dictado: string): Segmento[] {
  const t = String(dictado ?? '')
  const out: Segmento[] = []
  const re = /[^.;:!?\n]+[.;:!?]*/gu
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(t))) {
    const texto = m[0].trim()
    if (!texto) continue
    out.push({ texto, desde: m.index, hasta: m.index + m[0].length, i: i++ })
  }
  return out
}

/**
 * ¿Qué fragmento del dictado sostiene esta afirmación?
 *
 * Devuelve el de mayor cobertura. Si ninguno llega a `MINIMO_PARCIAL`, devuelve
 * `sin_respaldo` **sin segmento** — enlazar al menos malo sería dar por
 * comprobado lo que hay que comprobar.
 */
export function respaldoDe(afirmacion: string, segmentos: readonly Segmento[]): Respaldo {
  const palabras = contenido(afirmacion)

  if (palabras.length === 0) {
    // Una afirmación sin palabras de contenido no se puede rastrear; tampoco
    // afirma nada. Marcarla «sin respaldo» sería un falso positivo ruidoso.
    return { afirmacion, cobertura: 1, huerfanas: [], estado: 'respaldada' }
  }

  let mejor: { seg: Segmento; cobertura: number } | null = null
  for (const seg of segmentos) {
    const enSeg = new Set(contenido(seg.texto))
    const hallada = palabras.filter(
      w => enSeg.has(w) || respaldadaPorSinonimo(w, enSeg) || [...enSeg].some(x => mismaRaiz(w, x)),
    ).length
    const cobertura = hallada / palabras.length
    if (!mejor || cobertura > mejor.cobertura) mejor = { seg, cobertura }
  }

  /**
   * Las huérfanas se buscan contra el dictado ENTERO, no contra el mejor
   * fragmento. Una afirmación puede repartirse entre dos frases —«tiene
   * diabetes» y «desde hace diez años»— y llamarla inventada por eso sería un
   * falso positivo que enseña a ignorar el aviso.
   */
  const todo = new Set(segmentos.flatMap(s => contenido(s.texto)))
  const huerfanas = palabras.filter(
    w => !todo.has(w) && !respaldadaPorSinonimo(w, todo) && ![...todo].some(x => mismaRaiz(w, x)),
  )

  const cobertura = mejor?.cobertura ?? 0
  const estado: Respaldo['estado'] =
    cobertura >= COBERTURA_RESPALDADA ? 'respaldada'
      : cobertura >= MINIMO_PARCIAL ? 'parcial'
        : 'sin_respaldo'

  return {
    afirmacion,
    segmento: estado === 'sin_respaldo' ? undefined : mejor?.seg,
    cobertura: Math.round(cobertura * 100) / 100,
    huerfanas,
    estado,
  }
}

/**
 * Rastrea una nota entera contra su dictado.
 *
 * Cada frase de la nota se busca por separado, porque el médico revisa por
 * frases, no por párrafos: señalar «este párrafo tiene algo sin respaldo» le
 * devuelve el problema sin acotarlo.
 */
export function rastrearNota(nota: string, dictado: string): Respaldo[] {
  const segmentos = segmentar(dictado)
  if (!segmentos.length) return []
  return segmentar(nota).map(f => respaldoDe(f.texto, segmentos))
}

/** Lo que hay que enseñarle al médico: lo que ningún fragmento sostiene. */
export function afirmacionesSinRespaldo(nota: string, dictado: string): Respaldo[] {
  return rastrearNota(nota, dictado).filter(r => r.estado === 'sin_respaldo')
}

export const POR_QUE_IMPORTA =
  'Hoy la única forma de contestar «¿de dónde sacó la IA esto?» es volver a oír ' +
  'la consulta entera. Un médico que tiene que reescuchar veinte minutos para ' +
  'comprobar una línea no comprueba: firma.'

export const LO_QUE_NO_PRUEBA =
  'No dice que la afirmación sea verdad: dice que hay un fragmento que la ' +
  'sostiene. El paciente pudo equivocarse o el reconocedor pudo transcribir mal. ' +
  'Lo que elimina es la frase que NADIE dijo, no todos los errores.'

export const POR_QUE_NO_LO_CITA_EL_MODELO =
  'Un modelo que inventa una frase también puede inventar de dónde la sacó, y ' +
  'entonces el enlace certifica la alucinación en vez de delatarla.'
