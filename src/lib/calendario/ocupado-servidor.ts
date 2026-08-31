/**
 * LO QUE EL MÉDICO TIENE EN GOOGLE, PARA LOS CAMINOS SIN SESIÓN.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * Tres caminos distintos agendan sobre la misma agenda: el panel del
 * consultorio, el portal público y el bot de WhatsApp. Los tres tienen que
 * descontar lo que el médico ya tiene ocupado en su calendario personal, y la
 * historia de este repositorio dice qué pasa cuando cada uno lo resuelve por su
 * cuenta: **cinco implementaciones del cálculo de huecos, cuatro de ellas
 * desactualizadas**, y el bot ofreciendo la hora de la comida.
 *
 * Así que la consulta vive UNA vez, aquí.
 *
 * ── LO QUE NUNCA HACE ────────────────────────────────────────────────────────
 *
 *  · No adivina de quién es el calendario. Sin `medicoId`, o sin el vínculo
 *    `doctors/{id}.uid` que escribe el callback de Google, devuelve vacío: mirar
 *    el calendario del dueño le bloquearía huecos a los demás médicos.
 *  · No falla hacia «no hay nada libre». Si Google no contesta, devuelve vacío y
 *    lo DECLARA en el resultado — esconder el día entero por un fallo de red
 *    dejaría al consultorio sin agenda pública sin que nadie se entere.
 *  · No trae nada del evento: sólo el intervalo. El paciente ve que esa hora no
 *    está, no qué tiene el médico.
 */
import { adminDb } from '@/lib/firebase-admin'
import { comoBloqueos } from '@/lib/calendario/ocupado-externo'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import type { TimeBlock } from '@/lib/time-blocks-core'
import { conTiempoLimite } from '@/lib/fetch-con-timeout'

export interface OcupadoDelMedico {
  bloqueos: TimeBlock[]
  /** `true` sólo si se consultó y Google contestó. */
  consultado: boolean
  /** `true` si hay calendario vinculado pero la consulta falló. */
  fallo: boolean
}

const VACIO: OcupadoDelMedico = { bloqueos: [], consultado: false, fallo: false }

/**
 * Cuánto se espera al calendario del médico antes de seguir sin él.
 *
 * Generoso para una llamada real a Google, muy por debajo de lo que aguanta un
 * paciente mirando una pantalla de reserva que no acaba de cargar.
 */
export const ESPERA_GOOGLE_MS = 6000

/**
 * Los intervalos ocupados de ESE médico ese día, como bloqueos de agenda.
 *
 * @param medicoId id del documento en `doctors`. Sin él no se consulta nada.
 * @param fecha `YYYY-MM-DD` en la zona del consultorio.
 */
export async function ocupadoEnGoogle(
  clinicId: string,
  medicoId: string | undefined,
  fecha: string,
  opciones: { zonaHoraria?: string; googleCalendarId?: string } = {},
): Promise<OcupadoDelMedico> {
  if (!clinicId || !medicoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return VACIO

  try {
    const medSnap = await adminDb.collection('clinics').doc(clinicId)
      .collection('doctors').doc(medicoId).get()
    // El vínculo lo escribe `api/calendar/callback` cuando el médico conecta su
    // calendario. Sin él no se sabe de quién es, y no se adivina.
    const uid = String((medSnap.data() as { uid?: string } | undefined)?.uid ?? '')
    if (!uid) return VACIO

    const tokSnap = await adminDb.collection('googleTokens').doc(uid).get()
    const refreshToken = (tokSnap.data() as { refreshToken?: string } | undefined)?.refreshToken
    if (!refreshToken) return VACIO

    const tz = opciones.zonaHoraria || TZ_DEFAULT
    // El día COMPLETO en la zona del consultorio: pedirlo en UTC traería el día
    // corrido y ocultaría la mañana o la noche según el huso.
    const desde = instanteMX(fecha, '00:00', tz).toISOString()
    const hasta = instanteMX(fecha, '23:59', tz).toISOString()

    /**
     * CON TECHO — porque un `catch` no captura un CUELGUE.
     *
     * Este archivo ya degradaba bien cuando Google falla, y lo razona en
     * `POR_QUE_NO_SE_ESCONDE_EL_DIA`: «ni la agenda pública ni el bot se caen
     * porque Google tenga un mal día». Pero **un cuelgue es Google teniendo un
     * mal día**, y era el único caso que no cubría: `googleapis` no trae tiempo
     * máximo, así que una petición que no vuelve deja pendiente la promesa, el
     * `catch` de abajo sin nada que capturar, y con ella **la petición de
     * disponibilidad del paciente** — que es quien está mirando la pantalla de
     * reserva mientras tanto.
     *
     * Es la misma forma que el «Guardando…» eterno del alta de la asistente
     * (unidad 37): la degradación estaba escrita, y no llegaba a ejecutarse.
     *
     * Al agotarse se toma exactamente el mismo camino que un fallo —
     * `fallo: true`, sin bloqueos— que es el que este archivo ya declaró
     * correcto y justificó por escrito.
     */
    const { intervalosOcupados } = await import('@/lib/google-calendar')
    const r = await conTiempoLimite(
      intervalosOcupados(refreshToken, opciones.googleCalendarId || 'primary', desde, hasta),
      ESPERA_GOOGLE_MS,
      'el calendario de Google del médico',
    )
    if (!r.ok) return { bloqueos: [], consultado: false, fallo: true }

    return { bloqueos: comoBloqueos(r.intervalos, medicoId), consultado: true, fallo: false }
  } catch {
    // Ni la agenda pública ni el bot se caen porque Google tenga un mal día.
    return { bloqueos: [], consultado: false, fallo: true }
  }
}

export const POR_QUE_NO_SE_ESCONDE_EL_DIA =
  'Porque un fallo de Google no es «el médico está ocupado todo el día». ' +
  'Devolver vacío deja la agenda exactamente como estaba antes de existir esto; ' +
  'devolver el día entero bloqueado dejaría al consultorio sin agenda pública ' +
  'sin que nadie se entere.'
