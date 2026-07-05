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

  // ── Interconsultas y órdenes (arrays acotados por episodio) ──
  interconsultas?: Interconsulta[]
  indicaciones?: Indicacion[]

  // ── Metadatos ──
  createdAt: string
  updatedAt: string
  creadoPor: string
}

// ══════════════════════════════════════════════════════════════
// F2 — Interconsultas
// ══════════════════════════════════════════════════════════════
export const ESPECIALIDADES_IC = [
  'Infectología', 'Cardiología', 'Nefrología', 'Neumología', 'Neurología',
  'Gastroenterología', 'Endocrinología', 'Cirugía General', 'Medicina Interna',
  'Hematología', 'Oncología', 'Psiquiatría', 'Nutrición', 'Cuidados Paliativos',
  'Rehabilitación', 'Urología', 'Ginecología', 'Traumatología', 'Otra',
]

export interface Interconsulta {
  id: string
  especialidad: string
  motivo: string
  solicitanteNombre: string
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
  por?: string
}

// ══════════════════════════════════════════════════════════════
// F4 — Roles (vista, no seguridad de servidor)
// ══════════════════════════════════════════════════════════════
export type RolHospital = 'medico' | 'enfermeria' | 'admin'
export const ROL_HOSPITAL_LABEL: Record<RolHospital, string> = {
  medico: 'Médico',
  enfermeria: 'Enfermería',
  admin: 'Administración',
}

/** Días de estancia (desde el ingreso hasta hoy o hasta el egreso). */
export function diasEstancia(i: Pick<Internamiento, 'fechaIngreso' | 'fechaEgreso'>, nowMs = Date.now()): number {
  const ini = new Date(i.fechaIngreso).getTime()
  const fin = i.fechaEgreso ? new Date(i.fechaEgreso).getTime() : nowMs
  if (isNaN(ini) || isNaN(fin)) return 0
  return Math.max(0, Math.floor((fin - ini) / 86400000))
}
