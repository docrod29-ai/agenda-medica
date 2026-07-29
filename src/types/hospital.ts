// ══════════════════════════════════════════════════════════════
// MÓDULO DE HOSPITALIZACIÓN — Episodio de internamiento.
// El "episodio" es el hueso que une TODO lo de una hospitalización:
// ingreso → evoluciones → egreso, órdenes, signos, interconsultas.
// Cumple NOM-004-SSA3-2012 (documentos del expediente hospitalario).
// Vive en clinics/{clinicId}/internamientos/{id}; las notas hospitalarias
// siguen en el expediente del paciente pero llevan `internamientoId`.
// ══════════════════════════════════════════════════════════════

export type EstadoInternamiento = 'activo' | 'egresado'

export type TipoEgreso =
  | 'mejoria'          // por mejoría
  | 'maximo_beneficio' // por máximo beneficio
  | 'voluntaria'       // alta voluntaria
  | 'traslado'         // traslado a otra unidad
  | 'defuncion'        // defunción
  | 'otro'

export const TIPO_EGRESO_LABEL: Record<TipoEgreso, string> = {
  mejoria: 'Por mejoría',
  maximo_beneficio: 'Por máximo beneficio',
  voluntaria: 'Alta voluntaria',
  traslado: 'Traslado a otra unidad',
  defuncion: 'Defunción',
  otro: 'Otro',
}

/** Servicios/áreas hospitalarias comunes (editables por texto libre). */
export const SERVICIOS_HOSPITAL = [
  'Medicina Interna', 'Cirugía General', 'Urgencias', 'UCI / Terapia Intensiva',
  'Pediatría', 'Ginecología y Obstetricia', 'Traumatología y Ortopedia',
  'Cardiología', 'Nefrología', 'Neurología', 'Neumología', 'Oncología',
  'Infectología', 'Gastroenterología', 'Urología', 'Cuidados Paliativos', 'Otro',
]

export interface Internamiento {
  id: string
  clinicId: string
  pacienteId: string
  pacienteNombre: string

  // ── Datos administrativos ──
  servicio: string
  cama: string
  medicoTratanteId: string
  medicoTratanteNombre: string

  // ── Datos clínicos de ingreso ──
  diagnosticoIngreso: string
  cie10?: string
  motivoIngreso: string

  // ── Estado del episodio ──
  estado: EstadoInternamiento
  fechaIngreso: string          // ISO
  fechaEgreso?: string          // ISO

  // ── Egreso ──
  tipoEgreso?: TipoEgreso
  resumenEgreso?: string

  // ── Movimientos del episodio (traslados de cama/servicio, cambio de tratante) ──
  movimientos?: { fecha: string; tipo: 'traslado' | 'tratante'; detalle: string; por?: string }[]

  // ── Interconsultas y órdenes (arrays acotados por episodio) ──
  interconsultas?: Interconsulta[]
  indicaciones?: Indicacion[]

  // ── Conciliación de medicamentos ──
  medicamentosCasa?: string[]        // medicamentos que el paciente tomaba en casa (al ingreso)
  conciliadoAl?: string              // fecha ISO de la última conciliación

  // ── Enfermería (F6) ──
  balanceHidrico?: { fecha: string; ingresos: number; egresos: number; por?: string }[]
  escalas?: { fecha: string; tipo: 'braden' | 'morse'; score: number; riesgo: string; por?: string }[]
  sbar?: { fecha: string; texto: string; por?: string }[]

  // ── Metadatos ──
  createdAt: string
  updatedAt: string
  creadoPor: string
}

// ══════════════════════════════════════════════════════════════
// F2 — Interconsultas
// ══════════════════════════════════════════════════════════════
// Catálogo compartido con el alta de equipo (fuente única en @/lib/especialidades).
export { ESPECIALIDADES_INTERCONSULTA as ESPECIALIDADES_IC } from '@/lib/especialidades'

export interface Interconsulta {
  id: string
  especialidad: string
  motivo: string
  solicitanteNombre: string
  solicitanteId?: string           // uid del médico que la pide → para avisarle la respuesta por WhatsApp
  medicoSolicitadoId?: string      // id del médico destino (catálogo doctors) → resuelve su WhatsApp server-side
  medicoSolicitadoNombre?: string  // a quién se dirige (si se eligió un médico concreto)
  fecha: string
  estado: 'solicitada' | 'respondida'
  respuesta?: string
  respondidaPor?: string
  fechaRespuesta?: string
  notaId?: string            // si se respondió con una nota del expediente
}

// ══════════════════════════════════════════════════════════════
// F3 — Indicaciones médicas + MAR (registro de administración) + signos seriados
// ══════════════════════════════════════════════════════════════
export type TipoIndicacion = 'medicamento' | 'liquidos' | 'dieta' | 'cuidado' | 'estudio' | 'otro'

export const TIPO_INDICACION_LABEL: Record<TipoIndicacion, string> = {
  medicamento: 'Medicamento',
  liquidos: 'Líquidos / soluciones',
  dieta: 'Dieta',
  cuidado: 'Cuidados de enfermería',
  estudio: 'Estudio / laboratorio',
  otro: 'Otra indicación',
}

export interface Administracion {
  fecha: string
  por: string
  estado: 'administrado' | 'omitido'
  nota?: string
  cincoCorrectos?: boolean    // BCMA: se verificaron los "5 correctos"
  identidadVerificada?: boolean  // se escaneó/confirmó el brazalete del paciente
}

export interface Indicacion {
  id: string
  tipo: TipoIndicacion
  descripcion: string        // "Ceftriaxona 1 g IV", "Dieta blanda", "Vigilar diuresis"
  frecuencia?: string        // "cada 12 h"
  activa: boolean
  fecha: string
  creadaPor?: string
  administraciones: Administracion[]
  // Verificación farmacéutica (ciclo cerrado del medicamento)
  verificadaFarmacia?: boolean
  verificadaPor?: string
  fechaVerificacion?: string
}

/** Un registro puntual de signos vitales (para la gráfica/tendencia). */
export interface RegistroSignos {
  id: string
  fecha: string
  ta?: string
  fc?: number
  fr?: number
  temp?: number
  spo2?: number
  glucosa?: number
  dolor?: number             // EVA 0-10
  // ACVPU COMPLETO (decisión del Dr, L6): Alert / Confusion(nuevo) / Voice / Pain /
  // Unresponsive. Se conserva la letra real (no solo alerta/alterada) para no
  // destruir información en FHIR/auditoría/evolución; NEWS2 se DERIVA (A=0, resto=3).
  // 'alerta'/'alterada' se mantienen como legado (datos ya guardados).
  conciencia?: 'A' | 'C' | 'V' | 'P' | 'U' | 'alerta' | 'alterada'
  oxigeno?: boolean          // O2 suplementario (para NEWS2)
  oxigenoFlujoLpm?: number   // flujo de O2 (L/min) si se conoce → FHIR LOINC 3151-8
  oxigenoFiO2?: number       // FiO2 (%) si se conoce → FHIR LOINC 3150-0
  por?: string
  // ── E0-09 · corrección APPEND-ONLY de un signo mal capturado ──
  // Ambos OPCIONALES a propósito: los documentos ya guardados siguen siendo
  // válidos sin migración. Un signo NO se sobrescribe ni se borra: se anexa
  // otro registro que apunta al erróneo con `corrigeA`.
  /** id del registro de signos que ESTE registro corrige. */
  corrigeA?: string
  /** Por qué se corrigió. Su obligatoriedad es política del expediente → E0-09/Q4. */
  motivoCorreccion?: string
}

// ══════════════════════════════════════════════════════════════
// E0-09 — Libro clínico-legal APPEND-ONLY del episodio
// ══════════════════════════════════════════════════════════════
/**
 * Los arrays del doc de internamiento (`indicaciones[].administraciones[]`,
 * `balanceHidrico`, `escalas`, `sbar`, `movimientos`) son CACHÉ DE DISPLAY y
 * están topados por el límite de 1 MB por documento. El libro clínico-legal
 * completo vive en la subcolección append-only `registros`, que sólo escribe el
 * servidor (Admin SDK, /api/hospital/mutar) — ver `registro-durable.ts`.
 *
 * Un hecho ya ocurrido no se edita ni se borra: se ANEXA una corrección que lo
 * referencia. El evento erróneo permanece visible (NOM-004).
 */
export type TipoEventoClinico =
  | 'administracion'          // MAR: una dosis administrada u omitida
  | 'indicacion_alta'         // se prescribió una indicación
  | 'indicacion_suspension'   // se suspendió / reactivó una indicación
  | 'verificacion_farmacia'   // ciclo cerrado del medicamento
  | 'balance'                 // (ya en producción desde 2026-07, forma PLANA)
  | 'escala'                  // (ya en producción desde 2026-07, forma PLANA)
  | 'sbar'                    // (ya en producción desde 2026-07, forma PLANA)
  | 'correccion'              // corrige un evento anterior; nunca lo reemplaza

/** Qué afirma una corrección sobre el evento que corrige. */
export type EfectoCorreccion =
  | 'anula'      // el hecho NO ocurrió (p. ej. la dosis no se administró)
  | 'sustituye'  // el hecho ocurrió, pero con otros datos
  | 'aclara'     // el hecho ocurrió tal cual; se añade información

/** Valores admitidos dentro de `detalle` (serializables a Firestore sin sorpresas). */
export type ValorDetalle = string | number | boolean | null

/** Un hecho ya ocurrido en el episodio. Inmutable: sólo se le anexan correcciones. */
export interface EventoClinico {
  tipo: TipoEventoClinico
  /** ISO — reloj del SERVIDOR, nunca el del cliente. */
  fecha: string
  /** Autor REAL sellado por el servidor (no el `por` que manda el cliente). */
  por: string
  porUid?: string
  /** A qué indicación pertenece el hecho (MAR / órdenes). */
  indicacionId?: string
  /** Contenido propio del tipo de evento, saneado por lista blanca. */
  detalle?: Record<string, ValorDetalle>

  // ── Sólo cuando tipo === 'correccion' ──
  /** id del documento de `registros` que esta corrección corrige. */
  corrigeEventoId?: string
  motivo?: string
  efecto?: EfectoCorreccion

  // ── Campos PLANOS de los tres eventos que YA existen en producción ──
  // `balance`/`escala`/`sbar` se escriben con esta forma desde 2026-07. NO se
  // migran a `detalle`: hay documentos ya escritos en un libro append-only, y
  // reescribirlos para uniformar la forma sería exactamente lo que este módulo
  // existe para impedir. Se declaran `unknown` porque hoy pasan sin validar
  // desde el payload del cliente; ése es el estado real, no un ideal.
  ingresos?: unknown
  egresos?: unknown
  escala?: unknown
  score?: unknown
  riesgo?: unknown
  texto?: unknown
}

/** Un evento tal como se lee de `registros` (el id lo pone Firestore). */
export type EventoClinicoConId = EventoClinico & { id: string }

// ══════════════════════════════════════════════════════════════
// F4 — Roles (vista, no seguridad de servidor)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// F4 — Módulo de laboratorio (solicitud → resultado → valor crítico)
// ══════════════════════════════════════════════════════════════
export interface ResultadoLab {
  estudio: string
  valor: string
  unidad?: string
  referencia?: string
  critico?: boolean
}
export interface SolicitudLab {
  id: string
  clinicId: string
  internamientoId: string
  pacienteId: string
  pacienteNombre: string
  estudios: string[]
  prioridad: 'rutina' | 'urgente'
  solicitadaPor: string
  fecha: string
  estado: 'solicitada' | 'en_proceso' | 'resultado'
  resultados?: ResultadoLab[]
  procesadaPor?: string
  fechaResultado?: string
  /**
   * Cargas ANTERIORES de resultados, en orden. Nunca se borra: cada nueva carga
   * empuja aquí lo que había antes de sobrescribir `resultados`. Antes una
   * segunda carga reemplazaba la primera sin rastro — pérdida de dato clínico y
   * de trazabilidad (NOM-004). Vacío o ausente = solo hubo una carga.
   */
  historialResultados?: CargaResultadoLab[]
  createdAt: string
  updatedAt: string
}
export interface CargaResultadoLab {
  resultados: ResultadoLab[]
  procesadaPor: string
  fechaResultado: string
}
export const ESTUDIOS_LAB_RAPIDOS = [
  'Biometría hemática', 'Química sanguínea', 'Electrolitos séricos', 'Pruebas de función hepática',
  'Tiempos de coagulación', 'Gasometría arterial', 'Examen general de orina', 'PCR', 'Procalcitonina',
  'Troponina', 'Dímero D', 'Hemocultivo', 'Urocultivo', 'Lactato', 'Perfil tiroideo',
]

// ══════════════════════════════════════════════════════════════
// Catálogo de camas (inventario + ocupación)
// ══════════════════════════════════════════════════════════════
export type EstadoCama = 'libre' | 'ocupada' | 'bloqueada' | 'limpieza'
export const ESTADO_CAMA_LABEL: Record<EstadoCama, string> = {
  libre: 'Libre', ocupada: 'Ocupada', bloqueada: 'Bloqueada', limpieza: 'Limpieza',
}
export interface Cama {
  id: string
  clinicId: string
  servicio: string
  etiqueta: string          // "302-A"
  tipo?: string             // general / UCI / aislamiento
  estado: EstadoCama
  createdAt: string
}

export type RolHospital = 'medico' | 'enfermeria' | 'farmacia' | 'laboratorio' | 'admin'
export const ROL_HOSPITAL_LABEL: Record<RolHospital, string> = {
  medico: 'Médico',
  enfermeria: 'Enfermería',
  farmacia: 'Farmacia',
  laboratorio: 'Laboratorio',
  admin: 'Administración',
}

/** Días de estancia (desde el ingreso hasta hoy o hasta el egreso). */
export function diasEstancia(i: Pick<Internamiento, 'fechaIngreso' | 'fechaEgreso'>, nowMs = Date.now()): number {
  const ini = new Date(i.fechaIngreso).getTime()
  const fin = i.fechaEgreso ? new Date(i.fechaEgreso).getTime() : nowMs
  if (isNaN(ini) || isNaN(fin)) return 0
  return Math.max(0, Math.floor((fin - ini) / 86400000))
}
