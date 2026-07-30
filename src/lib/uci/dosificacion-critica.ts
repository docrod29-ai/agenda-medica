/**
 * DOSIFICACIÓN EN EL ADULTO CRÍTICO — algoritmo del Dr. (2026-07-30).
 *
 * ── LA REGLA QUE ORGANIZA TODO ───────────────────────────────────────────────
 *
 * Palabras textuales del Dr.:
 *
 *   «Yo NO programaría meropenem simplemente como CrCl → dosis.»
 *
 * El orden es: **foco y gravedad → CrCl → detectar ARC → identificar
 * IHD/CRRT/PIRRT → conocer MIC → elegir dosis → elegir duración de infusión →
 * TDM y reajuste.**
 *
 * Por eso este motor **no recibe un CrCl y devuelve una dosis**. Recibe el
 * escenario completo y devuelve el esquema que corresponde, o dice qué falta.
 *
 * ── LO QUE ESTE MOTOR NO HACE: ELEGIR ────────────────────────────────────────
 *
 * El Dr. describe DOS columnas —convencional y alta exposición— y advierte que
 * «la columna de alta exposición NO significa que todo paciente crítico deba
 * recibir 6 g/día». La elección depende del foco, del germen y del juicio de
 * quien está en la cabecera.
 *
 * El motor presenta **las dos**, dice **qué criterios de alta exposición se
 * cumplen** en este paciente, y **no marca ninguna como la buena**.
 *
 * ── EL ERROR QUE ESTE MOTOR EXISTE PARA IMPEDIR ──────────────────────────────
 *
 *   «CRRT: aquí NO usaría el ajuste de falla renal convencional. Un enfermo con
 *    CrCl prácticamente cero sin diálisis puede requerir 500 mg c/24 h, mientras
 *    que un paciente anúrico conectado a CVVHD/CVVHDF puede requerir varios
 *    gramos diarios porque el filtro elimina meropenem.»
 *
 * Tratar a un paciente en CRRT como «CrCl < 10» lo **infradosifica gravemente**.
 * El motor lo trata como rama propia y se niega a aplicar la tabla renal.
 *
 * ── SÓLO MEROPENEM ───────────────────────────────────────────────────────────
 *
 * El Dr. entregó el algoritmo del meropenem. **Los demás fármacos NO están** y
 * no se infieren: cada uno tiene su propia farmacocinética, su propio
 * aclaramiento por filtro y su propio objetivo PK/PD. `FARMACOS_SIN_ALGORITMO`
 * los declara.
 *
 * Módulo PURO. No decide, no prescribe: presenta el esquema que el Dr. escribió.
 */

export const MODALIDADES_RENALES = ['ninguna', 'ihd', 'crrt', 'pirrt'] as const
export type ModalidadRenal = (typeof MODALIDADES_RENALES)[number]

export const MODALIDAD_LABEL: Record<ModalidadRenal, string> = {
  ninguna: 'Sin terapia de reemplazo',
  ihd: 'Hemodiálisis intermitente',
  crrt: 'CRRT / CVVHD / CVVHDF',
  pirrt: 'SLED / PIRRT',
}

/**
 * Criterios de ALTA EXPOSICIÓN, textuales del Dr.
 *
 * «Es especialmente útil en shock séptico, meningitis/SNC, ARC, Pseudomonas,
 *  gran volumen de distribución, quemados o microorganismo con MIC elevada pero
 *  aún susceptible.»
 */
export const CRITERIOS_ALTA_EXPOSICION = [
  'shock_septico', 'snc', 'arc', 'pseudomonas',
  'volumen_distribucion_alto', 'quemado', 'mic_elevada_susceptible',
] as const
export type CriterioAltaExposicion = (typeof CRITERIOS_ALTA_EXPOSICION)[number]

export const CRITERIO_LABEL: Record<CriterioAltaExposicion, string> = {
  shock_septico: 'Shock séptico',
  snc: 'Infección de SNC / meningitis',
  arc: 'Aclaramiento renal aumentado',
  pseudomonas: 'Pseudomonas',
  volumen_distribucion_alto: 'Gran volumen de distribución',
  quemado: 'Paciente quemado',
  mic_elevada_susceptible: 'MIC elevada pero aún susceptible',
}

export interface EscenarioMeropenem {
  /** Aclaramiento de creatinina, mL/min. */
  crCl?: number | null
  modalidad?: ModalidadRenal
  /** Criterios de alta exposición presentes. */
  criterios?: readonly CriterioAltaExposicion[]
  /** MIC del germen, mg/L. */
  mic?: number | null
  /** ¿Hay monitorización de concentraciones disponible? */
  tdm?: boolean
}

export interface EsquemaMeropenem {
  /** Columna de la tabla del Dr. */
  convencional: string
  /** Columna de alta exposición. */
  altaExposicion: string
  /** Duración de infusión recomendada por el Dr. para este escenario. */
  infusion: string
  /** De dónde sale esta fila. */
  fuente: string
}

export interface ResultadoDosis {
  /** `null` si falta el dato que decide la fila. */
  esquema: EsquemaMeropenem | null
  /** Qué falta para poder proponer algo. */
  faltan: string[]
  /** Criterios de alta exposición que SÍ se cumplen en este paciente. */
  criteriosPresentes: CriterioAltaExposicion[]
  /** Avisos que el Dr. escribió y que el motor NO puede resolver. */
  avisos: string[]
  /** El motor no elige columna. Siempre `true`. */
  eligeElMedico: true
}

export const ARC_UMBRAL_CRCL = 130

export const NO_ELIJO_COLUMNA =
  'El sistema NO elige entre convencional y alta exposición. La columna de alta ' +
  'exposición NO significa que todo paciente crítico deba recibir 6 g/día: ' +
  'depende del foco, del germen y del juicio de quien está en la cabecera.'

export const CRRT_NO_ES_FALLA_RENAL =
  'En CRRT NO se aplica el ajuste de falla renal. Un paciente con CrCl casi cero ' +
  'SIN diálisis puede requerir 500 mg c/24 h; el mismo paciente anúrico conectado ' +
  'a CVVHD/CVVHDF puede requerir varios gramos diarios, porque el filtro elimina ' +
  'meropenem. Tratarlo como «CrCl < 10» lo infradosifica gravemente.'

export const RESISTENCIA_NO_SE_VENCE_CON_DOSIS =
  'No se «vence» una resistencia verdadera subiendo la dosis: la susceptibilidad ' +
  'y el mecanismo de resistencia siguen mandando.'

export const PREPARACION_ES_DEL_HOSPITAL =
  'La preparación y la estabilidad de la solución para infusión continua las fija ' +
  'el protocolo de farmacia del hospital. NO se asume que una bolsa aguante 24 h a ' +
  'temperatura ambiente en cualquier concentración.';

/** Filas de la tabla renal del Dr. De mayor a menor aclaramiento. */
const TABLA_RENAL: readonly { min: number; max: number; e: EsquemaMeropenem }[] = [
  {
    min: 50, max: Infinity,
    e: {
      convencional: '1 g IV c/8 h', altaExposicion: '2 g IV c/8 h',
      infusion: 'En UCI / sepsis grave, infusión de 3 h.',
      fuente: 'Tabla del Dr. (2026-07-30), fila CrCl > 50',
    },
  },
  {
    min: 26, max: 50,
    e: {
      convencional: '1 g IV c/12 h', altaExposicion: '2 g IV c/12 h',
      infusion: 'Infusión prolongada si la gravedad lo amerita.',
      fuente: 'Tabla del Dr., fila CrCl 26–50',
    },
  },
  {
    min: 10, max: 25,
    e: {
      convencional: '500 mg IV c/12 h', altaExposicion: '1 g IV c/12 h',
      infusion: 'Infusión prolongada si la gravedad lo amerita.',
      fuente: 'Tabla del Dr., fila CrCl 10–25',
    },
  },
  {
    min: 0, max: 10,
    e: {
      convencional: '500 mg IV c/24 h', altaExposicion: '1 g IV c/24 h',
      infusion: 'Infusión prolongada si la gravedad lo amerita.',
      fuente: 'Tabla del Dr., fila CrCl < 10',
    },
  },
]

const POR_MODALIDAD: Partial<Record<ModalidadRenal, EsquemaMeropenem>> = {
  ihd: {
    convencional: '500 mg IV c/24 h, administrar DESPUÉS de la sesión el día de HD',
    altaExposicion: 'En SNC / alta exposición: 1 g c/24 h, después de HD',
    infusion: 'Sincronizar con la sesión.',
    fuente: 'Tabla del Dr., fila hemodiálisis intermitente',
  },
  crrt: {
    convencional: '1 g IV c/8 h',
    altaExposicion: '1 g c/8 h en infusión de 3 h; escenarios seleccionados pueden requerir mayor exposición',
    infusion: 'Infusión de 3 h en infección grave. Alternativas con respaldo PK/PD: 2–4 g/24 h en infusión continua.',
    fuente: 'Tabla del Dr., fila CRRT/CVVHD',
  },
  pirrt: {
    convencional: 'Requerimiento aproximado de 2–3 g/día, según duración y si es diaria o en días alternos',
    altaExposicion: 'PIRRT diaria de mayor duración puede requerir 750 mg c/8 h o 1 g c/8 h',
    infusion: 'Debe sincronizarse con la sesión.',
    fuente: 'Sección 5 del Dr. (datos PIRRT 2026)',
  },
}

/**
 * Propone el esquema del escenario. **No elige columna.**
 *
 * Devuelve `esquema: null` cuando falta el dato que decide la fila: proponer una
 * dosis sin saber la modalidad de reemplazo es exactamente el error grave que el
 * Dr. señaló.
 */
export function esquemaMeropenem(e: EscenarioMeropenem): ResultadoDosis {
  const faltan: string[] = []
  const avisos: string[] = []
  const criterios = [...(e.criterios ?? [])]

  // ARC se DETECTA del CrCl, pero sólo si el CrCl consta.
  if (typeof e.crCl === 'number' && Number.isFinite(e.crCl)
    && e.crCl >= ARC_UMBRAL_CRCL && !criterios.includes('arc')) {
    criterios.push('arc')
  }

  const modalidad = e.modalidad
  if (modalidad === undefined) {
    faltan.push('modalidad de reemplazo renal (ninguna / IHD / CRRT / PIRRT)')
  }

  let esquema: EsquemaMeropenem | null = null

  if (modalidad !== undefined && modalidad !== 'ninguna') {
    esquema = POR_MODALIDAD[modalidad] ?? null
    if (modalidad === 'crrt') {
      avisos.push(CRRT_NO_ES_FALLA_RENAL)
      avisos.push('La dosis exacta en CRRT depende del flujo de efluente y del '
        + 'aclaramiento renal residual: no hay una dosis universal.')
    }
    if (modalidad === 'pirrt') {
      avisos.push('PIRRT tampoco se maneja como «CrCl < 10».')
    }
  } else if (modalidad === 'ninguna') {
    if (typeof e.crCl !== 'number' || !Number.isFinite(e.crCl)) {
      faltan.push('aclaramiento de creatinina (CrCl)')
    } else {
      const fila = TABLA_RENAL.find(f => e.crCl! > f.min && e.crCl! <= f.max)
        ?? TABLA_RENAL.find(f => e.crCl! >= f.min && e.crCl! <= f.max)
      esquema = fila?.e ?? null
      if (criterios.includes('arc')) {
        avisos.push(`Con CrCl ≥ ${ARC_UMBRAL_CRCL} mL/min el riesgo de concentraciones `
          + 'insuficientes aumenta claramente: no confiar en 1 g c/8 h en 30 min.')
      }
    }
  }

  if (e.mic === undefined || e.mic === null) {
    avisos.push('No consta la MIC. Con MIC ≤ 2 mg/L y con MIC 4–8 mg/L el Dr. '
      + 'describe requerimientos distintos de duración de infusión.')
  }
  if (e.tdm !== true) {
    avisos.push('Sin TDM no se puede individualizar después: el esquema queda como '
      + 'punto de partida.')
  }
  avisos.push(RESISTENCIA_NO_SE_VENCE_CON_DOSIS)

  return {
    esquema, faltan,
    criteriosPresentes: criterios,
    avisos,
    eligeElMedico: true,
  }
}

/**
 * Fármacos que la aplicación **no sabe** dosificar en el crítico.
 *
 * El Dr. entregó el algoritmo del meropenem. Los demás **no se infieren de él**:
 * cada uno tiene su farmacocinética, su aclaramiento por filtro y su objetivo
 * PK/PD. Copiar la lógica del meropenem a la vancomicina sería inventar una
 * pauta.
 *
 * Esta lista existe para que la pantalla DIGA que no sabe, en vez de callarse.
 */
export const FARMACOS_SIN_ALGORITMO: readonly string[] = [
  'vancomicina', 'piperacilina/tazobactam', 'cefepime', 'ceftazidima/avibactam',
  'linezolid', 'daptomicina', 'amikacina', 'gentamicina', 'colistina',
  'fluconazol', 'voriconazol', 'caspofungina', 'aciclovir',
]

export const SIN_ALGORITMO =
  'La aplicación NO tiene el algoritmo de dosificación crítica de este fármaco. ' +
  'Sólo está cargado el de meropenem, que el médico entregó. NO se deduce de él: ' +
  'cada fármaco tiene su farmacocinética, su aclaramiento por filtro y su objetivo ' +
  'PK/PD, y copiar la pauta de uno a otro sería inventarla.'

/** ¿Hay algoritmo cargado para este fármaco? */
export function tieneAlgoritmo(farmaco: string): boolean {
  return farmaco.trim().toLowerCase() === 'meropenem'
}
