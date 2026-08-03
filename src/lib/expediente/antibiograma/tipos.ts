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

import type { ProcedenciaAntibiograma } from './procedencia'

export type SIR = 'S' | 'I' | 'R'

/**
 * LO QUE PUEDE VENIR EN UNA CELDA DEL PANEL — incluido SDD.
 *
 * ── DECISIÓN 2 DEL DR. (3-ago-2026) ──────────────────────────────────────────
 *
 * CLSI define **SDD** (susceptible dosis-dependiente) como una categoría PROPIA,
 * distinta de S y de I: la probabilidad de eficacia depende de emplear mayor
 * exposición —dosis mayor, mayor frecuencia o infusión prolongada—. CLSI
 * recomienda transmitirla explícitamente como `SDD` o, cuando el sistema sólo
 * admite un carácter, como `D`.
 *
 *     categoria_original            = SDD
 *     utilizable                    = sí, condicional
 *     requiere_exposicion_aumentada = sí
 *     equivalente_a_S               = no
 *     equivalente_a_I               = no
 *
 * Hasta ahora el panel trabajaba SÓLO en S/I/R, así que un SDD reportado por el
 * laboratorio se quedaba fuera y se nombraba en un aviso. Eso desperdiciaba
 * información clínicamente relevante — palabras del Dr.
 *
 * `SIR` se conserva tal cual para todo lo que de verdad son tres categorías (la
 * salida de un punto de corte, por ejemplo). Lo que se amplía es lo que puede
 * REPORTAR un laboratorio.
 *
 * Ver `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`, decisión 2.
 */
export type CategoriaPanel = SIR | 'SDD'

export interface ResultadoAntibiograma {
  antibiotico: string
  /**
   * La categoría con la que razona el motor. Puede ser `SDD`: NO se convierte a
   * S ni a I, porque el Dr. lo prohibió explícitamente (decisión 2).
   */
  interpretacion: CategoriaPanel
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
  /**
   * ═══ INTERPRETACIÓN EFECTIVA (E0-15a) ═══
   * Cuando una regla experta EUCAST edita la categoría (p. ej. fluoroquinolonas
   * S→R por resistencia cruzada inferida), `interpretacion` pasa a ser la
   * **interpretación clínica canónica** y el dato del laboratorio se conserva
   * aquí. Nunca se destruye el original.
   *
   * Decisión del médico dueño: «nunca debe existir una pantalla donde Nexus
   * muestre R y el LLM continúe razonando con S. Eso es un defecto P0.»
   */
  interpretacionLab?: SIR
  /** Por qué se editó (regla experta) y su fuente/versión. */
  edicionRazon?: string
  edicionReferencia?: string
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
  /**
   * De dónde salieron las categorías del laboratorio: estándar, edición, método,
   * unidad. Decide si el motor puede EDITAR una categoría discordante o sólo
   * advertirla (decisión 3 del Dr.). Sin ella, no edita.
   */
  procedencia?: ProcedenciaAntibiograma
}

export type SitioInfeccion =
  | 'orina' | 'sangre' | 'respiratorio' | 'snc' | 'piel-partes-blandas'
  | 'intraabdominal' | 'hueso-articulacion' | 'otro'

export type FenotipoClave =
  | 'MRSA' | 'BORSA' | 'VISA' | 'hVISA' | 'VRSA' | 'MLSb-inducible' | 'MLSb-constitutivo'
  | 'penicilinasa-estafilococica' | 'HLAR' | 'VRE' | 'ampicilina-R-enterococo'
  | 'neumococo-PNS' | 'carbapenemasa' | 'carbapenemasa-indeterminada' | 'BLEE' | 'AmpC' | 'IRT'
  | 'porina-perdida' | 'bomba-expulsion' | 'FQ-R' | 'colistin-R'
  | 'S-maltophilia-intrinseca' | 'MDR' | 'XDR' | 'PDR'
  /**
   * NO es MDR, y ésa es toda la razón de que exista una clave aparte.
   *
   * Decisión del Dr. (3-ago-2026, decisión 1): M100-Ed35 usa las siglas MDRO en
   * las tablas de estafilococo y enterococo, pero **no establece una regla
   * universal** del tipo «no susceptible en tres clases» para declarar MDR. Un
   * conteo genérico no puede convertirse en una categoría formal.
   *
   * Se conserva la SEÑAL —resistencia adquirida extensa— y se le quita la
   * ETIQUETA que no le corresponde.
   */
  | 'resistencia-adquirida-extensa'
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
  /**
   * S/I/R cualquiera. Nació como `'S' → 'R'` porque sólo existía la
   * cross-resistencia EUCAST; la edición por punto de corte (decisión 3 del Dr.)
   * puede ir en cualquier dirección — un laboratorio que reporta R donde el
   * corte da S es igual de discordante— y el Dr. descartó explícitamente
   * corregir sólo hacia lo más restrictivo.
   */
  de: SIR
  a: SIR
  razon: string
  referencia: string
}

/** Categoría S/SDD/I/R derivada de una CMI con los puntos de corte del CLSI M100.
 *  SDD = susceptible dosis-dependiente (requiere el esquema de dosis alto). */
export interface CategoriaCMI {
  antibiotico: string
  cmi: number
  /**
   * Operador con el que el laboratorio reportó la CMI (E0-15c). «>2» significa
   * que el valor real está en (2, +∞): sin él, una CMI censurada se leía como el
   * número pelado y podía producir un falso «susceptible».
   */
  cmiCensurada?: '>' | '<'
  categoriaCLSI: 'S' | 'SDD' | 'I' | 'R'
  /** Categoría que reportó el laboratorio (si se capturó). `undefined` si fue SDD. */
  categoriaReportada?: SIR
  /**
   * El laboratorio reportó **SDD** para este fármaco.
   *
   * Va aparte y no dentro de `categoriaReportada` porque SDD no es comparable
   * con el punto de corte: no es S ni I ni R. Decisión 2 del Dr.: utilizable
   * SÓLO con exposición aumentada, y nunca almacenado como S.
   */
  reportadoSDD?: boolean
  /**
   * ═══ DECISIÓN 3 DEL DR.: PROCEDENCIA DEL PUNTO DE CORTE ═══
   *
   * `true` cuando los OCHO campos que el Dr. enumeró están verificados y el
   * motor por tanto SUSTITUYÓ la categoría del laboratorio por la del punto de
   * corte. El dato original nunca se destruye: viaja en `categoriaReportada`.
   */
  editadaPorPuntoDeCorte?: boolean
  /**
   * Hay discordancia y la procedencia NO está verificada: no se edita nada y
   * **las conclusiones que dependan de esta fila quedan bloqueadas** hasta
   * aclarar con qué estándar se interpretó.
   */
  bloqueaConclusiones?: boolean
  /** Qué falta para poder resolver la discordancia. Se enseña, no se calla. */
  faltaParaVerificar?: string[]
  /** true concuerda, false discrepa, null no reportada. */
  concuerda: boolean | null
  /** El punto de corte aplica solo a IVU no complicada. */
  soloUTI: boolean
  /** true si el corte NO aplica a este caso (foco no urinario o especie sin breakpoint válido). */
  noAplicable?: boolean
  motivoNoAplicable?: string
  /** La categoría no es S porque la CMI vino censurada con «>» (E0-15c). */
  desdeCmiCensurada?: boolean
  /**
   * ═══ LA EDICIÓN EXPERTA VIAJA HASTA AQUÍ ═══
   *
   * `categoriaCLSI` es un HECHO SOBRE LA CMI: 0.5 mg/L de levofloxacino es S en
   * la tabla del CLSI, y eso no se toca. Pero cuando una regla experta EUCAST ya
   * editó ese fármaco a R, esta fila —leída sola— dice «S» al lado de un panel
   * que dice «R», y quien la lee no tiene forma de saber cuál manda.
   *
   * Así se veía el prompt del modelo, con las TRES categorías del mismo fármaco:
   *
   *     Panel (canónico): Levofloxacino=R [EDITADO: el laboratorio reportó S]
   *     REGLA EXPERTA:    Levofloxacino S→R
   *     CMI→CLSI:         Levofloxacino 0.5=S          ← sin marca alguna
   *
   * La última línea es la que MÁS parece dato duro, y contradecía a las otras
   * dos. La decisión de qué manda ya estaba tomada (E0-15a: «usa SIEMPRE la
   * categoría editada»); lo que faltaba era traerla hasta esta fila.
   */
  interpretacionEfectiva?: SIR
  /** La categoría del panel la editó una regla experta, no el laboratorio. */
  editadaPorReglaExperta?: boolean
  edicionRazon?: string
  edicionReferencia?: string
  /**
   * El punto de corte da un fármaco utilizable y la interpretación canónica lo
   * descarta. No es un error: es el caso que hay que ENSEÑAR, porque es donde
   * alguien podría prescribir leyendo sólo la CMI.
   */
  conflictoConEdicion?: boolean
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
/**
 * Estado del mecanismo de carbapenemasa (E0-15b). Separa lo que está
 * DOCUMENTADO (resistencia observada) de lo que sería INFERIDO (la clase),
 * porque un antimicrobiano NO PROBADO no puede convertirse en resistente.
 */
export interface EstadoCarbapenemasa {
  /** La resistencia a carbapenémicos SÍ está en el reporte. */
  resistenciaSospechada: boolean
  /** ¿Confirmada por prueba fenotípica/molecular? */
  confirmada: boolean
  /** 'UNKNOWN' cuando el panel no permite inferirla. */
  clase: 'UNKNOWN' | string
}

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
  /** Solo cuando el mecanismo NO puede afirmarse con este panel (E0-15b). */
  carbapenemasa?: EstadoCarbapenemasa
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
  /**
   * Panel con las ediciones YA APLICADAS — la interpretación clínica CANÓNICA
   * (E0-15a). Toda salida (nota, prompt del LLM, validador, PK/PD, UI) debe
   * leer esto y no el panel crudo. El dato del laboratorio se conserva en
   * `interpretacionLab` de cada resultado.
   */
  resultadosEfectivos: ResultadoAntibiograma[]
  /**
   * Estado del mecanismo de carbapenemasa cuando el panel NO permite inferir la
   * clase (E0-15b): `clase: 'UNKNOWN'`. Ausente si no aplica.
   */
  carbapenemasa?: EstadoCarbapenemasa
  /** Pruebas microbiológicas del CLSI recomendadas según el fenotipo (cuándo/método/interpretación). */
  pruebasSugeridas: PruebaCLSI[]
  /**
   * Pruebas que NO se piden porque su resultado ya viene en el reporte capturado.
   *
   * Van aparte, y no simplemente filtradas, porque quitarlas de la lista y ya
   * está deja al médico sin saber si la prueba no aplicaba o si ya estaba hecha.
   * Lo que se recorta, se dice.
   */
  pruebasYaReportadas?: PruebaCLSI[]
  /** Algoritmo de diagnóstico de resistencia: el árbol de decisión de ESTE caso, paso a paso. */
  algoritmo: PasoAlgoritmo[]
  /** Categorías S/I/R derivadas de las CMI capturadas con los puntos de corte del CLSI M100. */
  categoriasCMI: CategoriaCMI[]
  /** Fuentes citadas en esta interpretación. */
  referencias: string[]
}
