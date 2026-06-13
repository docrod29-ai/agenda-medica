/**
 * WhatsApp Bot Webhook
 *
 * GET  → Meta webhook verification (challenge)
 * POST → Incoming messages, runs the conversation state machine
 *
 * States:
 *   inicio           → first message, show menu
 *   menu             → waiting for user to pick 1/2/3
 *   agendar_nombre   → ask patient name
 *   agendar_tipo     → ask appointment type
 *   agendar_fecha    → show available days, user picks
 *   agendar_hora     → show available slots, user picks
 *   agendar_confirm  → confirm all details, user says SÍ/NO
 *   info             → answered FAQ, back to menu
 *   cancelar_buscar  → searching for appointment to cancel
 *   esperando_lista  → patient on waitlist, waiting for slot offer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { ClinicConfig, Doctor, Appointment, AppointmentType } from '@/types'
import { sendWhatsApp } from '@/lib/whatsapp-send'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'

// Sin fallback público: si no está configurado, la verificación GET fallará
// (mejor que aceptar un token por defecto que está en el repo).
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''

/**
 * Verifica la firma X-Hub-Signature-256 de Meta sobre el body CRUDO.
 * Sin esto, cualquiera que conozca un phone_number_id puede inyectar
 * mensajes falsos (agendar citas espurias, disparar envíos de WhatsApp
 * a costa de la clínica).
 * Migración segura: si META_APP_SECRET no está configurado, se advierte
 * pero no se bloquea (para no tumbar un bot ya en producción). Una vez
 * seteado el secreto, la verificación es obligatoria (fail-closed).
 */
function firmaValida(rawBody: string, signatureHeader: string | null): boolean {
  if (!META_APP_SECRET) {
    console.warn('[Bot] META_APP_SECRET no configurado — firma del webhook NO verificada')
    return true
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const esperado = 'sha256=' + createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// NOTA DE SEGURIDAD: antes existía un `let _currentClinicId` a nivel de
// módulo + un send() que lo leía por closure. En serverless una instancia
// atiende peticiones CONCURRENTES, así que dos webhooks de clínicas distintas
// se pisaban el _currentClinicId → riesgo de enviar el WhatsApp de un paciente
// con las credenciales de OTRA clínica (fuga cross-tenant de PII).
// Ahora send() es un closure LOCAL dentro de handleMessage que captura el
// clinicId del parámetro — sin estado compartido entre invocaciones.

function formatDate(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function todayStr(): string {
  return hoyISO()  // zona MX, no UTC del servidor (Vercel corre en UTC)
}

function addDays(dateStr: string, n: number): string {
  return sumarDiasISO(dateStr, n)
}

const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

function getAvailableSlotsForDate(
  fecha: string,
  duracion: number,
  config: ClinicConfig,
  appointments: Appointment[],
): string[] {
  const d = new Date(fecha + 'T12:00:00')
  const dayKey = DAY_KEYS[d.getDay()]
  const schedule = config.horario[dayKey]
  if (!schedule?.activo) return []
  if (config.diasFestivos?.includes(fecha)) return []

  // FIX bug slots fantasma: step ≥ duración para no generar solapamientos
  const intervalConf = config.intervaloMinutos ?? 10
  const interval = Math.max(intervalConf, duracion)
  const [hI, mI] = schedule.inicio.split(':').map(Number)
  const [hF, mF] = schedule.fin.split(':').map(Number)
  const startMin = hI * 60 + mI
  const endMin = hF * 60 + mF

  const dayAppts = appointments.filter(a =>
    a.fechaHora.slice(0, 10) === fecha &&
    !['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)
  )

  const slots: string[] = []
  for (let m = startMin; m + duracion <= endMin; m += interval) {
    const slotEnd = m + duracion
    const conflict = dayAppts.some(a => {
      const [ah, am] = a.fechaHora.slice(11, 16).split(':').map(Number)
      const aStart = ah * 60 + am
      const aEnd = aStart + a.duracion
      return m < aEnd && slotEnd > aStart
    })
    if (!conflict) {
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    }
  }
  return slots
}

// ── Session CRUD ─────────────────────────────────────────────

interface Session {
  telefono: string
  estado: string
  datos: Record<string, string>
  doctorId?: string
  lastMessageAt: string
  createdAt: string
}

function clinicSessions(clinicId: string) {
  return adminDb.collection('clinics').doc(clinicId).collection('bot_sessions')
}

async function getSession(clinicId: string, telefono: string): Promise<(Session & { id: string }) | null> {
  const snap = await clinicSessions(clinicId).where('telefono', '==', telefono).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Session) }
}

async function saveSession(clinicId: string, telefono: string, update: Partial<Session>): Promise<void> {
  const now = new Date().toISOString()
  const existing = await getSession(clinicId, telefono)
  if (existing) {
    await clinicSessions(clinicId).doc(existing.id).update({ ...update, lastMessageAt: now })
  } else {
    await clinicSessions(clinicId).add({
      telefono, estado: 'inicio', datos: {}, lastMessageAt: now, createdAt: now, ...update,
    })
  }
}

async function clearSession(clinicId: string, telefono: string): Promise<void> {
  const existing = await getSession(clinicId, telefono)
  if (existing) await clinicSessions(clinicId).doc(existing.id).delete()
}

// ── Find clinic by WhatsApp phoneNumberId ─────────────────────

async function findClinicByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  // 1. Fast O(1) lookup via whatsapp_channels index (set by meta-connect / 360dialog-callback)
  try {
    const channelSnap = await adminDb.collection('whatsapp_channels').doc(phoneNumberId).get()
    if (channelSnap.exists) return channelSnap.data()!.clinicId as string
  } catch {
    // Index not available — fall through to scan
  }

  // 2. Scan clinics (legacy / env-var configured installs)
  const clinicsSnap = await adminDb.collection('clinics')
    .where('status', 'in', ['active', 'trial'])
    .get()

  for (const clinic of clinicsSnap.docs) {
    // Check whatsapp.phoneNumberId on the clinic doc itself (set by Embedded Signup)
    const waPhoneId = clinic.data()?.whatsapp?.phoneNumberId
    if (waPhoneId === phoneNumberId) return clinic.id

    // Also check legacy config field
    const configSnap = await adminDb
      .collection('clinics').doc(clinic.id)
      .collection('config').doc('main').get()
    if (configSnap.exists && configSnap.data()?.whatsappPhoneNumberId === phoneNumberId) {
      return clinic.id
    }
  }

  // 3. Fallback: single clinic + env var match
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (clinicsSnap.size === 1 && (!envPhoneId || envPhoneId === phoneNumberId)) {
    return clinicsSnap.docs[0].id
  }

  return null
}

// ── FAQ detector ─────────────────────────────────────────────

function detectFAQ(text: string): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/horario|hora|atiende|atencion|abren|cierran|cuando/.test(t)) return 'horario'
  if (/costo|precio|cobr|cuanto|pag|consulta/.test(t)) return 'costo'
  if (/direccion|donde|ubicacion|llegar|mapa|domicilio/.test(t)) return 'direccion'
  if (/seguro|aseguradora|deducible|poliza/.test(t)) return 'seguros'
  if (/padece|enfermed|trata|especialidad|atiende|infectolog|infeccion/.test(t)) return 'padecimientos'
  if (/estacionar|parking|carro|auto/.test(t)) return 'info_extra'
  return null
}

function buildFAQReply(faqKey: string, doctor: Doctor | null, config: ClinicConfig): string {
  const bot = doctor?.botConfig
  if (!bot) {
    return `Para más información, comuníquese al ${config.telefonoAdmin || config.whatsappConsultorio}.`
  }

  switch (faqKey) {
    case 'horario': {
      const dias = Object.entries(config.horario)
        .filter(([, v]) => v.activo)
        .map(([k, v]) => `• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v.inicio}–${v.fin}`)
        .join('\n')
      return `🕐 *Horario de atención:*\n\n${dias}`
    }
    case 'costo':
      return `💰 *Costo de consulta:*\n\n${bot.costoConsulta || 'Por favor comuníquese para información de costos.'}`
    case 'direccion':
      return `📍 *Ubicación:*\n\n${config.direccion || bot.comoLlegar}\n${config.googleMapsUrl ? `\n🗺 ${config.googleMapsUrl}` : ''}`
    case 'seguros':
      return `🏥 *Seguros aceptados:*\n\n${bot.seguros || 'Por favor comuníquese para información sobre seguros.'}`
    case 'padecimientos':
      return `🩺 *Padecimientos que atiende ${config.nombreMedico}:*\n\n${bot.padecimientos || 'Consulte directamente con el médico.'}`
    case 'info_extra':
      return bot.infoExtra || `Para más información, comuníquese al ${config.telefonoAdmin}.`
    default:
      return `Para información, comuníquese al ${config.telefonoAdmin || config.whatsappConsultorio}.`
  }
}

// ── Type selection helper ─────────────────────────────────────

const TIPO_OPTIONS: { key: AppointmentType; label: string; n: string }[] = [
  { n: '1', key: 'primera-vez',   label: 'Primera vez' },
  { n: '2', key: 'seguimiento',   label: 'Seguimiento / control' },
  { n: '3', key: 'urgente',       label: 'Urgente' },
  { n: '4', key: 'estudios',      label: 'Revisión de estudios' },
  { n: '5', key: 'teleconsulta',  label: 'Teleconsulta' },
  { n: '6', key: 'otro',          label: 'Otro' },
]

// ── Main state machine ────────────────────────────────────────

export async function handleMessage(from: string, body: string, clinicId: string): Promise<void> {
  // send() local: captura clinicId de ESTA invocación (sin estado de módulo
  // compartido → seguro ante peticiones concurrentes de distintas clínicas).
  const send = async (to: string, msg: string): Promise<boolean> => {
    const { ok } = await sendWhatsApp(clinicId, to, msg)
    return ok
  }
  const text = body.trim()
  const tLow = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Load config and first active doctor for this clinic
  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const [configSnap, doctorSnap] = await Promise.all([
    clinicRef.collection('config').doc('main').get(),
    clinicRef.collection('doctors').where('activo', '==', true).limit(1).get(),
  ])

  const config = configSnap.exists
    ? ({ ...configSnap.data() } as ClinicConfig)
    : null

  const doctor: Doctor | null = doctorSnap.empty
    ? null
    : ({ id: doctorSnap.docs[0].id, ...doctorSnap.docs[0].data() } as Doctor)

  const clinicName = config?.nombreClinica || config?.nombreMedico || 'el consultorio'
  const adminPhone = config?.telefonoAdmin || config?.whatsappConsultorio || ''

  const session = await getSession(clinicId, from)
  const estado = session?.estado || 'inicio'
  const datos = session?.datos || {}

  // ── Check session expiry (>2 hours = reset) ──────────────────
  if (session?.lastMessageAt) {
    const last = new Date(session.lastMessageAt).getTime()
    const elapsed = Date.now() - last
    if (elapsed > 2 * 60 * 60 * 1000) {
      await clearSession(clinicId, from)
      await send(from, buildMenu(clinicName))
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }
  }

  // ── Always detect FAQ first (any state) ──────────────────────
  const faqKey = detectFAQ(text)
  if (faqKey && estado !== 'agendar_nombre') {
    const reply = buildFAQReply(faqKey, doctor, config || ({} as ClinicConfig))
    await send(from, reply)
    await send(from, '¿Desea hacer algo más?\n\n1️⃣ Agendar cita\n2️⃣ Otra consulta\n0️⃣ Salir')
    await saveSession(clinicId, from, { estado: 'menu' })
    return
  }

  // ── INICIO / saludo ────────────────────────────────────────
  if (
    estado === 'inicio' ||
    /^(hola|buenas|buen dia|buenos|hi|hey|inicio|menu|empezar|start)/.test(tLow)
  ) {
    await send(from, buildMenu(clinicName))
    await saveSession(clinicId, from, { estado: 'menu', datos: {} })
    return
  }

  // ── MENU ──────────────────────────────────────────────────
  if (estado === 'menu') {
    if (tLow === '1' || /agendar|cita|quiero cita/.test(tLow)) {
      await send(from, `¿Cuál es su nombre completo?`)
      await saveSession(clinicId, from, { estado: 'agendar_nombre' })
      return
    }
    if (tLow === '2' || /informacion|info|pregunta/.test(tLow)) {
      await send(from, buildInfoMenu(config))
      await saveSession(clinicId, from, { estado: 'menu' })
      return
    }
    if (tLow === '3' || /cancelar/.test(tLow)) {
      await send(from, `Para cancelar su cita, por favor comuníquese al ${adminPhone}.\n\nTambién puede escribir su nombre completo y le ayudamos.`)
      await saveSession(clinicId, from, { estado: 'cancelar_buscar', datos: {} })
      return
    }
    if (tLow === '0' || /adios|gracias|salir/.test(tLow)) {
      await send(from, `¡Hasta luego! Cuando guste puede escribirnos. 😊`)
      await clearSession(clinicId, from)
      return
    }
    // Didn't match menu options, show again
    await send(from, `No entendí su opción. ${buildMenu(clinicName)}`)
    await saveSession(clinicId, from, { estado: 'menu' })
    return
  }

  // ── AGENDAR: pedir nombre ──────────────────────────────────
  if (estado === 'agendar_nombre') {
    if (text.length < 3) {
      await send(from, `Por favor escriba su nombre completo.`)
      return
    }
    datos.nombre = text
    const tipoMenu = TIPO_OPTIONS.map(t => `${t.n}️⃣ ${t.label}`).join('\n')
    await send(from, `Gracias ${text.split(' ')[0]}.\n\n¿Qué tipo de consulta necesita?\n\n${tipoMenu}`)
    await saveSession(clinicId, from, { estado: 'agendar_tipo', datos })
    return
  }

  // ── AGENDAR: seleccionar tipo ──────────────────────────────
  if (estado === 'agendar_tipo') {
    const opt = TIPO_OPTIONS.find(t => t.n === text || tLow.includes(t.label.toLowerCase()))
    if (!opt) {
      await send(from, `Por favor elija un número del 1 al ${TIPO_OPTIONS.length}.`)
      return
    }
    datos.tipo = opt.key
    datos.duracion = String((doctor?.duraciones?.[opt.key] ?? config?.duraciones?.[opt.key]) || 30)

    // Find available days (next 7 days)
    const availableDays = await getAvailableDays(clinicId, datos.duracion, config, doctor)
    if (availableDays.length === 0) {
      await send(from, `En este momento no hay horarios disponibles.\n\nLe invitamos a llamar al ${adminPhone} para coordinar su cita.`)
      await clearSession(clinicId, from)
      return
    }
    datos.availableDays = availableDays.join(',')
    const daysMenu = availableDays.map((d, i) => `${i + 1}️⃣ ${formatDate(d)} (${d})`).join('\n')
    await send(from, `¿Qué día prefiere?\n\n${daysMenu}`)
    await saveSession(clinicId, from, { estado: 'agendar_fecha', datos })
    return
  }

  // ── AGENDAR: seleccionar fecha ─────────────────────────────
  if (estado === 'agendar_fecha') {
    const availableDays = (datos.availableDays || '').split(',').filter(Boolean)
    const idx = parseInt(text) - 1
    const fecha = availableDays[idx]
    if (!fecha) {
      await send(from, `Por favor elija un número del 1 al ${availableDays.length}.`)
      return
    }
    datos.fecha = fecha
    const duracion = parseInt(datos.duracion || '30')

    // Get appointments for this date
    const apptSnap = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
      .where('fechaHora', '>=', fecha + ' 00:00')
      .where('fechaHora', '<=', fecha + ' 23:59')
      .get()
    const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))

    const slots = getAvailableSlotsForDate(fecha, duracion, config!, appts)

    if (slots.length === 0) {
      await send(from, `No hay horarios disponibles ese día. Por favor elija otro día.`)
      const daysMenu = availableDays.map((d, i) => `${i + 1}️⃣ ${formatDate(d)} (${d})`).join('\n')
      await send(from, daysMenu)
      return
    }

    // Show max 8 slots to avoid spam
    const displaySlots = slots.slice(0, 8)
    datos.availableSlots = displaySlots.join(',')
    const horasMenu = displaySlots.map((h, i) => `${i + 1}️⃣ ${h} hrs`).join('\n')
    await send(from, `Horarios disponibles el ${formatDate(fecha)}:\n\n${horasMenu}`)
    await saveSession(clinicId, from, { estado: 'agendar_hora', datos })
    return
  }

  // ── AGENDAR: seleccionar hora ──────────────────────────────
  if (estado === 'agendar_hora') {
    const availableSlots = (datos.availableSlots || '').split(',').filter(Boolean)
    const idx = parseInt(text) - 1
    const hora = availableSlots[idx]
    if (!hora) {
      await send(from, `Por favor elija un número del 1 al ${availableSlots.length}.`)
      return
    }
    datos.hora = hora

    // Build confirmation message
    const tipoLabel = TIPO_OPTIONS.find(t => t.key === datos.tipo)?.label || datos.tipo
    const confirmMsg = [
      `✅ *Confirme su cita:*`,
      ``,
      `👤 *Paciente:* ${datos.nombre}`,
      `📋 *Tipo:* ${tipoLabel}`,
      `📅 *Fecha:* ${formatDate(datos.fecha)}`,
      `🕐 *Hora:* ${datos.hora} hrs`,
      `🏥 *Consultorio:* ${clinicName}`,
      config?.direccion ? `📍 *Dirección:* ${config.direccion}` : '',
      ``,
      `Responda *SÍ* para confirmar o *NO* para cancelar.`,
    ].filter(l => l !== '').join('\n')

    await send(from, confirmMsg)
    await saveSession(clinicId, from, { estado: 'agendar_confirm', datos })
    return
  }

  // ── AGENDAR: confirmar ─────────────────────────────────────
  if (estado === 'agendar_confirm') {
    if (/^(si|sí|yes|confirmo|confirmar|ok|dale|adelante|1)$/i.test(tLow)) {
      // Create appointment
      const duracion = parseInt(datos.duracion || '30')
      const now = new Date().toISOString()
      const fechaHora = `${datos.fecha} ${datos.hora}`
      const medicoNombre = doctor?.nombre || config?.nombreMedico || 'Dr.'
      const doctorId = doctor?.id

      const apptRef = await adminDb.collection('clinics').doc(clinicId).collection('appointments').add({
        pacienteId: '',
        pacienteNombre: datos.nombre,
        pacienteTelefono: from,
        fechaHora,
        duracion,
        tipo: datos.tipo as AppointmentType,
        motivo: '',
        estado: 'solicitada',
        origen: 'WhatsApp',
        medicoNombre,
        medicoId: doctorId || '',
        doctorId: doctorId || '',
        lugar: clinicName,
        confirmadoPaciente: true,
        fechaConfirmacion: now,
        recordatorio24hEnviado: false,
        recordatorioMismoDiaEnviado: false,
        consentimientoMensajes: true,
        notasInternas: `Agendada por bot WhatsApp`,
        createdAt: now,
        updatedAt: now,
        creadoPor: 'bot',
        updatedPor: 'bot',
      })

      const tipoLabel = TIPO_OPTIONS.find(t => t.key === datos.tipo)?.label || datos.tipo
      await send(from, [
        `🎉 *¡Su cita ha sido registrada!*`,
        ``,
        `📅 ${formatDate(datos.fecha)} a las ${datos.hora} hrs`,
        `🏥 ${clinicName}`,
        config?.direccion ? `📍 ${config.direccion}` : '',
        ``,
        `Recibirá un recordatorio el día anterior. Para cambios, comuníquese al ${adminPhone}.`,
        ``,
        `¡Hasta pronto! 😊`,
      ].filter(l => l !== '').join('\n'))

      // Notify admin/secretary
      if (adminPhone && adminPhone !== from) {
        await send(adminPhone, [
          `🔔 *Nueva cita por WhatsApp*`,
          ``,
          `👤 Paciente: ${datos.nombre}`,
          `📱 Tel: ${from}`,
          `📋 Tipo: ${tipoLabel}`,
          `📅 ${formatDate(datos.fecha)} – ${datos.hora} hrs`,
          `🆔 Folio: ${apptRef.id.slice(0, 8)}`,
        ].join('\n'))
      }

      await clearSession(clinicId, from)
      return
    }

    if (/^(no|cancelar|cancel|nope|2)$/i.test(tLow)) {
      await send(from, `Cita cancelada. ¿Desea elegir otra fecha?\n\n1️⃣ Sí, quiero otra fecha\n2️⃣ No, gracias`)
      await saveSession(clinicId, from, { estado: 'agendar_reintentar', datos })
      return
    }

    await send(from, `Por favor responda *SÍ* para confirmar o *NO* para cancelar.`)
    return
  }

  // ── AGENDAR: reintentar ───────────────────────────────────
  if (estado === 'agendar_reintentar') {
    if (tLow === '1' || /si|sí|yes/.test(tLow)) {
      // Go back to type selection
      const tipoMenu = TIPO_OPTIONS.map(t => `${t.n}️⃣ ${t.label}`).join('\n')
      await send(from, `¿Qué tipo de consulta necesita?\n\n${tipoMenu}`)
      await saveSession(clinicId, from, { estado: 'agendar_tipo', datos: { nombre: datos.nombre } })
    } else {
      await send(from, `Entendido. ¡Hasta luego! Puede escribirnos cuando guste. 😊`)
      await clearSession(clinicId, from)
    }
    return
  }

  // ── CANCELAR: buscar cita ─────────────────────────────────
  if (estado === 'cancelar_buscar') {
    await send(from, `Para cancelar su cita comuníquese directamente al consultorio:\n📞 ${adminPhone}\n\n¿Hay algo más en lo que pueda ayudarle?`)
    await saveSession(clinicId, from, { estado: 'menu' })
    return
  }

  // ── WAITLIST response ─────────────────────────────────────
  if (estado === 'esperando_lista') {
    if (/^(si|sí|yes|quiero|confirmo|1)$/i.test(tLow)) {
      // They want the open slot
      const { slotFecha, slotHora, waitlistId } = datos
      await send(from, `Perfecto, le estamos agendando en el horario disponible...\n\n📅 ${formatDate(slotFecha)} a las ${slotHora} hrs`)

      // Create appointment
      const duracion = 30
      const now = new Date().toISOString()
      await adminDb.collection('clinics').doc(clinicId).collection('appointments').add({
        pacienteId: datos.pacienteId || '',
        pacienteNombre: datos.nombre,
        pacienteTelefono: from,
        fechaHora: `${slotFecha} ${slotHora}`,
        duracion,
        tipo: (datos.tipo || 'seguimiento') as AppointmentType,
        estado: 'solicitada',
        origen: 'WhatsApp',
        medicoNombre: doctor?.nombre || config?.nombreMedico || 'Dr.',
        doctorId: doctor?.id || '',
        confirmadoPaciente: true,
        fechaConfirmacion: now,
        recordatorio24hEnviado: false,
        recordatorioMismoDiaEnviado: false,
        consentimientoMensajes: true,
        notasInternas: 'Agendada desde lista de espera vía bot',
        createdAt: now,
        updatedAt: now,
        creadoPor: 'bot',
        updatedPor: 'bot',
      })

      // Mark waitlist entry as converted
      if (waitlistId) {
        await adminDb.collection('waitlist').doc(waitlistId).update({ estado: 'convertido' })
      }

      await send(from, `✅ ¡Cita agendada!\n\n📅 ${formatDate(slotFecha)} a las ${slotHora} hrs\n🏥 ${clinicName}\n${config?.direccion || ''}\n\nLe enviaremos un recordatorio. ¡Hasta pronto! 😊`)

      if (adminPhone) {
        await send(adminPhone, `🔔 Paciente de lista de espera confirmó cita:\n${datos.nombre} – ${slotFecha} ${slotHora}`)
      }

      await clearSession(clinicId, from)
    } else {
      await send(from, `Entendido, le quitamos de la oferta. Si desea agendar en otro momento, escríbanos.\n\n¿Quiere seguir en la lista de espera?`)
      await saveSession(clinicId, from, { estado: 'menu' })
    }
    return
  }

  // ── Default: doesn't match any state ─────────────────────
  await send(from, buildMenu(clinicName))
  await saveSession(clinicId, from, { estado: 'menu', datos: {} })
}

// ── Helper: get next available days (up to 5) ────────────────

async function getAvailableDays(clinicId: string, duracionStr: string, config: ClinicConfig | null, doctor: Doctor | null): Promise<string[]> {
  if (!config) return []
  const duracion = parseInt(duracionStr || '30')
  const days: string[] = []
  let cursor = todayStr()

  // Get all appointments for next 14 days
  const endDate = addDays(cursor, 14)
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
    .where('fechaHora', '>=', cursor + ' 00:00')
    .where('fechaHora', '<=', endDate + ' 23:59')
    .get()
  const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))

  for (let i = 0; i < 14 && days.length < 5; i++) {
    const fecha = addDays(cursor, i === 0 ? 1 : 0) // start tomorrow
    if (i === 0) cursor = fecha
    else cursor = addDays(cursor, 1)

    const slots = getAvailableSlotsForDate(cursor, duracion, config, appts)
    if (slots.length > 0) days.push(cursor)
  }

  return days
}

// ── Helper: menu messages ─────────────────────────────────────

function buildMenu(clinicName: string): string {
  return [
    `🏥 *${clinicName}*`,
    ``,
    `¡Bienvenido! ¿En qué le podemos ayudar?`,
    ``,
    `1️⃣ Agendar cita`,
    `2️⃣ Información (horarios, costos, ubicación)`,
    `3️⃣ Cancelar cita`,
    `0️⃣ Salir`,
    ``,
    `También puede escribir su pregunta directamente.`,
  ].join('\n')
}

function buildInfoMenu(config: ClinicConfig | null): string {
  return [
    `ℹ️ *¿Sobre qué desea información?*`,
    ``,
    `Puede preguntarme directamente, por ejemplo:`,
    `• "¿Cuál es el horario?"`,
    `• "¿Cuánto cuesta la consulta?"`,
    `• "¿Dónde están ubicados?"`,
    `• "¿Aceptan seguros?"`,
    `• "¿Qué enfermedades atienden?"`,
    ``,
    `O responda con el número de su interés.`,
  ].join('\n')
}

// ── GET: Meta webhook verification ───────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log('[Bot] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }
  if (!VERIFY_TOKEN) console.warn('[Bot] WHATSAPP_WEBHOOK_TOKEN no configurado — verificación rechazada')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST: Incoming messages ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Leer el body CRUDO (los bytes exactos que Meta firmó) ANTES de parsear.
    const rawBody = await req.text()
    const firma = req.headers.get('x-hub-signature-256')
    if (!firmaValida(rawBody, firma)) {
      console.warn('[Bot] Firma de webhook inválida — petición rechazada')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(rawBody)

    // Meta webhook payload structure
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // Identify which clinic owns this phoneNumberId
    const phoneNumberId: string = value?.metadata?.phone_number_id || ''
    const clinicId = await findClinicByPhoneNumberId(phoneNumberId)

    if (!clinicId) {
      console.warn('[Bot] No clinic found for phoneNumberId:', phoneNumberId)
      return NextResponse.json({ ok: true })
    }

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const from: string = msg.from
      const text: string = msg.text?.body || ''
      if (!from || !text) continue

      // Handle async, don't block webhook response
      handleMessage(from, text, clinicId).catch(err => {
        console.error(`[Bot] Error handling message from ${from}:`, err)
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Bot] Webhook error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
