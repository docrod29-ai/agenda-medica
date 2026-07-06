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
  conciencia?: 'alerta' | 'alterada'   // ACVPU (para NEWS2)
  oxigeno?: boolean          // O2 suplementario (para NEWS2)
  por?: string
}

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
  createdAt: string
  updatedAt: string
}
export const ESTUDIOS_LAB_RAPIDOS = [
  'Biometría hemática', 'Química sanguínea', 'Electrolitos séricos', 'Pruebas de función hepática',
  'Tiempos de coagulación', 'Gasometría arterial', 'Examen general de orina', 'PCR', 'Procalcitonina',
  'Troponina', 'Dímero D', 'Hemocultivo', 'Urocultivo', 'Lactato', 'Perfil tiroideo',
]

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
