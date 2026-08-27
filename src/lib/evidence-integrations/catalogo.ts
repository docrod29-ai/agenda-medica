/**
 * ══════════════════════════════════════════════════════════════════════════
 * CATÁLOGO DE PROVEEDORES Y MATRIZ DE CALIFICACIÓN (#314)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PORQUÉ EXISTE Y POR QUÉ NO ES `PROVEEDORES` DE `src/types/evidence.ts`.
 *
 * `src/types/evidence.ts:89` ya tiene un catálogo: dice qué proveedores pueden
 * producir un `Source` ANCLABLE (licencia `ENABLED`). Ése sigue siendo la
 * verdad de «¿puedo citar de aquí?» y este archivo NO lo duplica ni lo
 * contradice — lo REFERENCIA con `proveedorCanonico`.
 *
 * Lo que aquí se añade es otra pregunta, que hoy no tiene respuesta en ningún
 * sitio del repo: **¿qué sabemos legal y técnicamente de este proveedor, y qué
 * NO sabemos?** Un proveedor puede estar fuera de `PROVEEDORES` por tres
 * razones muy distintas —no hay contrato, hay contrato pero prohíbe reuso
 * generativo, o simplemente nadie lo ha evaluado— y esas tres tienen planes de
 * acción opuestos. Colapsarlas en `LICENSE_UNKNOWN` pierde la información que
 * el dueño necesita para decidir un gasto.
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  UN CAMPO LEGAL QUE NADIE VERIFICÓ SE ESCRIBE `UNVERIFIABLE`.         ║
 *   ║  NUNCA SE ASUME, NI «A FAVOR» NI «EN CONTRA».                        ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Es la regla 1 de `.claude/rules/clinical-safety.md` aplicada al dominio
 * legal: rellenar un campo plausible es el fallo más caro, porque no rompe
 * ninguna prueba y acaba justificando una integración que viola una licencia.
 *
 * ── LO QUE ESTE ARCHIVO NO ES ────────────────────────────────────────────────
 *
 * NO es asesoría legal y NO cierra ninguna negociación. Es el REGISTRO de lo
 * que se ha podido verificar desde el repositorio, con su fecha. Todo campo
 * `UNVERIFIABLE` es una pregunta abierta para el dueño, y está listada en
 * docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md, que se genera de aquí.
 *
 * ── FECHA DE LA REVISIÓN ─────────────────────────────────────────────────────
 *
 * Esta tabla se llenó el 2026-08-22 SIN acceso a portales de licenciamiento,
 * sin credenciales y sin contactar a ningún proveedor. Por eso casi todo lo
 * comercial de UpToDate/OpenEvidence/Cochrane está `UNVERIFIABLE`: no es
 * pereza, es el estado real del conocimiento. Ver `REVISADO_EN`.
 */

import type { ProveedorHabilitado } from '@/types/evidence'

/** Cuándo se revisó por última vez esta tabla. Lo comprueba su prueba. */
export const REVISADO_EN = '2026-08-22'

// ---------------------------------------------------------------------------
// 1. Rol — reglas 7 y 8 de #314, escritas en el tipo
// ---------------------------------------------------------------------------

/**
 * QUÉ PUEDE HACER el material de un proveedor. Es la decisión más importante
 * del archivo, porque separa «esto se puede citar» de «esto sólo orienta».
 *
 * · `respaldo` — puede sostener una afirmación clínica. Sólo estos producen
 *   `Source` canónicos y, por tanto, `Claim`.
 *
 * · `descubrimiento` — AYUDA A ENCONTRAR, NO RESPALDA. Es la clase de
 *   Perplexity (punto 7 de #314): su respuesta generada jamás cuenta por sí
 *   sola como evidencia. Sirve para sugerir términos, artículos o líneas de
 *   búsqueda que LUEGO se recuperan de una fuente verificable. Si el
 *   re-grounding no ocurre, no hay evidencia — hay una pista sin comprobar.
 *
 * · `conocimiento_personal` — notas del propio médico (Obsidian y equivalentes,
 *   punto 8 de #314). Llevan procedencia de autor/fuente/fecha y son CONTEXTO,
 *   no guía. Nunca ascienden a nivel de guideline por antigüedad, por repetición
 *   ni porque el médico las haya escrito él mismo.
 *
 * POR QUÉ EL ROL VIVE EN EL CATÁLOGO Y NO EN CADA ADAPTADOR: si cada adaptador
 * declarara su propio rol, un adaptador nuevo podría declararse `respaldo` y
 * saltarse la regla. Aquí es un dato, revisable en un solo sitio y probado.
 */
export type RolDeEvidencia = 'respaldo' | 'descubrimiento' | 'conocimiento_personal'

// ---------------------------------------------------------------------------
// 2. Licencia — cinco estados, porque tres no alcanzan
// ---------------------------------------------------------------------------

/**
 * · `OPEN`                 — material público reutilizable bajo términos
 *                            abiertos y conocidos (PubMed, WHO, CDC…).
 * · `LICENSED_OK`          — hay acuerdo verificado que permite el uso previsto.
 *                            HOY NINGÚN PROVEEDOR ESTÁ AQUÍ.
 * · `REQUIRES_AGREEMENT`   — existe una vía oficial de integración/licencia y
 *                            hace falta negociarla. Acción: decisión del dueño.
 * · `LICENSE_UNKNOWN`      — no se ha podido determinar. Acción: investigar.
 * · `LICENSE_PROHIBITED`   — se sabe que el uso previsto NO está permitido.
 *                            El adaptador no debe ni intentarlo.
 */
export type EstadoDeLicencia =
  | 'OPEN'
  | 'LICENSED_OK'
  | 'REQUIRES_AGREEMENT'
  | 'LICENSE_UNKNOWN'
  | 'LICENSE_PROHIBITED'

/** Sólo estos dos autorizan a hablar con el proveedor. */
export const LICENCIAS_OPERABLES = ['OPEN', 'LICENSED_OK'] as const satisfies readonly EstadoDeLicencia[]

export function licenciaPermiteOperar(l: EstadoDeLicencia): boolean {
  return (LICENCIAS_OPERABLES as readonly string[]).includes(l)
}

// ---------------------------------------------------------------------------
// 3. El valor que hace honesta a toda la tabla
// ---------------------------------------------------------------------------

/**
 * `UNVERIFIABLE` — no se ha verificado desde este repositorio.
 *
 * NO significa «no» y NO significa «probablemente sí». Significa que nadie con
 * acceso al portal del proveedor lo ha confirmado, y por tanto **no se puede
 * construir nada encima**. Es el equivalente legal de `NEEDS_CLINICAL_REVIEW`.
 */
export const UNVERIFIABLE = 'UNVERIFIABLE' as const
export type Unverificable = typeof UNVERIFIABLE

/** Un hecho de la matriz: o se sabe (con su nota), o está sin verificar. */
export type Verificable<T> = { readonly valor: T; readonly nota: string } | Unverificable

export function estaVerificado<T>(v: Verificable<T>): v is { readonly valor: T; readonly nota: string } {
  return v !== UNVERIFIABLE
}

/** Azúcar para declarar un hecho verificado con su justificación. */
function si<T>(valor: T, nota: string): Verificable<T> {
  return { valor, nota }
}

// ---------------------------------------------------------------------------
// 4. La matriz de calificación — los 12 campos del checkpoint de #314
// ---------------------------------------------------------------------------

/**
 * Los doce campos que hay que conocer ANTES de habilitar un adaptador
 * (issue #314, comentario de checkpoint, punto 3). Ninguno es decorativo:
 * cada uno puede, por sí solo, hacer ilegal una integración.
 */
export interface MatrizDeCalificacion {
  /** ¿Existe una vía oficial de integración/API/enterprise? */
  readonly viaOficial: Verificable<boolean>
  /** Qué clases de dato se le pueden enviar. */
  readonly clasesDeDatoPermitidas: Verificable<readonly string[]>
  /** ¿Los términos admiten PHI? Por defecto se asume que NO se envía. */
  readonly admitePhi: Verificable<boolean>
  /** Modelo de credencial (API key, OAuth, IP allowlist, SAML…). */
  readonly modeloDeCredencial: Verificable<string>
  /** ¿Se puede cachear el resultado, y por cuánto tiempo? */
  readonly derechoDeCache: Verificable<string>
  /** ¿Se puede mostrar/redistribuir el contenido al médico? */
  readonly derechoDeMostrar: Verificable<string>
  /** ¿Permite cita profunda al documento original? */
  readonly citaProfunda: Verificable<boolean>
  /** ¿Expone versión/fecha de revisión del contenido? */
  readonly exponeFrescura: Verificable<boolean>
  /** Límites de tasa y SLA declarados. */
  readonly limitesYSla: Verificable<string>
  /** Modelo de precio. */
  readonly precio: Verificable<string>
  /** Qué hace el proveedor cuando se cae (semántica de error). */
  readonly semanticaDeFallo: Verificable<string>
  /** ¿Permite uso del contenido en un sistema generativo? EL CAMPO CRÍTICO. */
  readonly reusoGenerativo: Verificable<string>
}

/** Los doce nombres, para que la prueba compruebe que no falta ninguno. */
export const CAMPOS_DE_LA_MATRIZ = [
  'viaOficial', 'clasesDeDatoPermitidas', 'admitePhi', 'modeloDeCredencial',
  'derechoDeCache', 'derechoDeMostrar', 'citaProfunda', 'exponeFrescura',
  'limitesYSla', 'precio', 'semanticaDeFallo', 'reusoGenerativo',
] as const satisfies readonly (keyof MatrizDeCalificacion)[]

/** Toda la matriz sin verificar. Punto de partida honesto de un proveedor nuevo. */
const SIN_VERIFICAR: MatrizDeCalificacion = {
  viaOficial: UNVERIFIABLE,
  clasesDeDatoPermitidas: UNVERIFIABLE,
  admitePhi: UNVERIFIABLE,
  modeloDeCredencial: UNVERIFIABLE,
  derechoDeCache: UNVERIFIABLE,
  derechoDeMostrar: UNVERIFIABLE,
  citaProfunda: UNVERIFIABLE,
  exponeFrescura: UNVERIFIABLE,
  limitesYSla: UNVERIFIABLE,
  precio: UNVERIFIABLE,
  semanticaDeFallo: UNVERIFIABLE,
  reusoGenerativo: UNVERIFIABLE,
}

// ---------------------------------------------------------------------------
// 5. La entrada de catálogo
// ---------------------------------------------------------------------------

/** Qué clase de material publica una fuente. NO es su peso metodológico. */
export type ClaseDeFuente =
  | 'literatura_primaria'
  | 'revision_sistematica'
  | 'guia_de_practica'
  | 'referencia_terciaria'   // compendios tipo UpToDate: sintetizan, no publican original
  | 'ficha_de_farmaco'
  | 'registro_de_ensayos'
  | 'asistente_generativo'   // no publica: genera
  | 'notas_del_medico'

export interface EntradaDeCatalogo {
  readonly id: ProveedorDeEvidencia
  readonly nombre: string
  readonly clase: ClaseDeFuente
  readonly rol: RolDeEvidencia
  readonly licencia: EstadoDeLicencia
  /**
   * A qué proveedor de `src/types/evidence.ts:PROVEEDORES` corresponde, si es
   * que corresponde a alguno.
   *
   * ── ESTE CAMPO ES LA COMPUERTA, NO UN DETALLE DE MAPEO ──────────────────
   * Sin `proveedorCanonico` NO SE PUEDE CONSTRUIR UN `Source`, y sin `Source`
   * no hay `Passage`, y sin `Passage` no hay `Claim`. Es decir: un proveedor
   * sin licencia verificada es, POR CONSTRUCCIÓN, incapaz de respaldar una
   * afirmación clínica. No hace falta un guardián aparte que lo prohíba: el
   * modelo de tipos ya lo hace imposible.
   */
  readonly proveedorCanonico?: ProveedorHabilitado
  /** Por qué está en el estado de licencia en que está. Obligatorio. */
  readonly porQue: string
  readonly matriz: MatrizDeCalificacion
  /**
   * Qué decisión humana falta para moverlo. `null` = no hay nada pendiente.
   * Lo lee `docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md`.
   */
  readonly decisionPendiente: string | null
}

// ---------------------------------------------------------------------------
// 6. EL CATÁLOGO
// ---------------------------------------------------------------------------

const ENTRADAS = {
  // ── Abiertos: ya operables, ya en PROVEEDORES ───────────────────────────
  pubmed: {
    id: 'pubmed',
    nombre: 'PubMed / MEDLINE (NCBI E-utilities)',
    clase: 'literatura_primaria',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'pubmed',
    porQue: 'API pública del NCBI, ya integrada en src/lib/evidencia/pubmed.ts. Se usan resumen y metadatos públicos; NO se descarga texto completo de revistas de paga.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'E-utilities (esearch/efetch), documentadas y públicas.'),
      clasesDeDatoPermitidas: si(['termino_de_busqueda_sin_phi'], 'Sólo se envían términos de búsqueda. La ruta actual ya minimiza PHI antes de llamar.'),
      admitePhi: si(false, 'Decisión de este repo: no se envía PHI a NCBI aunque la API no lo prohíba explícitamente. Ver .claude/rules/data-privacy.md.'),
      modeloDeCredencial: si('API key opcional (NCBI_API_KEY) que sólo eleva el límite de tasa', 'pubmed.ts:15 la lee del entorno; sin ella funciona más lento.'),
      citaProfunda: si(true, 'PMID resuelve a una URL estable de PubMed.'),
      exponeFrescura: si(false, 'Da fecha de PUBLICACIÓN, no de revisión. Un artículo no se "revisa": se sustituye por otro.'),
      limitesYSla: si('3 req/s sin clave, 10 req/s con clave; sin SLA contractual', 'pubmed.ts ya monta una cola de throttle por 429 observados en producción.'),
      precio: si('sin costo', 'Servicio público del NIH.'),
      semanticaDeFallo: si('429 y 5xx; puede devolver XML parcial', 'El throttle existente nació de un fallo real: "a veces no salen citas".'),
      reusoGenerativo: si('resumen y metadatos: sí, con cita', 'Los resúmenes de MEDLINE son públicos; el texto completo de la revista NO lo es.'),
    },
    decisionPendiente: null,
  },
  pmc: {
    id: 'pmc',
    nombre: 'PubMed Central (Open Access)',
    clase: 'literatura_primaria',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'pmc',
    porQue: 'Sólo el subconjunto Open Access. src/lib/evidencia/pubmed.ts:166 ya trae texto completo de PMC.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'BioC/OA de PMC.'),
      admitePhi: si(false, 'Misma política que PubMed.'),
      citaProfunda: si(true, 'PMCID estable.'),
      precio: si('sin costo', 'Servicio público del NIH.'),
      reusoGenerativo: si('depende de la licencia del artículo (CC-BY, CC0, o "OA no comercial")', 'RIESGO REAL: el subconjunto OA mezcla licencias. Hay que leer la licencia POR ARTÍCULO antes de reproducir texto completo.'),
    },
    decisionPendiente: 'Filtrar por licencia de artículo antes de reproducir texto completo de PMC (hoy no se filtra).',
  },
  clinicaltrials: {
    id: 'clinicaltrials',
    nombre: 'ClinicalTrials.gov',
    clase: 'registro_de_ensayos',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'clinicaltrials',
    porQue: 'Registro público del NIH con API v2 documentada.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'API v2 pública.'),
      admitePhi: si(false, 'Política del repo.'),
      citaProfunda: si(true, 'NCT id estable.'),
      exponeFrescura: si(true, 'lastUpdatePostDate por registro.'),
      precio: si('sin costo', 'Servicio público.'),
    },
    decisionPendiente: null,
  },
  who: {
    id: 'who',
    nombre: 'OMS / WHO (guías y publicaciones)',
    clase: 'guia_de_practica',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'who',
    porQue: 'Publicaciones bajo CC BY-NC-SA en su mayoría. Ya está en PROVEEDORES.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(false, 'No hay API de guías: hay documentos. La recuperación programática es un problema abierto.'),
      admitePhi: si(false, 'Política del repo.'),
      citaProfunda: si(true, 'URL estable de IRIS.'),
      reusoGenerativo: si('CC BY-NC-SA en general, con excepciones por documento', 'NC = no comercial. Ausculta es comercial: hay que revisar caso por caso antes de reproducir texto.'),
    },
    decisionPendiente: 'Confirmar si la cláusula NC de CC BY-NC-SA afecta el uso dentro de un producto de pago. Es una pregunta legal, no técnica.',
  },
  cdc: {
    id: 'cdc',
    nombre: 'CDC (guías y MMWR)',
    clase: 'guia_de_practica',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'cdc',
    porQue: 'Obra del gobierno federal de EE. UU.: dominio público salvo material de terceros incrustado.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(false, 'Hay APIs sueltas (data.cdc.gov) pero no una de guías.'),
      admitePhi: si(false, 'Política del repo.'),
      citaProfunda: si(true, 'URL estable.'),
      reusoGenerativo: si('dominio público, salvo figuras/tablas de terceros', 'La excepción de terceros es real y hay que respetarla al reproducir figuras.'),
    },
    decisionPendiente: null,
  },
  fda_dailymed: {
    id: 'fda_dailymed',
    nombre: 'FDA / DailyMed (fichas de producto)',
    clase: 'ficha_de_farmaco',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'fda_dailymed',
    porQue: 'openFDA ya está integrado en src/lib/evidencia/openfda.ts.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'openFDA + DailyMed SPL.'),
      admitePhi: si(false, 'Política del repo.'),
      citaProfunda: si(true, 'SetID de SPL estable.'),
      exponeFrescura: si(true, 'effective_time del SPL.'),
      precio: si('sin costo', 'Servicio público.'),
      reusoGenerativo: si('etiquetado en dominio público', 'La etiqueta aprobada es documento público.'),
    },
    decisionPendiente: 'Ojo clínico: la ficha FDA es de ETIQUETADO ESTADOUNIDENSE. Para México manda el registro sanitario COFEPRIS. No son intercambiables.',
  },

  // ── Cochrane: el caso de los tres niveles ────────────────────────────────
  cochrane: {
    id: 'cochrane',
    nombre: 'Cochrane Library',
    clase: 'revision_sistematica',
    rol: 'respaldo',
    licencia: 'REQUIRES_AGREEMENT',
    // SIN proveedorCanonico A PROPÓSITO ⇒ hoy NO puede producir un Source.
    porQue: [
      'Cochrane tiene TRES niveles que #314 exige distinguir y que se confunden constantemente:',
      '(1) el RESUMEN estructurado y el resumen en lenguaje sencillo (PLS), indexados en PubMed y visibles sin suscripción;',
      '(2) la REVISIÓN COMPLETA, que en la mayoría de países requiere suscripción a la Cochrane Library;',
      '(3) el REUSO COMERCIAL o en sistemas generativos, que es un permiso APARTE y NO se obtiene por tener acceso de lectura.',
      'Tener (1) o incluso (2) no da (3). Ésa es exactamente la confusión que convierte una integración en una infracción.',
      'NOTA OPERATIVA: los resúmenes de revisiones Cochrane SÍ están indexados en MEDLINE, así que hoy ya pueden llegar por el adaptador de PubMed, con su cita y bajo los términos de PubMed. Eso NO es "integrar Cochrane": es citar un resumen indexado.',
    ].join(' '),
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: UNVERIFIABLE,
      citaProfunda: si(true, 'El DOI/CD id de la revisión resuelve a la Cochrane Library. Verificable sin credencial.'),
      exponeFrescura: si(true, 'El versionado .pubN del identificador (p. ej. CD004523.pub5) ES el dato de frescura, y es público.'),
      reusoGenerativo: UNVERIFIABLE,
    },
    decisionPendiente: 'DECISIÓN DEL DUEÑO (licencia + gasto): pedir a Cochrane los términos de (a) acceso programático y (b) reuso en sistema generativo. Hasta entonces el adaptador queda en not_configured y el material Cochrane que llegue por PubMed se cita como resumen indexado, nunca como revisión completa.',
  },

  // ── Propietarios: sin contrato, sin adaptador operativo ──────────────────
  uptodate: {
    id: 'uptodate',
    nombre: 'UpToDate (Wolters Kluwer)',
    clase: 'referencia_terciaria',
    rol: 'respaldo',
    licencia: 'REQUIRES_AGREEMENT',
    porQue: [
      'Ya está en src/types/evidence.ts como LICENSE_UNKNOWN por la decisión D1 del dueño, que advierte de no convertir una copia personal del estándar en una base comercial redistribuida.',
      'UpToDate publica vías de integración institucional/EHR, pero son contratos empresariales: no hay una API de autoservicio.',
      'PROHIBIDO EXPLÍCITAMENTE POR #314: scraping, credenciales compartidas, automatizar un navegador alrededor del control de acceso, copiar el corpus o usar un endpoint no documentado. Este repo no contiene ninguna de esas cosas y el adaptador está construido para no poder hacerlas.',
    ].join(' '),
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'Existen programas de integración institucional/EHR documentados públicamente. Lo UNVERIFIABLE son sus TÉRMINOS, no su existencia.'),
      admitePhi: UNVERIFIABLE,
      reusoGenerativo: UNVERIFIABLE,
      precio: UNVERIFIABLE,
    },
    decisionPendiente: 'DECISIÓN DEL DUEÑO (licencia + gasto): iniciar contacto comercial con Wolters Kluwer para conocer términos de integración, precio y —crítico— si el reuso en un sistema generativo está permitido. Sin esa respuesta el adaptador NO se habilita.',
  },
  openevidence: {
    id: 'openevidence',
    nombre: 'OpenEvidence',
    clase: 'asistente_generativo',
    rol: 'respaldo',
    licencia: 'LICENSE_UNKNOWN',
    porQue: [
      'OpenEvidence es un producto de cara al médico, no un proveedor de datos con API pública documentada.',
      'AVISO ARQUITECTÓNICO: su salida es SINTETIZADA. Consumirla como "fuente" metería síntesis de otro modelo dentro de la nuestra, y el pasaje que respaldaría un claim sería texto GENERADO, no texto de la literatura. Eso rompe el invariante de src/types/evidence.ts (un Passage es subcadena LITERAL de un documento recuperado).',
      'Si algún día se integra, lo correcto es tratar su salida como DESCUBRIMIENTO (igual que Perplexity) y re-groundear en las fuentes primarias que cite, no como respaldo directo.',
    ].join(' '),
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: UNVERIFIABLE,
      reusoGenerativo: UNVERIFIABLE,
    },
    decisionPendiente: 'DECISIÓN DEL DUEÑO (licencia) + DECISIÓN ARQUITECTÓNICA: confirmar si existe una vía oficial de integración y, si existe, si su rol debe ser `descubrimiento` en vez de `respaldo`. La recomendación técnica de este slice es `descubrimiento`.',
  },

  // ── Descubrimiento: punto 7 de #314 ──────────────────────────────────────
  perplexity: {
    id: 'perplexity',
    nombre: 'Perplexity (búsqueda generativa)',
    clase: 'asistente_generativo',
    rol: 'descubrimiento',
    licencia: 'LICENSE_UNKNOWN',
    porQue: [
      'CLASIFICACIÓN EXPLÍCITA DE #314 (punto 7): sirve para DESCUBRIR, jamás para RESPALDAR.',
      'Una respuesta de Perplexity es texto generado. Aunque traiga enlaces, el texto que respaldaría la afirmación no es un pasaje de la fuente: es la paráfrasis del modelo. Anclar un claim ahí sería fabricar respaldo con pasos extra.',
      'USO LEGÍTIMO: proponer términos de búsqueda, identificar artículos candidatos o actuar de retador ("¿qué se me escapa?"). Lo que proponga se recupera DESPUÉS de una fuente verificable, y es esa recuperación —no Perplexity— la que respalda.',
      'La regla vive en el servidor: el rol `descubrimiento` hace que sobreConMaterial() RECHACE cualquier Source que venga por aquí (contrato.ts, ROL_NO_PUEDE_APORTAR_FUENTES). No depende de que un prompt se porte bien.',
    ].join(' '),
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'Tiene API de pago documentada. Lo pendiente es la decisión de gasto, no la existencia.'),
      admitePhi: si(false, 'Decisión de este repo: no se envía PHI a un buscador generativo de terceros.'),
      precio: UNVERIFIABLE,
      reusoGenerativo: si('irrelevante para respaldo: su salida no puede anclar un claim', 'No es una limitación de licencia sino del modelo de evidencia.'),
    },
    decisionPendiente: 'DECISIÓN DEL DUEÑO (gasto): la API es de pago. No se contrata nada en este slice.',
  },

  // ── Conocimiento personal: punto 8 de #314 ───────────────────────────────
  conocimiento_personal: {
    id: 'conocimiento_personal',
    nombre: 'Conocimiento personal del médico (Obsidian y equivalentes)',
    clase: 'notas_del_medico',
    rol: 'conocimiento_personal',
    licencia: 'OPEN',
    porQue: [
      'CLASIFICACIÓN EXPLÍCITA DE #314 (punto 8): son notas del propio médico, con procedencia de autor/fuente/fecha, y NUNCA ascienden automáticamente a nivel de guía.',
      'Valor real: es donde vive el criterio del Dr. —sus esquemas preferidos, su experiencia local, la resistencia bacteriana de SU hospital—. Eso no está en PubMed y a menudo es lo más útil que hay.',
      'Riesgo real y simétrico: una nota de hace cuatro años con una dosis que ya cambió es indistinguible, en texto plano, de una nota escrita ayer. Por eso la fecha de autoría es OBLIGATORIA y `frescura.ts` la evalúa con un umbral MÁS ESTRICTO que el de la literatura.',
      'El rol `conocimiento_personal` impide, por contrato, que produzca Source anclables. Se muestra como contexto atribuido al médico, separado visualmente de la evidencia externa.',
      'PRIVACIDAD: una bóveda personal puede contener PHI de pacientes reales. Cualquier importador futuro tiene que asumir que SÍ la contiene (.claude/rules/data-privacy.md), no que no.',
    ].join(' '),
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'Son archivos locales (Markdown). No hay proveedor con el que contratar.'),
      admitePhi: si(true, 'ES EL ÚNICO PROVEEDOR QUE PUEDE CONTENER PHI, porque es material del propio médico y nunca sale del inquilino. Justo por eso NO puede enviarse a ningún tercero.'),
      modeloDeCredencial: si('ninguna: importación explícita del médico', 'Nada se lee sin que el médico lo suba.'),
      derechoDeCache: si('dentro del inquilino, sí', 'Es material del propio consultorio.'),
      citaProfunda: si(true, 'Ruta del archivo + fecha de autoría.'),
      exponeFrescura: si(true, 'Fecha de la nota, que es OBLIGATORIA al importar.'),
      precio: si('sin costo', 'Archivos del médico.'),
      reusoGenerativo: si('dentro del inquilino y atribuido, sí; como guía, NO', 'Regla 8 de #314.'),
    },
    decisionPendiente: 'DECISIÓN DEL DUEÑO (política clínica): confirmar que el conocimiento personal se muestra SIEMPRE atribuido y separado, y que nunca alimenta al motor de razonamiento como si fuera guía. Este slice lo asume así y lo hace cumplir por contrato.',
  },

  // ── Adaptador determinista para pruebas y benchmark ──────────────────────
  sintetico: {
    id: 'sintetico',
    nombre: 'Fuente sintética (pruebas y benchmark)',
    clase: 'literatura_primaria',
    rol: 'respaldo',
    licencia: 'OPEN',
    proveedorCanonico: 'pubmed',
    porQue: 'Adaptador determinista con corpus sintético para que las pruebas y el benchmark de #314 no dependan de la red ni de una credencial. NO se usa en producción; su guardián lo comprueba.',
    matriz: {
      ...SIN_VERIFICAR,
      viaOficial: si(true, 'Es local.'),
      admitePhi: si(false, 'El corpus es sintético por regla (.claude/rules/data-privacy.md): cero pacientes reales.'),
      precio: si('sin costo', 'Local.'),
      semanticaDeFallo: si('inyectable por el test', 'Puede simular caída, rechazo y recorte a voluntad.'),
    },
    decisionPendiente: null,
  },
} as const satisfies Readonly<Record<string, Omit<EntradaDeCatalogo, 'id'> & { id: string }>>

export type ProveedorDeEvidencia = keyof typeof ENTRADAS

export const CATALOGO_DE_EVIDENCIA: Readonly<Record<ProveedorDeEvidencia, EntradaDeCatalogo>> =
  ENTRADAS as unknown as Readonly<Record<ProveedorDeEvidencia, EntradaDeCatalogo>>

// ---------------------------------------------------------------------------
// 7. Acceso
// ---------------------------------------------------------------------------

/** Entrada del catálogo. Devuelve `undefined` si el id no existe (no lanza). */
export function entradaDeCatalogo(p: ProveedorDeEvidencia): EntradaDeCatalogo {
  return CATALOGO_DE_EVIDENCIA[p]
}

export function esProveedorDeEvidencia(p: unknown): p is ProveedorDeEvidencia {
  return typeof p === 'string' && Object.prototype.hasOwnProperty.call(CATALOGO_DE_EVIDENCIA, p)
}

/** Proveedores cuyo material puede sostener una afirmación clínica. */
export function proveedoresDeRespaldo(): readonly ProveedorDeEvidencia[] {
  return (Object.keys(CATALOGO_DE_EVIDENCIA) as ProveedorDeEvidencia[])
    .filter(p => CATALOGO_DE_EVIDENCIA[p].rol === 'respaldo')
}

/**
 * Los campos legales sin verificar de un proveedor. Es la lista de preguntas
 * abiertas que el dueño necesita para decidir; la genera el documento de la
 * matriz y la comprueba su prueba.
 */
export function camposSinVerificar(p: ProveedorDeEvidencia): readonly string[] {
  const m = CATALOGO_DE_EVIDENCIA[p].matriz
  // Se compara contra el centinela en vez de llamar a `estaVerificado`: al
  // recorrer los 12 campos, `m[c]` es la UNIÓN de doce `Verificable<T>` con `T`
  // distinta, y ningún parámetro genérico concreto la acepta entera.
  return CAMPOS_DE_LA_MATRIZ.filter(c => m[c] === UNVERIFIABLE)
}

/** Todo lo que espera una decisión humana. Lo consume el documento de la matriz. */
export function decisionesPendientes(): readonly { proveedor: ProveedorDeEvidencia; decision: string }[] {
  return (Object.keys(CATALOGO_DE_EVIDENCIA) as ProveedorDeEvidencia[])
    .map(p => ({ proveedor: p, decision: CATALOGO_DE_EVIDENCIA[p].decisionPendiente }))
    .filter((d): d is { proveedor: ProveedorDeEvidencia; decision: string } => d.decision !== null)
}
