/**
 * Catálogo ÚNICO de especialidades médicas — fuente de verdad compartida por:
 *   · el alta de equipo (Configuración → Equipo)
 *   · las interconsultas hospitalarias
 *   · cualquier selector de especialidad
 *
 * Módulo puro (sin imports) para poder usarse tanto en cliente como en tipos.
 * Nombres en español de México, alineados a las especialidades del CONACEM.
 */

// ── Clínicas (no quirúrgicas) ──────────────────────────────────
export const ESPECIALIDADES_CLINICAS: string[] = [
  'Medicina General',
  'Medicina Interna',
  'Medicina Familiar',
  'Medicina de Urgencias',
  'Medicina Crítica / Terapia Intensiva',
  'Pediatría',
  'Neonatología',
  'Cardiología',
  'Cardiología Intervencionista',
  'Neumología',
  'Gastroenterología',
  'Hepatología',
  'Endocrinología',
  'Nefrología',
  'Reumatología',
  'Hematología',
  'Infectología',
  'Oncología Médica',
  'Geriatría',
  'Neurología',
  'Dermatología',
  'Alergología e Inmunología Clínica',
  'Genética Médica',
  'Psiquiatría',
  'Paidopsiquiatría',
  'Medicina de Rehabilitación (Fisiatría)',
  'Medicina del Dolor y Cuidados Paliativos',
  'Medicina del Deporte',
  'Medicina del Trabajo',
  'Nutriología Clínica',
]

// ── Quirúrgicas ────────────────────────────────────────────────
export const ESPECIALIDADES_QUIRURGICAS: string[] = [
  'Cirugía General',
  'Cirugía Cardiotorácica',
  'Cirugía de Tórax',
  'Angiología y Cirugía Vascular',
  'Cirugía Plástica y Reconstructiva',
  'Cirugía Pediátrica',
  'Cirugía Oncológica',
  'Cirugía Bariátrica',
  'Coloproctología',
  'Cirugía Hepatobiliar',
  'Trasplantes',
  'Neurocirugía',
  'Ortopedia y Traumatología',
  'Urología',
  'Otorrinolaringología',
  'Oftalmología',
  'Ginecología y Obstetricia',
  'Cirugía Maxilofacial',
  'Anestesiología',
]

// ── Diagnóstico y apoyo ────────────────────────────────────────
export const ESPECIALIDADES_DIAGNOSTICAS: string[] = [
  'Radiología e Imagen',
  'Radiología Intervencionista',
  'Anatomía Patológica',
  'Medicina Nuclear',
  'Medicina de Laboratorio (Patología Clínica)',
  'Medicina Transfusional',
]

// ── Otros profesionales de la salud (acceden al expediente) ────
export const OTROS_PROFESIONALES: string[] = [
  'Psicología',
  'Nutrición',
  'Odontología',
  'Fisioterapia / Rehabilitación',
  'Optometría',
  'Terapia de Lenguaje',
  'Terapia Ocupacional',
  'Trabajo Social',
  'Podología',
  'Quiropráctica',
  'Enfermería (con expediente)',
]

/** Todas las especialidades médicas (clínicas + quirúrgicas + diagnósticas). */
export const ESPECIALIDADES_MEDICAS: string[] = [
  ...ESPECIALIDADES_CLINICAS,
  ...ESPECIALIDADES_QUIRURGICAS,
  ...ESPECIALIDADES_DIAGNOSTICAS,
]

/** Grupos para <select> con <optgroup> en el alta de equipo. */
export const GRUPOS_ESPECIALIDAD: { grupo: string; opciones: string[] }[] = [
  { grupo: 'Especialidades clínicas', opciones: ESPECIALIDADES_CLINICAS },
  { grupo: 'Especialidades quirúrgicas', opciones: ESPECIALIDADES_QUIRURGICAS },
  { grupo: 'Diagnóstico y apoyo', opciones: ESPECIALIDADES_DIAGNOSTICAS },
]

/** Lista para interconsultas: todas las médicas + "Otra" al final. */
export const ESPECIALIDADES_INTERCONSULTA: string[] = [...ESPECIALIDADES_MEDICAS, 'Otra']
