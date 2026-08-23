/**
 * QUÉ SE LE PIDE AL MODELO, Y BAJO QUÉ EXIGENCIA — el contrato de entrada del router.
 *
 * #313 (control plane de costo/calidad). Este módulo NO decide nada: define la
 * forma de la pregunta. La respuesta la da `decidir.ts`.
 *
 * ── LA SEPARACIÓN QUE ORDENA TODO EL RIEL ────────────────────────────────────
 *
 * El router escoge un RECURSO DE CÓMPUTO. No escoge política clínica. Por eso
 * aquí no vive ni una sola frase como «sepsis = riesgo alto»: eso lo decide la
 * capa clínica (#303) y llega como METADATO. Si el router dedujera el riesgo
 * de un contenido clínico tendría que leerlo, y entonces sería un motor clínico
 * más — con otro dueño, otras pruebas y otra responsabilidad.
 *
 * El llamador declara: qué clase de tarea, con qué riesgo técnico, con qué
 * exigencia de calidad. El router responde: con qué modelo, o por qué con
 * ninguno.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ───────────────────────────────────────────────
 *
 * **Un presupuesto bajo NUNCA baja el piso de calidad.** El presupuesto puede
 * elegir entre candidatos que YA cumplen; no puede admitir a uno que no cumple.
 * Cuando no queda ninguno, el resultado es un fallo explícito — nunca el más
 * barato de los insuficientes. Está implementado en `pisoEfectivo()` y probado
 * al revés.
 *
 * Módulo PURO. Sin red, sin reloj escondido, sin PHI.
 */
import type { ResumenEvaluacion } from '@/lib/ia/evaluacion'

/* ════════════════════════════════════════════════════════════════════════
   A · CLASES DE TAREA
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Las ocho clases del contrato de #313, con sus identificadores LITERALES.
 *
 * Se conservan en inglés a propósito, aunque el resto del repositorio hable
 * español: son los nombres del contrato del dueño en el issue, y traducirlos
 * rompería la trazabilidad entre lo pedido y lo construido justo en la lista
 * que sirve para comprobar que están las ocho.
 *
 * No es un enum nuevo por gusto: se buscó primero. En el repositorio existían
 * dos vocabularios cercanos y **ninguno sirve para esto**:
 *
 *  · `feature` del libro de costos (`nota`, `verificar-nota`, `transcribir`…)
 *    nombra la RUTA que gastó, no la clase de trabajo. Hay veinte y crecen con
 *    cada pantalla. Se conserva y se PUENTEA aquí abajo, en `CLASE_POR_FEATURE`.
 *  · `ClaveMotor` de `planes-ia.ts` (`rapida`/`estandar`/`maxima`) nombra un
 *    NIVEL COMERCIAL que el médico elige y que enseña marcas de modelo. Es
 *    justo lo que #313 §K prohíbe, y además no dice qué trabajo se hace.
 */
export type ClaseTarea =
  /** Limpiar lo que oyó el reconocedor. No añade contenido clínico. */
  | 'transcription_cleanup'
  /** Sacar entidades y estructura de un texto ya dicho. */
  | 'extraction_structuring'
  /** Redactar la nota a partir de la verdad clínica ya extraída. */
  | 'note_rendering'
  /** Proponer códigos (CIE-10). Propuesta, nunca diagnóstico. */
  | 'coding_suggestion'
  /** Razonamiento clínico. Slice #303: el router no lo toca, sólo lo alimenta. */
  | 'clinical_reasoning'
  /** Síntesis de evidencia sobre material ya recuperado. */
  | 'evidence_synthesis'
  /** Revisión de seguridad de una salida ya generada. */
  | 'safety_review'
  /** Segunda opinión independiente sobre una salida previa. */
  | 'second_opinion'

export const CLASES_TAREA: readonly ClaseTarea[] = [
  'transcription_cleanup', 'extraction_structuring', 'note_rendering',
  'coding_suggestion', 'clinical_reasoning', 'evidence_synthesis',
  'safety_review', 'second_opinion',
]

/**
 * EL PUENTE CON LO QUE YA SE COBRA.
 *
 * El libro de costos lleva meses anotando por `feature`. Sin esta tabla, «costo
 * por clase de tarea» exigiría reetiquetar el histórico o inventar una segunda
 * contabilidad — y el issue pide explícitamente no construir un segundo libro.
 *
 * Se mapea sólo lo que EXISTE hoy en `src/app/api` y en `CADENA_CONSULTA`. Un
 * `feature` que no esté aquí devuelve `null`, no una clase por defecto: meterlo
 * en el cubo equivocado produce una cifra de costo por clase que parece completa
 * y está mal, que es peor que una cifra que declara su hueco.
 */
export const CLASE_POR_FEATURE: Readonly<Record<string, ClaseTarea>> = {
  // Voz → texto de trabajo. La transcripción en sí no pasa por el router (es
  // AssemblyAI/Whisper, otra puerta); lo que sí es tarea de modelo de texto es
  // la corrección y la atribución de roles.
  'corregir-transcripcion': 'transcription_cleanup',
  'atribuir-roles': 'transcription_cleanup',
  // Estructuración
  'extraer-entidades': 'extraction_structuring',
  'entidades': 'extraction_structuring',
  'laboratorio-vision': 'extraction_structuring',
  'antibiograma-vision': 'extraction_structuring',
  'receta-detectar-campos': 'extraction_structuring',
  // Redacción de documento clínico
  'nota': 'note_rendering',
  'nota-consulta': 'note_rendering',
  'inmuno-redactar': 'note_rendering',
  // Razonamiento
  'antibiograma-razonar': 'clinical_reasoning',
  'copilot-uci': 'clinical_reasoning',
  // Evidencia
  'evidencia': 'evidence_synthesis',
  'consultor-evidencia': 'evidence_synthesis',
  'evidencia-consultas': 'evidence_synthesis',
  // Revisión
  'verificar-nota': 'safety_review',
}

/** Clase de tarea de un `feature` del libro de costos. `null` si no está mapeado. */
export function claseDeFeature(feature: string): ClaseTarea | null {
  return CLASE_POR_FEATURE[feature] ?? null
}

/* ════════════════════════════════════════════════════════════════════════
   B · NIVELES DE RIESGO — categorías TÉCNICAS, no clínicas
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Cuánto daña equivocarse, en términos de qué hacer al respecto.
 *
 * Las tres categorías describen la CONSECUENCIA DE UN ERROR sobre el flujo, no
 * la gravedad del paciente. Quién es «alta consecuencia» lo decide la capa
 * clínica y llega como dato: aquí no hay ni una regla que mire contenido.
 */
export type NivelRiesgo =
  /** El error lo ve el médico antes de que llegue a ningún sitio. */
  | 'bajo'
  /** El error se arrastra a la nota si nadie lo mira. */
  | 'material'
  /** El error puede llegar impreso, firmado o a una decisión de tratamiento. */
  | 'alta_consecuencia'

export const NIVELES_RIESGO: readonly NivelRiesgo[] = ['bajo', 'material', 'alta_consecuencia']

/** Orden de severidad, para poder comparar sin `switch` en cada sitio. */
const SEVERIDAD: Record<NivelRiesgo, number> = { bajo: 0, material: 1, alta_consecuencia: 2 }
export const masSevero = (a: NivelRiesgo, b: NivelRiesgo): NivelRiesgo =>
  SEVERIDAD[a] >= SEVERIDAD[b] ? a : b

/* ════════════════════════════════════════════════════════════════════════
   C · LATENCIA
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Cuánto puede tardar sin estorbar.
 *
 * `interactiva` es lo que el médico espera mirando la pantalla con el paciente
 * enfrente. `diferida` es lo que puede terminar después de que cerró la consulta.
 */
export type ClaseLatencia = 'interactiva' | 'normal' | 'diferida'

const TOLERANCIA: Record<ClaseLatencia, number> = { interactiva: 0, normal: 1, diferida: 2 }

/** ¿Un modelo de latencia `ofrecida` sirve para una tarea que pide `pedida`? */
export function latenciaAlcanza(ofrecida: ClaseLatencia, pedida: ClaseLatencia): boolean {
  return TOLERANCIA[ofrecida] <= TOLERANCIA[pedida]
}

/* ════════════════════════════════════════════════════════════════════════
   D · PISO DE CALIDAD
   ════════════════════════════════════════════════════════════════════════ */

/**
 * La vara que un modelo tiene que pasar para poder hacer esta tarea.
 *
 * ── POR QUÉ LOS NÚMEROS NO ESTÁN ESCRITOS AQUÍ ───────────────────────────────
 *
 * Escribir `exactitudMin: 0.9` habría sido inventar un umbral. Suena razonable,
 * no rompe ninguna prueba, y acabaría citado como si alguien lo hubiera medido.
 * `clinical-safety.md` §1 lo prohíbe con nombre y apellidos, y aquí sería peor
 * que en otros sitios: es el número que decide si un modelo barato puede
 * redactar la nota que el médico firma.
 *
 * Así que el piso NUMÉRICO es **un dato de entrada** que declara la capa clínica.
 * Lo que sí vive aquí es la parte ESTRUCTURAL del piso, que no es una cifra
 * elegida sino una regla que el repositorio ya tomó:
 *
 *  · **Cero alucinaciones sobre el corpus oro.** No es un umbral nuevo: es
 *    `POR_QUE_EL_CRITERIO_ES_CERO` de `casos-oro.ts`, literal — «sobre un corpus
 *    que controlamos entero, una enfermedad inventada no es un porcentaje
 *    aceptable».
 *  · **La evidencia tiene que existir y ser de la versión vigente.**
 *  · **La muestra tiene que estar declarada**, porque una exactitud del 100 %
 *    sobre dos casos no es una exactitud.
 */
export interface PisoCalidad {
  /**
   * Exactitud por campo mínima (0..1). `null` = **no declarada**.
   *
   * Con `null`, un modelo NO puede ser promovido a esta tarea: sin vara no hay
   * medida, y «no hay vara» nunca significa «pasa». Ver `NEEDS_CLINICAL_REVIEW`
   * abajo.
   */
  exactitudMin: number | null
  /** Tasa de error máxima (0..1). `null` = no declarada. */
  tasaErrorMax: number | null
  /**
   * Alucinaciones por caso máximas.
   *
   * Por defecto 0 y no se relaja: es la regla ya escrita del corpus oro.
   */
  alucinacionesPorCasoMax: number
  /** Casos mínimos del corpus. `null` = no declarada. */
  muestraMin: number | null
  /**
   * Días máximos desde la evaluación. `null` = sin caducidad por tiempo.
   *
   * La caducidad por VERSIÓN de benchmark sí es siempre obligatoria y no
   * depende de este campo: una evidencia medida con otro corpus no vale,
   * tenga la edad que tenga.
   */
  frescuraMaxDias: number | null
}

/**
 * La parte del piso que el router impone SIEMPRE, sea cual sea el riesgo.
 *
 * Es deliberadamente pequeña: sólo lo que ya está decidido en el repositorio.
 * Todo lo demás lo declara quien pide la tarea.
 */
export const PISO_ESTRUCTURAL: PisoCalidad = {
  exactitudMin: null,
  tasaErrorMax: null,
  alucinacionesPorCasoMax: 0,
  muestraMin: null,
  frescuraMaxDias: null,
}

/**
 * Qué falta por decidir, y quién puede decidirlo. Se escribe, no se rellena.
 *
 * `clinical-safety.md` §1: «cuando falte, se escribe literalmente
 * NEEDS_CLINICAL_REVIEW con qué falta y quién puede decidirlo».
 */
export const NEEDS_CLINICAL_REVIEW: readonly string[] = [
  'NEEDS_CLINICAL_REVIEW: exactitud mínima por campo para note_rendering, ' +
  'clinical_reasoning y safety_review. Decide: dueño + capa clínica (#303). ' +
  'No se puede deducir del corpus sintético actual (4 casos).',
  'NEEDS_CLINICAL_REVIEW: tamaño mínimo de muestra para declarar que un modelo ' +
  'pasa una clase de tarea. Decide: dueño. Requiere corpus de-identificado y ' +
  'anotación clínica, que hoy no existe (POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION).',
  'NEEDS_CLINICAL_REVIEW: caducidad en días de una evidencia de calidad. ' +
  'Decide: dueño. Mientras no se declare, sólo caduca por versión de benchmark.',
]

/**
 * Combina el piso estructural con el que declara el llamador.
 *
 * **Sólo puede SUBIR.** Es la función donde vive la invariante de #313: cada
 * campo se queda con el más exigente de los dos, así que ni el llamador ni una
 * política de presupuesto pueden relajar lo que ya estaba puesto. Probada al
 * revés: se le pasa un piso más laxo y tiene que ignorarlo.
 */
export function pisoEfectivo(declarado?: Partial<PisoCalidad> | null): PisoCalidad {
  const d = declarado ?? {}
  const mayor = (a: number | null | undefined, b: number | null): number | null => {
    if (a == null) return b
    if (b == null) return a
    return Math.max(a, b)
  }
  const menor = (a: number | null | undefined, b: number | null): number | null => {
    if (a == null) return b
    if (b == null) return a
    return Math.min(a, b)
  }
  return {
    // Exactitud y muestra: más exigente = MÁS grande.
    exactitudMin: mayor(d.exactitudMin, PISO_ESTRUCTURAL.exactitudMin),
    muestraMin: mayor(d.muestraMin, PISO_ESTRUCTURAL.muestraMin),
    // Error y alucinaciones: más exigente = MÁS pequeño.
    tasaErrorMax: menor(d.tasaErrorMax, PISO_ESTRUCTURAL.tasaErrorMax),
    alucinacionesPorCasoMax: Math.min(
      d.alucinacionesPorCasoMax ?? PISO_ESTRUCTURAL.alucinacionesPorCasoMax,
      PISO_ESTRUCTURAL.alucinacionesPorCasoMax,
    ),
    // Frescura: más exigente = MENOS días.
    frescuraMaxDias: menor(d.frescuraMaxDias, PISO_ESTRUCTURAL.frescuraMaxDias),
  }
}

/**
 * ¿El piso tiene una vara numérica con la que juzgar?
 *
 * Sin exactitud ni tasa de error declaradas no hay forma de decir que un modelo
 * «cumple»: sólo se sabe que no alucinó en un corpus pequeño. Para riesgo
 * `bajo` eso puede bastar si además hay evidencia vigente; para lo demás, no.
 */
export function pisoEsMedible(p: PisoCalidad): boolean {
  return p.exactitudMin != null || p.tasaErrorMax != null
}

/* ════════════════════════════════════════════════════════════════════════
   E · LA SOLICITUD
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Señales TÉCNICAS que pueden pedir una segunda revisión.
 *
 * Ninguna se deduce aquí: las levanta quien hizo el trabajo. El router decide
 * SI se escala y a qué candidato — nunca mezcla dos respuestas clínicas ni
 * decide cuál tiene razón. Eso es del flujo clínico/seguridad (#303).
 */
export interface SenalesEscalacion {
  /** El productor declaró que no está seguro. */
  incertidumbre?: boolean
  /** Dos fuentes o dos pasadas se contradicen. */
  conflicto?: boolean
  /** Una validación determinista posterior falló. */
  validacionFallida?: boolean
  /** Esta petición cayó en la muestra de control de calidad. */
  muestreoBenchmark?: boolean
  /** El médico la pidió, explícitamente. Manda sobre todo lo demás. */
  peticionDelMedico?: boolean
}

/** Lo que el llamador declara para que el router pueda decidir. NUNCA lleva PHI. */
export interface SolicitudTarea {
  claseTarea: ClaseTarea
  riesgo: NivelRiesgo
  latencia: ClaseLatencia
  /** Piso declarado por la capa clínica. Se combina con el estructural. */
  pisoCalidad?: Partial<PisoCalidad> | null
  /** La salida se parsea como JSON: un modelo que no lo garantice no sirve. */
  requiereSalidaEstructurada?: boolean
  /** La entrada no cabe en un contexto ordinario. */
  requiereContextoLargo?: boolean
  /** ¿Se permite escalar a un segundo modelo si las señales lo piden? */
  permiteSegundaOpinion?: boolean
  /**
   * Restricciones de proveedor por razones TÉCNICAS o de licencia.
   * `soloEstos` vacío o ausente = sin restricción.
   */
  restriccionesProveedor?: { soloEstos?: readonly string[]; excluir?: readonly string[] } | null
  /** Tokens de entrada estimados. Para la banda de costo, no para el prompt. */
  tamanoEntradaEstimado?: number
  /** Tope de tokens de salida que el llamador va a pedir. */
  presupuestoSalida?: number
  /**
   * Identidad de correlación de la petición.
   *
   * Es un `requestId`, el mismo del libro de costos. **No es un identificador
   * de paciente ni de encuentro**: el telemetría de este riel no puede
   * contener nada con lo que reidentificar a nadie.
   */
  correlacionId: string
  senales?: SenalesEscalacion
}

/* ════════════════════════════════════════════════════════════════════════
   F · CALIDAD OBSERVADA — la forma, no los datos
   ════════════════════════════════════════════════════════════════════════ */

/**
 * El resultado de haber medido un modelo en una clase de tarea.
 *
 * Reutiliza `ResumenEvaluacion` de `evaluacion.ts` tal cual, sin copiar campos:
 * un segundo formato de métricas sería un segundo benchmark, y el issue lo
 * prohíbe expresamente. Lo que se añade alrededor es la PROCEDENCIA — quién,
 * con qué corpus, cuándo — que es lo que convierte una métrica en evidencia.
 */
export interface EvidenciaCalidad {
  proveedor: string
  modeloId: string
  claseTarea: ClaseTarea
  /** Versión del corpus/benchmark con que se midió. Cambiarla caduca lo viejo. */
  versionBenchmark: string
  /** ISO-8601. Se pasa: nada de relojes escondidos en un registro de evidencia. */
  evaluadoEn: string
  /** Las métricas, tal como las produce `resumirEvaluacion`. */
  resumen: ResumenEvaluacion
  /**
   * De dónde salieron los casos. `sintetico` es lo único que hay hoy.
   *
   * `data-privacy.md`: cero pacientes reales en corpus de evaluación. Un
   * `deidentificado` sólo puede entrar con decisión explícita del dueño.
   */
  origen: 'sintetico' | 'deidentificado'
}

export const POR_QUE_EL_RIESGO_LO_DECLARA_EL_LLAMADOR =
  'Porque si el router dedujera el riesgo del contenido, tendría que leer el ' +
  'contenido — y entonces sería un motor clínico más, con otro dueño y otras ' +
  'pruebas. Escoge un recurso de cómputo bajo un contrato que otro definió; no ' +
  'decide qué es grave.'

export const POR_QUE_EL_PISO_NUMERICO_NO_ESTA_ESCRITO_AQUI =
  'Porque escribir «exactitud mínima 0.9» habría sido inventar el umbral que ' +
  'decide si un modelo barato puede redactar la nota que el médico firma. ' +
  'Suena razonable, no rompe ninguna prueba, y acaba citado como si alguien lo ' +
  'hubiera medido. El piso numérico lo declara la capa clínica; aquí sólo vive ' +
  'lo que el repositorio ya decidió: cero alucinaciones sobre el corpus oro.'
