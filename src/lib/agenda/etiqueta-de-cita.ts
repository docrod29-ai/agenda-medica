/**
 * EL NOMBRE ACCESIBLE DE UNA CITA.
 *
 * Vive fuera de la página por una razón concreta: dentro de
 * `calendario/page.tsx` sólo se podía comprobar leyendo el fuente, y un
 * guardián que lee fuente se cumple con que la función NOMBRE el catálogo —
 * probado al revés, quitarle el estado a la cadena devuelta no lo hacía fallar.
 * Aquí se puede llamar y mirar lo que devuelve, que es lo único que importa.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El bloque de cita llevaba el estado en `title=` (sólo con ratón), en la
 * opacidad y en el tachado. Los tres son canales visuales o de puntero: quien
 * usa lector de pantalla oía «Cita de Nadia Ferreiro Ocampo a las 13:00» de una
 * cita CANCELADA. §19 y §22 del encargo, y la regla 4 de `clinical-safety`
 * dicha en lenguaje de interfaz.
 */
import { APPOINTMENT_STATUS_CONFIG, type AppointmentStatus } from '@/types'

/** Lo mínimo que hace falta para nombrar una cita. */
export type CitaNombrable = {
  pacienteNombre: string
  fechaHora: string
  estado: AppointmentStatus
  /** Sólo se dice cuando lo hay: en un consultorio de un solo médico sobra. */
  medicoNombre?: string
}

export function etiquetaDeCita(a: CitaNombrable): string {
  const hora = a.fechaHora.slice(11, 16)
  /**
   * Un estado que el catálogo no conozca se dice CRUDO, no se calla.
   * Regla 5 de `clinical-safety`: que falte un término significa que ese caso
   * no se vigila, no que se dé por bueno. Callarlo dejaría una cita cancelada
   * sonando igual que una confirmada, que es el defecto que trajo esto.
   */
  const dicho = APPOINTMENT_STATUS_CONFIG[a.estado]?.label ?? a.estado
  /**
   * CON QUÉ MÉDICO. Lo cazó el guardián de `title` de esta misma tanda: el
   * `title` del bloque lo decía y el nombre accesible no, así que en un
   * consultorio de varios médicos «de quién es esta cita» era un dato de ratón.
   * En la rejilla el médico se distingue por COLOR, que es el otro canal que no
   * llega a todo el mundo.
   */
  const con = a.medicoNombre ? ` · ${a.medicoNombre}` : ''
  return `Cita de ${a.pacienteNombre} a las ${hora}${con} — ${dicho}`
}
