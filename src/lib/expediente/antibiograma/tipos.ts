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
  /**
   * La CMI venía censurada en el reporte: «>16», «≤0.25».
   *
   * Importa porque `>500` no es lo mismo que `500`: el laboratorio está diciendo
   * que el valor real está POR ENCIMA del rango probado. Al descartar el símbolo,
   * un tamiz de gentamicina de alto nivel reportado «>500» se comparaba contra un
   * umbral estricto `> 500` y daba falso, apagando el HLAR.
   */
  cmiCensurada?: '>' | '<'
}

/** Resultado de una prueba confirmatoria (como la reportan los sistemas automatizados). */
export type ResultadoPrueba = 'pos' | 'neg'

/** Pruebas confirmatorias/fenotípicas que traen los reportes automatizados (Vitek/Phoenix/MicroScan)
 *  o el laboratorio manual. Cuando se capturan, CONFIRMAN el fenotipo (mayor confianza que inferirlo del S/I/R). */
export interface PruebasConfirmatorias {
  /** Tamiz de cefoxitina/oxacilina (detección de MRSA / mecA). */
  cefoxitinaScreen?: ResultadoPrueba
  /** D-test / D-zone: resistencia INDUCIBLE a clindamicina (MLSb inducible). */
  dTest?: ResultadoPrueba
  /** Confirmación de BLEE (sinergia con clavulanato). */
  esbl?: ResultadoPrueba
  /** Carbapenemasa (mCIM/eCIM, Carba NP o molecular). */
  carbapenemasa?: ResultadoPrueba
  /** Clase de carbapenemasa si se determinó (molecular/eCIM). */
  claseCarbapenemasa?: 'KPC' | 'OXA-48' | 'NDM' | 'VIM' | 'IMP' | 'MBL' | 'indeterminada'
  /** β-lactamasa por nitrocefina (estafilococo/enterococo/Haemophilus/gonococo). */
  betaLactamasa?: ResultadoPrueba
  /** Resistencia de ALTO nivel a aminoglucósidos (enterococo, screen gentamicina/estreptomicina). */
  hlar?: ResultadoPrueba
}

export interface EntradaAntibiograma {
  organismo: string
  resultados: ResultadoAntibiograma[]
  /** Contexto opcional que afina las recomendaciones (no altera la inferencia de mecanismo). */
  sitio?: SitioInfeccion
  /** Resultados de pruebas confirmatorias capturados del reporte (opcional). */
  pruebas?: PruebasConfirmatorias
}

export type SitioInfeccion =
  | 'orina' | 'sangre' | 'respiratorio' | 'snc' | 'piel-partes-blandas'
  | 'intraabdominal' | 'hueso-articulacion' | 'otro'

export type FenotipoClave =
  | 'MRSA' | 'BORSA' | 'VISA' | 'hVISA' | 'VRSA' | 'MLSb-inducible' | 'MLSb-constitutivo'
  | 'penicilinasa-estafilococica' | 'HLAR' | 'VRE' | 'ampicilina-R-enterococo'
  | 'neumococo-PNS' | 'carbapenemasa' | 'BLEE' | 'AmpC' | 'IRT'
  | 'porina-perdida' | 'bomba-expulsion' | 'FQ-R' | 'colistin-R'
  | 'S-maltophilia-intrinseca' | 'MDR' | 'XDR' | 'PDR'
  | '16S-RMTasa' | 'AME' | 'DTR' | 'linezolid-R' | 'daptomicina-R' | 'tigeciclina-R'

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
  /**
   * 'conflicto'      = «S» biológicamente imposible → sospechar error de ID/AST.
   * 'esperado'       = R intrínseca ya reportada como R (informativo).
   * 'alerta_clinica' = fenómeno CONOCIDO (no un error): la «S» in vitro no predice
   *                    eficacia clínica (p. ej. TMP-SMX en Enterococcus). No se debe
   *                    reportar como susceptible utilizable ni como error de especie.
   */
  tipo: 'conflicto' | 'esperado' | 'alerta_clinica'
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

/** Edición interpretativa: un fármaco reportado «S» que debe leerse R por inferencia (EUCAST T13). */
export interface EdicionInterpretativa {
  antibiotico: string
  de: 'S'
  a: 'R'
  razon: string
  referencia: string
}

/** Categoría S/SDD/I/R derivada de una CMI con los puntos de corte del CLSI M100.
 *  SDD = susceptible dosis-dependiente (requiere el esquema de dosis alto). */
export interface CategoriaCMI {
  antibiotico: string
  cmi: number
  categoriaCLSI: 'S' | 'SDD' | 'I' | 'R'
  /** Categoría que reportó el laboratorio (si se capturó). */
  categoriaReportada?: SIR
  /** true concuerda, false discrepa, null no reportada. */
  concuerda: boolean | null
  /** El punto de corte aplica solo a IVU no complicada. */
  soloUTI: boolean
  /** true si el corte NO aplica a este caso (foco no urinario o especie sin breakpoint válido). */
  noAplicable?: boolean
  motivoNoAplicable?: string
  referencia: string
}

/** Paso del ALGORITMO de diagnóstico de resistencia (árbol de decisión del caso). */
export interface PasoAlgoritmo {
  n: number
  titulo: string
  detalle: string
  /** hecho = el dato ya está; pendiente = falta hacerlo; na = no aplica a este caso. */
  estado: 'hecho' | 'pendiente' | 'na'
}

/** Prueba microbiológica confirmatoria/fenotípica del CLSI M100 (cuándo, método, interpretación). */
export interface PruebaCLSI {
  id: string
  nombre: string
  cuando: string
  organismos: string
  metodo: string
  interpretacion: string
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
  /** Ediciones interpretativas (EUCAST): «S» que debe leerse R por inferencia. */
  edicionesInterpretativas: EdicionInterpretativa[]
  /** Pruebas microbiológicas del CLSI recomendadas según el fenotipo (cuándo/método/interpretación). */
  pruebasSugeridas: PruebaCLSI[]
  /** Algoritmo de diagnóstico de resistencia: el árbol de decisión de ESTE caso, paso a paso. */
  algoritmo: PasoAlgoritmo[]
  /** Categorías S/I/R derivadas de las CMI capturadas con los puntos de corte del CLSI M100. */
  categoriasCMI: CategoriaCMI[]
  /** Fuentes citadas en esta interpretación. */
  referencias: string[]
}
