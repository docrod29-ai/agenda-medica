/**
 * EL TOKEN CON EL QUE EL PACIENTE ENTRA A SU VIDEOCONSULTA.
 *
 * ── QUÉ RESUELVE ─────────────────────────────────────────────────────────────
 *
 * `dondeEsLaCita` sabe decir «es una videoconsulta, éste es tu enlace» pero
 * **no puede acuñar la credencial**: firmar exige `PORTAL_PACIENTE_SECRET`, y
 * ese módulo lo importa también el navegador. Por eso el token es un dato de
 * entrada suyo — y por eso los dos emisores de servidor (el cron de
 * recordatorios y el bot de WhatsApp) llevaban meses mandando el texto
 * «recibirás el enlace» en vez de un enlace.
 *
 * Aquí se acuña. Sólo servidor.
 *
 * ── POR QUÉ LA VIGENCIA SE CALCULA Y NO SE FIJA ──────────────────────────────
 *
 * La tentación es `ttlDias = 1`. Falla justo en el caso principal: el
 * recordatorio de 24 horas sale un día antes, así que un token de un día
 * **caduca a la hora de la consulta** — y la sala sigue abierta dos horas más.
 * El paciente pulsaría su enlace a la hora exacta y leería «Cita no
 * encontrada»: exactamente el defecto que REG-268 acaba de cerrar por el otro
 * camino.
 *
 * La vigencia se deriva del cierre real de la sala (`ventanaDeSala`), redondeada
 * hacia arriba a días enteros, más un día de margen. Un enlace que muere antes
 * que la sala es un enlace roto; uno que la sobrevive un día no abre nada,
 * porque la sala ya está cerrada del otro lado.
 *
 * ── POR QUÉ HAY UN TECHO, Y QUÉ PASA CUANDO SE CRUZA ─────────────────────────
 *
 * `patient-token.ts` bajó los enlaces del portal de 30 días a 7 por una razón
 * escrita: viajan por WhatsApp, se reenvían, se quedan en teléfonos perdidos.
 * Una cita agendada para dentro de dos meses no puede llevar una credencial de
 * dos meses en un mensaje.
 *
 * Cuando la cita cae más allá del techo **no se acuña nada**, y `dondeEsLaCita`
 * dice «recibirás el enlace antes de tu cita» — que es verdad: el recordatorio
 * de 24 horas sí entra en ventana y sí lo lleva.
 *
 * ── ALCANCE `agenda`, NO `clinico` ───────────────────────────────────────────
 *
 * `/api/telesalud/sala` sólo exige que el token esté atado al paciente de esa
 * cita; no mira el alcance. Emitirlo `clinico` metería documentos clínicos en un
 * enlace de WhatsApp sin ninguna necesidad. Se emite con el mínimo que funciona.
 */
import { crearTokenPaciente } from '@/lib/patient-token'
import { HORAS_DESPUES } from '@/lib/telesalud/ventana-sala'

const UN_DIA_MS = 86_400_000

/**
 * Techo de vigencia de un enlace que viaja por WhatsApp. Es el mismo `7` que
 * `DIAS_DEFECTO` del portal, y por el mismo motivo (ver cabecera). Se declara
 * aquí y no se importa porque son dos decisiones distintas que hoy coinciden.
 */
export const MAX_DIAS_DEL_ENLACE = 7

/**
 * Días de vigencia que necesita el enlace de esta cita, o `null` si no procede
 * emitirlo.
 *
 * `null` significa una de tres: la cita no tiene hora utilizable, la sala ya
 * cerró, o la cita está tan lejos que el techo no la alcanza.
 */
export function diasDeVigenciaDelEnlace(
  inicioCitaMs: number,
  ahoraMs: number,
): number | null {
  if (!Number.isFinite(inicioCitaMs) || !Number.isFinite(ahoraMs)) return null

  const cierreDeLaSala = inicioCitaMs + HORAS_DESPUES * 3_600_000
  if (ahoraMs > cierreDeLaSala) return null

  // Un día de margen sobre el cierre: el token no puede morir antes que la sala.
  const dias = Math.ceil((cierreDeLaSala - ahoraMs) / UN_DIA_MS) + 1
  if (dias > MAX_DIAS_DEL_ENLACE) return null
  return dias
}

export interface DatosDelToken {
  clinicId: string
  /** `pacienteId` de la cita. Sin él no hay a quién atar el token. */
  patientId: string
  /** Instante real de inicio de la cita (`instanteMX(...).getTime()`). */
  inicioCitaMs: number
  ahoraMs: number
  /** `portalTokenVersion` del expediente. Ausente = 0, como el resto del portal. */
  version?: number
}

/**
 * Acuña el token del enlace de sala, o devuelve `undefined` si no procede.
 *
 * `undefined` y no `''` a propósito: es justo lo que `DatosDeLugar.tokenPaciente`
 * espera para caer en «recibirás el enlace».
 */
export function tokenDeSalaParaElPaciente(d: DatosDelToken): string | undefined {
  if (!d.clinicId || !d.patientId) return undefined
  const dias = diasDeVigenciaDelEnlace(d.inicioCitaMs, d.ahoraMs)
  if (dias === null) return undefined
  return crearTokenPaciente(d.clinicId, d.patientId, dias, 'agenda', Number(d.version ?? 0))
}

export const POR_QUE_NO_SIEMPRE_HAY_ENLACE =
  'Porque una credencial que viaja por WhatsApp no puede durar dos meses. Si la ' +
  'cita está más lejos que el techo, el mensaje dice que el enlace llega antes ' +
  'de la consulta — y el recordatorio de 24 horas lo cumple.'
