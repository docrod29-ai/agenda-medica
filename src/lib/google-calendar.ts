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

  return {
    summary: `${tipoLabel[appt.tipo] ?? appt.tipo} — ${appt.pacienteNombre}`,
    description: [
      appt.motivo ? `Motivo: ${appt.motivo}` : null,
      `Teléfono: ${appt.pacienteTelefono}`,
      appt.lugar ? `Lugar: ${appt.lugar}` : null,
      `Estado: ${appt.estado}`,
    ].filter(Boolean).join('\n'),
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
