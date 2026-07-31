/**
 * Confirmación BASADA EN RIESGO — decisión ICU-Q4.4 del médico dueño.
 *
 *   «NO usar un threshold universal tipo `confidence < 0.90 → preguntar`. Eso
 *    produciría fatiga.»
 *
 *   «El LLM **no** toma la decisión final de seguridad. La clasificación debe
 *    ser **DETERMINISTA**.»
 *
 * Por eso este módulo es una función pura sobre señales medibles. No llama a
 * ningún modelo, no lee el reloj y no tiene estado.
 *
 * ── LOS CUATRO NIVELES, TAL COMO LOS ESCRIBIÓ ────────────────────────────────
 *
 *  1. ALWAYS_CONFIRM — todo lo que venga SÓLO de voz y vaya a convertirse en
 *     acción u orden. Aunque la confianza sea alta.
 *     Y algo clave del encuadre: **se extrae durante el dictado SIN
 *     interrumpir**; la confirmación ocurre ANTES de guardar la orden activa o
 *     cambiar la terapia. No es un modal a media frase.
 *
 *  2. CONFIRM_IF_AMBIGUOUS — observaciones críticas. NO interrumpir si la
 *     confianza es alta Y el contexto es consistente Y el valor es plausible Y
 *     no hay un candidato fonético cercano. Las cuatro cosas.
 *
 *  3. PASSIVE — chip breve («PEEP 8 cmH₂O ✓») sin detener el dictado.
 *
 *  4. NONE — narrativa no crítica. Editable en la nota.
 *
 * ── REGLA ANTIFATIGA ─────────────────────────────────────────────────────────
 *
 *   «Nunca preguntar inmediatamente por cinco valores seguidos.»
 *
 * `planificarConfirmaciones` la implementa: durante el dictado todo es pasivo, y
 * al terminar la sección se dice cuántos requieren revisión.
 */

/** Nivel de confirmación. El orden es de MÁS a MENOS exigente. */
export const NIVELES_CONFIRMACION = [
  'ALWAYS_CONFIRM',
  'CONFIRM_IF_AMBIGUOUS',
  'PASSIVE',
  'NONE',
] as const
export type NivelConfirmacion = (typeof NIVELES_CONFIRMACION)[number]

/**
 * Conceptos de NIVEL 1 — se confirman siempre antes de volverse orden o terapia.
 * Lista literal de la decisión, sin añadidos.
 */
export const CONCEPTOS_NIVEL_1: readonly string[] = [
  'medicamento',
  'concentracion',
  'cambio_concentracion',
  'dosis',
  'velocidad_infusion',
  'cambio_vasopresor',
  'insulina',
  'anticoagulante',
  'electrolito_concentrado',
  'cambio_config_ecmo',
  'cambio_prescripcion_ckrt',
]

/**
 * Observaciones CRÍTICAS de NIVEL 2 — se preguntan sólo si hay ambigüedad.
 * Lista literal de la decisión.
 */
export const CONCEPTOS_NIVEL_2: readonly string[] = [
  'peep', 'pip', 'pplat', 'fio2', 'rass', 'gcs',
  'ecmo_flow', 'sweep', 'uf', 'qb', 'lactato', 'k', 'na', 'ph',
]

/** Un candidato de reconocimiento, con su confianza. */
export interface Candidato {
  concepto: string
  confianza: number
}

/** Señales que entran a la decisión. Todas medibles: ninguna es una opinión. */
export interface SenalesConfirmacion {
  concepto: string
  /** Confianza del reconocedor para el candidato ganador (0..1). */
  confianzaVoz: number
  /** Otros candidatos considerados, con su confianza. */
  candidatos?: readonly Candidato[]
  /** ¿El contexto activo (respiratorio, hemodinámico…) concuerda con el concepto? */
  contextoConcuerda: boolean
  /** ¿El valor cae en un rango fisiológicamente posible? `null` = no evaluable. */
  plausible: boolean | null
  /** ¿La unidad quedó ambigua (mg vs µg, min vs h)? */
  unidadAmbigua: boolean
  /** ¿Este dato va a convertirse en una ORDEN o cambio de terapia? */
  seVuelveOrden: boolean
  /** ¿Discrepa de lo que calcula un motor determinista? (ver reconciliacion.ts) */
  discrepaConCalculo?: boolean
}

export interface DecisionConfirmacion {
  nivel: NivelConfirmacion
  /** ¿Hay que INTERRUMPIR al médico ahora mismo? */
  interrumpeAhora: boolean
  /** Razones, en orden de peso. Vacío si no hace falta confirmar. */
  motivos: string[]
  /** Los dos candidatos en disputa, si la ambigüedad fue por eso. */
  candidatosEnDisputa?: readonly Candidato[]
}

/**
 * Margen entre el candidato ganador y el segundo por debajo del cual se
 * considera AMBIGUO.
 *
 * ⚠️ **Este número está anclado a los dos ejemplos trabajados de la decisión, no
 * inventado:**
 *   · «RASS menos cuatro» con confianza 0.98 y sin candidato cercano → NO
 *     preguntar.
 *   · «PEEP ocho» → PEEP 0.73 / PIP 0.68 → **preguntar** («¿PEEP 8 o PIP 8?»).
 *
 * La separación de ese segundo caso es 0.05, así que el margen tiene que ser
 * ≥ 0.05. Se usa 0.15 para cubrir separaciones algo mayores del mismo tipo.
 *
 * **Calibrarlo con datos reales es del médico dueño** (`pendiente_validacion` en
 * el registro): subirlo pregunta más y fatiga; bajarlo deja pasar confusiones.
 * Ninguna de las dos direcciones es «segura» por defecto.
 */
export const MARGEN_AMBIGUEDAD = 0.15

/**
 * Confianza por debajo de la cual se considera BAJA.
 *
 * Anclada al mismo ejemplo: 0.73 del candidato ganador de «PEEP ocho» ya
 * merecía pregunta, y 0.98 no. Se toma 0.80. Igual que el margen: **calibrarlo
 * es decisión del médico**, y por eso ambos son constantes con nombre y no
 * números sueltos dentro de un `if`.
 */
export const CONFIANZA_BAJA = 0.80

/** ¿Hay un segundo candidato clínicamente relevante demasiado cerca? */
export function hayCandidatoCercano(
  confianzaGanador: number,
  candidatos: readonly Candidato[] = [],
): { ambiguo: boolean; enDisputa: readonly Candidato[] } {
  const otros = [...candidatos]
    .filter(c => c.confianza < confianzaGanador || candidatos.length > 1)
    .sort((a, b) => b.confianza - a.confianza)
  // El ganador puede venir incluido en la lista: se salta el primero si coincide.
  const segundo = otros.find(c => c.confianza < confianzaGanador)
  if (segundo === undefined) return { ambiguo: false, enDisputa: [] }
  const ambiguo = confianzaGanador - segundo.confianza <= MARGEN_AMBIGUEDAD
  return { ambiguo, enDisputa: ambiguo ? [otros[0], segundo] : [] }
}

/**
 * Clasifica UN dato. Determinista y sin efectos.
 *
 * El orden de las reglas importa: primero lo que convierte el dato en una acción
 * (nivel 1), después lo que lo hace dudoso (nivel 2). Un medicamento con
 * confianza perfecta sigue siendo nivel 1.
 */
export function clasificarConfirmacion(s: SenalesConfirmacion): DecisionConfirmacion {
  const motivos: string[] = []

  // ── NIVEL 1 ──────────────────────────────────────────────────────────────
  // «Aunque la confianza sea alta, confirmar cambios con impacto potencial alto
  //  cuando provengan exclusivamente de voz y vayan a convertirse en acción.»
  if (CONCEPTOS_NIVEL_1.includes(s.concepto) || s.seVuelveOrden) {
    return {
      nivel: 'ALWAYS_CONFIRM',
      // NO interrumpe el dictado: la confirmación ocurre ANTES de guardar la
      // orden activa. Es la diferencia entre un flujo usable y un modal a media
      // frase.
      interrumpeAhora: false,
      motivos: ['Se va a convertir en orden o cambio de terapia: se confirma antes de guardar.'],
    }
  }

  // ── NIVEL 2 ──────────────────────────────────────────────────────────────
  if (CONCEPTOS_NIVEL_2.includes(s.concepto)) {
    const { ambiguo, enDisputa } = hayCandidatoCercano(s.confianzaVoz, s.candidatos)

    if (s.confianzaVoz < CONFIANZA_BAJA) motivos.push('Confianza baja del reconocedor.')
    if (ambiguo) motivos.push('Dos candidatos clínicamente relevantes están muy cerca.')
    if (s.unidadAmbigua) motivos.push('La unidad quedó ambigua.')
    if (s.plausible === false) motivos.push('El valor es fisiológicamente improbable.')
    if (!s.contextoConcuerda) motivos.push('El contexto activo no concuerda con el concepto.')
    if (s.discrepaConCalculo === true) motivos.push('Discrepa de lo que calcula el motor determinista.')

    if (motivos.length === 0) {
      // «NO interrumpir si: confianza alta Y contexto consistente Y valor
      //  plausible Y sin candidato fonético cercano.»
      return { nivel: 'PASSIVE', interrumpeAhora: false, motivos: [] }
    }
    return {
      nivel: 'CONFIRM_IF_AMBIGUOUS',
      interrumpeAhora: true,
      motivos,
      ...(enDisputa.length > 0 ? { candidatosEnDisputa: enDisputa } : {}),
    }
  }

  // ── NIVELES 3 y 4 ────────────────────────────────────────────────────────
  // Un dato numérico con unidad se muestra como chip; la narrativa, no.
  const esNumerico = s.unidadAmbigua || s.plausible !== null
  return {
    nivel: esNumerico ? 'PASSIVE' : 'NONE',
    interrumpeAhora: false,
    motivos: [],
  }
}

export interface PlanConfirmacion {
  decisiones: DecisionConfirmacion[]
  /** Lo que se confirma ANTES de guardar la orden (nivel 1). */
  antesDeGuardar: number
  /** Lo que exige atención ahora. */
  interrumpen: number
  /** Línea del pie de sección, o `null` si no hay nada que revisar. */
  resumen: string | null
}

/**
 * Plan para una SECCIÓN completa del dictado. Implementa la regla antifatiga.
 *
 * Aunque varios elementos sean ambiguos, el resultado NO es una cascada de cinco
 * preguntas: se cuentan y se resumen en una línea, y quien llama decide cuándo
 * pedirlas. La decisión lo dice literal: «Nunca preguntar inmediatamente por
 * cinco valores seguidos».
 */
export function planificarConfirmaciones(
  senales: readonly SenalesConfirmacion[],
): PlanConfirmacion {
  const decisiones = senales.map(clasificarConfirmacion)
  const antesDeGuardar = decisiones.filter(d => d.nivel === 'ALWAYS_CONFIRM').length
  const interrumpen = decisiones.filter(d => d.interrumpeAhora).length
  const total = antesDeGuardar + interrumpen
  return {
    decisiones,
    antesDeGuardar,
    interrumpen,
    resumen: total === 0 ? null
      : total === 1 ? '1 elemento requiere revisión.'
      : `${total} elementos requieren revisión.`,
  }
}

/** Pregunta ya redactada para una ambigüedad entre dos candidatos. */
export function preguntaDeDesambiguacion(
  valor: number | string,
  enDisputa: readonly Candidato[],
): string | null {
  if (enDisputa.length < 2) return null
  const [a, b] = enDisputa
  return `¿${a.concepto.toUpperCase()} ${valor} o ${b.concepto.toUpperCase()} ${valor}?`
}
