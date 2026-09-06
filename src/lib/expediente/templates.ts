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
    { key: 'pronostico',            label: 'Pronóstico',                      placeholder: 'Para la vida, la función y la enfermedad' },
  ],
  primera_vez: [
    { key: 'motivoConsulta',        label: 'Motivo de consulta',   obligatorio: true },
    { key: 'padecimientoActual',    label: 'Padecimiento actual',  obligatorio: true },
    { key: 'antecedentesRelevantes',label: 'Antecedentes relevantes' },
    { key: 'exploracionFisica',     label: 'Exploración física',   obligatorio: true },
    { key: 'planAbordajeDx',        label: 'Plan de abordaje diagnóstico', obligatorio: true,  placeholder: 'Estudios solicitados + diagnósticos diferenciales priorizados' },
    { key: 'planTratamiento',       label: 'Plan de tratamiento',  obligatorio: true,  placeholder: 'Fármaco · dosis · vía · intervalo · duración' },
    { key: 'pronostico',            label: 'Pronóstico',           placeholder: 'Para la vida, la función y la enfermedad' },
  ],
  seguimiento: [
    { key: 'subjetivo',  label: 'Subjetivo (S)',  obligatorio: true,  placeholder: 'Evolución referida, cumplimiento del tratamiento, nuevos síntomas' },
    { key: 'objetivo',   label: 'Objetivo (O)',   obligatorio: true,  placeholder: 'Exploración física de hoy, resultados de estudios' },
    { key: 'evaluacion', label: 'Evaluación (A)', obligatorio: true,  placeholder: 'Evolución de diagnósticos, razonamiento clínico' },
    { key: 'plan',       label: 'Plan (P)',       obligatorio: true,  placeholder: 'Cambios de medicamentos, estudios, próxima cita, signos de alarma' },
    { key: 'pronostico', label: 'Pronóstico',     placeholder: 'Para la vida, la función y la enfermedad' },
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
    { key: 'tipoIntervencion',  label: 'Tipo de intervención',       placeholder: 'Electiva / urgente · ambulatoria / con internamiento' },
    { key: 'pronostico',        label: 'Pronóstico',                 placeholder: 'Para la vida, la función y la enfermedad' },
  ],
  valoracion_inmuno: [
    { key: 'motivoHuesped',        label: 'Motivo y tipo de huésped',            obligatorio: true,  placeholder: 'Motivo de la interconsulta, tipo de huésped (SOT/TCMH/VIH…), estado de inmunosupresión, fecha TX/inicio IS, CD4' },
    { key: 'historiaInfectologica',label: 'Historia clínica dirigida',           obligatorio: true,  placeholder: 'Comorbilidades, dispositivos, hábitos, inmunosupresión actual, profilaxis activas, antecedentes infectológicos, exposiciones, vacunación, alergias' },
    { key: 'estudiosSolicitados',  label: 'Estudios a solicitar',                placeholder: 'Serologías basales, cultivos, marcadores fúngicos, IGRA, imagen… (se usa para la Orden médica)' },
    { key: 'planProfilaxis',       label: 'Profilaxis y plan antimicrobiano',    obligatorio: true,  placeholder: 'Profilaxis indicada (PJP, CMV, antifúngica, HBV, TB latente…), fármaco · vía · intervalo · duración. Ajuste renal. Validación clínica.' },
    { key: 'impresionPlan',        label: 'Impresión y plan — Infectología',     obligatorio: true,  placeholder: 'Conclusión de la valoración y seguimiento' },
  ],
  /**
   * ── LO QUE LA NOTA POSTOPERATORIA NO TENÍA DÓNDE ASENTAR (MC-009, MC-021,
   *    MC-022) ──────────────────────────────────────────────────────────────
   *
   * No había campo para la operación PLANEADA frente a la realizada («planeada:
   * apendicectomía laparoscópica / realizada: convertida a abierta»), ni para
   * la cuenta de gasas, compresas e instrumental, ni para el equipo quirúrgico,
   * ni para las piezas enviadas a patología, ni para el pronóstico. Todo eso
   * acababa —de memoria— dentro de «Descripción de la técnica». Una pieza no
   * enviada a patología o una cuenta de gasas no asentada es exactamente lo que
   * un perito busca.
   *
   * Y el cirujano privado mexicano opera en quirófano ajeno: el impreso llevaba
   * como establecimiento su consultorio y no había dónde decir dónde se operó
   * (MC-022). La fecha del procedimiento tampoco existía (MC-021), así que
   * ningún motor podía calcular el día postoperatorio.
   *
   * TODAS NACEN OPCIONALES. Que la NOM-004 exija cada una de estas secciones en
   * la nota postoperatoria es `NEEDS_CLINICAL_REVIEW` / revisión legal: el
   * auditor lo marcó así y el equipo rojo bajó el hallazgo a `parcial` por eso
   * mismo. Marcarlas obligatorias BLOQUEARÍA la firma por un requisito que
   * nadie ha verificado contra el texto de la norma; dejarlas sin existir
   * garantiza que el dato no se capture nunca. Existir y no bloquear es lo que
   * se puede sostener hoy.
   */
  nota_postoperatoria: [
    { key: 'diagnosticoPreop',   label: 'Diagnóstico preoperatorio',   obligatorio: true },
    { key: 'diagnosticoPostop',  label: 'Diagnóstico postoperatorio',  obligatorio: true },
    { key: 'operacionPlaneada',  label: 'Operación planeada',          placeholder: 'Lo que se programó, para contrastarlo con lo que se hizo' },
    { key: 'cirugiaRealizada',   label: 'Cirugía realizada',           obligatorio: true,  placeholder: 'Procedimiento efectuado, técnica' },
    { key: 'fechaProcedimiento', label: 'Fecha y hora del procedimiento', placeholder: 'Cuándo se operó (si no fue hoy)' },
    { key: 'lugarProcedimiento', label: 'Lugar del procedimiento',     placeholder: 'Hospital y quirófano donde se operó, si no fue en el consultorio' },
    { key: 'equipoQuirurgico',   label: 'Equipo quirúrgico',           placeholder: 'Cirujano, ayudantes, instrumentista, anestesiólogo, circulante' },
    { key: 'hallazgos',          label: 'Hallazgos transoperatorios',  obligatorio: true },
    { key: 'tecnica',            label: 'Descripción de la técnica',   placeholder: 'Pasos quirúrgicos relevantes' },
    { key: 'sangrado',           label: 'Sangrado y líquidos',         placeholder: 'Sangrado estimado, transfusiones, balance' },
    { key: 'cuentaMaterial',     label: 'Cuenta de gasas, compresas e instrumental', placeholder: 'Completa / incompleta, y qué se hizo si no cuadró' },
    { key: 'estudiosTransop',    label: 'Estudios transoperatorios',   placeholder: 'Congelación, cultivos, imagen en quirófano' },
    { key: 'piezasPatologia',    label: 'Piezas enviadas a patología', placeholder: 'Qué se envió, o «no se envió ninguna»' },
    { key: 'complicaciones',     label: 'Incidentes / complicaciones', placeholder: 'Ninguno / describir' },
    { key: 'estadoEgreso',       label: 'Estado al salir de quirófano', obligatorio: true, placeholder: 'Condición, destino (recuperación/UCI/piso)' },
    { key: 'planPostop',         label: 'Plan postoperatorio',         obligatorio: true,  placeholder: 'Indicaciones, analgesia, vigilancia, signos de alarma' },
    { key: 'pronostico',         label: 'Pronóstico',                  placeholder: 'Para la vida, la función y la enfermedad' },
  ],
  nota_anestesia: [
    { key: 'valoracionPreanestesica', label: 'Valoración preanestésica (ASA)', obligatorio: true, placeholder: 'Clasificación ASA, vía aérea, ayuno, riesgo' },
    { key: 'tipoAnestesia',      label: 'Tipo de anestesia',           obligatorio: true,  placeholder: 'General balanceada / regional / sedación' },
    { key: 'medicamentos',       label: 'Fármacos y dosis',            placeholder: 'Inducción, mantenimiento, relajantes, analgésicos' },
    { key: 'monitoreo',          label: 'Monitoreo transanestésico',   placeholder: 'Signos vitales, SpO2, capnografía, eventos' },
    { key: 'liquidos',           label: 'Líquidos y hemoderivados',    placeholder: 'Cristaloides, coloides, sangrado, uresis' },
    { key: 'incidentes',         label: 'Incidentes anestésicos',      placeholder: 'Ninguno / describir' },
    { key: 'lugarProcedimiento', label: 'Lugar del procedimiento',     placeholder: 'Hospital y quirófano, si no fue en el consultorio' },
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
  // Nota de evolución de UCI ORGANIZADA POR APARATOS Y SISTEMAS (cabeza a pies).
  // Cada sección es texto libre que el médico dicta; los motores deterministas
  // (ventilación, gasometría, hemodinamia, POCUS, escalas) se cablearán en
  // iteraciones posteriores y colgarán sus cálculos/alertas en un panel APARTE,
  // no dentro de estas secciones narrativas. Solo el Plan es obligatorio (NOM-004).
  // Nota de UCI por los 7 SISTEMAS del Dr (neuro · respiratorio · hemodinámico ·
  // abdominodigestivo · hidrometabólico · hematoinfeccioso · musculoesquelético),
  // con contexto y plan como marco. POCUS y soportes (CKRT/ECMO) se pliegan dentro
  // del sistema que corresponde (no como sección aparte).
  evolucion_uci: [
    { key: 'contexto',          label: 'Contexto y objetivos del día', placeholder: 'Día de UCI · día de VM · diagnósticos activos · procedimientos recientes · dispositivos invasivos · objetivos del día' },
    { key: 'neurologico',       label: 'Neurológico',                  placeholder: 'Conciencia · Glasgow/FOUR · RASS · CAM-ICU · pupilas · focalización · sedación/analgesia · bloqueo neuromuscular · crisis · PIC/PPC · temperatura' },
    { key: 'respiratorio',      label: 'Respiratorio',                 placeholder: 'Vía aérea · modo · FiO₂ · VT (y VT/PBW) · FR · PEEP · Ppico/Pplateau · driving pressure · compliance · auto-PEEP · secreciones · prono · destete · USG pulmonar (líneas B/LUS) · gasometría' },
    { key: 'hemodinamico',      label: 'Hemodinámico y cardiovascular', placeholder: 'FC · ritmo · TA · PAM · vasopresores/inotrópicos (dosis y unidad) · lactato · llenado capilar · diuresis · gasto cardiaco · POCUS cardiaco (VTI, VD, TAPSE) · PLR · VExUS/congestión · ECMO' },
    { key: 'abdominodigestivo', label: 'Abdominodigestivo',            placeholder: 'Abdomen · peristalsis · tolerancia enteral · residuo gástrico · evacuaciones · nutrición enteral/parenteral · metas calóricas/proteicas · función hepática · presión intraabdominal · drenajes/ostomías · riesgo de sangrado' },
    { key: 'hidrometabolico',   label: 'Hidrometabólico',              placeholder: 'Balance 24 h y acumulado · peso · diuresis horaria · Na/K/Cl/Mg/Ca/P · glucosa · ácido-base · creatinina/urea · KDIGO · TRR/CKRT (modalidad, dosis, UF, citrato) · osmolaridad · ajustes de fármacos' },
    { key: 'hematoinfeccioso',  label: 'Hematoinfeccioso',             placeholder: 'Hb · plaquetas · leucocitos · coagulación/sangrado · transfusiones · profilaxis TEV · foco infeccioso · cultivos/microorganismos/susceptibilidad · antimicrobianos (día, dosis, ajuste renal) · biomarcadores · aislamientos' },
    { key: 'musculoesqueletico', label: 'Musculoesquelético',          placeholder: 'Fuerza/tono · debilidad adquirida en UCI · movilización/rehabilitación · lesiones por presión · heridas/sitios quirúrgicos · catéteres/accesos · fracturas/férulas · dolor osteomuscular' },
    { key: 'plan',              label: 'Plan por sistema',             obligatorio: true,  placeholder: 'Objetivos por aparato · estudios · cambios terapéuticos · destete/retiro de dispositivos · profilaxis · nutrición · antimicrobianos · comunicación con familia · criterios de egreso de UCI' },
  ],
}

/** Construye las secciones vacías para un tipo de nota */
export function seccionesVacias(tipo: TipoNota): NotaSeccion[] {
  return SECCIONES_POR_TIPO[tipo].map(s => ({ ...s, value: '' }))
}

/**
 * LAS SECCIONES DEL TIPO, CONSERVANDO LO ESCRITO — Y SIN CLAVES AJENAS.
 *
 * ── EL DEFECTO (6-ago-2026, REG-196) ─────────────────────────────────────────
 *
 * El Dr. mandó la captura de una **«Nota de Primera Vez»** con encabezados
 * **SUBJETIVO (S) / OBJETIVO (O) / EVALUACIÓN (A) / PLAN (P)**: el título decía
 * una cosa y el documento tenía el formato de otra.
 *
 * No era sólo que el modelo escribiera SOAP —que también, porque `primera_vez`
 * no tenía instrucción de formato—: es que las **claves** guardadas eran las de
 * seguimiento. Al reprocesar sin cambiar de tipo, la base eran las secciones que
 * ya había en memoria (`prev`), así que una clave de otro tipo, una vez dentro,
 * no salía nunca.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Devuelve **exactamente** las secciones del tipo pedido, con el texto que ya
 * hubiera en las que coinciden por clave. Lo que no pertenece al tipo no viaja.
 *
 * ── Y LO QUE NO HACE: TIRAR TEXTO CLÍNICO ────────────────────────────────────
 *
 * Lo que no encaja se devuelve aparte (`huerfanas`), no se borra. Quien llame
 * decide: enseñarlo, moverlo o avisar. Perder prosa que el médico dictó para
 * arreglar un problema de formato sería cambiar un defecto por otro peor — y en
 * este repositorio la pérdida de datos es el fallo que más caro se ha pagado.
 *
 * Función PURA.
 */
export function seccionesDelTipo<T extends { key: string; value?: string }>(
  tipo: TipoNota,
  actuales: readonly T[] = [],
): { secciones: NotaSeccion[]; huerfanas: T[] } {
  const plantilla = seccionesVacias(tipo)
  const porClave = new Map(actuales.map(s => [s.key, s]))
  const secciones = plantilla.map(s => {
    const previa = porClave.get(s.key)
    return previa?.value?.trim() ? { ...s, value: previa.value } : s
  })
  const claves = new Set(plantilla.map(s => s.key))
  const huerfanas = actuales.filter(s => !claves.has(s.key) && s.value?.trim())
  return { secciones, huerfanas }
}


/** ¿Esta nota usa signos vitales obligatorios? */
export function requiereSignosVitales(tipo: TipoNota): boolean {
  return ['historia_clinica', 'primera_vez', 'seguimiento', 'ingreso', 'evolucion', 'evolucion_uci', 'valoracion_preoperatoria', 'valoracion_inmuno', 'nota_postoperatoria', 'nota_anestesia'].includes(tipo)
}

/** ¿Es una valoración preoperatoria? */
export function esPreoperatoria(tipo: TipoNota): boolean {
  return tipo === 'valoracion_preoperatoria'
}

/** ¿Es una valoración del paciente inmunocomprometido (Infectología)? */
export function esInmuno(tipo: TipoNota): boolean {
  return tipo === 'valoracion_inmuno'
}

/**
 * ¿Es una nota hospitalaria? — MC-020.
 *
 * ── LA CONTRADICCIÓN ─────────────────────────────────────────────────────────
 *
 * Esta función decía que una `nota_postoperatoria` es hospitalaria. La pantalla
 * del expediente —la única que de verdad clasifica notas— dice lo contrario con
 * su propia copia local:
 *
 *     const esHospitalaria = (n) => !!n.internamientoId || [...].includes(n.tipo)
 *
 * Y tiene razón: un cirujano privado firma notas postoperatorias en Practice,
 * sin internamiento ninguno. Esta exportación no la usaba ninguna pantalla
 * —«escrito y sin conectar»—, así que la contradicción no hacía daño todavía:
 * lo haría el día que alguien la importara creyendo que es la respuesta buena.
 *
 * ── LA REGLA, UNA SOLA ───────────────────────────────────────────────────────
 *
 * Lo que hace hospitalaria a una nota es el EPISODIO, no el tipo: si tiene
 * `internamientoId`, lo es. El tipo sólo decide en los que sólo existen dentro
 * de un internamiento (ingreso, evolución, evolución de UCI, egreso).
 *
 * Acepta el tipo suelto —como la llamaba el único consumidor que tenía— o la
 * nota entera, que es como hay que llamarla cuando se conoce el episodio.
 */
export function esHospitalaria(
  notaOTipo: TipoNota | { tipo: TipoNota; internamientoId?: string },
): boolean {
  const tipo = typeof notaOTipo === 'string' ? notaOTipo : notaOTipo.tipo
  const internada = typeof notaOTipo === 'string' ? false : !!notaOTipo.internamientoId
  return internada || ['ingreso', 'evolucion', 'evolucion_uci', 'egreso'].includes(tipo)
}

export const POR_QUE_EL_EPISODIO_MANDA_SOBRE_EL_TIPO =
  'Porque un cirujano privado firma notas postoperatorias en su consultorio, ' +
  'sin internamiento. Lo que hace hospitalaria a una nota es estar dentro de un ' +
  'episodio de internamiento, y eso lo dice `internamientoId`, no el tipo.'
