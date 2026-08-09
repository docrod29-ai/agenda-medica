/**
 * EL TOKEN QUE HACE QUE EL ENLACE DE LA VIDEOCONSULTA FUNCIONE.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * REG-265 cerró el camino del portal: el botón «Entrar a la videoconsulta»
 * dentro del portal ya lleva token. Los tres caminos que salen por **WhatsApp**
 * —los dos recordatorios del cron y las dos confirmaciones del bot— seguían
 * llamando a `dondeEsLaCita` **sin** token, así que caían en la rama honesta
 * («recibirás el enlace por este medio») y el paciente nunca recibía enlace.
 *
 * Honesto, pero incompleto: la videoconsulta se anuncia por WhatsApp y el
 * paciente acababa teniendo que entrar al portal justo cuando va con prisa.
 *
 * ── POR QUÉ NO SE ACUÑA EN `lib/whatsapp.ts` ─────────────────────────────────
 *
 * Porque ese módulo se importa **también desde el navegador**, y firmar ahí
 * filtraría `PORTAL_PACIENTE_SECRET`. Este módulo es de servidor y sólo lo usan
 * rutas de servidor.
 *
 * ── POR QUÉ EL TTL SE CALCULA Y NO SE FIJA ───────────────────────────────────
 *
 * Fijarlo en un día parece razonable y **rompe el caso más común**: el
 * recordatorio de 24 h sale a las 09:00 del día anterior para una cita de las
 * 15:00, así que un token de un día muere **seis horas antes** de la consulta.
 * El paciente pulsa el enlace a su hora y recibe «Cita no encontrada» — que es
 * exactamente el daño que REG-265 documentó y que este módulo existe para no
 * repetir.
 *
 * El token se emite para que **cubra la ventana de la sala y ni un minuto más**:
 * hasta la hora de la cita + `HORAS_DESPUES` (cuando la sala ya no acepta a
 * nadie) + una hora de holgura, para que nunca muera el enlace antes que la
 * sala.
 *
 * ── Y POR QUÉ A VECES DEVUELVE `undefined` A PROPÓSITO ───────────────────────
 *
 * Cuando la cita cae **más allá del techo** de duración de un enlace de portal
 * (`DIAS_MAXIMOS_ENLACE`), no se manda enlace: se deja la frase de siempre. Un
 * paciente que agenda por el bot con tres semanas de antelación recibiría, si
 * no, un enlace ya caducado el día de su consulta — y de todos modos le llegará
 * uno vivo en el recordatorio de 24 h. **Sin enlace se llama al consultorio;
 * con un enlace roto, el paciente cree que se quedó sin cita.**
 *
 * El techo no se copia: se importa de `patient-token`, que es quien lo decide.
 */
import { adminDb } from '@/lib/firebase-admin'
import { crearTokenPaciente, DIAS_MAXIMOS_ENLACE } from '@/lib/patient-token'
import { HORAS_DESPUES } from '@/lib/telesalud/ventana-sala'
import { safeLog } from '@/lib/security/sanitize'

/**
 * Holgura sobre el cierre de la sala. Una hora: si el token muriera exactamente
 * con la sala, un reloj desfasado dejaría fuera al paciente en el último minuto
 * de su propia consulta.
 */
export const HORAS_DE_HOLGURA = 1

const MS_POR_DIA = 86_400_000

/**
 * Cuántos días debe durar el token de ESTA cita, o `null` si no hay que emitir
 * ninguno.
 *
 * Función PURA: el instante entra como parámetro para poder probarla.
 *
 * @param instanteCitaMs hora real de la cita, ya resuelta a la zona del consultorio.
 * @param ahoraMs instante de referencia.
 */
export function ttlDiasParaLaSala(instanteCitaMs: number, ahoraMs: number): number | null {
  if (!Number.isFinite(instanteCitaMs) || !Number.isFinite(ahoraMs)) return null

  const finDeLaVentana =
    instanteCitaMs + (HORAS_DESPUES + HORAS_DE_HOLGURA) * 60 * 60_000

  // La sala ya cerró: un enlace ahora sólo puede decepcionar.
  if (finDeLaVentana <= ahoraMs) return null

  const dias = (finDeLaVentana - ahoraMs) / MS_POR_DIA

  // Más allá del techo del portal: mejor la frase honesta que un enlace que
  // llegará muerto. El recordatorio de 24 h traerá uno vivo.
  if (dias > DIAS_MAXIMOS_ENLACE) return null

  return dias
}

export interface DatosDelToken {
  clinicId: string
  patientId: string
  /** `tipo` de la cita, tal como se guarda. */
  tipo?: string
  /** Hora real de la cita en la zona del consultorio, en ms. */
  instanteCitaMs: number
  ahoraMs: number
}

/** ¿Es una teleconsulta? Se pregunta igual que en `donde-es.ts`. */
const ES_TELECONSULTA = 'teleconsulta'

/**
 * Acuña el token del paciente para la sala de SU cita, o devuelve `undefined`
 * cuando no procede (no es teleconsulta, no hay expediente, o la fecha cae
 * fuera de la ventana útil).
 *
 * Alcance `agenda`: entrar a la sala no requiere el alcance clínico, y este
 * enlace viaja por WhatsApp — que es justo la razón por la que
 * `/api/portal/link` tampoco emite `clinico`.
 *
 * La **versión** sale del expediente para que revocar siga sirviendo: el mismo
 * contador que corta el portal tiene que cortar esto. Si la lectura falla se
 * emite la 0, igual que `/api/portal/link`: falla cerrado si alguien revocó.
 */
export async function tokenParaLaSala(d: DatosDelToken): Promise<string | undefined> {
  if (String(d.tipo ?? '').trim().toLowerCase() !== ES_TELECONSULTA) return undefined
  if (!d.clinicId || !d.patientId) return undefined

  const ttl = ttlDiasParaLaSala(d.instanteCitaMs, d.ahoraMs)
  if (ttl === null) return undefined

  let version = 0
  try {
    const snap = await adminDb
      .collection('clinics').doc(d.clinicId)
      .collection('patients').doc(d.patientId).get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch (e) {
    safeLog.warn('[telesalud] no se pudo leer la versión del enlace; se emite la 0:', String(e))
  }

  return crearTokenPaciente(d.clinicId, d.patientId, ttl, 'agenda', version)
}

export const POR_QUE_EL_TTL_NO_ES_UN_DIA =
  'Porque el recordatorio de 24 h sale antes que la cita: un token de un día ' +
  'muere horas ANTES de la consulta y el paciente recibe «Cita no encontrada» ' +
  'al pulsar su enlace. El token cubre la ventana de la sala, no el reloj de ' +
  'quien lo emite.'
