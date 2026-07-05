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
    { key: 'planAbordajeDx',        label: 'Plan de abordaje diagnóstico',    obligatorio: true,  placeholder: 'Estudios solicitados, diagnósticos diferenciales priorizados, criterio de descarte/confirmación' },
    { key: 'planTratamiento',       label: 'Plan de tratamiento',             obligatorio: true,  placeholder: 'Fármaco · dosis · vía · intervalo · duración. Medidas no farmacológicas. Signos de alarma.' },
  ],
  primera_vez: [
    { key: 'motivoConsulta',        label: 'Motivo de consulta',   obligatorio: true },
    { key: 'padecimientoActual',    label: 'Padecimiento actual',  obligatorio: true },
    { key: 'antecedentesRelevantes',label: 'Antecedentes relevantes' },
    { key: 'exploracionFisica',     label: 'Exploración física',   obligatorio: true },
    { key: 'planAbordajeDx',        label: 'Plan de abordaje diagnóstico', obligatorio: true,  placeholder: 'Estudios solicitados + diagnósticos diferenciales priorizados' },
    { key: 'planTratamiento',       label: 'Plan de tratamiento',  obligatorio: true,  placeholder: 'Fármaco · dosis · vía · intervalo · duración' },
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
  valoracion_preoperatoria: [
    { key: 'cirugiaPropuesta',  label: 'Cirugía propuesta',          obligatorio: true,  placeholder: 'Procedimiento, fecha, urgencia' },
    { key: 'resumenClinico',    label: 'Resumen clínico y comorbilidades', obligatorio: true },
    { key: 'laboratorios',      label: 'Laboratorios relevantes',    placeholder: 'BH, QS (creatinina, glucosa), electrolitos, coagulación, etc.' },
    { key: 'conclusionRiesgo',  label: 'Conclusión de riesgo',       obligatorio: true,  placeholder: 'Se llena automáticamente con las escalas' },
    { key: 'recomendaciones',   label: 'Recomendaciones perioperatorias', obligatorio: true,  placeholder: 'Se generan automáticamente según la evidencia' },
  ],
  valoracion_inmuno: [
    { key: 'motivoHuesped',        label: 'Motivo y tipo de huésped',            obligatorio: true,  placeholder: 'Motivo de la interconsulta, tipo de huésped (SOT/TCMH/VIH…), estado de inmunosupresión, fecha TX/inicio IS, CD4' },
    { key: 'historiaInfectologica',label: 'Historia clínica dirigida',           obligatorio: true,  placeholder: 'Comorbilidades, dispositivos, hábitos, inmunosupresión actual, profilaxis activas, antecedentes infectológicos, exposiciones, vacunación, alergias' },
    { key: 'estudiosSolicitados',  label: 'Estudios a solicitar',                placeholder: 'Serologías basales, cultivos, marcadores fúngicos, IGRA, imagen… (se usa para la Orden médica)' },
    { key: 'planProfilaxis',       label: 'Profilaxis y plan antimicrobiano',    obligatorio: true,  placeholder: 'Profilaxis indicada (PJP, CMV, antifúngica, HBV, TB latente…), fármaco · vía · intervalo · duración. Ajuste renal. Validación clínica.' },
    { key: 'impresionPlan',        label: 'Impresión y plan — Infectología',     obligatorio: true,  placeholder: 'Conclusión de la valoración y seguimiento' },
  ],
  nota_postoperatoria: [
    { key: 'diagnosticoPreop',   label: 'Diagnóstico preoperatorio',   obligatorio: true },
    { key: 'diagnosticoPostop',  label: 'Diagnóstico postoperatorio',  obligatorio: true },
    { key: 'cirugiaRealizada',   label: 'Cirugía realizada',           obligatorio: true,  placeholder: 'Procedimiento efectuado, técnica' },
    { key: 'hallazgos',          label: 'Hallazgos transoperatorios',  obligatorio: true },
    { key: 'tecnica',            label: 'Descripción de la técnica',   placeholder: 'Pasos quirúrgicos relevantes' },
    { key: 'sangrado',           label: 'Sangrado y líquidos',         placeholder: 'Sangrado estimado, transfusiones, balance' },
    { key: 'complicaciones',     label: 'Incidentes / complicaciones', placeholder: 'Ninguno / describir' },
    { key: 'estadoEgreso',       label: 'Estado al salir de quirófano', obligatorio: true, placeholder: 'Condición, destino (recuperación/UCI/piso)' },
    { key: 'planPostop',         label: 'Plan postoperatorio',         obligatorio: true,  placeholder: 'Indicaciones, analgesia, vigilancia, signos de alarma' },
  ],
  nota_anestesia: [
    { key: 'valoracionPreanestesica', label: 'Valoración preanestésica (ASA)', obligatorio: true, placeholder: 'Clasificación ASA, vía aérea, ayuno, riesgo' },
    { key: 'tipoAnestesia',      label: 'Tipo de anestesia',           obligatorio: true,  placeholder: 'General balanceada / regional / sedación' },
    { key: 'medicamentos',       label: 'Fármacos y dosis',            placeholder: 'Inducción, mantenimiento, relajantes, analgésicos' },
    { key: 'monitoreo',          label: 'Monitoreo transanestésico',   placeholder: 'Signos vitales, SpO2, capnografía, eventos' },
    { key: 'liquidos',           label: 'Líquidos y hemoderivados',    placeholder: 'Cristaloides, coloides, sangrado, uresis' },
    { key: 'incidentes',         label: 'Incidentes anestésicos',      placeholder: 'Ninguno / describir' },
    { key: 'estadoEgreso',       label: 'Estado al egreso de anestesia', obligatorio: true, placeholder: 'Aldrete, destino, indicaciones' },
  ],
  consentimiento: [
    { key: 'procedimiento',      label: 'Procedimiento o tratamiento',  obligatorio: true,  placeholder: 'Nombre del procedimiento propuesto' },
    { key: 'descripcion',        label: 'En qué consiste',              obligatorio: true,  placeholder: 'Explicación en lenguaje claro para el paciente' },
    { key: 'beneficios',         label: 'Beneficios esperados',         obligatorio: true },
    { key: 'riesgos',            label: 'Riesgos y complicaciones',     obligatorio: true,  placeholder: 'Riesgos frecuentes y graves' },
    { key: 'alternativas',       label: 'Alternativas',                 obligatorio: true,  placeholder: 'Otras opciones, incluida no tratarse' },
    { key: 'declaracion',        label: 'Declaración del paciente',     obligatorio: true,  placeholder: 'El paciente comprende y acepta; nombre de testigos' },
  ],
}

/** Construye las secciones vacías para un tipo de nota */
export function seccionesVacias(tipo: TipoNota): NotaSeccion[] {
  return SECCIONES_POR_TIPO[tipo].map(s => ({ ...s, value: '' }))
}

/** ¿Esta nota usa signos vitales obligatorios? */
export function requiereSignosVitales(tipo: TipoNota): boolean {
  return ['historia_clinica', 'primera_vez', 'seguimiento', 'ingreso', 'evolucion', 'valoracion_preoperatoria', 'valoracion_inmuno', 'nota_postoperatoria', 'nota_anestesia'].includes(tipo)
}

/** ¿Es una valoración preoperatoria? */
export function esPreoperatoria(tipo: TipoNota): boolean {
  return tipo === 'valoracion_preoperatoria'
}

/** ¿Es una valoración del paciente inmunocomprometido (Infectología)? */
export function esInmuno(tipo: TipoNota): boolean {
  return tipo === 'valoracion_inmuno'
}

/** ¿Es una nota hospitalaria? */
export function esHospitalaria(tipo: TipoNota): boolean {
  return ['ingreso', 'evolucion', 'egreso', 'nota_postoperatoria', 'nota_anestesia'].includes(tipo)
}
