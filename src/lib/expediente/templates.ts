import type { TipoNota, NotaSeccion } from '@/types/expediente'

/**
 * TEMPLATES de secciones por tipo de nota.
 * Define qué campos narrativos lleva cada nota (NOM-004).
 * (*) = obligatorio según NOM-004 → bloquea la firma si está vacío.
 */
export const SECCIONES_POR_TIPO: Record<TipoNota, Omit<NotaSeccion, 'value'>[]> = {
  historia_clinica: [
    { key: 'motivoConsulta',        label: 'Motivo de consulta',              obligatorio: true,  placeholder: 'En palabras del paciente' },
    { key: 'padecimientoActual',    label: 'Padecimiento actual',             obligatorio: true,  placeholder: 'Narración cronológica (OLDCARTS)' },
    { key: 'antecedentesHeredo',    label: 'Antecedentes heredo-familiares',  placeholder: 'DM, HAS, Ca, cardiopatía…' },
    { key: 'antecedentesNoPat',     label: 'Antecedentes personales no patológicos', placeholder: 'Tabaquismo, alcoholismo, vivienda…' },
    { key: 'antecedentesPat',       label: 'Antecedentes personales patológicos', placeholder: 'Enfermedades crónicas, cirugías, hospitalizaciones' },
    { key: 'interrogatorioSistemas',label: 'Interrogatorio por aparatos y sistemas' },
    { key: 'exploracionFisica',     label: 'Exploración física',              obligatorio: true,  placeholder: 'Hallazgos por región' },
    { key: 'estudiosPrevios',       label: 'Estudios previos',                placeholder: 'Laboratorio, imagen' },
  ],
  primera_vez: [
    { key: 'motivoConsulta',        label: 'Motivo de consulta',   obligatorio: true },
    { key: 'padecimientoActual',    label: 'Padecimiento actual',  obligatorio: true },
    { key: 'antecedentesRelevantes',label: 'Antecedentes relevantes' },
    { key: 'exploracionFisica',     label: 'Exploración física',   obligatorio: true },
  ],
  seguimiento: [
    { key: 'subjetivo',  label: 'Subjetivo (S)',  obligatorio: true,  placeholder: 'Evolución referida, cumplimiento del tratamiento, nuevos síntomas' },
    { key: 'objetivo',   label: 'Objetivo (O)',   obligatorio: true,  placeholder: 'Exploración física de hoy, resultados de estudios' },
    { key: 'evaluacion', label: 'Evaluación (A)', obligatorio: true,  placeholder: 'Evolución de diagnósticos, razonamiento clínico' },
    { key: 'plan',       label: 'Plan (P)',       obligatorio: true,  placeholder: 'Cambios de medicamentos, estudios, próxima cita, signos de alarma' },
  ],
  alta_consulta: [
    { key: 'resumenEvolucion', label: 'Resumen de la evolución', obligatorio: true },
    { key: 'indicacionesAlta', label: 'Indicaciones al alta',    obligatorio: true },
    { key: 'restricciones',    label: 'Restricciones',           placeholder: 'Actividad, dieta' },
  ],
  ingreso: [
    { key: 'impresionInicial',   label: 'Impresión inicial (1 línea)', obligatorio: true },
    { key: 'motivoIngreso',      label: 'Motivo de ingreso',           obligatorio: true },
    { key: 'padecimientoActual', label: 'Padecimiento actual',         obligatorio: true },
    { key: 'antecedentes',       label: 'Antecedentes relevantes' },
    { key: 'exploracionFisica',  label: 'Exploración física al ingreso', obligatorio: true },
    { key: 'estudiosIngreso',    label: 'Estudios al ingreso',         placeholder: 'BH, QS, electrolitos, cultivos, imagen' },
    { key: 'planIngreso',        label: 'Plan de ingreso',             obligatorio: true },
    { key: 'pronostico',         label: 'Pronóstico',                  obligatorio: true },
  ],
  evolucion: [
    { key: 'subjetivo',  label: 'Subjetivo (S)',  obligatorio: true,  placeholder: '¿Cómo amanece? Síntomas activos' },
    { key: 'objetivo',   label: 'Objetivo (O)',   obligatorio: true,  placeholder: 'Signos vitales, balance hídrico, exploración de hoy' },
    { key: 'evaluacion', label: 'Evaluación (A)', obligatorio: true,  placeholder: 'Cómo evoluciona el caso' },
    { key: 'plan',       label: 'Plan (P)',       obligatorio: true,  placeholder: 'Cambios de tratamiento, estudios, meta 48h' },
  ],
  egreso: [
    { key: 'resumenCaso',          label: 'Resumen del caso (1 línea)',          obligatorio: true },
    { key: 'resumenEvolucion',     label: 'Resumen de la evolución hospitalaria', obligatorio: true },
    { key: 'procedimientos',       label: 'Procedimientos realizados' },
    { key: 'estudiosEgreso',       label: 'Estudios al egreso' },
    { key: 'indicacionesEgreso',   label: 'Indicaciones al egreso',              obligatorio: true },
    { key: 'signosAlarma',         label: 'Signos de alarma',                    obligatorio: true,  placeholder: 'Acudir a urgencias si…' },
    { key: 'pronostico',           label: 'Pronóstico',                          obligatorio: true },
  ],
}

/** Construye las secciones vacías para un tipo de nota */
export function seccionesVacias(tipo: TipoNota): NotaSeccion[] {
  return SECCIONES_POR_TIPO[tipo].map(s => ({ ...s, value: '' }))
}

/** ¿Esta nota usa signos vitales obligatorios? */
export function requiereSignosVitales(tipo: TipoNota): boolean {
  return ['historia_clinica', 'primera_vez', 'seguimiento', 'ingreso', 'evolucion'].includes(tipo)
}

/** ¿Es una nota hospitalaria? */
export function esHospitalaria(tipo: TipoNota): boolean {
  return ['ingreso', 'evolucion', 'egreso'].includes(tipo)
}
