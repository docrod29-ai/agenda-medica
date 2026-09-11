/**
 * CON QUÉ ESTADO NACE UNA CITA QUE PIDE EL PACIENTE — D-054.
 *
 * Hasta hoy toda cita que entraba por el portal público o por el bot de
 * WhatsApp nacía `solicitada`, y alguien del consultorio tenía que confirmarla
 * a mano desde la agenda. El dueño decidió el 9-sep-2026 que **cada médico
 * configure si la confirmación es directa o manual**. Esto es esa decisión,
 * en un solo sitio, para que las tres puertas de entrada (portal público, bot
 * y lista de espera) no la reinterpreten cada una a su manera.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * - `manual`  → la cita nace `solicitada`; el consultorio la confirma. Es lo
 *               que había, y sigue siendo lo que pasa si nadie configura nada:
 *               una decisión ausente no puede convertir citas en confirmadas.
 * - `directa` → la cita nace `confirmada`, con `fechaConfirmacion`, y al
 *               consultorio se le avisa de que ya está confirmada — no se le
 *               pide que la confirme.
 *
 * Manda el médico si tiene preferencia propia; si no, la del consultorio.
 * No depende de `horarioPropio`: confirmar no es una regla de horario.
 *
 * ── QUÉ NO DECIDE (declarado) ───────────────────────────────────────────────
 *
 * «Por horario o sede»: no hay sede en el modelo de cita (`branchId` existe
 * en el tipo y la API lo rechaza a propósito) ni franjas de confirmación por
 * hora. Cuando existan, este módulo es el único sitio que hay que ampliar.
 *
 * Módulo PURO: sin Firestore, sin fecha propia — la recibe.
 */

export type ModoDeConfirmacion = 'manual' | 'directa'

export const MODO_DE_CONFIRMACION_POR_OMISION: ModoDeConfirmacion = 'manual'

export const MODOS_DE_CONFIRMACION: readonly ModoDeConfirmacion[] = ['manual', 'directa']

export const ETIQUETA_MODO_DE_CONFIRMACION: Record<ModoDeConfirmacion, string> = {
  manual: 'Manual — el consultorio confirma cada cita',
  directa: 'Directa — la cita queda confirmada al pedirla',
}

export interface QuienConfirma {
  confirmacionDeCitas?: ModoDeConfirmacion | string | null
}

/** Lo que devuelve: los campos de estado que la cita lleva al nacer. */
export interface EstadoInicialDeCita {
  estado: 'solicitada' | 'confirmada'
  modo: ModoDeConfirmacion
  /** Sólo con `directa`: el instante en que quedó confirmada (ISO). */
  fechaConfirmacion?: string
}

function comoModo(v: unknown): ModoDeConfirmacion | null {
  return v === 'directa' || v === 'manual' ? v : null
}

/**
 * Resuelve el modo: el médico pisa al consultorio; lo ausente o lo
 * desconocido cae a `manual`. Un valor que no se reconoce NO se interpreta
 * como «directa» por parecerse: una cita confirmada sin que nadie lo
 * decidiera es el fallo caro.
 */
export function modoDeConfirmacion(
  clinica: QuienConfirma | null | undefined,
  medico?: QuienConfirma | null,
): ModoDeConfirmacion {
  return comoModo(medico?.confirmacionDeCitas)
    ?? comoModo(clinica?.confirmacionDeCitas)
    ?? MODO_DE_CONFIRMACION_POR_OMISION
}

export function estadoInicialDeCita(
  clinica: QuienConfirma | null | undefined,
  medico: QuienConfirma | null | undefined,
  ahoraIso: string,
): EstadoInicialDeCita {
  const modo = modoDeConfirmacion(clinica, medico)
  if (modo === 'directa') return { estado: 'confirmada', modo, fechaConfirmacion: ahoraIso }
  return { estado: 'solicitada', modo }
}

/** La frase que se le dice al consultorio, según quién confirma. */
export function loQueSeLeDiceAlConsultorio(modo: ModoDeConfirmacion): string {
  return modo === 'directa'
    ? 'Quedó *confirmada* (confirmación directa).'
    : 'Está en *solicitada*: confírmala desde la agenda.'
}

/** Y al paciente: no se le promete un contacto que no va a ocurrir. */
export function loQueSeLeDiceAlPaciente(modo: ModoDeConfirmacion): string {
  return modo === 'directa'
    ? 'Tu cita queda confirmada. Gracias.'
    : 'Te contactaremos para confirmar. Gracias.'
}
