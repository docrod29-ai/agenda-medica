/**
 * CADA MÉDICO VE SUS PACIENTES — D-057.
 *
 * ── LA DECISIÓN DEL DUEÑO (10-sep-2026) ─────────────────────────────────────
 *
 * «La asistente ve los médicos que tenga en su equipo pero no el expediente:
 * ella sólo agenda y los pendientes que no sean de origen privado. Cada médico
 * ve sólo sus pacientes, y el médico titular autoriza.»
 *
 * ── EL MODELO, EN TRES CAMPOS ───────────────────────────────────────────────
 *
 * - `medicoTitularUid`: el uid del médico de quien es el paciente. Nace con el
 *   médico que lo da de alta, o con el médico de la cita que lo trajo.
 * - `compartidoCon`: uids de otros médicos del mismo consultorio a los que el
 *   titular abrió el expediente. Lo escribe SÓLO el titular (o el admin).
 * - Sin `medicoTitularUid`: sólo el administrador accede hasta asignar titular.
 *   El directorio administrativo sigue disponible; no se modifica ningún dato clínico.
 *
 * ── QUIÉN VE QUÉ ────────────────────────────────────────────────────────────
 *
 * - Titular y compartidos: el expediente entero.
 * - `admin` (el dueño del consultorio): todo. Administra el consultorio y es
 *   quien puede reasignar si un médico se va.
 * - Otro médico del consultorio: la FICHA (nombre, teléfono, agenda) — que es
 *   lo que la asistente también ve — y un cartel para PEDIR acceso al titular.
 * - Asistente / recepción: nunca el expediente, decida lo que decida esto.
 *
 * Este módulo es PURO y es la única fuente de la regla en el cliente y en el
 * servidor. Las reglas de Firestore (`esMedicoDelPaciente`) son su transcripción
 * para las subcolecciones clínicas, y el guardián de la matriz las cruza.
 */
import type { Rol } from './matriz-acceso'

export interface FichaDeAlcance {
  medicoTitularUid?: string | null
  compartidoCon?: readonly string[] | null
}

export type MotivoSinAcceso = 'no_es_clinico' | 'de_otro_medico' | 'sin_titular'

export const ROLES_CON_EXPEDIENTE: readonly Rol[] = ['medico', 'admin']

/** ¿Este uid puede abrir el expediente (notas, laboratorios, fotos…) de esta ficha? */
export function puedeVerExpediente(ficha: FichaDeAlcance | null | undefined, uid: string | null | undefined, rol: Rol | string | null | undefined): boolean {
  if (!uid || !rol || !ROLES_CON_EXPEDIENTE.includes(rol as Rol)) return false
  if (rol === 'admin') return true
  const titular = ficha?.medicoTitularUid
  if (!titular) return false // Sin titular no se concede el expediente por omisión.
  if (titular === uid) return true
  return Array.isArray(ficha?.compartidoCon) && ficha!.compartidoCon!.includes(uid)
}

export function porQueNoVe(ficha: FichaDeAlcance | null | undefined, uid: string | null | undefined, rol: Rol | string | null | undefined): MotivoSinAcceso | null {
  if (puedeVerExpediente(ficha, uid, rol)) return null
  if (!rol || !ROLES_CON_EXPEDIENTE.includes(rol as Rol)) return 'no_es_clinico'
  return ficha?.medicoTitularUid ? 'de_otro_medico' : 'sin_titular'
}

/** ¿Puede este uid decidir con quién se comparte (o reclamar un paciente sin titular)? */
export function puedeAdministrarAcceso(ficha: FichaDeAlcance | null | undefined, uid: string | null | undefined, rol: Rol | string | null | undefined): boolean {
  if (!uid || !rol || !ROLES_CON_EXPEDIENTE.includes(rol as Rol)) return false
  if (rol === 'admin') return true
  const titular = ficha?.medicoTitularUid
  return !!titular && titular === uid
}

/** La lista de compartidos con `uid` dentro, sin duplicados y sin el titular. */
export function conAcceso(ficha: FichaDeAlcance, uid: string): string[] {
  const base = (ficha.compartidoCon ?? []).filter(u => u && u !== ficha.medicoTitularUid)
  return base.includes(uid) ? [...base] : [...base, uid]
}

export function sinAcceso(ficha: FichaDeAlcance, uid: string): string[] {
  return (ficha.compartidoCon ?? []).filter(u => u && u !== uid)
}

export const TEXTO_SIN_ACCESO: Record<MotivoSinAcceso, string> = {
  sin_titular: 'El administrador debe asignar un médico titular para abrir este expediente. La ficha administrativa sigue disponible.',
  no_es_clinico: 'El expediente lo ve el médico. Desde aquí puedes agendar y ver los pendientes de recepción.',
  de_otro_medico: 'Este paciente es de otro médico del consultorio. Pídele acceso a su médico titular: te llega en cuanto lo autorice.',
}
