/**
 * Motor de interpretación inteligente de antibiogramas — TIPOS.
 *
 * Filosofía (el foso): «la IA EXTRAE, el motor RAZONA».
 *   Un LLM de visión lee la placa/reporte y devuelve pares {antibiótico, S/I/R, CMI}.
 *   ESTE motor —100% determinista, versionado y con test— infiere el MECANISMO
 *   (β-lactamasas, porinas, bombas de expulsión, carbapenemasas), lo explica de
 *   forma didáctica y propone terapia dirigida. No hay alucinación posible: son
 *   reglas de libro, cada una citada a su fuente.
 *
 * FUENTES PRIMARIAS (leídas de principio a fin, ver antibiograma/referencias):
 *   [G+]  Torres C, Cercenado E. Lectura interpretada del antibiograma de cocos
 *         gram positivos. Enferm Infecc Microbiol Clin. 2010;28(8):541-553.
 *   [EB]  Navarro F, Miró E, Mirelis B. Lectura interpretada del antibiograma de
 *         enterobacterias. Enferm Infecc Microbiol Clin. 2010;28(9):638-645.
 *   [NF]  Vila J, Marco F. Lectura interpretada del antibiograma de bacilos
 *         gramnegativos no fermentadores. Enferm Infecc Microbiol Clin. 2010;28(10):726-736.
 *   [BLI] Bush K, Bradford PA. Interplay between β-lactamases and new β-lactamase
 *         inhibitors. Nat Rev Microbiol. 2019;17:295-306.
 *   [CLSI] CLSI M100 (edición vigente) — puntos de corte S/I/R aplicados por el
 *          laboratorio y notificación de fenotipos; NOM-045-SSA2-2005 (México).
 *
 * ⚠️ APOYO DECISIONAL. No sustituye al infectólogo ni a la confirmación de
 *    mecanismo (clase de carbapenemasa por método fenotípico/molecular).
 *    Pendiente de validación clínica antes de conducir prescripción en producción.
 */

export type SIR = 'S' | 'I' | 'R'

export interface ResultadoAntibiograma {
  antibiotico: string
  interpretacion: SIR
  /** CMI en mg/L (µg/mL) si se reportó. */
  cmi?: number
}

export interface EntradaAntibiograma {
  organismo: string
  resultados: ResultadoAntibiograma[]
  /** Contexto opcional que afina las recomendaciones (no altera la inferencia de mecanismo). */
  sitio?: SitioInfeccion
}

export type SitioInfeccion =
  | 'orina' | 'sangre' | 'respiratorio' | 'snc' | 'piel-partes-blandas'
  | 'intraabdominal' | 'hueso-articulacion' | 'otro'

export type FenotipoClave =
  | 'MRSA' | 'BORSA' | 'VISA' | 'MLSb-inducible' | 'MLSb-constitutivo'
  | 'penicilinasa-estafilococica' | 'HLAR' | 'VRE' | 'ampicilina-R-enterococo'
  | 'neumococo-PNS' | 'carbapenemasa' | 'BLEE' | 'AmpC' | 'IRT'
  | 'porina-perdida' | 'bomba-expulsion' | 'FQ-R' | 'colistin-R'
  | 'S-maltophilia-intrinseca' | 'MDR' | 'XDR'

/** Nivel de confianza de la inferencia. */
export type Confianza = 'confirmado' | 'probable' | 'sospecha'

export interface FenotipoDetectado {
  clave: FenotipoClave
  nombre: string
  confianza: Confianza
  /** Evidencia fenotípica que lo sustenta + cita de la fuente. */
  base: string
}

/** Inferencia de mecanismo molecular a partir del patrón (β-lactamasa, porina, bomba…). */
export interface MecanismoInferido {
  categoria: 'β-lactamasa' | 'porina' | 'bomba de expulsión' | 'diana' | 'enzima modificadora' | 'permeabilidad'
  nombre: string
  /** Clase de Ambler (A/B/C/D) cuando aplica. */
  ambler?: 'A' | 'B' | 'C' | 'D'
  confianza: Confianza
  explicacion: string
  referencia: string
}

export interface AlertaAntibiograma {
  nivel: 'critica' | 'alta' | 'info'
  mensaje: string
}

/** Conflicto/nota de resistencia intrínseca (una «S» reportada que es biológicamente imposible → error de lab). */
export interface NotaIntrinseca {
  tipo: 'conflicto' | 'esperado'
  antibiotico: string
  mensaje: string
  referencia: string
}

/** Opción terapéutica dirigida por el mecanismo inferido (no una simple lista de «S»). */
export interface OpcionTerapeutica {
  linea: 'dirigida' | 'alternativa' | 'evitar'
  agente: string
  razon: string
  referencia: string
}

/** Bloque de enseñanza: por qué el patrón significa lo que significa. */
export interface BloqueDidactico {
  titulo: string
  texto: string
  referencia: string
}

/** Aporte parcial de un módulo de órgano-específico; el motor los fusiona. */
export interface AporteModulo {
  fenotipos: FenotipoDetectado[]
  mecanismos: MecanismoInferido[]
  alertas: AlertaAntibiograma[]
  advertencias: string[]
  didactica: BloqueDidactico[]
  terapiaDirigida: OpcionTerapeutica[]
  optimizacionPKPD: string[]
  notificacion: boolean
  aislamiento: string | null
}

export function aporteVacio(): AporteModulo {
  return {
    fenotipos: [], mecanismos: [], alertas: [], advertencias: [],
    didactica: [], terapiaDirigida: [], optimizacionPKPD: [],
    notificacion: false, aislamiento: null,
  }
}

export interface InterpretacionAntibiograma {
  organismo: string
  /** Especie/grupo reconocido tras normalizar (o el texto original si no se reconoció). */
  organismoNormalizado?: string
  fenotipos: FenotipoDetectado[]
  /** Inferencia de mecanismo(s) molecular(es). */
  mecanismos: MecanismoInferido[]
  alertas: AlertaAntibiograma[]
  /** NOM-045: fenotipo de notificación epidemiológica obligatoria. */
  notificacionObligatoria: boolean
  /** Precaución de aislamiento sugerida (o null). */
  aislamiento: string | null
  /** Sugerencias PK/PD deterministas por clase presente y sensible. */
  optimizacionPKPD: string[]
  /** Caveats de stewardship que contradicen el S/I/R «literal». */
  advertencias: string[]
  /** Resistencia intrínseca esperada + conflictos con el reporte. */
  resistenciaIntrinseca: NotaIntrinseca[]
  /** Terapia dirigida por mecanismo. */
  terapiaDirigida: OpcionTerapeutica[]
  /** Explicación didáctica del razonamiento. */
  didactica: BloqueDidactico[]
  /** Fuentes citadas en esta interpretación. */
  referencias: string[]
}
