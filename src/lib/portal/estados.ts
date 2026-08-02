/**
 * QUÉ PUEDE TOCAR EL PACIENTE DE SU PROPIA CITA.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El portal sólo bloqueaba los estados TERMINALES —atendida, finalizada,
 * cancelada, no-asistió, reagendada—, y eso deja fuera justo lo que importa:
 *
 *   · una cita **pagada** podía pasar a «confirmada» con un toque desde el
 *     enlace del portal, y el estado que decía que el dinero ya entró
 *     desaparecía: la cita salía del control de cobro sin que nadie se enterara;
 *   · **en-sala** y **en-consulta** también: el paciente ya está adentro y el
 *     tablero de recepción lo perdía de vista.
 *
 * ── POR QUÉ LISTA BLANCA ─────────────────────────────────────────────────────
 *
 * Con lista negra, cada estado nuevo del producto nace tocable por el paciente y
 * hay que acordarse de prohibirlo — y quien añade un estado está pensando en
 * otra cosa. Con lista blanca nace protegido y hay que decidir abrirlo.
 *
 * Módulo PURO.
 */

/** Los estados desde los que el paciente todavía puede intervenir su cita. */
export const DESDE_EL_PORTAL: ReadonlySet<string> = new Set([
  'solicitada',
  'pendiente-datos',
  'pendiente-confirmar',
  'confirmada',
  'recordatorio-enviado',
])

/** Lo mínimo de una cita para decidir. */
export interface CitaParaPortal {
  estado?: string
  /** Si existe, esta cita ya movió dinero. */
  cobroId?: string
}

/**
 * ¿Puede el paciente actuar sobre esta cita desde el portal?
 *
 * `permiteCobrada` es para **confirmar**: decir «ahí estaré» no mueve el hueco
 * ni el dinero, así que una cita ya cobrada se puede confirmar. Cancelar y
 * reagendar sí lo mueven: una cita pagada que se cancela sola deja dinero
 * cobrado contra nada, y qué hacer con ese dinero es una decisión del
 * consultorio, no un botón del paciente.
 */
export function puedeTocarDesdeElPortal(
  cita: CitaParaPortal,
  opciones?: { permiteCobrada?: boolean },
): boolean {
  if (!DESDE_EL_PORTAL.has(String(cita.estado ?? ''))) return false
  if (cita.cobroId && !opciones?.permiteCobrada) return false
  return true
}

export const MENSAJE_ESTADO_NO_TOCABLE =
  'Esta cita ya no se puede cambiar desde aquí. Llama al consultorio y te ayudamos.'

export const POR_QUE_LISTA_BLANCA =
  'Porque con lista negra cada estado nuevo del producto nace tocable por el ' +
  'paciente y hay que acordarse de prohibirlo — y quien añade un estado está ' +
  'pensando en otra cosa. Con lista blanca nace protegido.'
