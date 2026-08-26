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
import { elegirExpedienteParaCita } from '@/lib/pacientes/duplicados'
import {
  esPalabraBaja, esPalabraAlta, registrarBaja, registrarAlta,
  MENSAJE_BAJA_OK, MENSAJE_ALTA_OK, normalizarTelefonoWa,
} from '@/lib/whatsapp/consent'
import { registrarEntrante } from '@/lib/whatsapp/contacts'
import { parsearStatuses, registrarStatus } from '@/lib/whatsapp/status'
import { hoyISO, sumarDiasISO, TZ_DEFAULT, instanteMX } from '@/lib/timezone'
// Del NÚCLEO PURO: ruta de SERVIDOR — ver el comentario de cabecera de
// time-blocks-core.ts (el SDK del cliente se inicializa al importarse).
import { estaBloqueado, type TimeBlock } from '@/lib/time-blocks-core'
import { ocupadoEnGoogle } from '@/lib/calendario/ocupado-servidor'
import { dondeEsLaCita } from '@/lib/telesalud/donde-es'
import { intencionDelMensaje } from '@/lib/whatsapp/intencion'
import { clasificarCitas, mensajeBloqueada, type CitaMinima } from '@/lib/whatsapp/citas-cancelables'
import { horarioLegible, type DiaHorario } from '@/lib/whatsapp/horario-legible'
import { mensajeAviso, aceptoElAviso, rechazoElAviso, consentimientoDelBot, selloExpediente, VERSION_AVISO } from '@/lib/whatsapp/aviso-bot'
import { getAvailableSlots, getDaySchedule, validarHorarioDia, descansosEnMinutos, pisaDescanso } from '@/lib/availability'
import { candidatosDeTelefono } from '@/lib/whatsapp/telefono-candidatos'
import { urgenciaDelMensaje, mensajeDeUrgencia, avisoDeUrgenciaAlConsultorio } from '@/lib/paciente/urgencia'
import { citaYaAgendada, type IntentoDeCitaDelBot, type CitaEscrita } from '@/lib/whatsapp/cita-ya-agendada'

/**
 * Carga los bloqueos (vacaciones/ausencias) de la clínica para el bot — y lo que
 * el médico tenga ocupado en su Google Calendar.
 *
 * ── POR QUÉ AQUÍ Y NO EN CADA SITIO ──────────────────────────────────────────
 *
 * El bot mira los huecos en TRES momentos: al listar, al revalidar antes de
 * confirmar, y al buscar «el próximo disponible». Los tres pasan por esta
 * función, así que añadir el calendario aquí los cubre a los tres — y cubre
 * también el cuarto que alguien escriba mañana. Es la misma lección que dejó el
 * generador de huecos con cinco implementaciones.
 *
 * `fecha` y `medicoId` son opcionales para no romper a ningún llamador: sin
 * ellos se comporta exactamente como antes (sólo los bloqueos del consultorio).
 */
async function cargarBloques(clinicId: string, fecha?: string, medicoId?: string, cfg?: ClinicConfig): Promise<TimeBlock[]> {
  let propios: TimeBlock[] = []
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('time_blocks').get()
    propios = snap.docs.map(d => ({ id: d.id, ...d.data() }) as TimeBlock)
  } catch { propios = [] }

  if (!fecha || !medicoId) return propios
  // Si Google no contesta, se sigue con los bloqueos del consultorio: el bot no
  // se queda sin agenda porque el calendario tenga un mal día.
  const g = await ocupadoEnGoogle(clinicId, medicoId, fecha, {
    zonaHoraria: cfg?.zonaHoraria, googleCalendarId: cfg?.googleCalendarId,
  })
  return [...propios, ...g.bloqueos]
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
    // El criterio vive en `lib/whatsapp/telefono-candidatos.ts`: aquí estaba bien
    // y en los otros dos sitios que buscan por teléfono no, así que ahora es uno
    // solo y no pueden volver a divergir.
    const candidatos = candidatosDeTelefono(telefonoRaw)
    // El primero de la lista es siempre la forma de 10 dígitos, que es como
    // guarda el panel y como se guarda un paciente nuevo.
    const diez = candidatos[0] ?? normalizarTelefonoWa(telefonoRaw)
    const pRef = adminDb.collection('clinics').doc(clinicId).collection('patients')
    // `limit(10)` y no `limit(1)`: una familia comparte el WhatsApp de la casa, y
    // con un solo documento se decidía sobre el primero que devolviera el índice.
    const snap = await pRef.where('telefono', 'in', candidatos).limit(10).get()
    if (!snap.empty) {
      /**
       * AQUÍ EL TELÉFONO SÍ ES LA IDENTIDAD… HASTA QUE HAY UN NOMBRE.
       *
       * El mensaje viene DE ese número, así que emparejar por teléfono es más
       * defendible que en el resto de la aplicación. Pero el WhatsApp es de la
       * casa: la madre escribe para agendar a su hijo, y con la regla vieja
       * —tomar el primer expediente con ese número— la cita del hijo aterrizaba
       * en el expediente de ella, y con ella todo lo que se escribiera después.
       *
       * Cuando el bot SÍ tiene un nombre, decide el mismo motor que el resto:
       * exige que se parezca. Si ninguno de los expedientes de esa casa es esta
       * persona, se crea uno nuevo.
       *
       * Cuando NO hay nombre utilizable, se cae al comportamiento de antes a
       * propósito: sin nombre no hay forma de distinguir a dos miembros de la
       * misma casa, y crear un expediente en cada mensaje llenaría el consultorio
       * de registros vacíos, que es peor que el riesgo que se evitaría.
       */
      const candidatosPac = snap.docs.map(d => {
        const x = d.data() as { nombre?: string; telefono?: string; whatsapp?: string; curp?: string; fechaNacimiento?: string; edad?: number }
        return { id: d.id, nombre: x.nombre, telefono: x.telefono, whatsapp: x.whatsapp, curp: x.curp, fechaNacimiento: x.fechaNacimiento, edad: x.edad }
      })
      const nombreUtil = (nombre || '').trim()
      if (nombreUtil.length < 4) return candidatosPac[0].id
      const elegido = elegirExpedienteParaCita({ nombre: nombreUtil, telefono: diez }, candidatosPac)
      if (elegido) return elegido.id
      // Hay expedientes con ese número, pero ninguno es esta persona → se crea.
    }
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

/**
 * Hoy en la zona del CONSULTORIO.
 *
 * `tz` es obligatoria a propósito: esto corre en el servidor, donde una misma
 * función atiende a muchos consultorios y no existe «la zona actual». Sin ella,
 * el bot ofrecía los días libres contando desde el día de México central: en
 * Tijuana (UTC-8), a partir de las 22:00 locales ya proponía el día siguiente.
 */
function todayStr(tz: string): string {
  return hoyISO(tz)  // no el UTC del servidor: Vercel corre en UTC
}

function addDays(dateStr: string, n: number): string {
  return sumarDiasISO(dateStr, n)
}

/**
 * LOS HUECOS QUE OFRECE EL BOT — y por qué ya no los calcula él.
 *
 * Esto era una COPIA del generador de huecos, escrita aparte y envejecida
 * aparte. Le faltaba lo que el panel y el portal fueron aprendiendo:
 *
 *   · los descansos del horario partido — ofrecía la hora de comida,
 *   · la validación del horario corrupto,
 *   · el filtro por médico — escondía el hueco libre del Dr. A porque la Dra. B
 *     tenía cita a esa hora,
 *   · las horas que ya pasaron hoy.
 *
 * Un motor de agenda con cinco implementaciones no tiene cinco veces más
 * seguridad: tiene cinco sitios donde olvidar la próxima regla. Ahora delega en
 * el mismo `getAvailableSlots` que usa todo lo demás, así que cualquier regla
 * futura llega al bot sin que nadie se acuerde de él.
 */
function getAvailableSlotsForDate(
  fecha: string,
  duracion: number,
  config: ClinicConfig,
  appointments: Appointment[],
  bloques: TimeBlock[] = [],
  medicoId?: string,
): string[] {
  return getAvailableSlots(fecha, duracion, appointments, config, undefined, bloques, medicoId)
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

/**
 * LO QUE PASA DESPUÉS DE UNA CANCELACIÓN — las tres cosas que ya aprendimos.
 *
 * v863 las cerró para el portal del paciente y aquí seguían sin hacerse: el
 * hueco liberado no se le ofrecía a nadie, no quedaba asiento en la bitácora
 * (NOM-024) y el consultorio sólo se enteraba mirando la agenda.
 *
 * Ninguna puede tumbar la cancelación: el paciente ya la pidió y ya está hecha.
 */
async function avisarCancelacion(
  clinicId: string,
  citaId: string,
  cita: Record<string, unknown>,
  from: string,
  adminPhone: string,
  send: (to: string, msg: string) => Promise<boolean>,
): Promise<void> {
  const fechaHora = String(cita.fechaHora ?? '')
  void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
    evento: 'cita_cancelada_whatsapp',
    clinicId, citaId,
    patientId: String(cita.pacienteId ?? ''),
    timestamp: new Date().toISOString(),
    meta: { fechaHora, tipo: String(cita.tipo ?? ''), medicoId: String(cita.medicoId ?? ''), origen: 'bot-whatsapp' },
  }).catch(() => { /* la bitácora no tumba la cancelación */ })

  if (fechaHora.length >= 16) {
    const { ofrecerHuecoLiberado } = await import('@/lib/whatsapp/ofrecer-hueco')
    void ofrecerHuecoLiberado(clinicId, {
      fecha: fechaHora.slice(0, 10),
      hora: fechaHora.slice(11, 16),
      tipo: String(cita.tipo ?? '') || undefined,
      duracion: Number(cita.duracion) || undefined,
      // Sin médico, el hueco de una doctora se le ofrecería a quien espera con otro.
      medicoId: String(cita.medicoId ?? '') || undefined,
    }).catch(() => { /* ídem */ })
  }

  if (adminPhone && adminPhone !== from) {
    await send(adminPhone, `🔔 Cancelación por WhatsApp: ${String(cita.pacienteNombre ?? from)} — ${fechaHora}`)
  }
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
  const telefono = config.telefonoAdmin || config.whatsappConsultorio

  /**
   * SIN `botConfig` SE CONTESTA LO QUE SÍ SE SABE.
   *
   * Esto empezaba con `if (!bot) return «comuníquese al teléfono»` — para TODO.
   * Pero el horario y la dirección no salen de `botConfig`: salen de la
   * configuración del consultorio, que siempre está llena porque sin ella no
   * hay agenda. Un consultorio que no completó el onboarding del bot tenía
   * «2️⃣ Información (horarios, costos, ubicación)» en el menú y el bot
   * contestando el teléfono a todo, pareciendo tonto por nada.
   */
  switch (faqKey) {
    case 'horario': {
      /**
       * CON LOS DESCANSOS. Esto imprimía `inicio–fin` a secas: un consultorio
       * que atiende de 9 a 14 y de 16 a 20 le decía al paciente
       * «Lunes: 09:00–20:00». El motor de huecos SÍ respeta el descanso desde
       * v829/v830, así que el sistema sabía la verdad y su bot decía otra cosa.
       * Ver `lib/whatsapp/horario-legible.ts`.
       */
      const dias = horarioLegible(config.horario as unknown as Record<string, DiaHorario>)
      return dias
        ? `🕐 *Horario de atención:*\n\n${dias}`
        : `No tengo el horario cargado. Comuníquese al ${telefono} y con gusto le informamos.`
    }
    case 'costo':
      return `💰 *Costo de consulta:*\n\n${bot?.costoConsulta || `Comuníquese al ${telefono} y con gusto le informamos.`}`
    case 'direccion': {
      const donde = config.direccion || bot?.comoLlegar || ''
      return donde
        ? `📍 *Ubicación:*\n\n${donde}${config.googleMapsUrl ? `\n\n🗺 ${config.googleMapsUrl}` : ''}`
        : `No tengo la dirección cargada. Comuníquese al ${telefono}.`
    }
    case 'seguros':
      return `🏥 *Seguros aceptados:*\n\n${bot?.seguros || `Comuníquese al ${telefono} para información sobre seguros.`}`
    case 'padecimientos':
      return `🩺 *Padecimientos que atiende ${config.nombreMedico ?? 'el médico'}:*\n\n${bot?.padecimientos || 'Consulte directamente con el médico.'}`
    case 'info_extra':
      return bot?.infoExtra || `Para más información, comuníquese al ${telefono}.`
    default:
      return `Para información, comuníquese al ${telefono}.`
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

/** Los temas del menú de información, con el número que se le enseña al paciente. */
const TEMAS_INFO: { n: string; label: string; clave: string }[] = [
  { n: '1', label: 'Horarios', clave: 'horario' },
  { n: '2', label: 'Costo de la consulta', clave: 'costo' },
  { n: '3', label: 'Ubicación', clave: 'direccion' },
  { n: '4', label: 'Seguros', clave: 'seguros' },
  { n: '5', label: 'Padecimientos que atiende', clave: 'padecimientos' },
]

// ── Main state machine ────────────────────────────────────────

export async function handleMessage(from: string, body: string, clinicId: string): Promise<void> {
  // send() local: captura clinicId de ESTA invocación (sin estado de módulo
  // compartido → seguro ante peticiones concurrentes de distintas clínicas).
  /**
   * EL FALLO SE REGISTRA AQUÍ, NO EN LAS 36 LLAMADAS.
   *
   * `send` devuelve un booleano y las 36 llamadas de esta máquina de estados lo
   * DESCARTAN. El caso que duele: el paciente agenda por WhatsApp, la
   * confirmación falla, la cita queda creada y él no se entera — no se presenta,
   * o se presenta a una hora que cree otra, y en el consultorio nadie supo nunca
   * que hubo un problema.
   *
   * Arreglar 36 sitios habría sido 36 oportunidades de olvidar uno. Poniéndolo
   * en el helper, quedan cubiertas todas, y también las que se escriban mañana.
   */
  const send = async (to: string, msg: string): Promise<boolean> => {
    const { ok } = await sendWhatsApp(clinicId, to, msg)
    if (!ok) {
      const { registrarNoEntregado } = await import('@/lib/whatsapp/no-entregados')
      await registrarNoEntregado(clinicId, to, msg, 'bot')
    }
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

  /**
   * ── LA URGENCIA, ANTES QUE NADA ──────────────────────────────────────────
   *
   * Va aquí y no más abajo, y el sitio ES la reparación.
   *
   * La primera decisión del bot sobre lo que escribe el paciente era el
   * detector de preguntas frecuentes, que trabaja por SUBCADENA: «me duele el
   * pecho desde hace una **hora**» contiene `hora`, así que al paciente con
   * dolor torácico se le contestaba el HORARIO DE ATENCIÓN. Y «no puedo
   * respirar» no casaba con nada y caía al menú de bienvenida.
   *
   * Poniéndolo por encima de `getSession` gana también a la máquina de estados:
   * a mitad de un agendado, esperando el aviso de privacidad o contestando un
   * recordatorio. §6 de `.claude/rules/patient-facing-ai.md`: «la urgencia gana
   * a todo lo demás».
   *
   * Sólo la baja (BAJA/STOP) queda por encima, y a propósito: es una obligación
   * legal y ninguna de sus palabras puede ser una urgencia.
   *
   * El bot NO triaja, NO aconseja y NO atiende: escala. Ver `lib/paciente/urgencia.ts`.
   */
  const urgencia = urgenciaDelMensaje(text)
  if (urgencia) {
    const telConsultorio = adminPhone || ''
    await send(from, mensajeDeUrgencia(telConsultorio))
    // El consultorio se entera aunque no esté mirando la pantalla. Nunca puede
    // tumbar el aviso al paciente: ése ya salió.
    if (telConsultorio && telConsultorio !== from) {
      await send(telConsultorio, avisoDeUrgenciaAlConsultorio(from, urgencia.motivo, text))
    }
    /**
     * Se cierra la conversación en curso. Dejar viva una sesión `agendar_hora`
     * significa que el siguiente mensaje del paciente —o de quien tenga su
     * teléfono— se interpreta como la elección de un horario. Después de una
     * urgencia se empieza de cero.
     */
    await clearSession(clinicId, from)
    return
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

  /**
   * LA RESPUESTA AL RECORDATORIO — antes que el detector de preguntas.
   *
   * El recordatorio de 24 h dice «Responde SÍ para confirmar o NO para
   * cancelar». Sin este bloque, el bot caía en el saludo y contestaba el menú:
   * el paciente confirmaba y su cita seguía sin confirmar; decía NO queriendo
   * cancelar y la cita seguía viva ocupando el hueco.
   *
   * Va ANTES del detector de FAQ porque «sí, esa **hora** me sirve» contiene la
   * palabra «hora» y el detector se lo quedaba: contestaba el horario de
   * atención y la respuesta del paciente se perdía.
   */
  /**
   * DOS PREGUNTAS DISTINTAS, DOS ESTADOS DISTINTOS.
   *
   * Antes las dos —«¿confirmas tu cita?» y «¿la cancelo?»— compartían el estado
   * `confirmando_cita` y se distinguían por una bandera DENTRO de `datos`. Y ahí
   * estaba el fallo, que encontró la auditoría de lanzamiento:
   *
   *  1. el paciente pide cancelar y abandona la conversación sin contestar;
   *  2. la bandera `cancelarSolo` se queda pegada en su sesión, que no caduca sola;
   *  3. llega el recordatorio de 24 h y el cron reescribe la sesión con
   *     `merge: true` — que en Firestore funde los mapas anidados, así que la
   *     bandera SOBREVIVE;
   *  4. el paciente responde «SÍ» a «¿confirmas tu cita?»… y se le CANCELA,
   *     se avisa al consultorio y su hueco se le ofrece a la lista de espera.
   *
   * Confirmar y perder la cita. El comentario de abajo ya advertía de este
   * peligro en el sentido contrario; le faltaba la mitad.
   *
   * Con un estado propio, una sesión vieja de cancelación no puede secuestrar la
   * pregunta del recordatorio: son ramas distintas del código.
   */
  if (estado === 'confirmando_cita' || estado === 'confirmando_cancelacion') {
    const citaId = String(session?.datos?.citaId ?? '')
    const esSi = /^(si|sí|s|ok|okay|confirmo|confirmado|va|claro|asi es|así es|1)\b/.test(tLow)
    const esNo = /^(no|n|cancelar|cancela|no puedo|2)\b/.test(tLow)
    if (citaId && (esSi || esNo)) {
      try {
        const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
        const snap = await citaRef.get()
        const est = String((snap.data() as { estado?: string } | undefined)?.estado ?? '')
        // No se toca lo que ya terminó ni lo que ya movió dinero: eso lo
        // resuelve el consultorio, no un mensaje de WhatsApp.
        const tocable = snap.exists && !['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada', 'pagada', 'pendiente-pago'].includes(est)
        /**
         * «SÍ» NO SIEMPRE QUIERE DECIR LO MISMO.
         *
         * Este estado nació para responder al recordatorio, donde SÍ = «confirmo
         * que asisto». Desde el flujo de CANCELAR se llega a la misma pregunta
         * con el sentido contrario: «¿la cancelo?» → SÍ = cancelar. Sin esta
         * distinción, quien pide cancelar y contesta SÍ acabaría con la cita
         * CONFIRMADA — exactamente lo contrario de lo que pidió, y sin enterarse
         * hasta el día de la consulta.
         */
        // El ESTADO manda. `cancelarSolo` se sigue leyendo sólo para no invertirle
        // el sentido a una conversación que ya estuviera en vuelo al desplegar
        // esto; el cron lo limpia, así que no puede quedarse pegada.
        const preguntaEraCancelar = estado === 'confirmando_cancelacion'
          || String(session?.datos?.cancelarSolo ?? '') === '1'
        if (!tocable) {
          await send(from, 'Esa cita ya no se puede cambiar por aquí. Llámanos al consultorio y te ayudamos. 🙌')
        } else if (preguntaEraCancelar) {
          if (esSi) {
            await citaRef.update({
              estado: 'cancelada',
              updatedAt: new Date().toISOString(), updatedPor: 'paciente-whatsapp',
            })
            await send(from, 'Listo, cancelamos tu cita. Si quieres otra fecha escribe *agendar* y te ayudamos. 🙌')
            await avisarCancelacion(clinicId, citaId, snap.data() as Record<string, unknown>, from, adminPhone, send)
          } else {
            await send(from, 'De acuerdo, tu cita sigue en pie. ¿Algo más? 🙌')
          }
        } else if (esSi) {
          await citaRef.update({
            estado: 'confirmada', confirmadoPaciente: true,
            fechaConfirmacion: new Date().toISOString(),
            updatedAt: new Date().toISOString(), updatedPor: 'paciente-whatsapp',
          })
          await send(from, '¡Gracias! Tu cita queda *confirmada*. Te esperamos. 😊')
        } else {
          await citaRef.update({
            estado: 'cancelada',
            updatedAt: new Date().toISOString(), updatedPor: 'paciente-whatsapp',
          })
          await send(from, 'Listo, cancelamos tu cita. Si quieres otra fecha escribe *agendar* y te ayudamos. 🙌')
          await avisarCancelacion(clinicId, citaId, snap.data() as Record<string, unknown>, from, adminPhone, send)
        }
      } catch {
        await send(from, 'No pudimos registrar tu respuesta. Llámanos al consultorio, por favor.')
      }
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }
    // Cualquier otra cosa: sigue la conversación normal, sin perder el mensaje.
  }

  /**
   * EL AVISO DE PRIVACIDAD, ANTES DE PEDIR UN SOLO DATO.
   *
   * El portal público EXIGE el consentimiento para crear una cita —sin él la
   * ruta responde 400— y el bot creaba el expediente del paciente y su cita sin
   * aviso ninguno: el paciente no lo veía y no quedaba constancia de nada. Son
   * datos de SALUD, sensibles, por un canal externo, y por WhatsApp entra una
   * parte grande de los pacientes.
   *
   * Se pide un «SÍ» EXPRESO: es más de lo que se pediría si bastara el
   * consentimiento tácito, y así no hay que interpretar hasta dónde llega.
   * Ver `lib/whatsapp/aviso-bot.ts`.
   */
  const pedirAviso = async (): Promise<void> => {
    await send(from, mensajeAviso(clinicName, clinicId, process.env.NEXT_PUBLIC_APP_URL))
    await saveSession(clinicId, from, { estado: 'aviso_privacidad', datos: {} })
  }

  if (estado === 'aviso_privacidad') {
    if (aceptoElAviso(text)) {
      await send(from, `Gracias. ¿Cuál es su nombre completo?`)
      // Queda el sello de LO QUE PASÓ: quién, cuándo, por qué canal y con qué
      // versión del aviso. Nunca se marca aceptado por no contestar.
      await saveSession(clinicId, from, { estado: 'agendar_nombre', datos: { avisoEn: new Date().toISOString() } })
      return
    }
    if (rechazoElAviso(text)) {
      await send(from, `Entendido, no seguimos. Si cambias de opinión escríbenos cuando quieras. 🙌`)
      await clearSession(clinicId, from)
      return
    }
    await send(from, `Para poder agendar necesito tu respuesta: *SÍ* para continuar o *NO* para salir.`)
    return
  }

  /**
   * LA INTENCIÓN MANDA SOBRE LA PREGUNTA FRECUENTE.
   *
   * Esto detectaba la pregunta frecuente ANTES que nada, y el patrón de PRECIO
   * incluye la palabra «consulta». Es decir: «quiero agendar una consulta» —la
   * frase más natural para pedir cita— disparaba la respuesta de precios, el bot
   * enseñaba el menú y la cita NO SE AGENDABA NUNCA. Y desde fuera parecía que
   * el bot funcionaba: contestó rápido y con información correcta.
   *
   * Ahora un verbo de acción (agendar, reservar, cancelar, reagendar) gana al
   * tema mencionado. Sin verbo, la pregunta frecuente manda como siempre:
   * «¿cuánto cuesta la consulta?» sigue siendo precio.
   * Ver `lib/whatsapp/intencion.ts`.
   */
  const intencion = intencionDelMensaje(text, detectFAQ)
  const faqKey = intencion.tipo === 'faq' ? intencion.clave : null

  // Pedir cita explícitamente arranca el alta desde CUALQUIER estado de reposo:
  // antes había que estar en el menú y escribir justo «1» o «agendar».
  if (intencion.tipo === 'agendar' && !['agendar_nombre', 'agendar_confirm', 'esperando_lista', 'confirmando_cita', 'confirmando_cancelacion', 'aviso_privacidad'].includes(estado)) {
    await pedirAviso()
    return
  }

  /**
   * Busca las citas de este teléfono y ofrece cancelarlas.
   *
   * Es una FUNCIÓN y no sólo un estado porque hay que poder llamarla en el mismo
   * mensaje: guardando el estado y devolviendo, el paciente recibía «déjame
   * buscar…» y no pasaba nada más hasta que volviera a escribir.
   */
  const buscarParaCancelar = async (): Promise<void> => {
    const minHoras = Number((config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? 0)
    const tz = config?.zonaHoraria || TZ_DEFAULT
    let citas: CitaMinima[] = []
    let falloLectura = false
    try {
      /**
       * TODOS LOS FORMATOS, no sólo el `wa_id`.
       *
       * El panel guarda 10 dígitos, la reserva pública los dígitos crudos y el
       * bot la forma canónica. Comparar con `==` contra el `wa_id` dejaba fuera
       * TODAS las citas dadas de alta en el mostrador, y el bot contestaba «no
       * encontré ninguna cita» — que se lee como «no tienes ninguna», no como
       * «no supe reconocer tu número».
       */
      const snap = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
        .where('pacienteTelefono', 'in', candidatosDeTelefono(from)).limit(25).get()
      citas = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) })) as CitaMinima[]
    } catch { falloLectura = true }

    if (falloLectura) {
      // No se dice «no tienes citas» cuando lo que pasó fue que no se pudieron leer.
      await send(from, `No pude consultar tus citas en este momento. Llámanos al ${adminPhone} y te ayudamos. 🙏`)
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }

    const { cancelables, bloqueadas } = clasificarCitas(
      citas, Date.now(),
      fh => instanteMX(fh.slice(0, 10), fh.slice(11, 16), tz).getTime(),
      minHoras,
    )

    if (cancelables.length === 0) {
      // Una cita bloqueada por la política NO se esconde: si el bot dijera «no
      // encontré citas», el paciente se quedaría tranquilo y no se presentaría.
      await send(from, bloqueadas.length > 0
        ? mensajeBloqueada(minHoras, adminPhone)
        : `No encontré ninguna cita próxima registrada con este número. Si la agendaste con otro teléfono, llámanos al ${adminPhone}. 🙌`)
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }

    if (cancelables.length === 1) {
      const c = cancelables[0]
      await send(from, [
        `Encontré esta cita:`, ``,
        `📅 ${formatDate(c.fechaHora.slice(0, 10))} a las ${c.fechaHora.slice(11, 16)} hrs`,
        c.medicoNombre ? `👨‍⚕️ ${c.medicoNombre}` : '',
        ``,
        `¿La cancelo? Responde *SÍ* para cancelar o *NO* para dejarla.`,
      ].filter(l => l !== '').join('\n'))
      await saveSession(clinicId, from, { estado: 'confirmando_cancelacion', datos: { citaId: c.id, cancelarSolo: '1' } })
      return
    }

    const lista = cancelables.slice(0, 5).map((c, i) =>
      `${i + 1}️⃣ ${formatDate(c.fechaHora.slice(0, 10))} · ${c.fechaHora.slice(11, 16)} hrs`).join('\n')
    await send(from, `Tienes varias citas próximas. ¿Cuál quieres cancelar?\n\n${lista}\n\n0️⃣ Ninguna`)
    await saveSession(clinicId, from, { estado: 'cancelar_elegir', datos: { ids: cancelables.slice(0, 5).map(c => c.id).join(',') } })
    return
    }

  // «Quiero cancelar mi cita» desde cualquier estado de reposo, sin pasar por el
  // menú: es lo que la gente escribe.
  if (intencion.tipo === 'cancelar' && !['agendar_nombre', 'agendar_confirm', 'esperando_lista', 'confirmando_cita', 'confirmando_cancelacion', 'cancelar_elegir', 'aviso_privacidad'].includes(estado)) {
    await buscarParaCancelar()
    return
  }

  /**
   * El estado del AVISO tampoco se secuestra: la pregunta de consentimiento
   * tiene que terminar antes de contestar otra cosa, o el paciente acaba dando
   * sus datos sin haber contestado si acepta.
   */
  if (faqKey && !['agendar_nombre', 'agendar_confirm', 'esperando_lista', 'confirmando_cita', 'confirmando_cancelacion', 'aviso_privacidad'].includes(estado)) {
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

  // ── MENÚ DE INFORMACIÓN ───────────────────────────────────
  if (estado === 'info_menu') {
    if (tLow === '0' || /volver|menu|salir/.test(tLow)) {
      await send(from, buildMenu(clinicName))
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }
    const tema = TEMAS_INFO.find(t => t.n === tLow)
    if (tema) {
      await send(from, buildFAQReply(tema.clave, doctor, config || ({} as ClinicConfig)))
      await send(from, `¿Algo más? Responde el número de otro tema o *0* para volver.`)
      return
    }
    // Cualquier otra cosa sigue el camino normal: la pregunta escrita a mano ya
    // la resuelve el detector de arriba, y no se pierde el mensaje.
  }

  // ── MENU ──────────────────────────────────────────────────
  if (estado === 'menu') {
    if (tLow === '1' || /agendar|cita|quiero cita/.test(tLow)) {
      await pedirAviso()
      return
    }
    if (tLow === '2' || /informacion|info|pregunta/.test(tLow)) {
      await send(from, buildInfoMenu(config))
      // Estado propio: en `menu`, el «1» que este menú invita a escribir caía en
      // el alta de cita.
      await saveSession(clinicId, from, { estado: 'info_menu' })
      return
    }
    if (tLow === '3' || /cancelar/.test(tLow)) {
      // El mensaje ya no promete algo que no pasa: ahora sí se buscan las citas
      // de este número y se cancelan aquí mismo.
      await buscarParaCancelar()
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
    const bloques = await cargarBloques(clinicId, fecha, doctor?.id, config!)

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
      /**
       * DÓNDE, SEGÚN EL TIPO. El bot ofrece «5️⃣ Teleconsulta» en su propio menú
       * y luego imprimía el consultorio y la dirección igual que a una cita
       * presencial, sin el enlace de la sala por ningún lado. Ver
       * `lib/telesalud/donde-es.ts`; aquí todavía no hay id de cita —no existe—
       * así que el enlace llega en el mensaje de después.
       */
      ...(datos.tipo === 'teleconsulta'
        ? ['💻 *Es una videoconsulta*: no necesita acudir al consultorio.']
        : [`🏥 *Consultorio:* ${clinicName}`, config?.direccion ? `📍 *Dirección:* ${config.direccion}` : '']),
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

      /**
       * REVALIDAR ANTES DE ESCRIBIR — no sólo el choque con otra cita.
       *
       * La transacción de abajo sólo comprobaba solapes. Todo lo demás —día
       * activo, horario, DESCANSOS, bloqueos, horas ya pasadas— se había
       * comprobado al LISTAR, y entre listar y confirmar puede pasar cualquier
       * cosa: la sesión del bot sobrevive minutos u horas, y en ese rato el
       * médico puede crear un bloqueo o cambiar su horario. El panel y el portal
       * público ya revalidaban; el bot no, así que era el único camino por el
       * que una cita podía entrar en la hora de comida.
       */
      /**
       * LA IDENTIDAD DE LA INTENCIÓN, ANTES QUE LA REVALIDACIÓN.
       *
       * Un mismo «SÍ» llega dos veces sin que nadie haga nada raro (Meta
       * reentrega, `clearSession` se traga su error, el proveedor se cae y el
       * paciente reescribe). Y la revalidación de abajo veía LA CITA QUE ACABA DE
       * CREAR ESTE MISMO PACIENTE, la contaba como ocupación y le contestaba «ese
       * horario ya no está disponible, agende de nuevo». El paciente agendaba, y
       * el consultorio se quedaba con dos citas suyas.
       *
       * Es la regla de GP9 —misma solicitud activa, mismo recurso— aplicada a la
       * otra vía que crea citas. Ver `lib/whatsapp/cita-ya-agendada.ts`.
       */
      const intento: IntentoDeCitaDelBot = {
        pacienteTelefono: from,
        fechaHora,
        tipo: String(datos.tipo ?? ''),
        duracion,
        medicoId: doctorId || '',
      }
      let nuevoFolio = ''
      let esReintento = false

      {
        const apptSnapRV = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
          .where('fechaHora', '>=', datos.fecha + ' 00:00')
          .where('fechaHora', '<=', datos.fecha + ' 23:59')
          .get()
        const apptsRV = apptSnapRV.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
        const yaEsta = citaYaAgendada(intento, apptsRV as unknown as CitaEscrita[])
        if (yaEsta) {
          // Ya está agendada: se le vuelve a confirmar LA MISMA, con su folio.
          nuevoFolio = yaEsta
          esReintento = true
        } else {
          const bloquesRV = await cargarBloques(clinicId, datos.fecha, doctor?.id, config!)
          const vigentes = getAvailableSlotsForDate(datos.fecha, duracion, config!, apptsRV, bloquesRV, doctor?.id)
          if (!vigentes.includes(datos.hora)) {
            await send(from, `Ese horario ya no está disponible. Por favor elija otro escribiendo *agendar* de nuevo. 🙏`)
            await saveSession(clinicId, from, { estado: 'menu', datos: {} })
            return
          }
        }
      }

      // Crear ATÓMICO: re-chequea conflicto dentro de la transacción → dos pacientes
      // no pueden confirmar el mismo horario a la vez (antes era un .add() directo).
      const apptsCol = adminDb.collection('clinics').doc(clinicId).collection('appointments')
      const [bh, bm] = datos.hora.split(':').map(Number)
      const bStart = bh * 60 + bm, bEnd = bStart + duracion
      let huboConflicto = false
      // Centinela por médico+día (igual que agenda interna y portal): serializa
      // reservas simultáneas del mismo día para cerrar la carrera de inserción fantasma.
      const diaRef = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(datos.fecha)  // un centinela por DÍA
      if (!esReintento) try {
        await adminDb.runTransaction(async (tx) => {
          await tx.get(diaRef)  // read: fija la versión del día
          const snap = await tx.get(apptsCol.where('fechaHora', '>=', `${datos.fecha} 00:00`).where('fechaHora', '<=', `${datos.fecha} 23:59`))
          let conflicto = false
          /**
           * La misma regla que arriba, ahora DENTRO de la transacción: cierra la
           * carrera de dos entregas simultáneas del mismo «SÍ». Sin esto el
           * perdedor de la carrera reejecuta, ve la cita del ganador —que es la
           * SUYA— y le contesta al paciente «acaba de ocuparse» mientras el otro
           * mensaje le dice que quedó registrada. Dos respuestas que se
           * desmienten, por la misma cita.
           */
          let reintentoEnTx = ''
          snap.forEach(d => {
            const a = d.data()
            if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
            if (citaYaAgendada(intento, [{ id: d.id, ...a } as CitaEscrita])) { reintentoEnTx = d.id; return }
            if (doctorId && a.medicoId && a.medicoId !== doctorId) return
            const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
            const aS = ah * 60 + am, aE = aS + (a.duracion ?? 30)
            if (bStart < aE && bEnd > aS) conflicto = true
          })
          if (reintentoEnTx) {
            // Su propia cita. No se escribe nada y se responde con el mismo folio.
            nuevoFolio = reintentoEnTx
            esReintento = true
            return
          }
          if (conflicto) throw new Error('CONFLICTO')
          tx.set(diaRef, { ultimaReserva: now }, { merge: true })  // write: invalida la tx concurrente
          const nref = apptsCol.doc()
          nuevoFolio = nref.id
          tx.set(nref, {
            pacienteId: pacienteIdBot, pacienteNombre: datos.nombre, pacienteTelefono: from,
            fechaHora, duracion, tipo: datos.tipo as AppointmentType, motivo: '',
            estado: 'solicitada', origen: 'WhatsApp', medicoNombre,
            medicoId: doctorId || '', doctorId: doctorId || '',
            // Sin lugar físico si es videoconsulta: el portal imprime
            // «Teleconsulta · {lugar}» y sería enseñarle el consultorio a quien
            // no tiene que ir.
            lugar: datos.tipo === 'teleconsulta' ? '' : clinicName,
            confirmadoPaciente: true, fechaConfirmacion: now,
            recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
            consentimientoMensajes: true, notasInternas: `Agendada por bot WhatsApp`,
            // Lo que el paciente aceptó, con su versión y su hora: el portal web
            // lo guarda desde siempre y este camino no guardaba nada.
            consentimientos: consentimientoDelBot(String(datos.avisoEn || now)),
            versionAviso: VERSION_AVISO,
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

      /**
       * EL SELLO TAMBIÉN EN EL EXPEDIENTE — donde lo mira el panel de Pacientes.
       *
       * El portal público guarda en `patients/{id}.avisoPrivacidad` un sello con
       * la versión, el medio y el HASH del texto aceptado; v884 dejó el
       * consentimiento del bot sólo en la cita, así que el paciente que llega
       * por WhatsApp seguía apareciendo sin aviso en su expediente.
       *
       * No se pisa uno anterior: el PRIMERO es el que vale, y machacarlo
       * borraría la fecha real en que aceptó.
       */
      if (pacienteIdBot) {
        try {
          const pacRef = adminDb.collection('clinics').doc(clinicId).collection('patients').doc(pacienteIdBot)
          const yaTiene = !!(await pacRef.get()).data()?.avisoPrivacidad
          if (!yaTiene) {
            await pacRef.set({
              avisoPrivacidad: selloExpediente(config, String(datos.avisoEn || now)),
              updatedAt: now,
            }, { merge: true })
          }
        } catch { /* la cita ya quedó; el sello no la tumba */ }
      }

      const tipoLabel = TIPO_OPTIONS.find(t => t.key === datos.tipo)?.label || datos.tipo
      await send(from, [
        `🎉 *¡Su cita ha sido registrada!*`,
        ``,
        `📅 ${formatDate(datos.fecha)} a las ${datos.hora} hrs`,
        /**
         * SIN ENLACE AQUÍ, Y ES UNA DECISIÓN.
         *
         * El bot agenda con semanas de antelación. Un token de sala vive los días
         * que dice `patient-token.ts`, así que un enlace metido en la confirmación
         * estaría muerto el día de la consulta y respondería 404 «tu cita no
         * existe» — que es peor que no mandarlo (ver `donde-es.ts`).
         *
         * El enlace lo manda el recordatorio, que corre sobre la ventana de hoy y
         * mañana: ahí el token nace vivo y llega a tiempo. Por eso este mensaje
         * dice la verdad («recibirás el enlace antes de tu cita») en vez de dar un
         * enlace roto, y la promesa la cumple `api/cron/reminders`.
         */
        ...dondeEsLaCita({
          tipo: datos.tipo, citaId: nuevoFolio, clinicId,
          direccion: config?.direccion, googleMapsUrl: config?.googleMapsUrl,
          baseUrl: process.env.NEXT_PUBLIC_APP_URL,
          tokenPaciente: '',
        }).lineas.map(l => l),
        ``,
        `Recibirá un recordatorio el día anterior. Para cambios, comuníquese al ${adminPhone}.`,
        ``,
        `¡Hasta pronto! 😊`,
      ].filter(l => l !== '').join('\n'))

      // Notify admin/secretary. En un REINTENTO no: la cita ya se avisó la
      // primera vez, y un segundo «🔔 Nueva cita» hace que el consultorio crea
      // que tiene dos. Retry no duplica citas NI avisos.
      if (!esReintento && adminPhone && adminPhone !== from) {
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
  /**
   * CANCELAR DE VERDAD — antes era una promesa sin nada detrás.
   *
   * El menú ofrece «3️⃣ Cancelar cita», el primer mensaje decía «también puede
   * escribir su nombre completo y le ayudamos»… y ESTE estado ignoraba por
   * completo lo que el paciente escribiera: repetía el teléfono del consultorio
   * y volvía al menú. El paciente tecleaba su nombre —dato personal, a un canal
   * externo— para nada, y su cita seguía viva: el día de la consulta contaba
   * como no-show.
   *
   * Y el bot SÍ sabía cancelar: contestar «NO» a un recordatorio cancela sin
   * problema. Lo que faltaba era ENCONTRAR la cita cuando el paciente escribe
   * por su cuenta, y eso se hace por el teléfono, que es lo único que el bot
   * conoce de quien escribe (el mismo criterio que la baja de lista de espera).
   *
   * La política de cancelación del consultorio se respeta: si el bot cancelara
   * sin mirarla sería la puerta trasera para saltarse lo que el portal exige.
   * Ver `lib/whatsapp/citas-cancelables.ts`.
   */
  /** Elegir cuál de varias citas cancelar. */
  if (estado === 'cancelar_elegir') {
    const ids = String(datos.ids ?? '').split(',').filter(Boolean)
    const n = parseInt(tLow, 10)
    if (tLow === '0' || /ninguna|salir/.test(tLow)) {
      await send(from, `De acuerdo, no cancelé nada. ¿Algo más?`)
      await saveSession(clinicId, from, { estado: 'menu', datos: {} })
      return
    }
    if (!Number.isFinite(n) || n < 1 || n > ids.length) {
      await send(from, `No entendí. Responde el número de la cita que quieres cancelar, o *0* para no cancelar ninguna.`)
      return
    }
    await send(from, `¿Confirmas que cancelo esa cita? Responde *SÍ* o *NO*.`)
    await saveSession(clinicId, from, { estado: 'confirmando_cancelacion', datos: { citaId: ids[n - 1], cancelarSolo: '1' } })
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
      let citaIdListaEspera = ''
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
          // El id se toma ANTES de escribir: es lo que permite darle al paciente
          // el enlace de su sala si la cita es una teleconsulta.
          const refLE = apptsColLE.doc()
          citaIdListaEspera = refLE.id
          tx.set(refLE, {
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

      {
        // Sin enlace, por la misma razón que el alta normal: lo manda el
        // recordatorio, con un token que sigue vivo el día de la consulta.
        const donde = dondeEsLaCita({
          tipo: datos.tipo, citaId: citaIdListaEspera, clinicId,
          direccion: config?.direccion, googleMapsUrl: config?.googleMapsUrl,
          baseUrl: process.env.NEXT_PUBLIC_APP_URL,
          tokenPaciente: '',
        })
        await send(from, [
          `✅ ¡Cita agendada!`, ``,
          `📅 ${formatDate(slotFecha)} a las ${slotHora} hrs`,
          ...(donde.esVideo ? [] : [`🏥 ${clinicName}`]),
          ...donde.lineas,
          ``,
          `Le enviaremos un recordatorio. ¡Hasta pronto! 😊`,
        ].filter(l => l !== undefined).join('\n'))
      }

      if (adminPhone) {
        await send(adminPhone, `🔔 Paciente de lista de espera confirmó cita:\n${datos.nombre} – ${slotFecha} ${slotHora}`)
      }

      await clearSession(clinicId, from)
    } else {
      /**
       * «RESPONDA NO Y LE QUITAMOS DE LA LISTA» — y no se le quitaba.
       *
       * El aviso de lista de espera promete la baja con esas palabras y esta
       * rama sólo mandaba un texto: la entrada seguía viva y el paciente
       * recibía la siguiente oferta después de haber pedido que no.
       *
       * Se da de baja por TELÉFONO, que es lo único que el bot conoce de quien
       * escribe. Si falla, se dice: prometer una baja que no ocurrió es peor que
       * no prometerla.
       */
      let dadoDeBaja = false
      try {
        const cRef = adminDb.collection('clinics').doc(clinicId)
        // Mismos candidatos que las citas: una baja prometida y no ejecutada es
        // peor que no prometerla, y este comentario ya lo decía dos líneas arriba.
        const wl = await cRef.collection('waitlist')
          .where('pacienteTelefono', 'in', candidatosDeTelefono(from))
          .limit(10)
          .get()
        for (const d of wl.docs) {
          const est = String((d.data() as { estado?: string }).estado ?? '')
          if (est === 'activo' || est === 'contactado') {
            await d.ref.update({ estado: 'baja', bajaEn: new Date().toISOString(), bajaMotivo: 'El paciente respondió NO a una oferta' })
            dadoDeBaja = true
          }
        }
      } catch { /* se dice abajo */ }

      await send(from, dadoDeBaja
        ? `Listo, le quitamos de la lista de espera. Si más adelante quiere una cita, escríbanos y con gusto le agendamos. 🙌`
        : `Entendido, no le ofrecemos este horario. No pudimos quitarle de la lista automáticamente — dígalo al consultorio y lo hacemos.`)
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
  let cursor = todayStr(config.zonaHoraria || TZ_DEFAULT)

  // Get all appointments for next 14 days
  const endDate = addDays(cursor, 14)
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
    .where('fechaHora', '>=', cursor + ' 00:00')
    .where('fechaHora', '<=', endDate + ' 23:59')
    .get()
  const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
  /**
   * AQUÍ NO SE CONSULTA GOOGLE, Y ES A PROPÓSITO.
   *
   * Esto recorre CATORCE días para proponer los primeros con hueco: consultar el
   * calendario día por día serían catorce llamadas dentro de un webhook, que
   * tiene que contestar rápido o WhatsApp reintenta el mensaje.
   *
   * No abre un agujero: esto sólo PROPONE días. Al elegir uno se listan sus
   * horas —ahí sí con Google— y al confirmar se revalida otra vez. Lo peor que
   * puede pasar es que se ofrezca un día que al abrirlo tenga menos huecos.
   */
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
  /**
   * LOS NÚMEROS QUE ESTE MENÚ PROMETÍA Y NO TENÍA.
   *
   * Terminaba con «O responda con el número de su interés» y no listaba ni un
   * número. Peor: después de este menú el estado sigue siendo `menu`, así que
   * quien leía esa línea y escribía «1» acababa en el ALTA DE CITA, y «3» en
   * cancelar. La instrucción no sólo era vacía: llevaba al sitio equivocado.
   */
  return [
    `ℹ️ *¿Sobre qué desea información?*`,
    ``,
    ...TEMAS_INFO.map(t => `${t.n}️⃣ ${t.label}`),
    `0️⃣ Volver`,
    ``,
    `También puede preguntarme directamente, por ejemplo: "¿cuál es el horario?"`,
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
