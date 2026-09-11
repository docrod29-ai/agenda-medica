/** REG-684: la transición sigue siendo atómica e idempotente. Corre en el
 * servidor para que recepción no necesite leer datos clínicos del paciente.
 * El handler reutiliza cambiosPorTransicion; no hay segundo motor de estados.
 */
import { fetchAutenticado } from '@/lib/auth-client'
import { auth } from '@/lib/firebase'
import type { AppointmentStatus } from '@/types'

export interface ResultadoTransicion {
  /** `false` = la cita YA estaba en ese estado; no se escribio nada. */
  aplicado: boolean
  /** El estado real de la cita al terminar. */
  estado: AppointmentStatus
  /** El que habia en el SERVIDOR al entrar (no el de la pantalla). */
  estadoPrevio: AppointmentStatus
  /** El paciente de la cita segun el servidor, para la bitacora. */
  pacienteId: string
}


export async function cambiarEstadoCita(clinicId: string, citaId: string, nuevoEstado: AppointmentStatus): Promise<ResultadoTransicion> {
  if (!clinicId) throw new Error('cambiarEstadoCita: falta el consultorio.')
  if (!citaId) throw new Error('cambiarEstadoCita: falta la cita.')
  const uid = auth.currentUser?.uid
  const respuesta = await fetchAutenticado('/api/appointments', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, citaId, nuevoEstado }),
  })
  if (uid && auth.currentUser?.uid !== uid) throw Object.assign(new Error('La sesión cambió antes de recibir el resultado.'), { code: 'sesion-cambiada' })
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw Object.assign(new Error(typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo cambiar el estado de la cita.'), {
    code: typeof cuerpo?.code === 'string' ? cuerpo.code : respuesta.status === 403 ? 'permission-denied' : respuesta.status === 401 ? 'unauthenticated' : respuesta.status === 404 ? 'cita-inexistente' : 'unavailable',
  })
  if (!cuerpo) throw new Error('El servidor no devolvió el resultado de la transición.')
  return cuerpo as ResultadoTransicion
}
