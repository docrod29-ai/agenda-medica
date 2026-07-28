/**
 * ══════════════════════════════════════════════════════════════════════════
 * COBERTURA DEL CLINICAL ENGINE REGISTRY (unidad Nexus OS E0-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * POR QUÉ EXISTE: el registro de motores (`registry.ts`) solo puede garantizar
 * "100 % de motores registrados" si existe una lista de lo que NO es un motor.
 * Sin ella, la única forma de comprobar la cobertura sería un número mágico
 * (`length >= 15`), que es exactamente lo que había y no detectaba nada.
 *
 * Con esta lista, el gate `src/__tests__/clinical-registry-cobertura.test.ts`
 * recorre RECURSIVAMENTE los directorios clínicos y exige que CADA archivo esté
 * en una de dos listas: registrado como motor, o justificado aquí. Un archivo
 * nuevo sin clasificar rompe el CI. Es un gate FAIL-CLOSED a propósito: cuesta
 * una línea de clasificación y evita un motor clínico invisible.
 *
 * DECISIÓN DE DISEÑO (E0-03 §4.3): lista central en vez de una etiqueta
 * `@motor-clinico` dentro de cada archivo. La etiqueta sería a prueba de
 * renombres pero obligaría a editar ~105 archivos de PRODUCCIÓN; la lista
 * central deja el diff completamente fuera del código que corre. Un renombre
 * rompe el test con un mensaje claro, que es un fallo deseable.
 *
 * ALCANCE (E0-03 §3.2): quedan FUERA `src/lib/evidencia` (recuperación de
 * literatura, etapa E2), `src/lib/voz` (habla → intención), `src/lib/ia`
 * (evaluación del LLM, etapa E7), `src/lib/fhir` y `src/lib/hl7`
 * (serialización) y `src/lib/compliance` (regulatorio). Es una decisión de
 * alcance explícita, no un olvido; ampliarla es añadir una cadena al arreglo.
 */

/** Directorios donde vive lógica clínica. Todo .ts aquí debe estar clasificado. */
export const DIRECTORIOS_CLINICOS = [
  'src/lib/uci',
  'src/lib/hospital',
  'src/lib/expediente', // RECURSIVO: esconde antibiograma/, laboratorio/ y cardiometabolico/
  'src/lib/inmuno',
  'src/lib/clinical',
  'src/lib/seguridad',
] as const

export interface ModuloNoMotor {
  /** Ruta relativa a la raíz del repo, exacta. */
  file: string
  /** Por qué NO es un motor clínico determinista (obligatorio, no vacío). */
  motivo: string
  /**
   * Justificación REFORZADA, obligatoria solo cuando el archivo exporta una
   * constante `*_VERSION` (señal débil de motor). Sin ella el gate falla: no se
   * puede meter un módulo versionado en esta lista en silencio.
   */
  senalRevisada?: string
}

/**
 * Módulos de los directorios clínicos que NO son motores deterministas
 * (persistencia, prompts, tipos, parseo de texto, catálogos sin cálculo…).
 * Estar aquí es una decisión CONSCIENTE y revisable, no un silencio.
 */
export const MODULOS_NO_MOTOR: ModuloNoMotor[] = [
  // ── src/lib/clinical ─────────────────────────────────────────────────────
  { file: 'src/lib/clinical/registry.ts', motivo: 'metadato puro del propio registro; no ejecuta cálculo (evita ciclos de import)' },
  { file: 'src/lib/clinical/cobertura.ts', motivo: 'metadato de cobertura del registro; no ejecuta cálculo' },

  // ── src/lib/uci ──────────────────────────────────────────────────────────
  { file: 'src/lib/uci/num.ts', motivo: 'coerción numérica compartida (coma decimal, vacío → null); no emite dato clínico por sí sola' },
  {
    file: 'src/lib/uci/benchmark.ts',
    motivo: 'arnés de validación: genera casos sintéticos y comprueba a los motores; no participa en la atención',
    senalRevisada: 'BENCHMARK_UCI_VERSION versiona el ARNÉS, no un motor: no calcula nada por su cuenta, solo compara la salida de ventilacion/gasometria/hemodinamia/seguridad contra un cómputo independiente.',
  },
  {
    file: 'src/lib/uci/copilot.ts',
    motivo: 'capa de razonamiento con LLM: arma snapshot y prompts; su contrato prohíbe calcular escalas o dosis',
    senalRevisada: 'COPILOT_VERSION versiona el CONTRATO del prompt y la fusión de opiniones. Todos los números que muestra vienen de motores ya registrados (ventilación, gasometría, PAM, SOFA, POCUS, CKRT, ECMO, neuro, alertas).',
  },
  {
    file: 'src/lib/uci/nota.ts',
    motivo: 'constructor de texto de la nota de evolución; redacta secciones con la salida de los motores, no calcula',
    senalRevisada: 'UCI_NOTA_VERSION versiona el FORMATO de la nota. Cada cifra que escribe proviene de un motor registrado; si el motor bloquea, la línea no se escribe.',
  },
  {
    file: 'src/lib/uci/discusion.ts',
    motivo: 'atribución de roles en el pase de visita (quién habló); no emite valor clínico',
    senalRevisada: 'DISCUSION_UCI_VERSION versiona las heurísticas de rol (adscrito/residente/enfermería), que son de transcripción, no de cálculo clínico.',
  },
  {
    file: 'src/lib/uci/evidencia.ts',
    motivo: 'base de conocimiento: fuentes y reglas citadas que los motores referencian por `fuenteId`',
    senalRevisada: 'EVIDENCIA_UCI_VERSION versiona el CATÁLOGO de citas. No evalúa a ningún paciente: quien aplica los umbrales es src/lib/uci/seguridad.ts, que sí está registrado.',
  },

  // ── src/lib/hospital ─────────────────────────────────────────────────────
  { file: 'src/lib/hospital/barcode.ts', motivo: 'genera el SVG de un código de barras Code 39; presentación' },
  { file: 'src/lib/hospital/cama.ts', motivo: 'normaliza y compara etiquetas de cama entre censo e inventario; logística, no clínica' },
  { file: 'src/lib/hospital/fhir-import.ts', motivo: 'importa un Bundle FHIR y verifica a qué paciente pertenece; serialización + control de identidad' },
  { file: 'src/lib/hospital/firestore.ts', motivo: 'persistencia del internamiento (censo, indicaciones, MAR, interconsultas)' },
  { file: 'src/lib/hospital/medicamentos-catalogo.ts', motivo: 'catálogo de búsqueda de medicamentos; no calcula dosis ni emite alerta' },
  { file: 'src/lib/hospital/registro-durable.ts', motivo: 'persistencia append-only del registro clínico-legal del internamiento' },

  // ── src/lib/inmuno ───────────────────────────────────────────────────────
  { file: 'src/lib/inmuno/catalogos.ts', motivo: 'etiquetas y agrupaciones de los chips de captura; UI' },
  { file: 'src/lib/inmuno/compose.ts', motivo: 'compone pares [título, valor] para la nota; formateo de texto' },
  { file: 'src/lib/inmuno/nota.ts', motivo: 'constructor de texto de la nota de inmunocomprometido' },

  // ── src/lib/seguridad ────────────────────────────────────────────────────
  { file: 'src/lib/seguridad/ofuscar-local.ts', motivo: 'ofuscación síncrona de PHI en localStorage; seguridad de almacenamiento, no clínica' },

  // ── src/lib/expediente (raíz) ────────────────────────────────────────────
  { file: 'src/lib/expediente/audit-log.ts', motivo: 'bitácora de auditoría (NOM-024); registra eventos, no calcula' },
  { file: 'src/lib/expediente/extraction-schema.ts', motivo: 'tipos del esquema de extracción auditada; sin lógica' },
  { file: 'src/lib/expediente/firestore.ts', motivo: 'persistencia de notas clínicas y adendas' },
  { file: 'src/lib/expediente/fotos-clinicas.ts', motivo: 'persistencia y agrupación de fotografía clínica seriada; no interpreta la imagen' },
  { file: 'src/lib/expediente/huella-impreso.ts', motivo: 'huella de lo que realmente se imprimió (trazabilidad medicolegal); no calcula dato clínico' },
  {
    file: 'src/lib/expediente/integrity.ts',
    motivo: 'hash SHA-256 de integridad del expediente (NOM-024); criptografía, no clínica',
    senalRevisada: 'HASH_VERSION versiona el ALGORITMO de canonicalización del hash (ver docs/audit sobre el falso positivo de integridad). No produce ningún valor clínico.',
  },
  { file: 'src/lib/expediente/labs-desde-texto.ts', motivo: 'mapea estudios ya extraídos a las claves que consume el copiloto; los umbrales los aplican los motores' },
  { file: 'src/lib/expediente/lexico-voz-2026.ts', motivo: 'léxico de dictado (corpus de términos); sin lógica' },
  { file: 'src/lib/expediente/medical-ner.ts', motivo: 'prompts y tipos de extracción de entidades; la extracción la hace el LLM' },
  { file: 'src/lib/expediente/medical-vocabulary.ts', motivo: 'vocabulario médico para el corrector de transcripción; sin cálculo clínico' },
  { file: 'src/lib/expediente/nom004.ts', motivo: 'validación regulatoria de campos obligatorios antes de firmar; no emite dato clínico' },
  { file: 'src/lib/expediente/parser-clinico.ts', motivo: 'parser de texto de respaldo cuando el LLM falla: EXTRAE valores, no los calcula ni los interpreta' },
  { file: 'src/lib/expediente/procedencia.ts', motivo: 'sello de procedencia por campo (de dónde salió el dato); trazabilidad' },
  { file: 'src/lib/expediente/prompts.ts', motivo: 'texto de los prompts para estructurar la transcripción' },
  { file: 'src/lib/expediente/sanitizar-prosa.ts', motivo: 'quita banderas internas del texto de la nota; no toca contenido clínico' },
  { file: 'src/lib/expediente/sugerencias-ia.ts', motivo: 'marca y resuelve lo que el modelo propuso y el médico no dictó; control de procedencia' },
  { file: 'src/lib/expediente/templates.ts', motivo: 'qué secciones lleva cada tipo de nota (NOM-004); plantilla' },
  { file: 'src/lib/expediente/tipos-visibles.ts', motivo: 'qué tipos de nota se ofrecen según el contexto; UI' },
  { file: 'src/lib/expediente/versioning.ts', motivo: 'historial de versiones del borrador (trazabilidad pre-firma)' },
  { file: 'src/lib/expediente/vocabulario-atc.ts', motivo: 'catálogo farmacológico ATC/Cuadro Básico para el reconocimiento de nombres; sin cálculo' },

  // ── src/lib/expediente/antibiograma ──────────────────────────────────────
  { file: 'src/lib/expediente/antibiograma/catalogo-antibioticos.ts', motivo: 'catálogo de antimicrobianos del panel; datos sin inferencia' },
  { file: 'src/lib/expediente/antibiograma/epidemiologia.ts', motivo: 'prevalencias publicadas (INVIFAR, WHO GLASS) usadas como contexto; no infiere fenotipo' },
  { file: 'src/lib/expediente/antibiograma/referencias.ts', motivo: 'constantes bibliográficas; fuente única de las citas' },
  { file: 'src/lib/expediente/antibiograma/tipos.ts', motivo: 'tipos del motor de antibiograma; sin lógica de inferencia' },
  { file: 'src/lib/expediente/antibiograma/util.ts', motivo: 'normalización de nombres y búsqueda de S/I/R por sinónimo; utilidades de texto' },
  { file: 'src/lib/expediente/antibiograma/razonar.ts', motivo: 'prompts para la capa de razonamiento con LLM; los hechos ya los fijó el motor' },
  { file: 'src/lib/expediente/antibiograma/vision.ts', motivo: 'prompt de visión para transcribir la foto del antibiograma; solo transcribe' },
  { file: 'src/lib/expediente/antibiograma/resumen-nota.ts', motivo: 'redacta para la nota la interpretación que el motor ya produjo' },

  // ── src/lib/expediente/cardiometabolico ──────────────────────────────────
  { file: 'src/lib/expediente/cardiometabolico/hoja-paciente.ts', motivo: 'traduce a lenguaje de paciente lo que los módulos con guía ya decidieron; no calcula' },

  // ── src/lib/expediente/laboratorio ───────────────────────────────────────
  { file: 'src/lib/expediente/laboratorio/firestore.ts', motivo: 'persistencia del historial de laboratorios' },
  { file: 'src/lib/expediente/laboratorio/vision.ts', motivo: 'prompt de visión para transcribir el PDF/foto de laboratorio; solo transcribe' },
]

/**
 * Documentos de docs/clinical-decisions/ que NO son el ADR de un motor.
 * Declararlos evita que el gate de ADRs huérfanos (aserción 5) los reporte, y
 * evita también la tentación de "resolverlo" relajando esa aserción.
 */
export const DOCS_NO_ADR = [
  'README.md',
  'PREGUNTAS-PENDIENTES.md',
] as const

/**
 * Señales de que un archivo es un motor disfrazado. Se usan en la aserción
 * ANTIFRAUDE del gate: no se puede "resolver" un CI rojo metiendo un motor
 * nuevo en MODULOS_NO_MOTOR.
 *
 * · DURA: no admite excepción. Un `*_ENGINE_VERSION` o un export que calcula
 *   (calcular…, score…, dosis…) descalifica al archivo de esta lista.
 * · DÉBIL: cualquier otra constante `*_VERSION` exige `senalRevisada` escrita.
 */
export const SENAL_DURA_VERSION = /^[A-Z0-9_]*_ENGINE_VERSION$/
export const SENAL_DURA_EXPORT = /^(calcular|calc|score|puntaje|dosis|indice|clasificar|estratificar)/i
export const SENAL_DEBIL_VERSION = /^[A-Z0-9_]*_VERSION$/
