/**
 * RESPUESTAS SINTÉTICAS DE LOS PROVEEDORES EXTERNOS — sólo para grabar el video.
 *
 * La sesión donde se grabó no tenía llaves de AssemblyAI (voz a texto) ni de
 * Anthropic (redacción de la nota). En vez de fingir la interfaz, se graba la
 * interfaz REAL y se interceptan en el navegador únicamente esas dos llamadas,
 * devolviendo lo que devolverían con este diálogo. Las formas de cada respuesta
 * salen del contrato real de cada ruta:
 *
 *   · transcribir-diarizado  → src/app/api/expediente/transcribir-diarizado/route.ts
 *   · atribuir-roles         → src/app/api/expediente/atribuir-roles/route.ts
 *   · procesar               → src/lib/expediente/extraction-schema.ts
 *   · verificar-nota         → src/app/api/expediente/verificar-nota/route.ts
 *
 * Todo lo demás —motores de seguridad, procedencia, firma, sello, receta,
 * órdenes, portal— corre de verdad sobre el emulador.
 *
 * La nota reusa frases literales del diálogo a propósito: `rastrearNota` y
 * `cuandoSeDijo` (cliente) son los que ligan cada frase con su segundo de
 * audio, y sólo lo consiguen si la frase está en el dictado.
 */

/** Palabras que el «reconocedor» oyó con duda (< UMBRAL_DUDA = 0.6). */
const DUDOSAS = { urea: 0.52, anafilaxia: 0.57 }

/** Convierte los turnos del diálogo en utterances con palabras y tiempos. */
export function utterancesDesde(turnos) {
  return turnos.map(t => {
    const palabras = t.texto.split(/\s+/)
    const paso = (t.finMs - t.inicioMs) / palabras.length
    return {
      speaker: t.rol === 'Médico' ? 'A' : 'B',
      text: t.texto,
      palabras: palabras.map((p, i) => {
        const limpia = p.toLowerCase().replace(/[^a-záéíóúñü]/g, '')
        return { texto: p, inicioMs: Math.round(t.inicioMs + i * paso), confianza: DUDOSAS[limpia] ?? 0.96 }
      }),
    }
  })
}

export function textoDesde(turnos) {
  return turnos.map(t => `${t.rol}: ${t.texto}`).join('\n')
}

/** Texto que «llega» en vivo en el trozo k (cada 20 s), como haría transcribir-chunk. */
export function textoDelTrozo(turnos, k, trozoMs = 20000) {
  return turnos
    .filter(t => t.inicioMs >= k * trozoMs && t.inicioMs < (k + 1) * trozoMs)
    .map(t => t.texto).join(' ')
}

export const ROLES = { ok: true, roles: { A: 'Médico', B: 'Paciente' }, sinIdentificar: 0, hablantes: 2, separacionFallida: false }

const campo = (value, source_quote, speaker, confidence = 'alta', needs_review = false, reason = '') =>
  ({ value, confidence, source_quote, speaker, needs_review, reason })

export const NOTA = {
  ok: true,
  resumenEjecutivo:
    'Mujer de 68 años con diabetes tipo 2 y nefropatía incipiente, en control con metformina; refiere edema vespertino de pies; se solicita perfil renal y hemoglobina glucosilada.',
  secciones: {
    subjetivo:
      'Acude a control de diabetes mellitus tipo 2. Refiere glucemias capilares matutinas entre 110 y 130, con elevaciones nocturnas ocasionales. ' +
      'Refiere apego a metformina 850 mg dos veces al día, sin faltar. Refiere que los pies se le hinchan un poco por la tarde. ' +
      'Niega fiebre y ardor al orinar. Alergias conocidas: penicilina (anafilaxia) y sulfas; niega alergias nuevas a medicamentos.',
    objetivo:
      'Signos vitales registrados en consulta. Edema leve de pies, referido por la paciente como vespertino. ' +
      'Resto de la exploración física: no dictada en esta consulta.',
    evaluacion:
      'Control de diabetes: glucosa referida aceptable en las mañanas, con elevaciones nocturnas por caracterizar. ' +
      'Nefropatía diabética incipiente conocida: se revalora la función renal. Edema vespertino de pies a correlacionar con la función renal.',
    plan:
      'Por la nefropatía incipiente, solicitar creatinina, urea, examen general de orina y hemoglobina glucosilada. ' +
      'Continuar metformina 850 mg vía oral cada 12 horas por 3 meses. ' +
      'Ajuste de dosis condicionado al resultado de la función renal: se valorará en la siguiente cita, no se indica hoy. ' +
      'Cita de seguimiento con resultados.',
  },
  diagnosticos: [
    { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11', tipo: 'definitivo', estado: 'cronico' },
    { descripcion: 'Nefropatía diabética incipiente', codigoCIE10: 'E11.2', tipo: 'definitivo', estado: 'en_seguimiento' },
    { descripcion: 'Edema de miembros inferiores', codigoCIE10: 'R60.0', tipo: 'presuntivo', estado: 'activo' },
  ],
  medicamentos: [
    {
      nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: '3 meses',
      indicacion: 'Diabetes mellitus tipo 2. Con alimentos.', procedenciaClinica: 'se_prescribe_hoy', estado: 'activa',
    },
  ],
  alergias: [
    { alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'anafilaxia', severidad: 'anafilaxia', confirmada: true },
    { alergeno: 'Sulfas', tipo: 'medicamento', severidad: 'moderada', confirmada: true },
  ],
  signosVitales: {},
  estudiosOrden: ['Creatinina', 'Urea', 'Examen general de orina', 'Hemoglobina glucosilada (HbA1c)'],
  extraction: {
    resumenEjecutivo: campo(
      'Mujer de 68 años con diabetes tipo 2 y nefropatía incipiente, en control con metformina.',
      'Cómo ha estado de la glucosa', 'medico',
    ),
    secciones: {
      subjetivo: campo('Refiere glucemias capilares matutinas entre 110 y 130', 'en las mañanas me sale entre ciento diez y ciento treinta', 'paciente'),
      objetivo: campo('Edema leve de pies, referido por la paciente como vespertino', 'Los pies sí se me hinchan un poco por la tarde', 'paciente', 'media', true, 'Exploración física no dictada'),
      evaluacion: campo('Nefropatía diabética incipiente conocida: se revalora la función renal', 'si la función renal salió más baja', 'medico', 'media'),
      plan: campo('Continuar metformina 850 mg vía oral cada 12 horas por 3 meses', 'Le renuevo la metformina ochocientos cincuenta miligramos cada doce horas por tres meses', 'medico', 'alta', true, 'El ajuste de metformina es condicional: no se indicó hoy'),
    },
    diagnosticos: [
      { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11', tipo: 'definitivo', estado: 'cronico', confidence: 'alta', source_quote: 'el control de su diabetes', speaker: 'medico', needs_review: false, reason: '', tipoOrigen: 'extraccion' },
      { descripcion: 'Nefropatía diabética incipiente', codigoCIE10: 'E11.2', tipo: 'definitivo', estado: 'en_seguimiento', confidence: 'media', source_quote: 'Por la nefropatía incipiente', speaker: 'medico', needs_review: false, reason: '', tipoOrigen: 'extraccion' },
      { descripcion: 'Edema de miembros inferiores', codigoCIE10: 'R60.0', tipo: 'presuntivo', estado: 'activo', confidence: 'media', source_quote: 'Los pies sí se me hinchan un poco por la tarde', speaker: 'paciente', needs_review: true, reason: 'Referido, no explorado', tipoOrigen: 'extraccion' },
    ],
    medicamentos: [
      { nombre: 'Metformina', dosis: '850 mg', via: 'oral', procedenciaClinica: 'se_prescribe_hoy', frecuencia: 'cada 12 horas', duracion: '3 meses', indicacion: 'Diabetes mellitus tipo 2', confidence: 'alta', source_quote: 'metformina ochocientos cincuenta miligramos cada doce horas por tres meses', speaker: 'medico', needs_review: false, reason: '' },
    ],
    alergias: [
      { alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'anafilaxia', severidad: 'anafilaxia', confirmada: true, confidence: 'alta', source_quote: 'sólo la penicilina, que me da anafilaxia', speaker: 'paciente', needs_review: false, reason: '' },
      { alergeno: 'Sulfas', tipo: 'medicamento', confirmada: true, confidence: 'alta', source_quote: 'Y las sulfas', speaker: 'paciente', needs_review: false, reason: '' },
    ],
    signosVitales: {},
  },
  preopInputs: {},
  safety: {
    fields_auto_filled: [],
    fields_requiring_review: ['objetivo', 'plan'],
    conflicts_detected: [],
    missing_critical_fields: [],
    alergia_conflicto: [],
    contenido_sospechoso: [],
    dictamen: 'Sin conflicto alergia-fármaco: metformina no cruza con penicilina ni sulfas. El ajuste de dosis del plan es condicional y se registró como intención, no como orden.',
  },
  _plan: 'premium',
  _motor: 'maxima',
  _modoEconomico: false,
  _uso: { usadas: 14, limite: 200, restantes: 186, porcentaje: 7, alerta: 'ok' },
  _modelo: 'claude-opus-4-8',
  _promptVersion: 'demo-video',
  _apiVersion: '2023-06-01',
  _modelosNota: ['claude-opus-4-8', 'GPT', 'síntesis'],
  _citasFusion: { revisadas: 11, restauradas: 0, descartadas: 0 },
}

export const VERIFICACION = {
  ok: true,
  modelo: 'gpt-5',
  tramos: 1,
  hallazgos: [
    {
      severidad: 'media', tema: 'exploración física',
      problema: 'La exploración física no fue dictada; el apartado objetivo sólo recoge lo referido por la paciente.',
      sugerencia: 'Completar la exploración física antes de firmar, o dejar constancia de que no se realizó.',
    },
    {
      severidad: 'baja', tema: 'dosis',
      problema: 'Metformina 850 mg cada 12 horas coincide con lo dictado. No se detectó cambio de cifra ni de unidad.',
      sugerencia: 'Sin acción.',
    },
  ],
}

export const ENTIDADES = {
  ok: true,
  model: 'demo',
  conditions: [
    { texto: 'diabetes mellitus tipo 2', cie10: 'E11', estado: 'activo', severidad: '', source_quote: 'Sigue tomando la metformina' },
    { texto: 'fiebre', cie10: '', estado: 'negado', severidad: '', source_quote: 'Fiebre no' },
  ],
  medications: [{ texto: 'metformina', generico: 'metformina', dosis: '850', unidad_dosis: 'mg', via: 'oral', intervalo: 'cada 12 horas', duracion: '3 meses', source_quote: 'metformina ochocientos cincuenta miligramos cada doce horas' }],
  procedures: [], anatomy: [], tests: [],
  allergies: [{ alergeno: 'penicilina', reaccion: 'anafilaxia', severidad: 'anafilaxia', source_quote: 'la penicilina, que me da anafilaxia' }],
  cross_check: { alergia_vs_medicamento: [], interacciones_farmacologicas: [] },
  negacionesCorregidas: [], avisosTemporales: [],
}
