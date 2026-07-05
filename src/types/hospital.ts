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

  // ── Metadatos ──
  createdAt: string
  updatedAt: string
  creadoPor: string
}

/** Días de estancia (desde el ingreso hasta hoy o hasta el egreso). */
export function diasEstancia(i: Pick<Internamiento, 'fechaIngreso' | 'fechaEgreso'>, nowMs = Date.now()): number {
  const ini = new Date(i.fechaIngreso).getTime()
  const fin = i.fechaEgreso ? new Date(i.fechaEgreso).getTime() : nowMs
  if (isNaN(ini) || isNaN(fin)) return 0
  return Math.max(0, Math.floor((fin - ini) / 86400000))
}
