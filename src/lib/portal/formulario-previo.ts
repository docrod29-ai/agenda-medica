/**
 * LO QUE EL PACIENTE CUENTA ANTES DE ENTRAR — P-019 del charter.
 *
 * ── PARA QUÉ ─────────────────────────────────────────────────────────────────
 *
 * Hoy el médico reconstruye en la consulta cosas que el paciente podría haber
 * escrito con calma en su casa: qué le pasa, qué toma, a qué es alérgico, qué le
 * han operado. Con la prisa de la consulta, lo que no se pregunta no se sabe — y
 * las alergias y la medicación vigente son justo los dos datos que más caro
 * cuestan cuando faltan.
 *
 * ── LA REGLA QUE HACE ESTO SEGURO ────────────────────────────────────────────
 *
 * **Lo que dice el paciente NO pisa el expediente.** Nunca. Se guarda aparte,
 * marcado como dicho por él, y el médico decide qué pasa al expediente y qué no.
 *
 * El motivo no es burocrático: si el formulario escribiera directo en
 * `patient.alergias`, un paciente que teclea «no» en el campo de alergias
 * BORRARÍA una alergia a penicilina documentada en su expediente. Y el resto del
 * sistema —la compuerta de la receta, el cruce de la nota— confía en ese campo.
 *
 * Por la misma razón esto no calcula ni puntúa nada: es una declaración, no una
 * valoración. Cualquier escala o umbral sería una cifra clínica inventada.
 *
 * Módulo PURO.
 */

/** Las preguntas. Texto libre a propósito: encasillar aquí sería decidir por el médico. */
export const CAMPOS_PREVIOS = [
  { clave: 'motivo', etiqueta: '¿Qué te trae a consulta?', ayuda: 'Cuéntalo con tus palabras.', largo: true },
  { clave: 'desdeCuando', etiqueta: '¿Desde cuándo?', ayuda: 'Por ejemplo: «tres semanas».' },
  { clave: 'medicamentos', etiqueta: '¿Qué medicamentos tomas?', ayuda: 'Incluye los de siempre, los de venta libre y suplementos.', largo: true },
  { clave: 'alergias', etiqueta: '¿Eres alérgico a algún medicamento?', ayuda: 'Si sabes qué te pasó al tomarlo, dilo.' },
  { clave: 'antecedentes', etiqueta: '¿Qué enfermedades o cirugías has tenido?', largo: true },
  { clave: 'otro', etiqueta: '¿Algo más que el médico deba saber?', largo: true },
] as const

export type ClavePrevia = (typeof CAMPOS_PREVIOS)[number]['clave']

/** Lo que se guarda. Se marca de dónde viene para que nadie lo confunda con el expediente. */
export interface FormularioPrevio {
  respuestas: Partial<Record<ClavePrevia, string>>
  enviadoEn: string
  /** Siempre `paciente`: es su declaración, no un dato verificado. */
  origen: 'paciente'
  /** El médico lo miró. NO significa que lo haya pasado al expediente. */
  revisadoEn?: string
  revisadoPor?: string
}

/** Tope por campo: es un formulario, no un expediente. */
export const MAX_CARACTERES = 1500

export const AVISO_NO_ES_EXPEDIENTE =
  'Esto lo escribió el paciente antes de la consulta. NO sustituye lo que está ' +
  'en su expediente ni lo modifica: si algo de aquí debe quedar registrado, ' +
  'pásalo tú.'

export const AVISO_URGENCIA =
  'Si tienes un malestar grave o urgente, no esperes a la consulta: llama al ' +
  'consultorio o acude a urgencias.'

/**
 * Limpia lo que llega del navegador.
 *
 * Devuelve sólo los campos conocidos y con contenido: guardar seis cadenas
 * vacías haría que la consulta enseñara una tarjeta con seis preguntas sin
 * responder, que se lee como «el paciente no tiene nada» y no es lo mismo que
 * «el paciente no contestó eso».
 */
export function limpiarRespuestas(bruto: unknown): Partial<Record<ClavePrevia, string>> {
  const o = (bruto ?? {}) as Record<string, unknown>
  const out: Partial<Record<ClavePrevia, string>> = {}
  for (const campo of CAMPOS_PREVIOS) {
    const v = String(o[campo.clave] ?? '').trim().slice(0, MAX_CARACTERES)
    if (v) out[campo.clave] = v
  }
  return out
}

/** ¿Hay algo que enseñar? Un formulario vacío no se guarda ni se anuncia. */
export function tieneContenido(r: Partial<Record<ClavePrevia, string>>): boolean {
  return Object.values(r).some(v => String(v ?? '').trim() !== '')
}

/** Resumen de una línea para la tarjeta de la consulta. */
export function resumenPrevio(f: FormularioPrevio | null | undefined): string {
  if (!f || !tieneContenido(f.respuestas)) return ''
  const partes: string[] = []
  if (f.respuestas.motivo) partes.push(f.respuestas.motivo)
  if (f.respuestas.desdeCuando) partes.push(`desde ${f.respuestas.desdeCuando}`)
  return partes.join(' · ')
}

export const POR_QUE_NO_PISA_EL_EXPEDIENTE =
  'Porque un paciente que teclea «no» en el campo de alergias borraría una ' +
  'alergia a penicilina documentada, y de ese campo dependen la compuerta de la ' +
  'receta y el cruce de la nota. Lo que él dice se guarda como lo que es: lo que ' +
  'él dice.'
