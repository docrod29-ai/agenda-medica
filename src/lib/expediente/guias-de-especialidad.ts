/**
 * LAS GUÍAS POR ESPECIALIDAD — I-5 del loop «grabación perfecta».
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * «nota como **internista, pediatra, ginecólogo, cirujano, intensivista,
 * infectólogo** etcétera según sea el caso».
 *
 * Y en las doce preguntas contestó algo que cambia el alcance del producto:
 * lo van a usar **médicos de CUALQUIER especialidad**, y **cada especialista
 * valida su propia rama al usarla**.
 *
 * ── POR QUÉ ESTO SALE DEL PROMPT Y VIVE APARTE ──────────────────────────────
 *
 * Estas guías estaban escritas dentro de `prompts.ts`, en medio de un archivo de
 * 800 líneas. Mientras la app era para un internista-infectólogo eso bastaba.
 * Deja de bastar en cuanto la usa un pediatra: **su criterio no puede vivir en
 * una constante que sólo se cambia recompilando**.
 *
 * Aquí son DATOS con procedencia declarada. Lo que se siembra es exactamente lo
 * que ya había —ni una palabra nueva— y queda dicho de quién es.
 *
 * ── LO QUE CAMBIA DE VERDAD: EL SILENCIO ────────────────────────────────────
 *
 * `guiaEspecialidad()` devolvía cadena vacía cuando no encontraba la rama. O
 * sea: un neumólogo pediatra, un reumatólogo, un geriatra —cualquiera fuera de
 * las dieciséis— recibía una nota redactada **con criterio genérico y sin que
 * nadie se lo dijera**.
 *
 * Un genérico silencioso es la peor de las tres opciones. Ahora se sabe cuándo
 * no hay guía, y se puede decir.
 *
 * ── EL LÍMITE, Y ES DURO ────────────────────────────────────────────────────
 *
 * Aquí NO se redacta criterio clínico de ramas que el dueño no ejerce. Las
 * dieciséis que están, están porque ya estaban. Una decimoséptima la escribe
 * quien la ejerce — el propio médico, desde su configuración — y hasta entonces
 * el sistema dice que no la tiene en vez de fingir que sí.
 *
 * Módulo PURO, sin dependencias.
 */

/** De dónde salió una guía. Importa para saber quién responde por ella. */
export type OrigenDeLaGuia =
  /** Venía en el repositorio, revisada por el médico dueño. */
  | 'repositorio'
  /** La escribió el médico que la usa, desde su configuración. */
  | 'del_medico'

export interface GuiaDeEspecialidad {
  /** Raíz para reconocer la especialidad escrita a mano ("Cardiología clínica"). */
  clave: string
  /** Cómo se llama, para poder decírselo al médico. */
  nombre: string
  /** El texto que se le inyecta al modelo. */
  guia: string
  origen: OrigenDeLaGuia
}

export const GUIAS: readonly GuiaDeEspecialidad[] = [
  {
    clave: 'cardiolog',
    nombre: 'Cardiología',
    origen: 'repositorio',
    guia:
      'CARDIOLOGÍA: clasifica disnea (NYHA) y angina (CCS); documenta factores de riesgo CV (HTA, DM, dislipidemia, tabaquismo, AHF), hallazgos de ECG/eco si se mencionan, y estratifica riesgo. Plan: metas de TA/LDL, antiagregación/anticoagulación con justificación.',
  },
  {
    clave: 'pediatr',
    nombre: 'Pediatría',
    origen: 'repositorio',
    guia:
      'PEDIATRÍA: SIEMPRE peso, talla y perímetro cefálico (lactante) TAL COMO SE DICTARON, con su unidad. NO calcules percentiles ni mg/kg: los hace el motor (regla 16-bis) y salen en su panel. Esquema de vacunación CENSIA; hitos del desarrollo; alimentación. Si se dictó un cálculo de líquidos, transcríbelo; no lo hagas tú.',
  },
  {
    clave: 'ginec',
    nombre: 'Ginecología y Obstetricia',
    origen: 'repositorio',
    guia:
      'GINECOLOGÍA/OBSTETRICIA: FUM, ciclo, G/P/A/C, método anticonceptivo, citología/mama; en embarazo: edad gestacional por FUM/USG, FCF, movimientos fetales, categoría FDA de fármacos. Evita teratógenos.',
  },
  {
    clave: 'interna',
    nombre: 'Medicina Interna',
    origen: 'repositorio',
    guia:
      'MEDICINA INTERNA: enfoque por problemas (problem list), comorbilidades y su control, polifarmacia y conciliación, criterios de Beers en ≥65. Síntesis de sistemas.',
  },
  {
    clave: 'urgenc',
    nombre: 'Urgencias',
    origen: 'repositorio',
    guia:
      'URGENCIAS: triage, ABCDE, tiempo de evolución, signos de alarma, escalas (qSOFA, Glasgow, dolor torácico). Plan: estabilización, estudios urgentes, criterios de ingreso/alta/observación.',
  },
  {
    clave: 'infectolog',
    nombre: 'Infectología',
    origen: 'repositorio',
    guia:
      'INFECTOLOGÍA/PROA: foco infeccioso, síndrome, microbiología (cultivos/antibiograma), empírico vs dirigido, esquema completo (fármaco+dosis+vía+intervalo+duración+ajuste renal), desescalada y switch IV→VO, día de tratamiento y reevaluación 48-72h.',
  },
  {
    clave: 'cirug',
    nombre: 'Cirugía General',
    origen: 'repositorio',
    guia:
      'CIRUGÍA: diagnóstico quirúrgico, indicación, riesgo (ASA), consentimiento, plan quirúrgico, profilaxis antibiótica y tromboprofilaxis, cuidados pre/postoperatorios.',
  },
  {
    clave: 'psiqui',
    nombre: 'Psiquiatría',
    origen: 'repositorio',
    guia:
      'PSIQUIATRÍA: examen mental estructurado, riesgo suicida/heteroagresividad, antecedentes psiquiátricos y de consumo, escalas (PHQ-9, GAD-7) si se mencionan, plan farmacológico + psicoterapia.',
  },
  {
    clave: 'dermatolog',
    nombre: 'Dermatología',
    origen: 'repositorio',
    guia:
      'DERMATOLOGÍA: describe lesión elemental (tipo, color, forma, bordes, distribución, topografía), dermatoscopía si aplica, diagnóstico diferencial dermatológico.',
  },
  {
    clave: 'ortoped',
    nombre: 'Ortopedia y Traumatología',
    origen: 'repositorio',
    guia:
      'ORTOPEDIA/TRAUMA: mecanismo de lesión, exploración articular (arcos, estabilidad, neurovascular distal), imagen (Rx/TAC), clasificación de fractura, plan (inmovilización/quirúrgico).',
  },
  {
    clave: 'endocrin',
    nombre: 'Endocrinología',
    origen: 'repositorio',
    guia:
      'ENDOCRINOLOGÍA: control metabólico (HbA1c, glucosa, perfil tiroideo/lipídico), metas terapéuticas, ajuste de insulina/hipoglucemiantes, complicaciones micro/macrovasculares.',
  },
  {
    clave: 'neurolog',
    nombre: 'Neurología',
    origen: 'repositorio',
    guia:
      'NEUROLOGÍA: exploración neurológica estructurada (pares, fuerza, sensibilidad, reflejos, marcha, cognición), escalas (NIHSS, Glasgow), localización topográfica del déficit.',
  },
  {
    clave: 'neumolog',
    nombre: 'Neumología',
    origen: 'repositorio',
    guia:
      'NEUMOLOGÍA: patrón respiratorio, SpO2, espirometría si se menciona, tabaquismo (índice paquetes/año), clasificación (GOLD/GINA), plan inhalado.',
  },
  {
    clave: 'gastro',
    nombre: 'Gastroenterología',
    origen: 'repositorio',
    guia:
      'GASTROENTEROLOGÍA: síntomas digestivos, signos de alarma, endoscopia si aplica, función hepática, plan dietético y farmacológico.',
  },
  {
    clave: 'nefrolog',
    nombre: 'Nefrología',
    origen: 'repositorio',
    guia:
      'NEFROLOGÍA: función renal (creatinina, eGFR, estadio ERC), balance hídrico, electrolitos, ajuste de fármacos por TFG, indicación de diálisis si aplica.',
  },
  {
    clave: 'oncolog',
    nombre: 'Oncología',
    origen: 'repositorio',
    guia:
      'ONCOLOGÍA: estadificación (TNM), ECOG/Karnofsky, línea de tratamiento, toxicidades, plan oncológico y de soporte.',
  },
]

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/**
 * Busca la guía de una especialidad escrita a mano.
 *
 * Por raíz y no por igualdad: el médico escribe «Cardiología clínica»,
 * «Infectología pediátrica», «Medicina Interna / Geriatría». Devuelve `null`
 * cuando no hay — y **ese null es información**, no un fallo.
 */
export function guiaDe(
  especialidad: unknown,
  extra: readonly GuiaDeEspecialidad[] = [],
): GuiaDeEspecialidad | null {
  const e = norm(especialidad)
  if (!e) return null

  /**
   * MANDA LA PALABRA QUE VA DELANTE, NO EL ORDEN DE ESTA LISTA.
   *
   * La primera versión devolvía la primera coincidencia del arreglo, y con eso
   * **«Infectología pediátrica» caía en PEDIATRÍA** — sólo porque `pediatr`
   * estaba antes que `infectolog` en la lista. Lo encontró su propia prueba.
   *
   * En español el núcleo del nombre va primero: «Infectología pediátrica» es
   * infectología, «Cirugía pediátrica» es cirugía, «Cardiología pediátrica» es
   * cardiología. Así que gana la raíz que aparece ANTES en el texto.
   *
   * A igualdad de posición manda la del médico: si él escribió la suya, es la
   * suya. (Ver la respuesta «el médico de esa especialidad valida al usarla».)
   */
  let mejor: { g: GuiaDeEspecialidad; donde: number } | null = null
  for (const g of [...extra, ...GUIAS]) {
    const donde = e.indexOf(norm(g.clave))
    if (donde === -1) continue
    if (!mejor || donde < mejor.donde) mejor = { g, donde }
  }
  return mejor?.g ?? null
}

/** ¿Esta especialidad tiene guía? Sirve para poder DECIRLO, no para bloquear. */
export function tieneGuia(
  especialidad: unknown,
  extra: readonly GuiaDeEspecialidad[] = [],
): boolean {
  return guiaDe(especialidad, extra) !== null
}

/**
 * El bloque que se inyecta al prompt. Cadena vacía si no hay guía.
 *
 * El formato es EL MISMO que tenía `guiaEspecialidad()` dentro de `prompts.ts`:
 * mover esto no puede cambiar ni un carácter de lo que ve el modelo, o cambiaría
 * el comportamiento de la nota sin que nadie lo pidiera.
 */
export function bloqueDeEspecialidad(
  especialidad: unknown,
  extra: readonly GuiaDeEspecialidad[] = [],
): string {
  const g = guiaDe(especialidad, extra)
  return g ? `\nENFOQUE POR ESPECIALIDAD — ${g.guia}\n` : ''
}

export const POR_QUE_EL_NULL_ES_INFORMACION =
  'Un genérico silencioso es peor que no tener guía: el médico no sabe que su ' +
  'nota se redactó con criterio de nadie. Saber que falta permite decirlo, y ' +
  'permite que él la escriba.'

export const EL_LIMITE =
  'Aquí no se redacta criterio clínico de ramas que el dueño no ejerce. Las que ' +
  'están, están porque ya estaban. Una nueva la escribe quien la ejerce.'
