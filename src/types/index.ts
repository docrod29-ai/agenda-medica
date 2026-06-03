// ══════════════════════════════════════════════════════════════
// MODELOS DE DATOS — Agenda Médica Inteligente (SaaS Multi-tenant)
// ══════════════════════════════════════════════════════════════

export type ClinicPlan = 'trial' | 'basico' | 'pro' | 'clinica'
export type ClinicStatus = 'active' | 'trial' | 'suspended' | 'cancelled'

export interface ClinicWhatsApp {
  provider: '360dialog' | 'meta' | 'none'
  apiKey?: string          // 360dialog permanent API key
  phoneNumberId?: string   // Meta phone_number_id (also used by 360dialog)
  phoneNumber?: string     // E.164 format, e.g. "+526141234567"
  connected: boolean
  connectedAt?: string     // ISO date
}

export interface Clinic {
  id: string
  nombreClinica: string
  nombreMedico: string
  plan: ClinicPlan
  status: ClinicStatus
  trialEndsAt?: string          // ISO date
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeSubscriptionStatus?: string
  whatsapp?: ClinicWhatsApp     // WhatsApp connection (set after 360dialog enrollment)
  ownerId: string               // Firebase uid del creador
  createdAt: string
  updatedAt: string
}

export interface ClinicMember {
  clinicId: string
  role: 'admin' | 'medico' | 'secretaria'
  /** Nombre visible en el chat. Si no se define, usa nombreMedico (médico/admin) o email prefix */
  displayName?: string
  /** Avatar opcional (emoji o data URL) */
  avatar?: string
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────

export type AppointmentStatus =
  | 'solicitada'
  | 'pendiente-datos'
  | 'pendiente-confirmar'
  | 'confirmada'
  | 'recordatorio-enviado'
  | 'en-sala'
  | 'en-consulta'
  | 'atendida'
  | 'finalizada'
  | 'cancelada'
  | 'reagendada'
  | 'no-asistio'
  | 'pendiente-pago'   // facturación esperando cobro
  | 'pagada'

export type AppointmentType =
  | 'primera-vez'
  | 'seguimiento'
  | 'urgente'
  | 'estudios'
  | 'teleconsulta'
  | 'prequirurgica'
  | 'procedimiento'
  | 'otro'

export type AppointmentOrigin =
  | 'Manual'
  | 'WhatsApp'
  | 'Teléfono'
  | 'Referido'
  | 'Google Calendar'
  | 'Otro'

export type UserRole = 'medico' | 'secretaria' | 'admin'

export interface Doctor {
  id: string
  nombre: string
  especialidad: string
  telefono?: string
  email?: string
  foto?: string
  horario: ClinicConfig['horario']
  duraciones: ClinicConfig['duraciones']
  intervaloMinutos: number
  zonaHoraria: string
  activo: boolean
  // Onboarding para el bot
  botConfig?: {
    padecimientos: string
    costoConsulta: string
    seguros: string
    comoLlegar: string
    infoExtra: string
    completado: boolean
  }
  createdAt: string
  updatedAt: string
}

/** Etiquetas operativas para triage de pacientes (configurables, no rompen nada). */
export type PatientTag =
  | 'nuevo'
  | 'seguimiento'
  | 'frecuente'
  | 'alto-riesgo'
  | 'requiere-llamada'
  | 'pendiente-estudios'
  | 'pendiente-pago'
  | 'requiere-factura'
  | 'requiere-consentimiento'
  | 'requiere-interprete'
  | 'embarazo'
  | 'cronico'
  | 'inactivo'

export const PATIENT_TAG_CONFIG: Record<PatientTag, { label: string; color: string }> = {
  'nuevo':                    { label: 'Nuevo',                   color: '#60a5fa' },
  'seguimiento':              { label: 'Seguimiento',             color: '#94a3b8' },
  'frecuente':                { label: 'Frecuente',               color: '#22c55e' },
  'alto-riesgo':              { label: 'Alto riesgo',             color: '#ef4444' },
  'requiere-llamada':         { label: 'Requiere llamada',        color: '#f59e0b' },
  'pendiente-estudios':       { label: 'Pendiente estudios',      color: '#a855f7' },
  'pendiente-pago':           { label: 'Pendiente pago',          color: '#f97316' },
  'requiere-factura':         { label: 'Requiere factura',        color: '#06b6d4' },
  'requiere-consentimiento':  { label: 'Requiere consentimiento', color: '#eab308' },
  'requiere-interprete':      { label: 'Requiere intérprete',     color: '#84cc16' },
  'embarazo':                 { label: 'Embarazo',                color: '#ec4899' },
  'cronico':                  { label: 'Crónico',                 color: '#8b5cf6' },
  'inactivo':                 { label: 'Inactivo',                color: '#64748b' },
}

/** Sucursal / sede / consultorio físico — opcional para clínicas multi-sede. */
export interface Branch {
  id: string
  nombre: string
  direccion?: string
  telefono?: string
  googleMapsUrl?: string
  activa: boolean
  createdAt: string
}

export interface Patient {
  id: string
  nombre: string
  telefono: string
  whatsapp?: string
  email?: string
  fechaNacimiento?: string
  edad?: number
  sexo?: 'Masculino' | 'Femenino' | 'Otro'
  seguroMedico?: string
  alergias?: string
  notas?: string
  tags?: PatientTag[]
  ultimaCita?: string
  proximoSeguimiento?: string
  noShowCount: number
  cancelacionCount: number
  // === Cumplimiento NOM-024 + LFPDPPP ===
  /** CURP del paciente (NOM-024 Art. 5.6.2 — identificación obligatoria) */
  curp?: string
  /** Aceptación del aviso de privacidad LFPDPPP */
  avisoPrivacidad?: {
    aceptado: boolean
    fechaAceptacion: string        // ISO
    versionAviso: string           // ej "2026-06"
    medioAceptacion: 'presencial' | 'portal' | 'whatsapp' | 'verbal'
  }
  createdAt: string
  updatedAt: string
  creadoPor: string
}

export interface Appointment {
  id: string
  pacienteId: string
  pacienteNombre: string
  pacienteTelefono: string
  fechaHora: string         // 'YYYY-MM-DD HH:mm'
  duracion: number          // minutos
  tipo: AppointmentType
  motivo?: string
  estado: AppointmentStatus
  origen: AppointmentOrigin
  medicoNombre: string
  medicoId?: string
  lugar?: string
  confirmadoPaciente: boolean
  fechaConfirmacion?: string
  recordatorio24hEnviado: boolean
  recordatorioMismoDiaEnviado: boolean
  notasInternas?: string
  consentimientoMensajes: boolean
  doctorId?: string
  branchId?: string            // ✨ multi-sucursal (opcional)
  googleCalendarEventId?: string
  googleCalendarSyncStatus?: 'pending' | 'synced' | 'error'
  createdAt: string
  updatedAt: string
  creadoPor: string
  updatedPor: string
}

export interface WaitlistEntry {
  id: string
  pacienteId?: string
  pacienteNombre: string
  pacienteTelefono: string
  fechaDeseada?: string
  rangoHorario?: string
  tipo?: AppointmentType
  prioridad: number
  estado: 'activo' | 'contactado' | 'convertido' | 'eliminado'
  notas?: string
  createdAt: string
  creadoPor: string
}

export interface NotificationLog {
  id: string
  appointmentId: string
  pacienteId: string
  tipo: 'confirmacion' | 'recordatorio-24h' | 'recordatorio-dia' | 'cancelacion' | 'reagendamiento'
  canal: 'whatsapp' | 'sms' | 'email'
  estado: 'enviado' | 'fallido' | 'pendiente'
  sentAt?: string
  errorMessage?: string
}

export interface AuditLog {
  id: string
  entityType: 'appointment' | 'patient' | 'waitlist' | 'config'
  entityId: string
  action: string
  oldValue?: string
  newValue?: string
  userId: string
  userEmail: string
  createdAt: string
}

export interface DaySchedule {
  activo: boolean
  inicio: string  // 'HH:mm'
  fin: string     // 'HH:mm'
}

export interface ClinicConfig {
  id?: string
  nombreMedico: string
  nombreClinica: string
  cedulaProfesional?: string   // NOM-004 — requerido para firmar notas
  especialidad?: string        // NOM-004 — aparece en la firma y el PDF
  direccion: string
  googleMapsUrl: string
  telefonoAdmin: string
  whatsappConsultorio: string
  zonaHoraria: string
  horario: {
    lunes: DaySchedule
    martes: DaySchedule
    miercoles: DaySchedule
    jueves: DaySchedule
    viernes: DaySchedule
    sabado: DaySchedule
    domingo: DaySchedule
  }
  duraciones: Record<AppointmentType, number>
  intervaloMinutos: number
  recordatorio24h: boolean
  recordatorioMismoDia: boolean
  horaResumenDiario: string
  diasFestivos: string[]
  whatsappProveedor: string
  googleCalendarId: string
  // Portal público de auto-agenda
  publicBookingEnabled?: boolean   // Si true, el portal /reservar/[clinicId] acepta citas
  publicBookingNote?: string       // Mensaje opcional para pacientes ("solo nuevas consultas, etc.")
  /**
   * Firma + sello del médico (imagen). Si está presente, se renderiza encima de la
   * línea de firma en notas firmadas, recetas y órdenes. Se guarda como data URL
   * base64 ya redimensionado.
   */
  firmaImagenDataUrl?: string
  // Receta y órdenes médicas
  recetaConfig?: RecetaConfig
  updatedAt?: string
}

/** Re-exports desde lib/receta-template para que ClinicConfig consumidores no necesiten otro import */
export type { PaperSize, EstiloReceta } from '@/lib/receta-template'

/** Configuración de impresos: recetas y órdenes médicas */
export interface RecetaConfig {
  /** Tamaño de papel */
  paperSize: 'media-carta' | 'carta' | 'oficio' | 'a4' | 'a5'
  /** Estilo visual */
  estilo: 'minimalista' | 'clasico' | 'moderno'
  /** Membrete: imagen del encabezado del doctor (logo + clínica + datos) en data URL base64 */
  membreteDataUrl?: string
  /** Pie de página: imagen opcional al final (firma escaneada, datos extra) */
  pieDataUrl?: string
  /**
   * Diseño COMPLETO de receta subido por el médico (su propio papel).
   * Cuando se usa, sustituye membrete/pie/encabezado generado: la imagen se renderiza
   * como fondo a tamaño completo y SOLO se sobreponen los datos dinámicos (paciente,
   * Rx, indicaciones, firma) en la zona definida por `disenoMargenes`.
   */
  disenoCompletoDataUrl?: string
  /** Márgenes del área de contenido cuando se usa diseño completo (en mm). */
  disenoMargenes?: { top: number; right: number; bottom: number; left: number }
  /** Tamaño de fuente del contenido sobre el diseño custom (px) */
  disenoFontSize?: number
  /**
   * Solo mostrar Rx/estudios en el área de contenido del diseño custom.
   * Útil si tu papel YA tiene impresos los campos del paciente (Nombre, Edad,
   * Fecha, etc.) — así no se sobreponen.
   */
  disenoSoloRx?: boolean
  /** Color de acento (botones, líneas) */
  colorAccento?: string
  /** Mostrar QR de verificación al pie de la receta */
  mostrarQR?: boolean
  /** Generar copias: médico + paciente + farmacia en una sola hoja */
  copiasEnHoja?: 1 | 2 | 3
  /** Vigencia default de la receta en días */
  vigenciaDias?: number
  /** Texto del aviso legal al pie */
  avisoLegal?: string
  /** Datos opcionales del médico que sobrescriben los de ClinicConfig */
  rfc?: string
  registroDGP?: string             // Registro DGP/SSA para psicotrópicos
  registroAntidopaje?: string      // Opcional para deportólogos
  // Lo que se debe imprimir
  mostrarAlergias?: boolean
  mostrarDiagnostico?: boolean
  mostrarSignosVitales?: boolean
}

export interface DashboardStats {
  citasHoy: number
  citasManana: number
  citasSemana: number
  confirmadas: number
  pendientesConfirmar: number
  canceladas: number
  noShow: number
  nuevosHoy: number
  listasEspera: number
  proxCita: Appointment | null
}

// ── Constantes de UI ──────────────────────────────────────────

export const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  'solicitada':           { label: 'Solicitada',          color: 'text-amber-400',  bgColor: 'bg-amber-400/10',  dotColor: 'bg-amber-400' },
  'pendiente-datos':      { label: 'Pendiente de datos',  color: 'text-amber-400',  bgColor: 'bg-amber-400/10',  dotColor: 'bg-amber-400' },
  'pendiente-confirmar':  { label: 'Pendiente confirmar', color: 'text-amber-400',  bgColor: 'bg-amber-400/10',  dotColor: 'bg-amber-400' },
  'confirmada':           { label: 'Confirmada',          color: 'text-teal-400',   bgColor: 'bg-teal-400/10',   dotColor: 'bg-teal-400' },
  'recordatorio-enviado': { label: 'Recordatorio enviado',color: 'text-blue-400',   bgColor: 'bg-blue-400/10',   dotColor: 'bg-blue-400' },
  'en-sala':              { label: 'En sala de espera',   color: 'text-blue-400',   bgColor: 'bg-blue-400/15',   dotColor: 'bg-blue-400' },
  'en-consulta':          { label: 'En consulta',         color: 'text-purple-400', bgColor: 'bg-purple-400/15', dotColor: 'bg-purple-400' },
  'atendida':             { label: 'Atendida',            color: 'text-teal-500',   bgColor: 'bg-teal-500/10',   dotColor: 'bg-teal-500' },
  'finalizada':           { label: 'Finalizada',          color: 'text-slate-400',  bgColor: 'bg-slate-400/10',  dotColor: 'bg-slate-400' },
  'cancelada':            { label: 'Cancelada',           color: 'text-red-400',    bgColor: 'bg-red-400/10',    dotColor: 'bg-red-400' },
  'reagendada':           { label: 'Reagendada',          color: 'text-orange-400', bgColor: 'bg-orange-400/10', dotColor: 'bg-orange-400' },
  'no-asistio':           { label: 'No asistió',          color: 'text-red-500',    bgColor: 'bg-red-500/10',    dotColor: 'bg-red-500' },
  'pendiente-pago':       { label: 'Pendiente de pago',   color: 'text-orange-400', bgColor: 'bg-orange-400/15', dotColor: 'bg-orange-400' },
  'pagada':               { label: 'Pagada',              color: 'text-green-400',  bgColor: 'bg-green-400/10',  dotColor: 'bg-green-400' },
}

export const APPOINTMENT_TYPE_CONFIG: Record<AppointmentType, { label: string; icon: string; defaultMinutes: number }> = {
  'primera-vez':   { label: 'Primera vez',          icon: '🆕', defaultMinutes: 60 },
  'seguimiento':   { label: 'Seguimiento',          icon: '🔄', defaultMinutes: 30 },
  'urgente':       { label: 'Urgente',              icon: '🚨', defaultMinutes: 30 },
  'estudios':      { label: 'Revisión de estudios', icon: '🔬', defaultMinutes: 30 },
  'teleconsulta':  { label: 'Teleconsulta',         icon: '💻', defaultMinutes: 30 },
  'prequirurgica': { label: 'Val. prequirúrgica',   icon: '⚕️',  defaultMinutes: 60 },
  'procedimiento': { label: 'Procedimiento',        icon: '🩺', defaultMinutes: 45 },
  'otro':          { label: 'Otro',                 icon: '📋', defaultMinutes: 30 },
}

export const DEFAULT_CONFIG: ClinicConfig = {
  nombreMedico: '',
  nombreClinica: '',
  cedulaProfesional: '',
  especialidad: '',
  direccion: '',
  googleMapsUrl: '',
  telefonoAdmin: '',
  whatsappConsultorio: '',
  zonaHoraria: 'America/Chihuahua',
  horario: {
    lunes:     { activo: true,  inicio: '09:00', fin: '18:00' },
    martes:    { activo: true,  inicio: '09:00', fin: '18:00' },
    miercoles: { activo: true,  inicio: '09:00', fin: '18:00' },
    jueves:    { activo: true,  inicio: '09:00', fin: '18:00' },
    viernes:   { activo: true,  inicio: '09:00', fin: '14:00' },
    sabado:    { activo: false, inicio: '09:00', fin: '12:00' },
    domingo:   { activo: false, inicio: '09:00', fin: '12:00' },
  },
  duraciones: {
    'primera-vez': 60, 'seguimiento': 30, 'urgente': 30, 'estudios': 30,
    'teleconsulta': 30, 'prequirurgica': 60, 'procedimiento': 45, 'otro': 30,
  },
  intervaloMinutos: 10,
  recordatorio24h: true,
  recordatorioMismoDia: true,
  horaResumenDiario: '07:00',
  diasFestivos: [],
  whatsappProveedor: '',
  googleCalendarId: '',
  publicBookingEnabled: true,
  publicBookingNote: '',
  recetaConfig: {
    paperSize: 'media-carta',
    estilo: 'minimalista',
    colorAccento: '#14b8a6',
    mostrarQR: true,
    copiasEnHoja: 1,
    vigenciaDias: 30,
    mostrarAlergias: true,
    mostrarDiagnostico: true,
    mostrarSignosVitales: false,
    avisoLegal: 'Esta receta es personal e intransferible. Conserve este documento como respaldo médico.',
  },
}
