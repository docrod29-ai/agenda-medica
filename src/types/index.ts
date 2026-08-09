// ══════════════════════════════════════════════════════════════
// MODELOS DE DATOS — Agenda Médica Inteligente (SaaS Multi-tenant)
// ══════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
// Unión canónica de roles (E0-06). Se importa en vez de redeclararse: este archivo
// tenía la 3.ª de las cuatro listas de roles que había en el repo (ver E0-07).
import type { Rol } from '@/lib/authz/matriz-acceso'
import { UserPlus, RefreshCw, Siren, Microscope, Video, ClipboardCheck, Stethoscope, ClipboardList } from 'lucide-react'

// Planes actuales: agenda · clinica · premium (Pro) · hospital. Se conservan
// 'basico'/'pro' por compatibilidad con consultorios dados de alta antes del rebranding.
export type ClinicPlan = 'trial' | 'agenda' | 'clinica' | 'premium' | 'hospital' | 'basico' | 'pro' | 'cortesia'
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
  trialEndsAt?: string          // ISO date — lo lee la interfaz
  /**
   * El MISMO instante en epoch-ms. No es un duplicado por descuido.
   *
   * Las reglas de Firestore no saben parsear una fecha ISO, así que el paywall
   * del servidor compara contra este número. `/api/clinic/crear` escribe los dos
   * a la vez y `firestore.rules` prohíbe que el cliente toque cualquiera de
   * ellos — si se pudieran editar, cualquiera se regalaría prueba infinita.
   *
   * Faltaba en este tipo aunque el servidor llevaba tiempo escribiéndolo: el
   * tipo describía menos de lo que había, que es la clase de hueco que hace que
   * una pantalla lea `undefined` y decida mal sin que nadie se entere.
   */
  trialEndsAtMs?: number
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeSubscriptionStatus?: string
  // Pase libre otorgado por el dueño de la plataforma (cortesía / demo / socio).
  // Cuando es true, el acceso nunca vence y no se cobra.
  paseLibre?: boolean
  paseLibreMotivo?: string
  paseLibrePor?: string          // correo del dueño que lo otorgó
  notasInternas?: string         // notas del dueño sobre este cliente (no visibles al cliente)
  // Control de acceso por MÓDULOS (entitlements). undefined = acceso a TODO
  // (compatibilidad con clínicas previas). Lo asigna el dueño desde /superadmin.
  modulos?: string[]
  paqueteId?: string             // paquete aplicado (referencia)
  paqueteNombre?: string
  paquetePrecio?: number         // precio del paquete asignado (fuente del MRR real)
  whatsapp?: ClinicWhatsApp     // WhatsApp connection (set after 360dialog enrollment)
  ownerId: string               // Firebase uid del creador
  createdAt: string
  updatedAt: string
}

export interface ClinicMember {
  clinicId: string
  /**
   * E0-07: pasa a la unión CANÓNICA de roles (`src/lib/authz/matriz-acceso.ts`).
   * Era la tercera lista de roles del repo y la única que dejaba fuera a `recepcion`
   * y `facturacion`, así que un doc de membresía con uno de esos valores no tipaba
   * aunque la matriz de acceso y `permissions.ts` sí los evalúan.
   *
   * Es una AMPLIACIÓN de tipo (6 → 8 valores), no un cambio de comportamiento:
   * ningún literal existente deja de ser válido y `cambiarRolMiembro`
   * (`src/lib/miembros.ts`) sigue admitiendo solo los 6 ASIGNABLES, que es lo que de
   * verdad limita qué se puede guardar.
   */
  role: Rol
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
  /**
   * CÉDULA PROFESIONAL DEL MÉDICO — no la del consultorio.
   *
   * `ClinicConfig.cedulaProfesional` es un valor por CLÍNICA, y los impresos la
   * usaban para todos: en un consultorio con dos médicos, la adenda y la nota de
   * la Dra. salían con la cédula del dueño. Un documento medicolegal con un
   * firmante falso impreso.
   *
   * `firestore.rules` ya declara que «FIRMAR ES UN ACTO PERSONAL — nadie firma
   * con la cédula de otro» y valida `metadata.medicoId`; faltaba el campo donde
   * guardar la de cada uno.
   *
   * Opcional a propósito: los consultorios de un solo médico siguen funcionando
   * con la de la clínica, y quien no la haya llenado no queda bloqueado — se le
   * avisa.
   */
  cedulaProfesional?: string
  /**
   * uid de Firebase de este médico, escrito al conectar su Google Calendar
   * (v875) y rellenado para los ya conectados (v899).
   *
   * Es el puente entre «quien firma» (uid de la sesión) y «de quién es la firma»
   * (id de este documento). Sin él, la receta de un consultorio con dos médicos
   * sale sin firma. Ver `resolverIdMedico` en `lib/impreso-medico.ts`.
   */
  uid?: string
  /**
   * HORARIO PROPIO — hoy nadie lo enciende, y por eso los cuatro campos de abajo
   * son opcionales.
   *
   * Se copiaba el horario del consultorio al dar de alta al médico y no existía
   * forma de volver a editarlo, así que la agenda quedaba congelada en el día
   * del alta. Manda el horario del consultorio salvo que esto sea `true`.
   * Ver `lib/horario-medico.ts`.
   */
  horarioPropio?: boolean
  horario?: ClinicConfig['horario']
  duraciones?: ClinicConfig['duraciones']
  intervaloMinutos?: number
  zonaHoraria?: string
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
  'nuevo':                    { label: 'Nuevo',                   color: '#60A5FA' },
  'seguimiento':              { label: 'Seguimiento',             color: '#94A3B8' },
  'frecuente':                { label: 'Frecuente',               color: '#22C55E' },
  'alto-riesgo':              { label: 'Alto riesgo',             color: '#EF4444' },
  'requiere-llamada':         { label: 'Requiere llamada',        color: '#F59E0B' },
  'pendiente-estudios':       { label: 'Pendiente estudios',      color: '#A855F7' },
  'pendiente-pago':           { label: 'Pendiente pago',          color: '#F97316' },
  'requiere-factura':         { label: 'Requiere factura',        color: '#06B6D4' },
  'requiere-consentimiento':  { label: 'Requiere consentimiento', color: '#EAB308' },
  'requiere-interprete':      { label: 'Requiere intérprete',     color: '#84CC16' },
  'embarazo':                 { label: 'Embarazo',                color: '#EC4899' },
  'cronico':                  { label: 'Crónico',                 color: '#8B5CF6' },
  'inactivo':                 { label: 'Inactivo',                color: '#64748B' },
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

export interface AlergiaEstructurada {
  alergeno: string
  tipo?: 'medicamento' | 'alimento' | 'ambiental' | 'otro'
  severidad?: 'leve' | 'moderada' | 'grave'
  reaccion?: string
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
  /** Alergias en texto libre (compatibilidad; sigue siendo la entrada rápida). */
  alergias?: string
  /** Alergias ESTRUCTURADAS (opcional) — cruce de seguridad más fiable + FHIR rico. */
  alergiasEstructuradas?: AlergiaEstructurada[]
  /**
   * CONSENTIMIENTO PARA GRABAR LA CONSULTA — se pide UNA VEZ por paciente.
   *
   * Lo eligió el médico dueño: «una vez por paciente, y ya». Antes vivía en un
   * `useState` que moría con la pantalla, así que el modal salía en **cada**
   * consulta del mismo paciente: un paso repetido cien veces al mes, y encima
   * sin nada que exhibir ante una queja salvo el registro de auditoría.
   *
   * Aquí queda EN EL EXPEDIENTE, que es donde un consentimiento tiene sentido:
   * quién lo otorgó, cuándo, y qué médico lo recabó.
   *
   * Ausente = nunca se pidió. No se asume otorgado por omisión jamás.
   */
  consentimientoGrabacion?: {
    /** ISO. Cuándo lo otorgó el paciente. */
    fecha: string
    /** uid del médico que lo recabó. */
    medicoId?: string
  }
  notas?: string
  tags?: PatientTag[]
  ultimaCita?: string
  proximoSeguimiento?: string
  /**
   * VERSIÓN DE LOS ENLACES DEL PORTAL — sube para revocarlos todos.
   *
   * El magic-link va firmado y con fecha, y hasta ahora no había forma de
   * invalidar uno ya emitido: un teléfono perdido, un número reciclado o un
   * mensaje reenviado valían hasta caducar. Subir este contador tumba de golpe
   * todos los enlaces emitidos para este paciente.
   *
   * Ausente = 0, que es lo que declaran los enlaces anteriores a esto: siguen
   * valiendo hasta que alguien revoque.
   */
  portalTokenVersion?: number
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
    /** 'verbal' se retiró del formulario (Art. 9 LFPDPPP exige por escrito);
     *  se mantiene en el tipo para no romper los registros ya guardados. */
    medioAceptacion: 'presencial' | 'portal' | 'whatsapp' | 'verbal'
    /**
     * Huella SHA-256 del TEXTO que el paciente aceptó.
     *
     * `versionAviso` es una constante del código, pero el texto se genera en
     * vivo desde la configuración del consultorio (razón social, domicilio,
     * responsable). Si el médico cambia cualquiera de esos datos, el aviso que
     * el paciente aceptó deja de ser reproducible y la versión NO cambia: queda
     * un consentimiento que no se puede demostrar. La huella lo fija.
     *
     * Opcional: los consentimientos anteriores a este campo no la tienen.
     */
    hashTexto?: string
  }
  // === Valoración infectológica del inmunocomprometido (módulo portado de StewardMX) ===
  /** Campos del formulario hc_* (chips, estudios, resultados, textos). */
  txValoracion?: Record<string, string>
  txValoracionAt?: string
  /** Historial de valoraciones fechadas. */
  txValoracionHist?: { fecha: string; modo: string; huesped: string; texto: string }[]
  createdAt: string
  updatedAt: string
  creadoPor: string
}

/**
 * E0-06 — PHI CLÍNICO del paciente, FUERA del documento administrativo.
 *
 * Vive en `clinics/{clinicId}/patients/{patientId}/clinico/resumen` (documento
 * único, id fijo `resumen`) porque Firestore no autoriza por campo: mientras estos
 * datos sean campos de `patients/{id}` —que es `isMember` para que recepción pueda
 * agendar— cualquier rol de la clínica los lee y ninguna regla lo evita.
 *
 * Documento único y no colección de N docs: se lee y se escribe siempre completo,
 * así el coste es UNA lectura por pantalla de paciente.
 */
export interface ResumenClinicoPaciente {
  /** Alergias en texto libre (entrada rápida). */
  alergias?: string
  /** Alergias ESTRUCTURADAS — cruce de seguridad más fiable + FHIR rico. */
  alergiasEstructuradas?: AlergiaEstructurada[]
  /** Antes `Patient.notas`: texto libre que en la práctica son antecedentes. */
  notasClinicas?: string
  txValoracion?: Record<string, string>
  txValoracionAt?: string
  txValoracionHist?: { fecha: string; modo: string; huesped: string; texto: string }[]
  actualizadoEn: string
  /** uid de quien lo escribió. */
  actualizadoPor: string
  /** Sello del backfill. Su presencia prueba que el paciente ya migró. */
  migradoEn?: string
}

/**
 * Campos clínicos que TODAVÍA viven en `Patient` y que deben mudarse a
 * `ResumenClinicoPaciente`. Fuente única para el splitter de escritura, para el
 * script de migración y para los tests.
 *
 * Mientras esta lista no esté vacía en producción, la aceptación de E0-06
 * («recepción no lee alergias») NO se cumple: son exactamente los campos que hoy
 * se sirven bajo `allow read: if isMember`.
 */
export const CAMPOS_CLINICOS_PACIENTE = [
  'alergias',
  'alergiasEstructuradas',
  'notas',
  'txValoracion',
  'txValoracionAt',
  'txValoracionHist',
] as const

export type CampoClinicoPaciente = (typeof CAMPOS_CLINICOS_PACIENTE)[number]

/**
 * Comprobación EN COMPILACIÓN de que la lista de arriba solo nombra campos que de
 * verdad existen en `Patient`. Si alguien renombra `txValoracionHist`, `tsc` falla
 * aquí en vez de dejar un splitter que copia un campo inexistente y pierde el dato.
 */
const _CAMPOS_CLINICOS_SON_DE_PATIENT: readonly (keyof Patient)[] = CAMPOS_CLINICOS_PACIENTE
void _CAMPOS_CLINICOS_SON_DE_PATIENT

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
  /**
   * DECORATIVO HOY — no lo escribe ninguna interfaz ni lo mira el motor de
   * agenda, y desde v847 la API tampoco lo acepta. Se conserva en el tipo para
   * los documentos que ya lo llevaran; cuando exista la interfaz de sucursales,
   * `getAvailableSlots` y el chequeo de solapes tienen que particionar por sede
   * ANTES de volver a aceptarlo.
   */
  branchId?: string
  googleCalendarEventId?: string
  googleCalendarSyncStatus?: 'pending' | 'synced' | 'error'
  cobroId?: string             // cobro ya registrado para esta cita (evita doble cobro)
  cobradoEn?: string
  // Exención de cobro (cortesía): el médico/asistente decide NO cobrar esta cita.
  // Es una decisión DELIBERADA y AUDITADA (quién, cuándo, por qué), no un olvido:
  // oculta el botón "Cobrar" y saca la cita de cuentas por cobrar, sin registrar un
  // cobro de $0 que ensucie el corte de caja. Reversible (con auditoría).
  cobroExento?: boolean
  exentoMotivo?: string
  exentoPor?: string           // uid de quien marcó la cortesía
  exentoPorNombre?: string
  exentoEn?: string
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

/*
 * AQUÍ VIVÍAN `NotificationLog` Y `AuditLog`, Y DESCRIBÍAN OTRA APLICACIÓN.
 *
 * `AuditLog` prometía `entityType`, `entityId`, `oldValue` y `newValue`: una
 * bitácora con el ANTES y el DESPUÉS de cada cambio. La bitácora real
 * (`lib/expediente/audit-log.ts`) no guarda nada de eso, y `createAuditLog`
 * —el único que usaba este tipo— se borró hace tiempo de `lib/firestore.ts`.
 *
 * Un tipo que nadie construye no es documentación inofensiva: es un plano de un
 * sitio que no existe. Quien lo lea creerá que el expediente registra el valor
 * anterior de lo que se cambió, y ante una revisión eso importa.
 *
 * `NotificationLog` igual: la entrega de mensajes se registra en el libro de
 * `whatsapp/no-entregados` y en el outbox, con otra forma.
 */

export interface DaySchedule {
  activo: boolean
  inicio: string  // 'HH:mm'
  fin: string     // 'HH:mm'
  /**
   * HORARIO PARTIDO — los huecos que el consultorio NO atiende dentro del día.
   *
   * ── POR QUÉ HACÍA FALTA ────────────────────────────────────────────────────
   *
   * El día era un solo tramo `inicio`–`fin`. Un médico que atiende de 9 a 14 y
   * de 16 a 20 —que en México es lo normal, no la excepción— no podía
   * expresarlo. Tenía dos salidas y las dos malas:
   *
   *  · declarar 9–20 y dejar que el portal ofreciera su hora de comida a los
   *    pacientes, o
   *  · crear a mano un bloqueo de 14:00 a 16:00 **para cada día del año**.
   *
   * Es una lista y no un solo `descanso` porque una vez que existe el concepto,
   * dos pausas (comida y una sesión de quirófano fija) cuestan lo mismo que una.
   *
   * OPCIONAL: sin descansos el día se comporta exactamente como antes.
   */
  descansos?: { inicio: string; fin: string }[]
}

export interface ClinicConfig {
  id?: string
  nombreMedico: string
  nombreClinica: string
  cedulaProfesional?: string   // NOM-004 — requerido para firmar notas
  especialidad?: string        // NOM-004 — aparece en la firma y el PDF
  instruccionesIA?: string     // preferencias del médico para la redacción de notas por IA
  pedirCobroAlCerrar?: boolean  // ¿el MÉDICO registra el cobro al firmar? default FALSE → la secretaria cobra desde Citas y cae en Finanzas del médico; enciéndelo solo si el médico cobra al cerrar
  direccion: string
  googleMapsUrl: string
  telefonoAdmin: string
  whatsappConsultorio: string
  // === Identidad fiscal y de privacidad (LFPDPPP / aviso + contrato de encargo) ===
  /** Razón social o nombre completo del responsable del tratamiento. */
  razonSocial?: string
  /** RFC del responsable (persona física o moral). */
  rfc?: string
  /** Domicilio fiscal, si difiere del domicilio del consultorio. */
  domicilioFiscal?: string
  /** Persona designada como responsable de privacidad / datos personales. */
  responsablePrivacidad?: string
  /** Correo de contacto para derechos ARCO y avisos de privacidad. */
  correoArco?: string
  zonaHoraria: string
  /**
   * Minutos de margen antes de marcar una dosis atrasada en el MAR.
   *
   * OPERATIVO, no clínico: depende de los turnos y de la ronda de enfermería.
   * Vacío = el de fábrica (`GRACIA_MAR_DEFECTO`). Ver `lib/uci/gracia.ts`.
   */
  graciaMarMin?: number
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
  /** Opt-in: pedir reseña por WhatsApp automáticamente tras la visita (cron) */
  resenaAutomatica?: boolean
  /** Anticipo/pago en línea: link de pago propio del médico (Stripe Payment Link / MercadoPago) */
  anticipoLink?: string
  /** Monto del anticipo (MXN) — solo informativo en el botón */
  anticipoMonto?: number
  horaResumenDiario: string
  diasFestivos: string[]
  /*
   * `whatsappProveedor` se quitó: era un segundo sitio donde declarar el
   * proveedor, y el que de verdad se lee es `ClinicWhatsApp.provider`. Dos
   * campos para lo mismo es una invitación a que uno diga «meta» y el otro
   * «360dialog» sin que nadie sepa cuál manda.
   */
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
  /** Firma/sello POR MÉDICO (key = medicoId). Cada médico tiene su propia firma;
   *  si no, cae a `firmaImagenDataUrl`. */
  firmaPorMedico?: Record<string, string>
  /**
   * Hoja membretada del médico para NOTAS (y órdenes/referencias): imagen de hoja
   * carta con su encabezado/logo (y pie), sobre la que se imprime la nota. Si está
   * presente, sustituye el encabezado de texto autogenerado. Se sube en
   * Configuración (acepta PDF o imagen; se guarda en Storage / data URL).
   */
  notaMembreteDataUrl?: string
  /** Zona de contenido de la nota sobre la hoja membretada (mm): márgenes para no
   *  encimar el encabezado ni el pie. Default: top 42, bottom 28, left 22, right 22. */
  notaMembreteMargenes?: { top: number; right: number; bottom: number; left: number }
  /** Posición de la FIRMA sobre la hoja membretada de notas (% de la hoja; centro
   *  de la firma). Se calibra arrastrando en Configuración → Cuenta. Si no está,
   *  la firma cae a una posición razonable sobre el pie derecho. */
  notaMembreteFirmaPos?: { x: number; y: number }
  /** Hoja membretada de notas POR MÉDICO (key = medicoId). Cada médico tiene su
   *  propio papel; si no, cae a la general (notaMembreteDataUrl). */
  notaMembretePorMedico?: Record<string, { url: string; margenes?: { top: number; right: number; bottom: number; left: number }; firmaPos?: { x: number; y: number } }>

  // === Perfil público /dr (captación / SEO — convierte como Doctoralia) ===
  /** Foto del médico para el perfil público (URL de Storage). */
  fotoMedicoUrl?: string
  /** Biografía / presentación pública del médico. */
  bioPublica?: string
  /** Lista de precios por servicio, visible en el perfil público. */
  preciosPublicos?: { servicio: string; precio: number }[]

  // Receta y órdenes médicas
  recetaConfig?: RecetaConfig
  /**
   * Overrides de receta POR MÉDICO (key = medicoId).
   * Cada médico ya tiene su propio papel impreso — aquí guarda su diseño,
   * márgenes y tamaño. Lo que no esté definido cae al recetaConfig general.
   */
  recetasPorMedico?: Record<string, Partial<RecetaConfig>>
  updatedAt?: string
}

/** Re-exports desde lib/receta-template para que ClinicConfig consumidores no necesiten otro import */
export type { PaperSize, EstiloReceta } from '@/lib/receta-template'

/** Configuración de impresos: recetas y órdenes médicas */
export interface RecetaConfig {
  /** Tamaño de papel */
  /** Tamaño de papel de RECETAS y ÓRDENES MÉDICAS. */
  paperSize: 'media-carta' | 'carta' | 'oficio' | 'a4' | 'a5' | 'receta-13x23' | 'receta-23x13' | 'receta-25x15' | 'personalizado'
  /** Medidas propias en mm — solo cuando paperSize === 'personalizado'. */
  paperCustomWidthMm?: number
  paperCustomHeightMm?: number
  /**
   * Tamaño de papel de las NOTAS clínicas (evolución, ingreso, egreso).
   * Ajuste INDEPENDIENTE del de la receta: cambiar uno no mueve el otro.
   * Default 'carta' (si está sin definir, se usa carta).
   */
  notaPaperSize?: 'carta' | 'oficio' | 'a4' | 'media-carta' | 'a5'
  /**
   * Dónde se imprime físicamente:
   *  - 'papel-real': la impresora tiene cargado el papel del tamaño exacto
   *    de la receta (default — comportamiento histórico)
   *  - 'carta': la impresora tiene papel CARTA; la receta se posiciona
   *    arriba-centro de la hoja con una línea punteada de corte ✂.
   *    Resuelve el problema clásico de "no se imprime en formato receta"
   *    cuando el navegador escala/centra tamaños custom impredeciblemente.
   */
  imprimirEn?: 'papel-real' | 'carta'
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
  /** Dimensiones REALES del membrete subido (mm). La hoja usa EXACTAMENTE este
   *  tamaño para que la imagen la llene sin bordes blancos → los datos calibrados
   *  caen justo en su lugar (no "flotando" arriba). */
  disenoWidthMm?: number
  disenoHeightMm?: number
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
  /**
   * Calibrador: posición EXACTA (en % de la hoja) de cada dato del paciente sobre
   * el diseño custom. El médico arrastra cada campo a su lugar UNA vez. Si está
   * definido, esos campos se colocan ahí (no en el bloque de márgenes).
   */
  /**
   * Calibrador: coordenadas (mm) de cada dato sobre el diseño del médico.
   * `nacimiento` = fecha de nacimiento; la piden las farmacias para dispensar,
   * y como el encabezado propio del médico la coloca donde él quiera, tiene que
   * ser un campo ARRASTRABLE igual que el nombre, no una línea fija.
   */
  disenoCampos?: Partial<Record<'nombre' | 'edad' | 'nacimiento' | 'sexo' | 'fecha' | 'folio' | 'firma' | 'qr', { x: number; y: number }>>
  /** Tamaño (mm) de la firma/sello y del QR sobre el diseño. Default firma 20, QR 14. */
  disenoTamanos?: { firma?: number; qr?: number }
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

/*
 * Y AQUÍ `DashboardStats`, QUE NINGUNA PANTALLA CALCULABA.
 *
 * Diez cifras declaradas —citas de mañana, de la semana, pendientes de
 * confirmar, nuevos de hoy…— y ni un solo consumidor. El tablero calcula lo
 * suyo con sus propias consultas. Prometía un resumen que no existe.
 */

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

export const APPOINTMENT_TYPE_CONFIG: Record<AppointmentType, { label: string; Icon: LucideIcon; defaultMinutes: number }> = {
  'primera-vez':   { label: 'Primera vez',          Icon: UserPlus,       defaultMinutes: 60 },
  'seguimiento':   { label: 'Seguimiento',          Icon: RefreshCw,      defaultMinutes: 30 },
  'urgente':       { label: 'Urgente',              Icon: Siren,          defaultMinutes: 30 },
  'estudios':      { label: 'Revisión de estudios', Icon: Microscope,     defaultMinutes: 30 },
  'teleconsulta':  { label: 'Teleconsulta',         Icon: Video,          defaultMinutes: 30 },
  'prequirurgica': { label: 'Val. prequirúrgica',   Icon: ClipboardCheck, defaultMinutes: 60 },
  'procedimiento': { label: 'Procedimiento',        Icon: Stethoscope,    defaultMinutes: 45 },
  'otro':          { label: 'Otro',                 Icon: ClipboardList,  defaultMinutes: 30 },
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
  googleCalendarId: '',
  publicBookingEnabled: true,
  publicBookingNote: '',
  recetaConfig: {
    paperSize: 'media-carta',
    estilo: 'minimalista',
    colorAccento: '#14B8A6',
    mostrarQR: true,
    copiasEnHoja: 1,
    vigenciaDias: 30,
    mostrarAlergias: true,
    mostrarDiagnostico: true,
    mostrarSignosVitales: false,
    avisoLegal: 'Esta receta es personal e intransferible. Conserve este documento como respaldo médico.',
  },
}
