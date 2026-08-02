/**
 * LA CITA QUE NO SE PUDO SINCRONIZAR — Y QUE NADIE VEÍA.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `Appointment.googleCalendarSyncStatus` se escribe en cinco sitios y **no lo
 * leía ninguna pantalla**. Un campo escrito y nunca leído no es una función a
 * medias: es una promesa. El comentario del portal decía, literalmente, que la
 * cita se marcaba «para que el panel pueda mostrarlo y el médico lo arregle con
 * un clic desde su sesión» — y ese panel no existía.
 *
 * Así que cuando el paciente reagendaba y Google fallaba, o cuando el médico no
 * tenía su calendario ligado, la cita quedaba marcada en `error`… y el médico
 * seguía con un evento equivocado en su calendario sin ninguna forma de
 * enterarse. Exactamente el estado que la marca existía para evitar.
 *
 * ── POR QUÉ SE REPARA DESDE LA SESIÓN DEL MÉDICO ─────────────────────────────
 *
 * Porque ahí SÍ hay token propio: `/api/calendar/sync` escribe con el
 * `googleTokens/{uid}` del que está en sesión. El portal, sin sesión, depende
 * del vínculo médico ↔ calendario; cuando ese vínculo falta, esto es la salida.
 *
 * Módulo PURO: decide qué hacer, no lo hace.
 */
import type { Appointment } from '@/types'

/** Lo poco que hace falta mirar de una cita para saber si quedó descuadrada. */
export interface CitaSincronizable {
  googleCalendarEventId?: string
  googleCalendarSyncStatus?: Appointment['googleCalendarSyncStatus']
  estado?: string
}

/**
 * ¿Esta cita quedó descuadrada con Google?
 *
 * Sin evento no hay nada que arreglar —nunca llegó a estar en el calendario—, y
 * `pending` es una escritura en vuelo, no un fallo: marcarla en rojo sería
 * asustar por algo que probablemente termine bien.
 */
export function necesitaReparacion(cita: CitaSincronizable | null | undefined): boolean {
  if (!cita?.googleCalendarEventId) return false
  return cita.googleCalendarSyncStatus === 'error'
}

/**
 * Qué hay que hacerle al evento para que diga la verdad.
 *
 * Una cita cancelada no se «actualiza»: se borra, porque en el calendario del
 * médico —y en el del paciente, si estaba invitado— no debe quedar nada. Todo lo
 * demás se reescribe con los datos actuales de la cita, que es la fuente de
 * verdad.
 */
export function accionDeReparacion(estado: string | undefined): 'delete' | 'update' {
  return estado === 'cancelada' || estado === 'reagendada' ? 'delete' : 'update'
}

/** Lo que se le dice al médico junto a la marca. */
export function avisoDesincronizada(estado: string | undefined): string {
  return accionDeReparacion(estado) === 'delete'
    ? 'Esta cita ya no existe en Nexus, pero sigue viva en Google Calendar: el paciente todavía la ve y a ti te ocupa la hora.'
    : 'Google Calendar quedó con los datos viejos de esta cita: la hora que ves ahí no es la que vale.'
}

export const POR_QUE_NO_SE_REINTENTA_SOLO =
  'Porque el reintento automático ya ocurrió donde se podía —el portal escribe ' +
  'con el vínculo del médico— y falló. Volver a intentarlo en bucle contra la ' +
  'API de Google no arregla un calendario sin ligar, y esconder el problema es ' +
  'lo que llevó a que un campo se escribiera cinco veces sin que nadie lo leyera.'
