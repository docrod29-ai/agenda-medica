/**
 * Modelo Claim / Source / Passage — evidencia con procedencia verificable
 * (Nexus OS E2-01).
 *
 * PORQUÉ EXISTE: hoy la evidencia del repo son "5 referencias al final". El
 * modelo ya devuelve `{punto, sustento, citas:[n]}` (src/app/api/expediente/
 * evidencia/route.ts:153) pero NADIE valida esas citas: en
 * src/app/(dashboard)/consulta/[patientId]/page.tsx:2698 el render hace
 * `(nums ?? []).filter(n => arts[n - 1])`, así que un índice FUERA DE RANGO se
 * descarta EN SILENCIO y la afirmación se pinta idéntica a una respaldada. El
 * prompt además autoriza el arreglo de citas vacío. Resultado: hoy una
 * afirmación clínica sin respaldo se muestra al médico como hecho.
 *
 * LA ACEPTACIÓN DE E2-01 ES UNA FRASE: «una afirmación sin pasaje de respaldo
 * no puede construirse». Se hace cumplir por DOS puertas independientes:
 *   1. El COMPILADOR (`Claim.apoyos: NoVacio<Passage>` + marcas fantasma). Los
 *      casos negativos viven en src/__tests__/tipos/evidence.tipos.ts.
 *   2. El RUNTIME (`claimDesde` / `claimDesdeJSON`), porque un Claim no nace de
 *      código escrito a mano: nace del JSON que devuelve un LLM, y ahí el tipo
 *      no protege nada. Estas fábricas NUNCA lanzan, NUNCA inventan y NUNCA
 *      descartan en silencio: devuelven `Resultado` con motivo.
 *
 * QUÉ APORTA DE NUEVO: el `Passage`. El repo ya tiene retrieval
 * (src/lib/evidencia/pubmed.ts) y evidencia estructurada (src/lib/uci/
 * evidencia.ts, con `verified: boolean` puesto a mano). Lo que no existe en
 * ninguna parte es el FRAGMENTO LITERAL de la fuente que respalda la
 * afirmación. Eso es lo que convierte una referencia en evidencia auditable.
 *
 * ALCANCE DELIBERADO — lo que este archivo NO hace:
 *  - NO define jerarquía ni peso de la evidencia (que una guía pese más que un
 *    ECA es criterio metodológico). `DisenoDeEstudio` es una taxonomía
 *    DESCRIPTIVA sin orden. La jerarquía es E2-03 (validacionClinica: true).
 *  - NO verifica ENTAILMENT (si el pasaje realmente IMPLICA la afirmación).
 *    Aquí sólo se garantiza LITERALIDAD y PROCEDENCIA. Un pasaje real que no
 *    respalda la afirmación pasa este filtro; atraparlo es E2-06. Es una
 *    limitación DECLARADA, no un descuido.
 *  - NO se cablea a ninguna ruta ni al render (eso es E2-05, cambio visible en
 *    producción). Este módulo no tiene callers todavía.
 *
 * NO se registra en CLINICAL_ENGINE_REGISTRY: no calcula nada clínico y no
 * tiene callers; registrarlo sin ADR subiría la deuda congelada de E0-03 y
 * pondría el CI en rojo. Mismo criterio que E0-04.
 *
 * OJO, NO CONFUNDIR con src/__tests__/claims-guard.test.ts: aquél vigila
 * AFIRMACIONES PUBLICITARIAS de la landing. Esto son afirmaciones CLÍNICAS.
 * Son cosas distintas y no deben fusionarse.
 *
 * Sin dependencias: ni red, ni Firebase, ni `process.env`. Funciones puras y
 * deterministas (cero `Date.now()`, cero `Math.random()`).
 */

// ---------------------------------------------------------------------------
// 0. Utilidades de tipo y de resultado
// ---------------------------------------------------------------------------

/**
 * Tupla NO VACÍA. `Passage[]` NO es asignable a esto: hay que probar el primer
 * elemento. Es la mitad "de compilación" de la aceptación de la unidad.
 */
export type NoVacio<T> = readonly [T, ...T[]]

/**
 * Resultado explícito. Las fábricas de este módulo son TOTALES: no lanzan
 * excepciones y no devuelven `null` a secas — devuelven el motivo, porque el
 * motivo es la información que hoy se pierde en el render de consulta.
 */
export type Resultado<T, M extends string> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly motivo: M; readonly detalle: string }

const ok = <T>(valor: T): { readonly ok: true; readonly valor: T } => ({ ok: true, valor })
const mal = <M extends string>(motivo: M, detalle: string): { readonly ok: false; readonly motivo: M; readonly detalle: string } =>
  ({ ok: false, motivo, detalle })

// ---------------------------------------------------------------------------
// 1. Catálogo de proveedores y licencia (decisión D1 del Dr., ya tomada)
// ---------------------------------------------------------------------------

/**
 * Proveedores de evidencia y su estatus de licencia.
 *
 * NO se inventa criterio: codifica la decisión D1 del médico dueño en
 * docs/clinical-decisions/DECISIONES-ARQUITECTURA-2026-07-28.md:279-294, que
 * advierte expresamente que no se debe «convertir una copia personal del
 * estándar en una base comercial redistribuida».
 *
 * Efecto: construir un `Source` de UpToDate o de CLSI NO COMPILA.
 */
export const PROVEEDORES = {
  pubmed:          { nombre: 'PubMed/MEDLINE',     licencia: 'ENABLED' },
  pmc:             { nombre: 'PubMed Central',     licencia: 'ENABLED' },
  crossref:        { nombre: 'Crossref',           licencia: 'ENABLED' },
  clinicaltrials:  { nombre: 'ClinicalTrials.gov', licencia: 'ENABLED' },
  who:             { nombre: 'WHO',                licencia: 'ENABLED' },
  cdc:             { nombre: 'CDC',                licencia: 'ENABLED' },
  fda_dailymed:    { nombre: 'FDA/DailyMed',       licencia: 'ENABLED' },
  ema:             { nombre: 'EMA',                licencia: 'ENABLED' },
  idsa_publica:    { nombre: 'IDSA (pública)',     licencia: 'ENABLED' },
  escmid_publica:  { nombre: 'ESCMID (pública)',   licencia: 'ENABLED' },
  eucast:          { nombre: 'EUCAST',             licencia: 'ENABLED' },
  uptodate:        { nombre: 'UpToDate',           licencia: 'LICENSE_UNKNOWN' },
  accessmedicine:  { nombre: 'AccessMedicine',     licencia: 'LICENSE_UNKNOWN' },
  clinicalkey:     { nombre: 'ClinicalKey',        licencia: 'LICENSE_UNKNOWN' },
  revista_de_pago: { nombre: 'Revista de pago',    licencia: 'LICENSE_UNKNOWN' },
  clsi:            { nombre: 'CLSI',               licencia: 'LICENSE_UNKNOWN' },
} as const satisfies Readonly<Record<string, { nombre: string; licencia: 'ENABLED' | 'LICENSE_UNKNOWN' }>>

export type Proveedor = keyof typeof PROVEEDORES

/** Sólo los proveedores con licencia `ENABLED`. Los demás no son expresables. */
export type ProveedorHabilitado =
  { [K in Proveedor]: (typeof PROVEEDORES)[K]['licencia'] extends 'ENABLED' ? K : never }[Proveedor]

/** ¿Este identificador es un proveedor habilitado? (validación de RUNTIME). */
export function esProveedorHabilitado(p: unknown): p is ProveedorHabilitado {
  return typeof p === 'string'
    && Object.prototype.hasOwnProperty.call(PROVEEDORES, p)
    && PROVEEDORES[p as Proveedor].licencia === 'ENABLED'
}

// ---------------------------------------------------------------------------
// 2. Marcas fantasma — NO se exportan
// ---------------------------------------------------------------------------

/**
 * MARCAS INVARIANTES — NO BORRAR NI SIMPLIFICAR A `readonly marca?: never`.
 *
 * No se exportan ⇒ desde fuera del módulo es IMPOSIBLE escribir el objeto a
 * mano y hacerlo pasar por `Source`/`Passage`/`Claim`/`Estudio`. La única
 * puerta es la fábrica.
 *
 * Cada marca es una función de un literal a un literal (el mismo tipo en
 * posición contravariante y covariante) para que el tipo sea invariante y no
 * se ensanche, igual que en E0-04.
 *
 * CONTROL NEGATIVO EJECUTADO (DISENO §4.4): sustituyendo las marcas por
 * `readonly marcaClaim?: never`, 2 de los 6 casos negativos DEJAN de fallar
 * (un Passage inventado y un Claim inventado compilan) y `tsc` sale con
 * TS2578. Si las borras, el CI queda VERDE y la aceptación desaparece; por eso
 * hay un guardián en src/__tests__/evidence-model.test.ts.
 */
declare const MARCA_SOURCE: unique symbol
declare const MARCA_PASAJE: unique symbol
declare const MARCA_CLAIM: unique symbol
declare const MARCA_ESTUDIO: unique symbol

// ---------------------------------------------------------------------------
// 3. Fechas — dos, y con precisión honesta
// ---------------------------------------------------------------------------

/**
 * PubMed a veces sólo entrega el AÑO (src/lib/evidencia/pubmed.ts:119 extrae
 * `<Year>`). Completar a '2024-01-01' INVENTA once meses; este tipo conserva
 * la precisión que realmente había.
 */
export type FechaPublicacion =
  | { readonly precision: 'anio'; readonly iso: `${number}` }
  | { readonly precision: 'mes'; readonly iso: `${number}-${number}` }
  | { readonly precision: 'dia'; readonly iso: string }
  | { readonly precision: 'desconocida' }

/**
 * Construye una `FechaPublicacion` desde lo que haya, SIN rellenar lo que
 * falta. Si no reconoce el formato devuelve `desconocida` — nunca adivina.
 */
export function fechaPublicacionDesde(v: unknown): FechaPublicacion {
  if (typeof v !== 'string') return { precision: 'desconocida' }
  const s = v.trim()
  if (/^\d{4}$/.test(s)) return { precision: 'anio', iso: s as `${number}` }
  if (/^\d{4}-\d{2}$/.test(s)) return { precision: 'mes', iso: s as `${number}-${number}` }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { precision: 'dia', iso: s }
  return { precision: 'desconocida' }
}

// ---------------------------------------------------------------------------
// 4. Source — un documento recuperado de un proveedor habilitado
// ---------------------------------------------------------------------------

export interface Source {
  /** `${proveedor}:${idExterno}` — p. ej. `pubmed:38412345`. Determinista. */
  readonly id: string
  readonly proveedor: ProveedorHabilitado
  /** PMID, DOI, NCT… */
  readonly idExterno: string
  readonly titulo: string
  /** Revista u organización que lo publica. */
  readonly contenedor?: string
  readonly publicado: FechaPublicacion
  /** Instante ISO de la RECUPERACIÓN (métrica de frescura, decisión D2). */
  readonly recuperadoEn: string
  /**
   * El texto sobre el que se pueden anclar pasajes. Hoy = resumen público
   * (+ texto completo de PMC Open Access). El texto completo de revistas de
   * paga NO se descarga ni se reproduce.
   */
  readonly textoRecuperado: string
  readonly url?: string
  readonly [MARCA_SOURCE]: (s: 'source') => 'source'
}

export interface EntradaSource {
  readonly proveedor: ProveedorHabilitado
  readonly idExterno: string
  readonly titulo: string
  readonly contenedor?: string
  readonly publicado: FechaPublicacion
  readonly recuperadoEn: string
  readonly textoRecuperado: string
  readonly url?: string
}

export type MotivoRechazoSource =
  | 'PROVEEDOR_NO_HABILITADO'
  | 'SIN_ID_EXTERNO'
  | 'SIN_TITULO'
  | 'SIN_TEXTO_RECUPERADO'
  | 'FECHA_RECUPERACION_INVALIDA'

/**
 * Única puerta de entrada a `Source`.
 *
 * `recuperadoEn` se EXIGE al llamador en vez de tomarlo de `Date.now()`: así
 * las fábricas quedan puras y los ids/tests son reproducibles. Quien recupera
 * el documento es quien sabe cuándo lo recuperó.
 */
export function fuente(entrada: EntradaSource): Resultado<Source, MotivoRechazoSource> {
  // El compilador ya bloquea los proveedores LICENSE_UNKNOWN, pero un objeto
  // que viene de Firestore o de un `as` no pasó por el compilador.
  if (!esProveedorHabilitado(entrada.proveedor)) {
    return mal('PROVEEDOR_NO_HABILITADO', `proveedor "${String(entrada.proveedor)}" no está habilitado (ver PROVEEDORES / decisión D1)`)
  }
  const idExterno = typeof entrada.idExterno === 'string' ? entrada.idExterno.trim() : ''
  if (!idExterno) return mal('SIN_ID_EXTERNO', 'un Source sin identificador externo no es citable ni deduplicable')
  const titulo = typeof entrada.titulo === 'string' ? entrada.titulo.trim() : ''
  if (!titulo) return mal('SIN_TITULO', 'un Source sin título no se puede mostrar al médico')
  const textoRecuperado = typeof entrada.textoRecuperado === 'string' ? entrada.textoRecuperado : ''
  // Sin texto no hay pasajes posibles ⇒ no hay claims posibles. Falla ruidosa.
  if (!textoRecuperado.trim()) return mal('SIN_TEXTO_RECUPERADO', 'sin texto recuperado no se puede anclar ningún pasaje')
  const recuperadoEn = typeof entrada.recuperadoEn === 'string' ? entrada.recuperadoEn.trim() : ''
  if (!recuperadoEn || Number.isNaN(Date.parse(recuperadoEn))) {
    return mal('FECHA_RECUPERACION_INVALIDA', `recuperadoEn "${String(entrada.recuperadoEn)}" no es un instante ISO válido`)
  }
  const s: Omit<Source, typeof MARCA_SOURCE> = {
    id: `${entrada.proveedor}:${idExterno}`,
    proveedor: entrada.proveedor,
    idExterno,
    titulo,
    ...(entrada.contenedor ? { contenedor: entrada.contenedor } : {}),
    publicado: entrada.publicado ?? { precision: 'desconocida' },
    recuperadoEn,
    textoRecuperado,
    ...(entrada.url ? { url: entrada.url } : {}),
  }
  // Aserción inevitable y CONFINADA a la fábrica: la marca es `declare`, no
  // existe en tiempo de ejecución — sólo en el tipo.
  return ok(s as Source)
}

// ---------------------------------------------------------------------------
// 5. Passage — fragmento LITERAL de un Source
// ---------------------------------------------------------------------------

export interface Passage {
  /** Determinista: `${sourceId}#${inicio}-${fin}`. Sin Date.now, sin random. */
  readonly id: string
  readonly sourceId: string
  /** Subcadena LITERAL de `Source.textoRecuperado` (offsets [inicio, fin)). */
  readonly texto: string
  readonly inicio: number
  readonly fin: number
  readonly [MARCA_PASAJE]: (p: 'passage') => 'passage'
}

export type MotivoRechazoPasaje =
  | 'PASAJE_VACIO'
  | 'PASAJE_NO_LITERAL'
  | 'PASAJE_DEMASIADO_CORTO'
  | 'FUENTE_DESCONOCIDA'

/**
 * Mínimo de caracteres de un pasaje. ES UNA GUARDA DE SOFTWARE, NO UN UMBRAL
 * CLÍNICO: un fragmento de 3 caracteres ("10%") es subcadena de casi cualquier
 * resumen y volvería la verificación literal decorativa. El número es
 * ARBITRARIO y ajustable por parámetro; por eso NO tiene ADR clínico: no
 * decide nada médico.
 */
export const MINIMO_CARACTERES_PASAJE = 40

/**
 * Normalización CONSERVADORA para comparar textos, con mapa de offsets hacia
 * el texto ORIGINAL (para que `Passage.texto` siga siendo la subcadena literal
 * de `textoRecuperado`, no una versión maquillada).
 *
 * QUÉ SE NORMALIZA: espacios/saltos colapsados y guiones/comillas tipográficos
 * Unicode unificados — diferencias de MAQUETACIÓN, no de contenido.
 *
 * QUÉ NO SE NORMALIZA, A PROPÓSITO: dígitos, separadores decimales y acentos.
 * Si la fuente escribe `0·72` (estilo Lancet) y el modelo escribe `0.72`, NO
 * coincide y se RECHAZA. Preferimos un rechazo honesto a una coincidencia
 * inventada: normalizar cifras es exactamente cómo se cuela un dato falso.
 */
const GUIONES = /[‐‑‒–—―−]/
const COMILLAS_SIMPLES = /[‘’‚‛′]/
const COMILLAS_DOBLES = /[“”„‟″]/

function normalizarConMapa(texto: string): { normal: string; mapa: number[] } {
  const salida: string[] = []
  // mapa[i] = índice en el texto ORIGINAL del carácter normalizado i.
  const mapa: number[] = []
  let enEspacio = true // arranca en true para comerse el espacio inicial (trim)
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (/\s/.test(c)) {
      if (!enEspacio) { salida.push(' '); mapa.push(i); enEspacio = true }
      continue
    }
    enEspacio = false
    const n = GUIONES.test(c) ? '-' : COMILLAS_SIMPLES.test(c) ? "'" : COMILLAS_DOBLES.test(c) ? '"' : c
    salida.push(n)
    mapa.push(i)
  }
  // Quita el espacio final si lo hubiera (trim del lado derecho).
  while (salida.length && salida[salida.length - 1] === ' ') { salida.pop(); mapa.pop() }
  // Centinela: índice ORIGINAL siguiente al último carácter conservado, para
  // poder calcular `fin` exclusivo sin salirse del arreglo.
  mapa.push(mapa.length ? mapa[mapa.length - 1] + 1 : 0)
  return { normal: salida.join(''), mapa }
}

/** Igual que arriba pero sin mapa, para el lado del texto citado. */
export function normalizarParaComparar(texto: string): string {
  return normalizarConMapa(texto).normal
}

/**
 * Construye un `Passage` SÓLO si `textoCitado` aparece TAL CUAL en el texto de
 * la fuente (tras la normalización conservadora de arriba). Una paráfrasis NO
 * es un pasaje.
 *
 * OJO: esto verifica LITERALIDAD, no ENTAILMENT. Que el pasaje exista no
 * significa que respalde la afirmación; eso es E2-06.
 */
export function pasaje(
  s: Source,
  textoCitado: string,
  opts?: { minimoCaracteres?: number },
): Resultado<Passage, MotivoRechazoPasaje> {
  // Defensa de runtime: un "Source" puede llegar de Firestore por un `as`.
  if (!s || typeof s.textoRecuperado !== 'string' || !s.textoRecuperado.trim() || typeof s.id !== 'string' || !s.id) {
    return mal('FUENTE_DESCONOCIDA', 'la fuente no tiene id o no tiene texto recuperado sobre el que anclar')
  }
  if (typeof textoCitado !== 'string' || !textoCitado.trim()) {
    return mal('PASAJE_VACIO', 'el texto citado está vacío')
  }
  const minimo = opts?.minimoCaracteres ?? MINIMO_CARACTERES_PASAJE
  const citaNormal = normalizarParaComparar(textoCitado)
  if (citaNormal.length < minimo) {
    return mal('PASAJE_DEMASIADO_CORTO', `el pasaje tiene ${citaNormal.length} caracteres normalizados y el mínimo de software es ${minimo}`)
  }
  const { normal, mapa } = normalizarConMapa(s.textoRecuperado)
  const idx = normal.indexOf(citaNormal)
  if (idx < 0) {
    return mal('PASAJE_NO_LITERAL', `el texto citado no aparece literalmente en ${s.id} (no se normalizan cifras ni acentos, a propósito)`)
  }
  const inicio = mapa[idx]
  const fin = mapa[idx + citaNormal.length]
  const p: Omit<Passage, typeof MARCA_PASAJE> = {
    id: `${s.id}#${inicio}-${fin}`,
    sourceId: s.id,
    texto: s.textoRecuperado.slice(inicio, fin),
    inicio,
    fin,
  }
  return ok(p as Passage)
}

// ---------------------------------------------------------------------------
// 6. Claim — LA ACEPTACIÓN DE LA UNIDAD
// ---------------------------------------------------------------------------

export interface Claim {
  readonly id: string
  /** Síntesis en español (decisión D3: fuente en su idioma, síntesis en español). */
  readonly texto: string
  /** ← LA ACEPTACIÓN, escrita en el tipo: uno o más pasajes, nunca cero. */
  readonly apoyos: NoVacio<Passage>
  readonly [MARCA_CLAIM]: (c: 'claim') => 'claim'
}

export type MotivoRechazoClaim =
  | 'TEXTO_VACIO'
  | 'SIN_PASAJE'             // ← el caso `citas: []` que el prompt autoriza hoy
  | 'CITA_FUERA_DE_RANGO'    // ← el bug de consulta/page.tsx:2698, ahora EXPLÍCITO
  | 'PASAJE_NO_LITERAL'
  | 'PASAJE_DEMASIADO_CORTO' // se conserva aparte para NO perder información
  | 'CIFRA_NO_LITERAL'       // la afirmación reporta un número que no está en el pasaje
  | 'FUENTE_DESCONOCIDA'

/**
 * Hash FNV-1a de 32 bits, en hexadecimal. Se implementa aquí (7 líneas) en vez
 * de importar `node:crypto` para que el módulo siga siendo puro e isomorfo.
 * Sólo sirve para dar un id DETERMINISTA y corto — no es criptográfico y no se
 * usa para integridad.
 */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Construye un `Claim`. El compilador ya garantiza que `apoyos` no está vacío
 * (`NoVacio<Passage>`) y que cada apoyo salió de `pasaje()` (marca fantasma);
 * lo único que queda por validar en runtime es el texto.
 *
 * El id es DETERMINISTA (texto + ids de los apoyos): mismo input ⇒ mismo id,
 * para que los tests sean reproducibles y los claims deduplicables (lo necesita
 * E2-04).
 */
export function claim(texto: string, apoyos: NoVacio<Passage>): Resultado<Claim, 'TEXTO_VACIO'> {
  const t = typeof texto === 'string' ? texto.trim() : ''
  if (!t) return mal('TEXTO_VACIO', 'una afirmación sin texto no es una afirmación')
  const c: Omit<Claim, typeof MARCA_CLAIM> = {
    id: `claim:${hash(`${t}|${apoyos.map(a => a.id).join(',')}`)}`,
    texto: t,
    apoyos,
  }
  return ok(c as Claim)
}

/**
 * Forma CRUDA en la que hoy llega una afirmación desde el LLM. Refleja el
 * contrato que ya existe en src/app/api/expediente/evidencia/route.ts:153
 * (`{punto, sustento, citas:[n]}`), con `citas` como índices 1-BASADOS sobre la
 * lista de fuentes que se le mostró al modelo, más el texto literal que dice
 * haber citado de cada una.
 */
export interface ClaimCrudo {
  readonly texto: string
  /** Índices 1-basados sobre `fuentes`, tal como los devuelve el modelo. */
  readonly citas: readonly number[]
  /** Texto citado de cada fuente, EN EL MISMO ORDEN que `citas`. */
  readonly pasajes: readonly string[]
  /**
   * Cifra que la afirmación reporta (p. ej. "HR 0.72"). Si se declara, DEBE
   * aparecer literalmente en alguno de los pasajes.
   */
  readonly cifra?: string
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * ÚNICA PUERTA para datos que vienen de FUERA (LLM, Firestore, HTTP).
 *
 * Aquí es donde de verdad se cumple la aceptación, porque el compilador no ve
 * el `JSON.parse` de la respuesta del modelo.
 *
 * DIFERENCIA CLAVE CON EL CÓDIGO DE HOY: un índice de cita fuera de rango es un
 * RECHAZO con motivo, no un descarte silencioso. Hoy
 * `(nums ?? []).filter(n => arts[n - 1])` lo borra y la afirmación se pinta
 * como si estuviera respaldada.
 */
export function claimDesde(datos: unknown, fuentes: readonly Source[]): Resultado<Claim, MotivoRechazoClaim> {
  if (!esObjeto(datos)) return mal('TEXTO_VACIO', 'la entrada no es un objeto')
  const texto = typeof datos.texto === 'string' ? datos.texto.trim() : ''
  if (!texto) return mal('TEXTO_VACIO', 'una afirmación sin texto no es una afirmación')

  const citas = Array.isArray(datos.citas) ? datos.citas : null
  // ACEPTACIÓN: sin citas no hay claim. Ni `[]`, ni ausente, ni basura.
  if (!citas || citas.length === 0) {
    return mal('SIN_PASAJE', 'la afirmación no trae ninguna cita: una afirmación sin pasaje de respaldo no puede construirse')
  }
  const textosCitados = Array.isArray(datos.pasajes) ? datos.pasajes : null
  if (!textosCitados || textosCitados.length === 0) {
    return mal('SIN_PASAJE', 'la afirmación cita fuentes pero no aporta el texto literal que las respalda')
  }
  if (textosCitados.length !== citas.length) {
    return mal('SIN_PASAJE', `hay ${citas.length} citas y ${textosCitados.length} pasajes: no se puede emparejar sin adivinar`)
  }

  const apoyos: Passage[] = []
  for (let i = 0; i < citas.length; i++) {
    const n = citas[i]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > fuentes.length) {
      return mal('CITA_FUERA_DE_RANGO', `la cita [${String(n)}] no corresponde a ninguna de las ${fuentes.length} fuentes (hoy este caso se descarta en silencio)`)
    }
    const citado = textosCitados[i]
    const r = pasaje(fuentes[n - 1], typeof citado === 'string' ? citado : '')
    if (!r.ok) {
      // Los motivos del pasaje se PROPAGAN tal cual; no se colapsan en uno solo.
      const motivo: MotivoRechazoClaim = r.motivo === 'PASAJE_VACIO' ? 'SIN_PASAJE' : r.motivo
      return mal(motivo, r.detalle)
    }
    apoyos.push(r.valor)
  }

  if (typeof datos.cifra === 'string' && datos.cifra.trim()) {
    const cifra = normalizarParaComparar(datos.cifra)
    const respaldada = apoyos.some(a => normalizarParaComparar(a.texto).includes(cifra))
    if (!respaldada) {
      return mal('CIFRA_NO_LITERAL', `la cifra "${datos.cifra}" no aparece literalmente en ningún pasaje de respaldo`)
    }
  }

  // `apoyos` tiene al menos un elemento: el bucle corrió ≥1 vez y cualquier
  // fallo devolvió antes. La aserción a NoVacio está confinada a esta línea.
  return claim(texto, apoyos as unknown as NoVacio<Passage>)
}

/**
 * Rehidrata un `Claim` que volvió de Firestore o de `JSON.stringify`.
 *
 * La marca sólo existe en el TIPO, así que un objeto serializado NO es un
 * `Claim` hasta pasar por aquí. Y no se confía en el `texto` guardado: cada
 * pasaje se vuelve a verificar contra el texto de su fuente, así que un
 * documento manipulado en la base de datos no puede fabricar respaldo.
 */
export function claimDesdeJSON(datos: unknown, fuentes: readonly Source[]): Resultado<Claim, MotivoRechazoClaim> {
  if (!esObjeto(datos)) return mal('TEXTO_VACIO', 'la entrada no es un objeto')
  const texto = typeof datos.texto === 'string' ? datos.texto.trim() : ''
  if (!texto) return mal('TEXTO_VACIO', 'una afirmación sin texto no es una afirmación')
  const crudos = Array.isArray(datos.apoyos) ? datos.apoyos : null
  if (!crudos || crudos.length === 0) {
    return mal('SIN_PASAJE', 'el objeto serializado no trae apoyos: una afirmación sin pasaje de respaldo no puede construirse')
  }
  const porId = new Map(fuentes.map(f => [f.id, f]))
  const apoyos: Passage[] = []
  for (const crudo of crudos) {
    if (!esObjeto(crudo)) return mal('SIN_PASAJE', 'un apoyo serializado no es un objeto')
    const s = typeof crudo.sourceId === 'string' ? porId.get(crudo.sourceId) : undefined
    if (!s) return mal('FUENTE_DESCONOCIDA', `el apoyo apunta a la fuente "${String(crudo.sourceId)}", que no está entre las ${fuentes.length} fuentes dadas`)
    const r = pasaje(s, typeof crudo.texto === 'string' ? crudo.texto : '')
    if (!r.ok) {
      const motivo: MotivoRechazoClaim = r.motivo === 'PASAJE_VACIO' ? 'SIN_PASAJE' : r.motivo
      return mal(motivo, r.detalle)
    }
    apoyos.push(r.valor)
  }
  return claim(texto, apoyos as unknown as NoVacio<Passage>)
}

// ---------------------------------------------------------------------------
// 7. Estudio — población, diseño, efecto, limitaciones y fecha (objetivo del backlog)
// ---------------------------------------------------------------------------

export type MotivoAusencia =
  | 'no_reportado_en_la_fuente'  // la fuente no lo dice
  | 'no_extraido_todavia'        // aún no se intentó extraer
  | 'no_aplica_a_este_diseno'    // p. ej. "efecto" en una guía narrativa

/**
 * Un dato de la evidencia: o se conoce Y SE SABE DE QUÉ PASAJE SALIÓ, o se
 * declara ausente CON MOTIVO. No hay tercera forma.
 *
 * `undefined` significando "normal" o "ninguno" es exactamente el bug que este
 * tipo existe para impedir (doctrina `missing ≠ 0` de `num()` y del registry).
 */
export type Declarado<T> =
  | { readonly conocido: true; readonly valor: T; readonly pasajeId: string }
  | { readonly conocido: false; readonly motivo: MotivoAusencia }

/**
 * Taxonomía DESCRIPTIVA de diseños de estudio. DELIBERADAMENTE SIN PESO NI
 * ORDEN: decidir que una guía pesa más que un ECA es criterio metodológico y
 * es E2-03 (validacionClinica: true). Aquí sólo se nombra lo que es.
 */
export type DisenoDeEstudio =
  | 'metaanalisis' | 'revision_sistematica'
  | 'ensayo_clinico_aleatorizado' | 'ensayo_clinico_no_aleatorizado'
  | 'cohorte' | 'casos_y_controles' | 'transversal'
  | 'serie_de_casos' | 'reporte_de_caso'
  | 'guia_de_practica_clinica' | 'documento_regulatorio'
  | 'revision_narrativa' | 'preclinico'
  | 'otro' | 'no_declarado'

export type MedidaDeEfecto =
  | 'HR' | 'RR' | 'OR' | 'diferencia_de_riesgo' | 'diferencia_de_medias'
  | 'NNT' | 'NNH' | 'proporcion' | 'otra'

export interface Efecto {
  readonly medida: MedidaDeEfecto
  readonly valor: number
  readonly ic95?: readonly [number, number]
  readonly p?: number
  readonly unidad?: string
  /** La cifra TAL CUAL aparece en el pasaje. Si no aparece literal, no hay efecto. */
  readonly citaLiteral: string
}

export interface Poblacion {
  readonly descripcion: string
  readonly n?: number
  readonly criteriosInclusion?: readonly string[]
  readonly criteriosExclusion?: readonly string[]
}

export interface Estudio {
  readonly source: Source
  readonly poblacion: Declarado<Poblacion>
  readonly diseno: Declarado<DisenoDeEstudio>
  readonly efecto: Declarado<Efecto>
  readonly limitaciones: Declarado<readonly string[]>
  readonly [MARCA_ESTUDIO]: (e: 'estudio') => 'estudio'
}

export interface EntradaEstudio {
  readonly source: Source
  readonly poblacion: Declarado<Poblacion>
  readonly diseno: Declarado<DisenoDeEstudio>
  readonly efecto: Declarado<Efecto>
  readonly limitaciones: Declarado<readonly string[]>
  /** Pasajes (del MISMO source) a los que se anclan los campos conocidos. */
  readonly pasajes: readonly Passage[]
}

export type MotivoRechazoEstudio =
  | 'PASAJE_AJENO_AL_SOURCE'
  | 'LIMITACIONES_VACIAS'
  | 'POBLACION_VACIA'
  | 'CIFRA_NO_LITERAL'

/**
 * Construye un `Estudio`: un `Source` más los cuatro datos que pide el objetivo
 * del backlog, CADA UNO anclado a un pasaje de ESE MISMO source o declarado
 * ausente con motivo.
 */
export function estudio(entrada: EntradaEstudio): Resultado<Estudio, MotivoRechazoEstudio> {
  const porId = new Map(entrada.pasajes.map(p => [p.id, p]))

  // Un campo CONOCIDO debe apuntar a un pasaje de ESTE source. Un pasaje de
  // otro artículo "respaldando" la población de éste es procedencia falsa.
  for (const [campo, d] of [
    ['poblacion', entrada.poblacion],
    ['diseno', entrada.diseno],
    ['efecto', entrada.efecto],
    ['limitaciones', entrada.limitaciones],
  ] as const) {
    if (!d.conocido) continue
    const p = porId.get(d.pasajeId)
    if (!p || p.sourceId !== entrada.source.id) {
      return mal('PASAJE_AJENO_AL_SOURCE', `el campo "${campo}" se ancla al pasaje "${d.pasajeId}", que no pertenece a ${entrada.source.id}`)
    }
  }

  // Un arreglo de limitaciones VACÍO es ambiguo («la fuente no declaró
  // limitaciones» vs. «no las extrajimos») y la lectura ambigua más peligrosa
  // es «este estudio no tiene limitaciones». Hay que decir cuál de las dos es.
  if (entrada.limitaciones.conocido && entrada.limitaciones.valor.length === 0) {
    return mal('LIMITACIONES_VACIAS', 'limitaciones conocido:true con arreglo vacío es ambiguo: declara el motivo de ausencia')
  }
  if (entrada.poblacion.conocido && !entrada.poblacion.valor.descripcion.trim()) {
    return mal('POBLACION_VACIA', 'una población conocida sin descripción no describe nada')
  }
  // La cifra del efecto debe aparecer TAL CUAL en el pasaje al que se ancla.
  if (entrada.efecto.conocido) {
    const p = porId.get(entrada.efecto.pasajeId)!
    const cita = normalizarParaComparar(entrada.efecto.valor.citaLiteral)
    if (!cita || !normalizarParaComparar(p.texto).includes(cita)) {
      return mal('CIFRA_NO_LITERAL', `la cita literal del efecto ("${entrada.efecto.valor.citaLiteral}") no aparece en el pasaje ${p.id}`)
    }
  }

  const e: Omit<Estudio, typeof MARCA_ESTUDIO> = {
    source: entrada.source,
    poblacion: entrada.poblacion,
    diseno: entrada.diseno,
    efecto: entrada.efecto,
    limitaciones: entrada.limitaciones,
  }
  return ok(e as Estudio)
}
