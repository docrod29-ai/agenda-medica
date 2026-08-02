import { google } from 'googleapis'
import { Appointment, ClinicConfig } from '@/types'

const SCOPES = ['https://www.googleapis.com/auth/calendar']

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

/**
 * Iniciales de un nombre: «Juan Pérez García» → «J.P.G.»
 *
 * Suficiente para reconocer de quién es la cita entre las del día, insuficiente
 * para identificar a nadie desde fuera. Si el nombre viene vacío se devuelve una
 * etiqueta neutra en vez de una cadena vacía, porque un evento titulado
 * «Seguimiento — » parece un error y no lo es.
 */
export function iniciales(nombre: string | undefined | null): string {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return 'Paciente'
  return partes.slice(0, 3).map(p => p[0].toUpperCase() + '.').join('')
}

export function buildCalendarEvent(appt: Appointment, config: ClinicConfig) {
  // Hora LOCAL "flotante" (sin Z) + timeZone → Google la interpreta en la zona de
  // la clínica. Antes se hacía toISOString() en la zona del SERVIDOR (UTC en
  // Vercel), corriendo la cita 6-7 h. Se calcula el fin en UTC para no re-contaminar.
  const startNaive = `${appt.fechaHora.slice(0, 10)}T${appt.fechaHora.slice(11, 16)}:00`
  const startUtc = new Date(`${startNaive}Z`)
  const endNaive = new Date(startUtc.getTime() + appt.duracion * 60 * 1000).toISOString().slice(0, 19)

  const tipoLabel: Record<string, string> = {
    'primera-vez': 'Primera vez',
    'seguimiento': 'Seguimiento',
    'urgente': 'Urgente',
    'estudios': 'Revisión de estudios',
    'teleconsulta': 'Teleconsulta',
    'prequirurgica': 'Val. prequirúrgica',
    'procedimiento': 'Procedimiento',
    'otro': 'Otro',
  }

  /**
   * EL CALENDARIO LLEVA UN PUNTERO, NO EL EXPEDIENTE.
   *
   * ── LO QUE SALÍA ANTES ───────────────────────────────────────────────────
   *
   *   summary:     «Seguimiento — Juan Pérez García»
   *   description: «Motivo: dolor torácico\nTeléfono: 614 123 4567»
   *
   * Nombre completo, teléfono y MOTIVO DE CONSULTA en claro, hacia Google. Era
   * el flujo con más datos identificados saliendo del sistema y el que menos
   * aparecía declarado en el aviso de privacidad. Y el evento vive en un
   * calendario que se puede compartir con una asistente, con la familia o con
   * quien tenga el enlace — sitios donde el motivo de consulta de un paciente
   * no debería poder leerse nunca.
   *
   * ── LO QUE SALE AHORA ────────────────────────────────────────────────────
   *
   *   summary:     «Seguimiento — J.P.G.»
   *   description: «Abrir en NexusMED: https://…/citas?cita=abc123»
   *
   * Las iniciales bastan para reconocer la cita de un vistazo entre las demás
   * del día —que es para lo que sirve el calendario— y no identifican a nadie
   * fuera de la consulta. El resto vive donde tiene que vivir: en el
   * expediente, detrás de la sesión del médico. El enlace es un puntero, no un
   * dato: sin sesión no abre nada.
   *
   * El lugar y el estado se quedan: no son del paciente, son de la agenda.
   */
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'
  return {
    summary: `${tipoLabel[appt.tipo] ?? appt.tipo} — ${iniciales(appt.pacienteNombre)}`,
    description: [
      appt.id ? `Abrir en NexusMED: ${APP_URL}/citas?cita=${appt.id}` : null,
      appt.lugar ? `Lugar: ${appt.lugar}` : null,
      `Estado: ${appt.estado}`,
      '',
      'Los datos del paciente no salen del expediente: este evento sólo apunta a la cita.',
    ].filter(v => v !== null).join('\n'),
    start: {
      dateTime: startNaive,
      timeZone: config.zonaHoraria ?? 'America/Chihuahua',
    },
    end: {
      dateTime: endNaive,
      timeZone: config.zonaHoraria ?? 'America/Chihuahua',
    },
    colorId: appt.estado === 'cancelada' ? '11' :
             appt.estado === 'confirmada' ? '2' :
             appt.estado === 'en-consulta' ? '3' : '1',
  }
}

export async function createCalendarEvent(
  refreshToken: string,
  calendarId: string,
  appt: Appointment,
  config: ClinicConfig
): Promise<string> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const event = buildCalendarEvent(appt, config)

  const res = await calendar.events.insert({
    calendarId: calendarId || 'primary',
    requestBody: event,
  })

  return res.data.id ?? ''
}

export async function updateCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
  appt: Appointment,
  config: ClinicConfig
): Promise<void> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const event = buildCalendarEvent(appt, config)

  await calendar.events.update({
    calendarId: calendarId || 'primary',
    eventId,
    requestBody: event,
  })
}

export async function deleteCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  await calendar.events.delete({
    calendarId: calendarId || 'primary',
    eventId,
  })
}

export async function listCalendars(refreshToken: string) {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const res = await calendar.calendarList.list()
  return res.data.items ?? []
}

/**
 * INTERVALOS OCUPADOS del calendario del médico, para un día.
 *
 * ── POR QUÉ `freebusy` Y NO `events.list` ────────────────────────────────────
 *
 * `events.list` traería títulos, invitados y descripciones de la agenda PERSONAL
 * del médico. Para no ofrecer un hueco basta con saber que está ocupado, así que
 * se pregunta lo mínimo: `freebusy` devuelve sólo intervalos.
 *
 * No hace falta ampliar el permiso de Google: el alcance que ya se concede
 * (`auth/calendar`) incluye `freebusy`.
 *
 * Devuelve `[]` ante cualquier fallo — y el llamador tiene que DECIRLO, porque
 * «no pude preguntar» y «no tiene nada» no son lo mismo: si se confunden, la
 * agenda ofrece horas ocupadas creyendo que están libres.
 */
export async function intervalosOcupados(
  refreshToken: string,
  calendarId: string,
  desdeISO: string,
  hastaISO: string,
): Promise<{ ok: boolean; intervalos: { start?: string | null; end?: string | null }[] }> {
  try {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const id = calendarId || 'primary'
    const res = await calendar.freebusy.query({
      requestBody: { timeMin: desdeISO, timeMax: hastaISO, items: [{ id }] },
    })
    const cal = res.data.calendars?.[id]
    // Google devuelve los errores POR calendario, con 200 en la petición: si no
    // se miran, un calendario inaccesible se lee como un día entero libre.
    if (cal?.errors?.length) return { ok: false, intervalos: [] }
    return { ok: true, intervalos: cal?.busy ?? [] }
  } catch {
    return { ok: false, intervalos: [] }
  }
}
