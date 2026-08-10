/**
 * NEXUSMED ANTIMICROBIAL INTELLIGENCE ENGINE V4 — el vocabulario.
 *
 * ── EL ERROR CONCEPTUAL QUE ESTE ARCHIVO ELIMINA ─────────────────────────────
 *
 * `if (dose > drug.maxDose)`.
 *
 * Un antibiótico no tiene «una dosis máxima». Tiene máximos distintos según la
 * indicación, el sitio, el microorganismo, la CMI, la función renal, el peso, la
 * estrategia PK/PD y la formulación. Un solo número obliga a elegir uno, y
 * cualquiera que se elija está mal en algún escenario real:
 *
 *   · ceftriaxona 2 g q12h en meningitis — correcta, y el doble del «máximo»
 *     que uno pondría pensando en una neumonía.
 *   · daptomicina 10 mg/kg/día — dosis alta respaldada, no sobredosis.
 *   · meropenem 2 g q8h en 3 h con aclaramiento aumentado — optimización PK/PD.
 *
 * Con un `maxDose` los tres salen marcados como error, el médico aprende a
 * ignorar la alarma, y el día que la alarma tenga razón tampoco la va a leer.
 * Una alerta que se equivoca en los casos que un intensivista ve a diario no es
 * una red de seguridad: es ruido con aspecto de red de seguridad.
 *
 * ── DE DÓNDE SALEN LOS DATOS ─────────────────────────────────────────────────
 *
 * De `Ausculta_Antibacterial_Dosing_V3_EVIDENCE_VERIFIED.json` (49 fármacos, 39
 * fuentes, verificado contra FDA/DailyMed, IDSA 2026, CLSI M100 Ed36 y EUCAST
 * v16.1). **Este archivo no inventa ni una cifra**: define la forma, no el
 * contenido. Lo que el dataset no diga sale como `UNKNOWN_INSUFFICIENT_DATA`.
 *
 * Módulo PURO, sólo tipos y constantes.
 */

/* ════════════════════════════════════════════════════════════════════════
   Contexto del paciente — objetos estructurados, no cadenas sueltas
   ════════════════════════════════════════════════════════════════════════ */

/** Con qué se estimó la función renal. RULE_RENAL_ESTIMATOR: no se sustituye en silencio. */
export type MetodoRenal = 'cockcroft-gault' | 'ckd-epi' | 'mdrd' | 'medido' | 'desconocido'

export interface FuncionRenal {
  /** Creatinina sérica, mg/dL. */
  scr?: number
  /** Aclaramiento de creatinina, mL/min. */
  crcl?: number
  /** Método con el que se calculó el CrCl. */
  crclMetodo?: MetodoRenal
  /** Filtrado estimado, mL/min/1.73 m². */
  egfr?: number
  egfrMetodo?: MetodoRenal
  /** Diuresis, mL/kg/h. */
  uresis?: number
  /** Estadio KDIGO de lesión renal aguda. */
  akiEstadio?: 0 | 1 | 2 | 3
  /**
   * Hacia dónde va la función renal.
   *
   * RULE_UNSTABLE_AKI: con la función renal cambiando rápido, **no** se mantiene
   * una dosis calculada sobre un CrCl único de estado estable. Un CrCl de hace
   * doce horas en un paciente que se está deteriorando describe a un paciente
   * que ya no existe.
   */
  trayectoria?: 'estable' | 'mejorando' | 'deteriorando' | 'desconocida'
  /** Aclaramiento aumentado. RULE_ARC: umbral común ≥130 mL/min, pero es por fármaco. */
  aclaramientoAumentado?: boolean
}

export type ModalidadTRR = 'IHD' | 'SLED' | 'PIRRT' | 'CVVH' | 'CVVHD' | 'CVVHDF' | 'PD'

/**
 * Terapia de reemplazo renal.
 *
 * RULE_CRRT_NO_GENERIC: **la pauta de CrCl <10 no sirve de sustituto para
 * CRRT.** Un anúrico en CVVHDF a 35 mL/kg/h puede necesitar una exposición
 * completamente distinta a la de alguien con CrCl 8 sin diálisis, y tratarlos
 * igual infradosifica al que está en la técnica más intensa — justo el enfermo
 * más grave.
 */
export interface TerapiaReemplazoRenal {
  activa: boolean
  modalidad?: ModalidadTRR
  /** Efluente efectivo, mL/h. */
  efluente?: number
  dializado?: number
  reposicion?: number
  /** Predilución diluye el efluente efectivo: no es un detalle. */
  dilucion?: 'pre' | 'post' | 'mixta'
  /** Función renal residual, mL/min. */
  funcionRenalResidual?: number
  /** Horas de parada del circuito en 24 h. Un circuito coagulado no depura. */
  horasSinTratamiento?: number
}

export type EstandarAST = 'CLSI' | 'EUCAST'

/**
 * Microbiología.
 *
 * RULE_AST_VERSION: el estándar y su versión van juntos y **no se mezclan**.
 * RULE_MIC_CONTEXT: elegir dosis no es interpretar sensibilidad.
 */
export interface Microbiologia {
  organismo?: string
  /** CMI en mg/L. */
  cmi?: number
  /** El operador importa: «>2» no es 2. */
  cmiOperador?: '=' | '<=' | '>=' | '<' | '>'
  cmiMetodo?: 'microdilucion' | 'gradiente' | 'automatizado' | 'difusion' | 'desconocido'
  estandarAST?: EstandarAST
  /** «M100 Ed36 2026», «v16.1 2026». */
  versionAST?: string
  fenotipo?: string
  mecanismosResistencia?: readonly string[]
}

/** Escalar de peso. RULE_WEIGHT: se exige el documentado y el del fármaco. */
export type EscalarPeso = 'TBW' | 'IBW' | 'AdjBW' | 'LBW'

export interface Paciente {
  edadAnios?: number
  /** Peso en KILOGRAMOS. RULE_WEIGHT bloquea libras interpretadas como kilos. */
  pesoKg?: number
  tallaCm?: number
  sexo?: 'M' | 'F' | 'otro'
  renal?: FuncionRenal
  trr?: TerapiaReemplazoRenal
  /** Child-Pugh. */
  hepatica?: { childPugh?: 'A' | 'B' | 'C'; bilirrubina?: number; inr?: number }
  /** ECMO cambia el volumen de distribución y puede secuestrar fármaco. */
  ecmo?: { activo: boolean; modo?: 'VV' | 'VA' }
  criticamenteEnfermo?: boolean
  sepsisOChoque?: boolean
}

/* ════════════════════════════════════════════════════════════════════════
   La petición — todo lo que hace falta para resolver
   ════════════════════════════════════════════════════════════════════════ */

export type Via = 'IV' | 'PO' | 'IM' | 'inhalada' | 'intratecal' | 'topica'

export type EstrategiaPKPD =
  | 'estandar'
  | 'infusion_extendida'
  | 'infusion_continua'
  | 'dosis_alta'
  | 'guiada_por_tdm'

export interface PeticionDosis {
  /** Nombre del fármaco tal como aparece en el dataset verificado. */
  farmaco: string
  via?: Via
  /** IR, XR, sal concreta. Nitrofurantoína y amoxi/clav no son intercambiables entre formulaciones. */
  formulacion?: string
  indicacion?: string
  sitioInfeccion?: string
  microbiologia?: Microbiologia
  paciente?: Paciente
  estrategia?: EstrategiaPKPD
  /** Gravedad declarada por el médico, no inferida. */
  gravedad?: 'leve' | 'moderada' | 'grave'
}

/* ════════════════════════════════════════════════════════════════════════
   Los máximos — cuatro conceptos distintos, no un número
   ════════════════════════════════════════════════════════════════════════ */

/**
 * De dónde sale el máximo. Es lo que decide si una dosis por encima se puede
 * razonar o hay que pararla.
 */
export type TipoMaximo =
  /** La ficha o la guía dice un número explícito. */
  | 'EXPLICIT'
  /** El máximo depende del contexto (indicación, sitio, organismo). */
  | 'CONTEXTUAL'
  /** Lo fija el objetivo PK/PD, no una tabla. */
  | 'PKPD_DEPENDENT'
  /** Lo fija la concentración medida. */
  | 'TDM_DEPENDENT'
  /** No hay máximo declarado en la evidencia disponible. */
  | 'NONE'

export interface LimitesDosis {
  /** Lo habitual. Por encima se AVISA, no se bloquea. */
  usualMaxPorDosis?: number
  usualMaxPorDia?: number
  /** El máximo en ESTE contexto (meningitis, AMR grave, ARC…). */
  contextualMaxPorDosis?: number
  contextualMaxPorDia?: number
  /** El techo duro. Por encima se BLOQUEA. */
  absolutoMaxPorDosis?: number
  absolutoMaxPorDia?: number
  /** Para combinaciones: el tope del componente que lo tiene. */
  maxComponente?: { componente: string; maxPorDosis?: number; maxPorDia?: number }
  tipoMaximo: TipoMaximo
  unidad?: string
}

/* ════════════════════════════════════════════════════════════════════════
   Las cuatro dosis — no se sobrescriben
   ════════════════════════════════════════════════════════════════════════ */

export interface Pauta {
  /** El texto verificado, tal cual viene del dataset. No se reescribe. */
  texto: string
  dosis?: number
  unidad?: string
  intervaloHoras?: number
  duracionInfusionHoras?: number
  /** IDs del registro de fuentes. Sin fuente no hay pauta. */
  fuentes: readonly string[]
}

/**
 * Las cuatro capas de dosis, separadas por RULE_SOURCE_SEPARATION.
 *
 * **No se fusionan nunca.** Ceftazidima/avibactam es 2.5 g q8h en infusión de
 * 2 h por ficha y de 3 h por IDSA para AMR grave: las dos son conocidas y
 * distintas. Mostrar una sola escondería que existe la otra, y el médico que
 * necesita la de IDSA no sabría que su app la conoce.
 */
export interface ReglaDosis {
  label?: Pauta
  guideline?: Pauta
  pkpdOptimizada?: Pauta
  offLabelRespaldada?: Pauta
}

/* ════════════════════════════════════════════════════════════════════════
   Veredicto del Safety Kernel
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Los ocho estados. La diferencia entre «alto» y «prohibido» es lo que hace que
 * la alerta se siga leyendo.
 */
export type EstadoSeguridad =
  | 'VALID_STANDARD'
  | 'VALID_HIGH_DOSE'
  | 'VALID_PKPD_OPTIMIZED'
  | 'VALID_OFF_LABEL_SUPPORTED'
  | 'WARN_ABOVE_USUAL'
  | 'BLOCK_CONTEXTUAL_MAX'
  | 'UNKNOWN_INSUFFICIENT_DATA'
  | 'SPECIALIST_REVIEW'

export const ESTADOS_QUE_DEJAN_PASAR: readonly EstadoSeguridad[] = [
  'VALID_STANDARD', 'VALID_HIGH_DOSE', 'VALID_PKPD_OPTIMIZED', 'VALID_OFF_LABEL_SUPPORTED',
]

/** Nivel de la alerta. INFO informa, WARN avisa, BLOCK detiene. */
export type NivelAlerta = 'INFO' | 'WARN' | 'BLOCK'

export interface Alerta {
  nivel: NivelAlerta
  codigo: string
  /** Qué pasa, en una frase que un intensivista pueda accionar. */
  mensaje: string
  /** Qué regla del dataset lo exige. */
  regla?: string
}

export interface Veredicto {
  estado: EstadoSeguridad
  alertas: readonly Alerta[]
  /** Qué dato falta para poder resolver. Vacío si no falta ninguno. */
  datosFaltantes: readonly string[]
  /** IDs de las fuentes que sostienen la respuesta. */
  fuentes: readonly string[]
  /** Nivel de verificación del fármaco en el dataset (A1, B, …). */
  nivelVerificacion?: string
}

export const POR_QUE_NO_HAY_MAXDOSE =
  'Un antibiótico no tiene «una dosis máxima»: tiene máximos distintos según ' +
  'indicación, sitio, organismo, CMI, función renal, peso, estrategia PK/PD y ' +
  'formulación. Un solo número marca como error la ceftriaxona 2 g q12h de una ' +
  'meningitis, la daptomicina a 10 mg/kg y el meropenem en infusión extendida ' +
  'con aclaramiento aumentado — tres cosas que un intensivista hace cada semana. ' +
  'Una alerta que se equivoca en lo cotidiano enseña a ignorarla, y el día que ' +
  'tenga razón tampoco se va a leer.'
