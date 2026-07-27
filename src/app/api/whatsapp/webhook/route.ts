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
import { safeLog } from '@/lib/security/sanitize'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { ClinicConfig, Doctor, Appointment, AppointmentType } from '@/types'
import { sendWhatsApp } from '@/lib/whatsapp-send'
import { marcarProcesado, telefonoRedactado } from '@/lib/whatsapp/dedup'
import { permiteFallbackUnicoTenant } from '@/lib/whatsapp/tenant'
import {
  esPalabraBaja, esPalabraAlta, registrarBaja, registrarAlta,
  MENSAJE_BAJA_OK, MENSAJE_ALTA_OK, normalizarTelefonoWa,
} from '@/lib/whatsapp/consent'
import { registrarEntrante } from '@/lib/whatsapp/contacts'
import { parsearStatuses, registrarStatus } from '@/lib/whatsapp/status'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'
import { estaBloqueado, type TimeBlock } from '@/lib/time-blocks'

/** Carga los bloqueos (vacaciones/ausencias) de la clínica para el bot. */
async function cargarBloques(clinicId: string): Promise<TimeBlock[]> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('time_blocks').get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TimeBlock)
  } catch { return [] }
}

/**
 * Vincula la cita del bot a un EXPEDIENTE: busca al paciente por teléfono (varios
 * formatos, para no depender de cómo se guardó) y lo crea si no existe — igual que
 * el booking público. Antes el bot dejaba `pacienteId: ''`: cita huérfana, no-show
 * nunca contabilizado y el motor de riesgo ciego para ese paciente.
 * Devuelve el id del paciente, o '' si algo falla (nunca rompe el agendado).
 */
async function resolverPacienteBot(clinicId: string, telefonoRaw: string, nombre: string, now: string): Promise<string> {
  try {
    const canonico = normalizarTelefonoWa(telefonoRaw)   // 52 + 10 dígitos
    const diez = canonico.length >= 10 ? canonico.slice(-10) : canonico
    // Candidatos exactos (Firestore no hace "termina en"): cubre lo que guarda el
    // panel (10 dígitos), el booking (dígitos crudos) y la forma canónica/móvil.
    const candidatos = Array.from(new Set(
      [diez, canonico, `521${diez}`, telefonoRaw.replace(/\D/g, '')].filter(Boolean),
    )).slice(0, 10)
    const pRef = adminDb.collection('clinics').doc(clinicId).collection('patients')
    const snap = await pRef.where('telefono', 'in', candidatos).limit(1).get()
    if (!snap.empty) return snap.docs[0].id
    const np = await pRef.add({
      nombre: (nombre || '').trim(),
      telefono: diez,   // se guarda en 10 dígitos (como el panel), para futuros matches
      noShowCount: 0, cancelacionCount: 0,
      createdAt: now, updatedAt: now, creadoPor: 'bot-whatsapp',
    })
    return np.id
  } catch { return '' }
}

// Sin fallback público: si no está configurado, la verificación GET fallará
// (mejor que aceptar un token por defecto que está en el repo).
// Acepta CUALQUIERA de los dos nombres (había un desajuste: el conector usaba
// WHATSAPP_VERIFY_TOKEN y el webhook WHATSAPP_WEBHOOK_TOKEN → la verificación de
// Meta fallaba si no coincidían). Un solo valor sirve para ambos.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || ''
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
    /**
     * FAIL-CLOSED. Antes esto devolvía `true` "para no tumbar un bot en
     * producción durante la migración", pero el efecto real era que, sin el
     * secreto configurado, CUALQUIERA que conociera un phone_number_id podía
     * inyectar mensajes falsos: agendar citas espurias y disparar WhatsApp a
     * costa de la clínica. Un webhook público sin verificar la firma no es una
     * migración, es una puerta abierta.
     *
     * Ahora se rechaza. Requiere que META_APP_SECRET esté en el entorno (Meta →
     * App Dashboard → Configuración → Básica → Clave secreta de la app). Es el
     * mismo criterio fail-closed que ya usa el cron (CRON_SECRET).
     */
    safeLog.error('[Bot] META_APP_SECRET no configurado — se RECHAZA el webhook (fail-closed)')
    return false
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
  bloques: TimeBlock[] = [],
  medicoId?: string,
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
    if (conflict) continue
    // BLOQUEOS (vacaciones/ausencias): el bot ignoraba time_blocks y ofrecía huecos
    // en días bloqueados (el panel y el booking público sí los respetan). Se excluye
    // el slot si cae dentro de un bloqueo del médico (o de toda la clínica).
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    if (bloques.length && estaBloqueado(`${fecha} ${hhmm}`, bloques, medicoId, config.zonaHoraria || 'America/Mexico_City')) continue
    slots.push(hhmm)
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

/**
 * CLAVE CANÓNICA DE SESIÓN — el mismo teléfono debe mapear SIEMPRE al mismo doc.
 *
 * Antes había dos convenciones sobre `bot_sessions`: el webhook buscaba por el
 * CAMPO `telefono` (con el wa_id crudo de Meta, formato `521…`) y creaba con
 * `.add()` (id aleatorio), mientras `waitlist-notify` guardaba con un id derivado
 * de `pacienteTelefono` (dígitos sin lada, `55…`). Las dos claves NO coincidían:
 * el paciente respondía "SÍ" a una oferta de lista de espera, el webhook no
 * encontraba la sesión `esperando_lista`, caía al menú por defecto y el hueco se
 * perdía en silencio. Ahora todo se indexa por el teléfono NORMALIZADO
 * (`normalizarTelefonoWa` → `52` + 10 dígitos), igual que opt-out y la ventana de
 * 24 h, usándolo como ID del documento para que no puedan existir duplicados.
 */
function claveSesion(telefono: string): string {
  return normalizarTelefonoWa(telefono)
}

async function getSession(clinicId: string, telefono: string): Promise<(Session & { id: string }) | null> {
  const id = claveSesion(telefono)
  const d = await clinicSessions(clinicId).doc(id).get()
  if (!d.exists) return null
  return { id: d.id, ...(d.data() as Session) }
}

async function saveSession(clinicId: string, telefono: string, update: Partial<Session>): Promise<void> {
  const now = new Date().toISOString()
  const id = claveSesion(telefono)
  await clinicSessions(clinicId).doc(id).set(
    { telefono: id, estado: 'inicio', datos: {}, createdAt: now, ...update, lastMessageAt: now },
    { merge: true },
  )
}

async function clearSession(clinicId: string, telefono: string): Promise<void> {
  await clinicSessions(clinicId).doc(claveSesion(telefono)).delete().catch(() => {})
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

  // 3. Fallback catch-all SOLO para instalación single-tenant (regla pura,
  //    testeable). En multi-tenant un phoneNumberId desconocido → null (cero
  //    acceso cruzado). Ver src/lib/whatsapp/tenant.ts.
  if (permiteFallbackUnicoTenant({
    numClinicas: clinicsSnap.size,
    phoneNumberId,
    envPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  })) {
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

  // Registrar el entrante: abre/renueva la ventana de servicio de 24 h (WA-1).
  await registrarEntrante(clinicId, from)

  // ── Opt-out / opt-in ANTES que nada (WA-2) ───────────────────
  // Palabras dedicadas (BAJA / STOP · ALTA) para no chocar con "cancelar" (cita)
  // ni "salir" (menú). Se confirma y se corta el flujo.
  if (esPalabraBaja(text)) {
    // Solo confirmamos "no le enviaremos más" si REALMENTE se persistió la baja;
    // si no, no mentimos (seguiría recibiendo → violación LFPDPPP/Meta).
    const bajaOk = await registrarBaja(clinicId, from)
    await clearSession(clinicId, from)
    await send(from, bajaOk
      ? MENSAJE_BAJA_OK
      : 'No pudimos procesar su baja en este momento. Por favor responda *BAJA* de nuevo en un minuto.')
    return
  }
  if (esPalabraAlta(text)) {
    const altaOk = await registrarAlta(clinicId, from)
    await send(from, altaOk
      ? MENSAJE_ALTA_OK
      : 'No pudimos reactivar sus mensajes ahora. Responda *ALTA* de nuevo en un minuto.')
    // sigue el flujo normal tras reactivar
  }

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
    const bloques = await cargarBloques(clinicId)

    const slots = getAvailableSlotsForDate(fecha, duracion, config!, appts, bloques, doctor?.id)

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
      // Vincula al expediente (fuera de la transacción de la cita, como el booking).
      const pacienteIdBot = await resolverPacienteBot(clinicId, from, datos.nombre, now)

      // Crear ATÓMICO: re-chequea conflicto dentro de la transacción → dos pacientes
      // no pueden confirmar el mismo horario a la vez (antes era un .add() directo).
      const apptsCol = adminDb.collection('clinics').doc(clinicId).collection('appointments')
      const [bh, bm] = datos.hora.split(':').map(Number)
      const bStart = bh * 60 + bm, bEnd = bStart + duracion
      let huboConflicto = false
      let nuevoFolio = ''
      // Centinela por médico+día (igual que agenda interna y portal): serializa
      // reservas simultáneas del mismo día para cerrar la carrera de inserción fantasma.
      const diaRef = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(datos.fecha)  // un centinela por DÍA
      try {
        await adminDb.runTransaction(async (tx) => {
          await tx.get(diaRef)  // read: fija la versión del día
          const snap = await tx.get(apptsCol.where('fechaHora', '>=', `${datos.fecha} 00:00`).where('fechaHora', '<=', `${datos.fecha} 23:59`))
          let conflicto = false
          snap.forEach(d => {
            const a = d.data()
            if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
            if (doctorId && a.medicoId && a.medicoId !== doctorId) return
            const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
            const aS = ah * 60 + am, aE = aS + (a.duracion ?? 30)
            if (bStart < aE && bEnd > aS) conflicto = true
          })
          if (conflicto) throw new Error('CONFLICTO')
          tx.set(diaRef, { ultimaReserva: now }, { merge: true })  // write: invalida la tx concurrente
          const nref = apptsCol.doc()
          nuevoFolio = nref.id
          tx.set(nref, {
            pacienteId: pacienteIdBot, pacienteNombre: datos.nombre, pacienteTelefono: from,
            fechaHora, duracion, tipo: datos.tipo as AppointmentType, motivo: '',
            estado: 'solicitada', origen: 'WhatsApp', medicoNombre,
            medicoId: doctorId || '', doctorId: doctorId || '', lugar: clinicName,
            confirmadoPaciente: true, fechaConfirmacion: now,
            recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
            consentimientoMensajes: true, notasInternas: `Agendada por bot WhatsApp`,
            createdAt: now, updatedAt: now, creadoPor: 'bot', updatedPor: 'bot',
          })
        })
      } catch (e) {
        if (e instanceof Error && e.message === 'CONFLICTO') huboConflicto = true
        else throw e
      }
      if (huboConflicto) {
        await send(from, `Lo sentimos, ese horario acaba de ocuparse. Por favor elija otro escribiendo *agendar* de nuevo. 🙏`)
        await saveSession(clinicId, from, { estado: 'menu', datos: {} })
        return
      }

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
          `🆔 Folio: ${nuevoFolio.slice(0, 8)}`,
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

      /**
       * ATÓMICO, como la otra rama del bot.
       *
       * Esto era un `.add()` pelón: sin re-chequeo de conflicto, sin transacción y
       * sin tocar el centinela del día. Y el hueco libre se ofrece a TRES pacientes
       * de la lista de espera a la vez, así que los tres podían contestar "SÍ" y a
       * los tres se les confirmaba `✅ ¡Cita agendada!` para el mismo horario.
       *
       * Además escribía `doctorId` pero NO `medicoId`, y de eso dependen dos cosas:
       * la cita DESAPARECE en cuanto se filtra por médico en la agenda, y al no
       * tener médico cuenta como ocupada para TODOS — tapaba el hueco a los demás.
       * Una cita que existe, que nadie ve, y que estorba.
       */
      const duracion = 30
      const now = new Date().toISOString()
      // El médico del HUECO liberado (guardado en la sesión por waitlist-notify), no
      // el primer doctor activo. Antes se agendaba con el médico equivocado → la cita
      // desaparecía al filtrar por médico y tapaba el hueco a los demás.
      const medicoIdBot = datos.medicoId || doctor?.id || ''
      // Vincula al expediente: usa el de la sesión de lista de espera si vino, y si no
      // lo resuelve por teléfono (crea si hace falta) para no dejar la cita huérfana.
      const pacienteIdLE = datos.pacienteId || await resolverPacienteBot(clinicId, from, datos.nombre, now)
      const apptsColLE = adminDb.collection('clinics').doc(clinicId).collection('appointments')
      const [sh, sm] = slotHora.split(':').map(Number)
      const sStart = sh * 60 + sm, sEnd = sStart + duracion
      const diaRefLE = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(slotFecha)
      let ocupadoLE = false
      try {
        await adminDb.runTransaction(async (tx) => {
          await tx.get(diaRefLE)
          const snap = await tx.get(apptsColLE.where('fechaHora', '>=', `${slotFecha} 00:00`).where('fechaHora', '<=', `${slotFecha} 23:59`))
          let conflicto = false
          snap.forEach(d => {
            const a = d.data()
            if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
            if (medicoIdBot && a.medicoId && a.medicoId !== medicoIdBot) return
            const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
            const aS = ah * 60 + am, aE = aS + (a.duracion ?? 30)
            if (sStart < aE && sEnd > aS) conflicto = true
          })
          if (conflicto) throw new Error('CONFLICTO')
          tx.set(diaRefLE, { ultimaReserva: now }, { merge: true })
          tx.set(apptsColLE.doc(), {
            pacienteId: pacienteIdLE,
            pacienteNombre: datos.nombre,
            pacienteTelefono: from,
            fechaHora: `${slotFecha} ${slotHora}`,
            duracion,
            tipo: (datos.tipo || 'seguimiento') as AppointmentType,
            estado: 'solicitada',
            origen: 'WhatsApp',
            medicoNombre: doctor?.nombre || config?.nombreMedico || 'Dr.',
            medicoId: medicoIdBot,     // ← faltaba: sin esto la cita es invisible
            doctorId: medicoIdBot,
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
        })
      } catch (e) {
        if (e instanceof Error && e.message === 'CONFLICTO') ocupadoLE = true
        else throw e
      }

      if (ocupadoLE) {
        // Otro paciente de la lista contestó primero. Se le dice la verdad en vez
        // de confirmarle una cita que no existe.
        await send(from, `Lo sentimos, ese horario acaba de ocuparse — otra persona de la lista respondió primero. Le mantenemos en la lista de espera para el siguiente hueco. 🙏`)
        await saveSession(clinicId, from, { estado: 'menu' })
        return
      }

      // Marcar la entrada de lista de espera como convertida. Ruta CORRECTA
      // (clinics/{id}/waitlist, no top-level) y en try/catch: un fallo del marcado
      // NUNCA debe impedir la confirmación al paciente ni el cierre de sesión.
      if (waitlistId) {
        try {
          await adminDb.collection('clinics').doc(clinicId).collection('waitlist').doc(waitlistId).update({ estado: 'convertido' })
        } catch (e) {
          safeLog.warn(`[bot] no se pudo marcar waitlist ${waitlistId} como convertido:`, String(e))
        }
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
  const bloques = await cargarBloques(clinicId)

  for (let i = 0; i < 14 && days.length < 5; i++) {
    const fecha = addDays(cursor, i === 0 ? 1 : 0) // start tomorrow
    if (i === 0) cursor = fecha
    else cursor = addDays(cursor, 1)

    const slots = getAvailableSlotsForDate(cursor, duracion, config, appts, bloques, doctor?.id)
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
    safeLog.info('[Bot] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }
  if (!VERIFY_TOKEN) safeLog.warn('[Bot] WHATSAPP_WEBHOOK_TOKEN no configurado — verificación rechazada')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST: Incoming messages ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Leer el body CRUDO (los bytes exactos que Meta firmó) ANTES de parsear.
    const rawBody = await req.text()
    const firma = req.headers.get('x-hub-signature-256')
    if (!firmaValida(rawBody, firma)) {
      safeLog.warn('[Bot] Firma de webhook inválida — petición rechazada')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(rawBody)

    // Meta webhook payload structure
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages
    const statuses = value?.statuses

    const hayMensajes = Array.isArray(messages) && messages.length > 0
    const hayStatuses = Array.isArray(statuses) && statuses.length > 0
    if (!hayMensajes && !hayStatuses) {
      return NextResponse.json({ ok: true })
    }

    // Identify which clinic owns this phoneNumberId
    const phoneNumberId: string = value?.metadata?.phone_number_id || ''
    const clinicId = await findClinicByPhoneNumberId(phoneNumberId)

    if (!clinicId) {
      safeLog.warn('[Bot] No clinic found for phoneNumberId:', phoneNumberId)
      return NextResponse.json({ ok: true })
    }

    // Estados de entrega (sent/delivered/read/failed) → visibilidad + opt-out Meta
    if (hayStatuses) {
      for (const s of parsearStatuses(value)) await registrarStatus(clinicId, s)
    }

    if (!hayMensajes) return NextResponse.json({ ok: true })

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const from: string = msg.from
      const text: string = msg.text?.body || ''
      if (!from || !text) continue

      // Idempotencia: si Meta reentrega el mismo wamid, no re-procesar (evita
      // doble respuesta / doble acción). Fail-open: si el dedup falla, procesa.
      const { nuevo } = await marcarProcesado(msg.id)
      if (!nuevo) continue

      // Handle async, don't block webhook response
      handleMessage(from, text, clinicId).catch(err => {
        safeLog.error(`[Bot] Error handling message from ${telefonoRedactado(from)}:`, err)
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    safeLog.error('[Bot] Webhook error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
