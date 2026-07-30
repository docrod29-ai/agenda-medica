/**
 * POLÍTICA DE ERROR CRÍTICO — pipeline clínico de dictado.
 *
 * Portada de `config/critical-error-policy.json` y `config/units-and-numbers.json`
 * del paquete que entregó el Dr. (NexusMED_CLINICAL_ASR_PIPELINE_V1). Aquí no se
 * añade ninguna clase de error que él no haya declarado.
 *
 * ── POR QUÉ ESTO ES UNA LISTA Y NO UNA HEURÍSTICA ────────────────────────────
 *
 * Un corrector fonético siempre encontrará que «mcg» se parece a «mg». La
 * diferencia entre esos dos es un factor de MIL en la dosis. No hay umbral de
 * similitud que haga esa sustitución aceptable: **está prohibida y punto**.
 *
 * Lo mismo con PEEP↔PIP, ECMO VV↔VA, CVVH↔CVVHD↔CVVHDF, derecha↔izquierda y
 * negado↔afirmado. Son pares donde el parecido fonético es alto y el significado
 * clínico es **opuesto**: exactamente donde una heurística hace más daño.
 *
 * Módulo PURO, sin dependencias.
 */

/** Clases de error crítico declaradas por el Dr. */
export const CLASES_ERROR_CRITICO = [
  'sustitucion_farmaco', 'cambio_dosis', 'corrimiento_decimal', 'cambio_unidad',
  'cambio_frecuencia', 'cambio_via', 'cambio_lateralidad', 'volteo_negacion',
  'cambio_modo_ventilador', 'cambio_tipo_ecmo', 'cambio_modo_ckrt',
  'sustitucion_analito', 'sustitucion_organismo', 'sustitucion_mecanismo_resistencia',
] as const
export type ClaseErrorCritico = (typeof CLASES_ERROR_CRITICO)[number]

export const CLASE_LABEL: Record<ClaseErrorCritico, string> = {
  sustitucion_farmaco: 'Sustitución de fármaco',
  cambio_dosis: 'Cambio de dosis',
  corrimiento_decimal: 'Corrimiento de decimal',
  cambio_unidad: 'Cambio de unidad',
  cambio_frecuencia: 'Cambio de frecuencia',
  cambio_via: 'Cambio de vía',
  cambio_lateralidad: 'Cambio de lateralidad',
  volteo_negacion: 'Volteo de negación',
  cambio_modo_ventilador: 'Cambio de modo ventilatorio',
  cambio_tipo_ecmo: 'Cambio de tipo de ECMO',
  cambio_modo_ckrt: 'Cambio de modo de CKRT',
  sustitucion_analito: 'Sustitución de analito',
  sustitucion_organismo: 'Sustitución de organismo',
  sustitucion_mecanismo_resistencia: 'Sustitución de mecanismo de resistencia',
}

export interface ParProhibido {
  /** Los dos términos que NUNCA pueden intercambiarse. */
  a: string
  b: string
  clase: ClaseErrorCritico
  /** Qué pasa si se confunden. Va a la pantalla. */
  consecuencia: string
}

/**
 * Pares que **jamás** se autocorrigen el uno por el otro.
 *
 * De `never_autocorrect` y `dangerous_confusions` del paquete del Dr. La
 * consecuencia la escribo yo a partir de lo que significa cada par; ninguna
 * inventa una regla clínica nueva.
 */
export const PARES_PROHIBIDOS: readonly ParProhibido[] = [
  { a: 'mg', b: 'mcg', clase: 'cambio_unidad',
    consecuencia: 'Factor de MIL en la dosis.' },
  { a: 'mcg', b: 'µg', clase: 'cambio_unidad',
    consecuencia: 'Misma unidad escrita distinto: no es error, pero no se sustituye sin avisar.' },
  { a: 'ml', b: 'l', clase: 'cambio_unidad',
    consecuencia: 'Factor de MIL en el volumen.' },
  { a: 'u', b: 'ml', clase: 'cambio_unidad',
    consecuencia: 'Unidades de actividad contra volumen: no son convertibles.' },
  { a: '/h', b: '/min', clase: 'cambio_frecuencia',
    consecuencia: 'Factor de SESENTA en la velocidad de infusión.' },
  { a: 'peep', b: 'pip', clase: 'cambio_modo_ventilador',
    consecuencia: 'Presión al final de la espiración contra presión pico: parámetros distintos del ventilador.' },
  { a: 'pao2', b: 'paco2', clase: 'sustitucion_analito',
    consecuencia: 'Oxígeno contra dióxido de carbono: gasometrías opuestas.' },
  { a: 'ecmo vv', b: 'ecmo va', clase: 'cambio_tipo_ecmo',
    consecuencia: 'Soporte respiratorio contra soporte circulatorio.' },
  { a: 'cvvh', b: 'cvvhd', clase: 'cambio_modo_ckrt',
    consecuencia: 'Modos distintos de terapia continua: cambian el aclaramiento y la dosis del antibiótico.' },
  { a: 'cvvhd', b: 'cvvhdf', clase: 'cambio_modo_ckrt',
    consecuencia: 'Modos distintos de terapia continua: cambian el aclaramiento y la dosis del antibiótico.' },
  { a: 'cvvh', b: 'cvvhdf', clase: 'cambio_modo_ckrt',
    consecuencia: 'Modos distintos de terapia continua: cambian el aclaramiento y la dosis del antibiótico.' },
  { a: 'derecho', b: 'izquierdo', clase: 'cambio_lateralidad',
    consecuencia: 'Lado equivocado.' },
  { a: 'derecha', b: 'izquierda', clase: 'cambio_lateralidad',
    consecuencia: 'Lado equivocado.' },
]

/** Unidades canónicas del paquete. Se usan para RECONOCER, no para reescribir. */
export const UNIDADES_CANONICAS: readonly string[] = [
  'mcg', 'mg', 'g', 'mL', 'L', 'U', 'UI', 'mEq', 'mmol',
  'mg/dL', 'mmol/L', 'ng/mL', 'pg/mL',
  'mcg/kg/min', 'mcg/kg/h', 'mg/kg', 'mg/kg/h',
  'mL/kg', 'mL/kg/h', 'mL/min', 'mL/h', 'L/min',
  'mmHg', 'cmH2O', 'rpm', 'lpm', '%', '°C',
]

/** Cuándo hay que PEDIR CONFIRMACIÓN, del paquete del Dr. */
export const MOTIVOS_CONFIRMACION = [
  'confianza_baja_con_termino_critico',
  'dos_o_mas_farmacos_plausibles',
  'dosis_o_unidad_ambigua',
  'negacion_incierta',
  'lateralidad_incierta',
  'sigla_de_modo_o_dispositivo_incierta',
] as const
export type MotivoConfirmacion = (typeof MOTIVOS_CONFIRMACION)[number]

export const NUNCA_POR_FONETICA =
  'Un corrector fonético SIEMPRE encontrará que «mcg» se parece a «mg», y entre ' +
  'esos dos hay un factor de MIL en la dosis. No existe umbral de similitud que ' +
  'haga esa sustitución aceptable: está prohibida, no penalizada.'
