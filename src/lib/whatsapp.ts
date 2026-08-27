import { Appointment, ClinicConfig, WaitlistEntry } from '@/types'
import { dondeEsLaCita } from '@/lib/telesalud/donde-es'

/**
 * DÓNDE ES LA CITA — el bloque que antes era siempre la dirección.
 *
 * Los tres mensajes de abajo se escribieron cuando todas las citas eran
 * presenciales y nunca miraron el tipo: a un paciente de TELECONSULTA se le
 * mandaba la dirección del consultorio y «te esperamos», sin darle jamás el
 * enlace de la sala. Ver `lib/telesalud/donde-es.ts`.
 */
function lugarDe(cita: Appointment, config: ClinicConfig) {
  return dondeEsLaCita({
    tipo: cita.tipo,
    citaId: cita.id,
    clinicId: (cita as { clinicId?: string }).clinicId || (config as { clinicId?: string }).clinicId,
    direccion: config.direccion,
    googleMapsUrl: config.googleMapsUrl,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  })
}

// ── Generadores de mensajes ───────────────────────────────────

export function msgConfirmacion(cita: Appointment, config: ClinicConfig): string {
  const fecha = formatFechaWA(cita.fechaHora)
  const hora = cita.fechaHora.slice(11, 16)
  const lugar = lugarDe(cita, config)
  return [
    `Hola ${cita.pacienteNombre}, su cita con ${config.nombreMedico || 'el médico'} ha sido agendada.`,
    ``,
    `📅 *${fecha}* a las *${hora} hrs*`,
    ...lugar.lineas,
    ``,
    `Responda:`,
    `✅ *CONFIRMAR* — para confirmar asistencia`,
    `🔄 *CAMBIAR* — para reagendar`,
    `❌ *CANCELAR* — para cancelar`,
  ].filter(l => l !== null && l !== undefined && !(l === '' && false)).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function msgRecordatorio24h(cita: Appointment, config: ClinicConfig): string {
  const hora = cita.fechaHora.slice(11, 16)
  const lugar = lugarDe(cita, config)
  return [
    `Hola ${cita.pacienteNombre} 👋`,
    ``,
    `Le recordamos su cita médica *mañana a las ${hora} hrs* con ${config.nombreMedico || 'el médico'}.`,
    ``,
    ...lugar.lineas,
    ``,
    `Favor de confirmar su asistencia respondiendo *CONFIRMAR*, o avisarnos si necesita cambiar su cita.`,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function msgRecordatorioDia(cita: Appointment, config: ClinicConfig): string {
  const hora = cita.fechaHora.slice(11, 16)
  const lugar = lugarDe(cita, config)
  return [
    `Hola ${cita.pacienteNombre} 👋`,
    ``,
    `*Hoy tiene cita médica a las ${hora} hrs* con ${config.nombreMedico || 'el médico'}.`,
    ``,
    ...lugar.lineas,
    ``,
    // «Favor de acudir puntualmente» le decía a quien tiene una videoconsulta
    // que se presentara en el consultorio.
    lugar.cierre,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function msgCancelacion(cita: Appointment, config: ClinicConfig): string {
  return `Hola ${cita.pacienteNombre}, su cita del ${formatFechaWA(cita.fechaHora)} a las ${cita.fechaHora.slice(11, 16)} hrs ha sido cancelada.\n\nSi desea reagendar, contáctenos o responda *CITA* a este mensaje.`
}

export function msgListaEsperaAviso(entry: WaitlistEntry, config: ClinicConfig, fecha: string, hora: string): string {
  return [
    `Hola ${entry.pacienteNombre} 👋`,
    ``,
    `Se liberó un espacio con ${config.nombreMedico || 'el médico'}:`,
    ``,
    `📅 *${formatFechaWA(fecha + ' ' + hora)}* a las *${hora} hrs*`,
    ``,
    `¿Desea tomarlo? Responda *SÍ* para confirmar antes de que se ocupe.`,
  ].join('\n')
}

export function msgResumenDiario(citas: Appointment[], config: ClinicConfig): string {
  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const lines = citas.map((c, i) =>
    `${i + 1}. ${c.fechaHora.slice(11, 16)} — ${c.pacienteNombre} — ${c.tipo} — ${c.estado}`
  )
  return [
    `📅 *Agenda ${fecha}*`,
    ``,
    ...lines,
    ``,
    `Total: ${citas.length} consulta${citas.length !== 1 ? 's' : ''}`,
  ].join('\n')
}

// ── Abrir WhatsApp ────────────────────────────────────────────

export function openWhatsApp(telefono: string, mensaje: string): void {
  const tel = telefono.replace(/\D/g, '')
  const number = tel.startsWith('52') ? tel : `52${tel}`
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(mensaje)}`, '_blank')
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard?.writeText(text) ?? Promise.reject('No clipboard API')
}

// ── Webhook handler (Next.js API route) ───────────────────────
// Ver: src/app/api/whatsapp/webhook/route.ts
// Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

function formatFechaWA(fechaHora: string): string {
  try {
    const d = new Date(fechaHora.slice(0, 16).replace(' ', 'T'))
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return fechaHora
  }
}
