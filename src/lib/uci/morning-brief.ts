/**
 * MORNING BRIEF — charter §30.
 *
 *   «Últimas 12 horas:  NE 0.18 → 0.06 · Lactato 4.2 → 1.8 · FiO2 60 → 40% ·
 *    PEEP 12 → 8 · Creatinina 1.5 → 2.4 · Diuresis 0.7 → 0.3 · Balance +2.3 L ·
 *    VExUS 1 → 3
 *
 *    MEJORÓ: hemodinamia, oxigenación
 *    EMPEORÓ: función renal, congestión
 *    PENDIENTE: cultivo, SBT, reevaluación del CVC
 *
 *    **Todas las frases deben vincularse a datos reales.**»
 *
 * ── LA FRONTERA QUE ESTE MÓDULO RESPETA ──────────────────────────────────────
 *
 * Un delta es un HECHO: la creatinina pasó de 1.5 a 2.4. Decir que eso significa
 * «empeoró la función renal» ya es **saber medicina**: requiere conocer que en
 * ese parámetro subir es malo.
 *
 * Por eso la dirección de beneficio **se declara, no se deduce**. Una métrica sin
 * declarar produce su delta **sin veredicto** — nunca un «empeoró» inventado. Y
 * el mapa de direcciones vive en un solo sitio, citado, para que el médico dueño
 * pueda revisarlo de un vistazo en vez de buscarlo dentro de la lógica.
 *
 * ── «PENDIENTE» NO SE INVENTA ────────────────────────────────────────────────
 *
 * Los pendientes del ejemplo (cultivo, SBT, reevaluación del CVC) sólo pueden
 * salir de metas diarias u órdenes abiertas. Mientras esas no existan como dato
 * estructurado, esta sección va **vacía y declarada como vacía**. Rellenarla con
 * sugerencias plausibles sería exactamente lo que el charter prohíbe: una frase
 * que no se vincula a un dato real.
 *
 * Módulo PURO. El instante y la ventana entran por parámetro.
 */

/** Sistemas que agrupa el brief. Los del ejemplo del charter. */
export const SISTEMAS_BRIEF = [
  'hemodinamia',
  'oxigenacion',
  'ventilacion',
  'funcion_renal',
  'congestion',
  'metabolico',
] as const
export type SistemaBrief = (typeof SISTEMAS_BRIEF)[number]

/**
 * Hacia dónde es MEJOR que se mueva una métrica.
 *
 * `null` = **no declarado**: se muestra el delta sin veredicto.
 */
export type DireccionBeneficio = 'menor_es_mejor' | 'mayor_es_mejor' | null

export interface MetricaBrief {
  clave: string
  /** Cómo se llama en la pantalla. */
  etiqueta: string
  unidad?: string
  sistema: SistemaBrief
  direccionBeneficio: DireccionBeneficio
  /** De dónde sale que esa es la dirección. Obligatorio si está declarada. */
  fuenteDireccion?: string
}

/**
 * Catálogo de métricas del brief.
 *
 * ⚠️ Cada `direccionBeneficio` declarada cita su razón. Las que dependen del
 * contexto clínico quedan en `null` **a propósito**: se muestra el cambio y el
 * intensivista lo interpreta.
 */
export const METRICAS_BRIEF: readonly MetricaBrief[] = [
  {
    clave: 'ne', etiqueta: 'Norepinefrina', unidad: 'µg/kg/min', sistema: 'hemodinamia',
    direccionBeneficio: 'menor_es_mejor',
    fuenteDireccion: 'Definicional: menos vasopresor es menos soporte. Bajar la dosis sólo es posible si la hemodinamia lo permite.',
  },
  {
    clave: 'fio2', etiqueta: 'FiO₂', unidad: '%', sistema: 'oxigenacion',
    direccionBeneficio: 'menor_es_mejor',
    fuenteDireccion: 'Definicional: menos FiO₂ para la misma oxigenación es menos soporte.',
  },
  {
    clave: 'peep', etiqueta: 'PEEP', unidad: 'cmH2O', sistema: 'ventilacion',
    direccionBeneficio: 'menor_es_mejor',
    fuenteDireccion: 'Definicional en el contexto de retiro del soporte: bajar PEEP manteniendo oxigenación es desescalar.',
  },
  {
    clave: 'balance', etiqueta: 'Balance hídrico', unidad: 'L', sistema: 'congestion',
    // El balance positivo NO es malo por sí mismo: en choque distributivo la
    // reanimación es el tratamiento. Depende de la fase, y eso lo sabe el médico.
    direccionBeneficio: null,
  },
  {
    clave: 'lactato', etiqueta: 'Lactato', unidad: 'mmol/L', sistema: 'metabolico',
    direccionBeneficio: null,
  },
  {
    clave: 'creatinina', etiqueta: 'Creatinina', unidad: 'mg/dL', sistema: 'funcion_renal',
    direccionBeneficio: null,
  },
  {
    clave: 'diuresis', etiqueta: 'Diuresis', unidad: 'mL/kg/h', sistema: 'funcion_renal',
    direccionBeneficio: null,
  },
  {
    clave: 'vexus', etiqueta: 'VExUS', sistema: 'congestion',
    direccionBeneficio: null,
  },
]

export type Veredicto = 'mejoro' | 'empeoro' | 'sin_cambio' | 'sin_veredicto'

export interface CambioBrief {
  clave: string
  etiqueta: string
  unidad?: string
  sistema: SistemaBrief
  de: number
  a: number
  /** Positivo = subió. */
  delta: number
  veredicto: Veredicto
  /** Por qué NO hay veredicto, cuando no lo hay. */
  motivoSinVeredicto?: string
  /** «NE 0.18 → 0.06». Formato del charter. */
  texto: string
}

export interface Brief {
  /** «Últimas 12 horas». */
  ventanaHoras: number
  cambios: CambioBrief[]
  mejoraron: SistemaBrief[]
  empeoraron: SistemaBrief[]
  /** Sistemas cuyos cambios no tienen dirección declarada. */
  sinVeredicto: SistemaBrief[]
  /**
   * SIEMPRE vacío hoy, y declarado: los pendientes exigen metas diarias u
   * órdenes abiertas como dato estructurado, que aún no existen.
   */
  pendientes: string[]
  pendientesNoDisponibles: true
}

const REDONDEO = 1e-9

/** Un par de valores de la misma métrica, en los extremos de la ventana. */
export interface ParMedido {
  clave: string
  de: number
  a: number
}

/**
 * Construye el brief a partir de pares ya medidos.
 *
 * No lee la serie ni elige la ventana: recibe los extremos. Elegir cuál es «el
 * valor de hace 12 horas» es la regla de vigencia que ya resuelve
 * `observacion-version.ts`, y duplicarla aquí las dejaría divergir.
 */
export function construirBrief(pares: readonly ParMedido[], ventanaHoras: number): Brief {
  if (!Number.isFinite(ventanaHoras) || ventanaHoras <= 0) {
    throw new Error('construirBrief: `ventanaHoras` debe ser un número positivo')
  }

  const cambios: CambioBrief[] = []

  for (const p of pares) {
    const m = METRICAS_BRIEF.find(x => x.clave === p.clave)
    if (m === undefined) continue                       // métrica desconocida: se ignora
    if (!Number.isFinite(p.de) || !Number.isFinite(p.a)) continue

    const delta = p.a - p.de
    const subio = delta > REDONDEO
    const bajo = delta < -REDONDEO

    let veredicto: Veredicto = 'sin_cambio'
    let motivo: string | undefined
    if (m.direccionBeneficio === null) {
      veredicto = 'sin_veredicto'
      motivo = 'La dirección de beneficio de esta métrica no está declarada: depende del contexto clínico.'
    } else if (subio) {
      veredicto = m.direccionBeneficio === 'mayor_es_mejor' ? 'mejoro' : 'empeoro'
    } else if (bajo) {
      veredicto = m.direccionBeneficio === 'menor_es_mejor' ? 'mejoro' : 'empeoro'
    }

    cambios.push({
      clave: m.clave, etiqueta: m.etiqueta, sistema: m.sistema,
      ...(m.unidad !== undefined ? { unidad: m.unidad } : {}),
      de: p.de, a: p.a, delta,
      veredicto,
      ...(motivo !== undefined ? { motivoSinVeredicto: motivo } : {}),
      texto: `${m.etiqueta} ${p.de} → ${p.a}${m.unidad !== undefined ? ` ${m.unidad}` : ''}`,
    })
  }

  const porVeredicto = (v: Veredicto): SistemaBrief[] =>
    [...new Set(cambios.filter(c => c.veredicto === v).map(c => c.sistema))]

  return {
    ventanaHoras,
    cambios,
    mejoraron: porVeredicto('mejoro'),
    empeoraron: porVeredicto('empeoro'),
    sinVeredicto: porVeredicto('sin_veredicto'),
    // Se declara la ausencia en vez de rellenarla con sugerencias plausibles.
    pendientes: [],
    pendientesNoDisponibles: true,
  }
}

/**
 * Mensaje único para la sección de pendientes. Que la pantalla diga POR QUÉ está
 * vacía es más honesto que un espacio en blanco, que se lee como «no hay nada
 * pendiente».
 */
export const PENDIENTES_NO_DISPONIBLES =
  'Los pendientes se listarán cuando existan metas diarias u órdenes abiertas ' +
  'como dato estructurado (charter §35). No se sugieren: toda frase del brief ' +
  'debe vincularse a un dato real.'

/** Métricas sin dirección declarada. Es la lista de preguntas para el médico. */
export function metricasSinDireccion(): MetricaBrief[] {
  return METRICAS_BRIEF.filter(m => m.direccionBeneficio === null)
}

/** Toda dirección declarada tiene que citar su razón. Lo verifica el golden. */
export function direccionesSinFuente(): MetricaBrief[] {
  return METRICAS_BRIEF.filter(
    m => m.direccionBeneficio !== null && (m.fuenteDireccion ?? '').trim() === '',
  )
}
