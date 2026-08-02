/**
 * ESCRIBIR EN EL CALENDARIO DEL MÉDICO DESDE UN CAMINO SIN SESIÓN.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El paciente reagenda de martes a jueves desde su enlace del portal: Nexus dice
 * jueves y el calendario del consultorio —y el del paciente, si está invitado—
 * **sigue diciendo martes**. Cancela, y el evento se queda vivo. El médico ve un
 * hueco ocupado que no lo está, o se presenta a una cita que ya no existe.
 *
 * No se sincronizaba **a propósito**, y el motivo estaba escrito: el token de
 * Google vive en `googleTokens/{uid}` y quien reagenda es el paciente, así que
 * no había forma de saber cuál de los médicos conectó ese calendario. Escribir
 * en el equivocado es peor que no escribir.
 *
 * ── POR QUÉ YA SE PUEDE ──────────────────────────────────────────────────────
 *
 * Ese motivo dejó de ser cierto. v875 empezó a escribir el vínculo
 * `doctors/{id}.uid` al conectar el calendario, v899 lo rellenó para los que ya
 * estaban conectados, y `ocupado-servidor.ts` ya lo usa para LEER el freebusy
 * desde el portal y el bot. Aquí se usa el mismo vínculo para ESCRIBIR.
 *
 * ── LO QUE SIGUE SIN HACER ───────────────────────────────────────────────────
 *
 *  · No adivina de quién es el calendario. Sin `medicoId`, sin `uid` en la ficha
 *    o sin token, devuelve `sin-vinculo` y no toca nada — mirar el del dueño de
 *    la clínica escribiría en la agenda de otro médico.
 *  · No inventa un evento que no existe: sin `googleCalendarEventId` no hay nada
 *    que mover ni que borrar.
 *  · No tumba la operación del paciente. Si Google falla, la cita ya está
 *    reagendada o cancelada en Nexus, que es la fuente de verdad; se devuelve
 *    `fallo` y quien llama lo deja escrito como desincronizada, que es la verdad.
 */
import { adminDb } from '@/lib/firebase-admin'
import type { Appointment, ClinicConfig } from '@/types'

export type ResultadoSync =
  /** El evento quedó igual que la cita. */
  | 'sincronizado'
  /** No hay calendario ligado a ese médico: no hay dónde escribir. */
  | 'sin-vinculo'
  /** La cita nunca llegó a tener evento en Google. */
  | 'sin-evento'
  /** Hay a quién escribirle, pero Google no dejó. */
  | 'fallo'

/** El refresh token del médico dueño de la cita, o cadena vacía. */
export async function tokenDelMedico(clinicId: string, medicoId?: string): Promise<string> {
  if (!clinicId || !medicoId) return ''
  try {
    const medSnap = await adminDb.collection('clinics').doc(clinicId)
      .collection('doctors').doc(medicoId).get()
    const uid = String((medSnap.data() as { uid?: string } | undefined)?.uid ?? '')
    if (!uid) return ''
    const tokSnap = await adminDb.collection('googleTokens').doc(uid).get()
    return String((tokSnap.data() as { refreshToken?: string } | undefined)?.refreshToken ?? '')
  } catch {
    return ''
  }
}

/**
 * Mueve o borra el evento de Google de una cita tocada desde el portal.
 *
 * @param cita la cita YA con los datos nuevos (para `mover`, con la fecha nueva).
 */
export async function sincronizarCitaDelPortal(
  clinicId: string,
  cita: Appointment,
  accion: 'mover' | 'borrar',
  config: ClinicConfig | null,
): Promise<ResultadoSync> {
  if (!cita.googleCalendarEventId) return 'sin-evento'

  const refreshToken = await tokenDelMedico(clinicId, cita.medicoId)
  if (!refreshToken) return 'sin-vinculo'

  try {
    const calendarId = (config as { googleCalendarId?: string } | null)?.googleCalendarId || 'primary'
    const gcal = await import('@/lib/google-calendar')
    if (accion === 'borrar') {
      await gcal.deleteCalendarEvent(refreshToken, calendarId, cita.googleCalendarEventId)
    } else {
      await gcal.updateCalendarEvent(
        refreshToken, calendarId, cita.googleCalendarEventId, cita, (config ?? {}) as ClinicConfig,
      )
    }
    return 'sincronizado'
  } catch {
    return 'fallo'
  }
}

/**
 * Cómo queda marcada la cita según lo que se pudo hacer.
 *
 * `desincronizado` NO es un error escondido: es la verdad, y es lo que permite
 * que el panel del médico lo enseñe y él lo arregle desde su sesión, donde sí
 * hay token propio.
 */
export function estadoDeSync(r: ResultadoSync): 'synced' | 'error' | null {
  if (r === 'sincronizado') return 'synced'
  if (r === 'sin-evento') return null
  return 'error'
}

export const POR_QUE_NO_SE_ADIVINA_EL_CALENDARIO =
  'Porque escribir en el calendario del médico equivocado le mete una cita ' +
  'ajena en su agenda y le borra la suya. Sin el vínculo médico ↔ calendario no ' +
  'se toca nada y la cita queda marcada como desincronizada, que es la verdad.'
