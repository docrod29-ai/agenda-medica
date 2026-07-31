/**
 * Extractor PICO — la búsqueda se ARMA desde facetas, no desde texto crudo
 * (Nexus OS E2-02).
 *
 * PORQUÉ EXISTE: hoy, entre la pregunta del médico y PubMed sólo viaja una
 * CADENA OPACA. En src/app/api/consultor-evidencia/route.ts:150 el prompt le
 * pide al modelo «líneas de consulta ya armadas… unidas con AND/OR», el código
 * las recoge como strings (:156-157) y las manda tal cual (:166). Igual en
 * src/app/api/expediente/evidencia/route.ts:80-95. Y hay tres caminos de texto
 * literal como red de seguridad: `buscarEvidencia(pregunta)` con la pregunta en
 * español entera (:172), `traducirBasico()` (bolsa de palabras unida con
 * espacios) y `[dx[0], ...meds].join(' ')` (:73), que PEGA población e
 * intervención en una sola cadena. Resultado: nadie puede auditar, deduplicar,
 * relajar ni explicarle al médico de dónde salió una búsqueda.
 *
 * LA ACEPTACIÓN DE E2-02 ES UNA FRASE: «la búsqueda se arma desde PICO, no
 * desde embeddings del texto crudo». (La mitad de «embeddings» ya se cumple por
 * ausencia: no existen vectores en el repo. Lo que faltaba es la estructura.)
 * Se hace cumplir por DOS puertas independientes, igual que en E2-01:
 *   1. El COMPILADOR: `consultaDesdePICO` sólo acepta un `PICO` y `buscarConPICO`
 *      sólo acepta `ConsultaPubMed`, ambos con marca fantasma NO exportada ⇒ una
 *      cadena no compila y una `ConsultaPubMed` escrita a mano tampoco. Los casos
 *      negativos viven en src/__tests__/tipos/pico.tipos.ts.
 *   2. El RUNTIME (`picoDesdeModelo`), porque el compilador no ve el `JSON.parse`
 *      de la respuesta del LLM. Ahí el modo obvio de romper la aceptación
 *      fingiendo cumplirla es que el modelo devuelva la consulta ya armada
 *      DENTRO de un campo del PICO: `{poblacion: "(UTI OR cystitis) AND women"}`.
 *      Eso se RECHAZA con motivo (`CONSULTA_DICTADA_POR_EL_MODELO`), no se
 *      limpia en silencio: borrarle los paréntesis produciría un término que
 *      nadie escribió. El modelo aporta TÉRMINOS; el ensamblado lo hace código
 *      determinista.
 *
 * ALCANCE DELIBERADO — lo que este archivo NO hace:
 *  - NO juzga si el PICO es CLÍNICAMENTE el adecuado. Que «recurrent UTI» sea la
 *    población correcta para la pregunta del médico es juicio clínico. Aquí sólo
 *    se garantizan ESTRUCTURA y PROCEDENCIA (igual que E2-01 garantizaba
 *    literalidad y no entailment). Limitación DECLARADA, no descuido.
 *  - NO emite field tags ni MeSH (`[tiab]`, `[mh]`). Para poner `[mh]` hay que
 *    SABER que el término es un encabezado MeSH válido y el repo no tiene
 *    diccionario MeSH; etiquetar a ciegas produce búsquedas que devuelven 0 EN
 *    SILENCIO, el peor fallo posible aquí. Eso es E2-03.
 *  - NO decide jerarquía ni peso de la evidencia. `FILTRO_HQ` y `RANK` de
 *    src/lib/evidencia/pubmed.ts se quedan EXACTAMENTE como están (E2-03,
 *    validacionClinica: true).
 *  - NO se cablea a ninguna ruta ni prompt (eso es E2-05, cambio visible sobre
 *    un flujo que el médico ya probó en vivo — regla 5 de la carta operativa).
 *    Este módulo no tiene callers todavía.
 *
 * NO se registra en CLINICAL_ENGINE_REGISTRY: no calcula nada clínico y no tiene
 * callers; registrarlo sin ADR subiría la deuda congelada de E0-03 y pondría el
 * CI en rojo. Mismo criterio que E0-04 y E2-01.
 *
 * PURO A PROPÓSITO: NO importa `./pubmed` (que lee `process.env.NCBI_API_KEY` y
 * monta una cola de throttle EN EL MOMENTO DEL IMPORT). El puente con la
 * búsqueda vive aparte, en `./buscar-con-pico`. Cero red, cero reloj, cero
 * `Math.random()`, cero PHI.
 */

import type { NoVacio, Resultado } from '@/types/evidence'
import { traducirBasico } from './traducir-medico'

const ok = <T>(valor: T): { readonly ok: true; readonly valor: T } => ({ ok: true, valor })
const mal = <M extends string>(motivo: M, detalle: string): { readonly ok: false; readonly motivo: M; readonly detalle: string } =>
  ({ ok: false, motivo, detalle })

// ---------------------------------------------------------------------------
// 1. Marcas fantasma — NO se exportan
// ---------------------------------------------------------------------------

/**
 * MARCAS INVARIANTES — NO BORRAR NI SIMPLIFICAR A `readonly marca?: never`.
 *
 * No se exportan ⇒ desde fuera del módulo es IMPOSIBLE escribir el objeto a mano
 * y hacerlo pasar por `TerminoPICO`/`PICO`/`ConsultaPubMed`. La única puerta son
 * las fábricas de este archivo.
 *
 * Cada marca es una función de un literal a un literal (el mismo tipo en
 * posición contravariante y covariante) para que el tipo sea invariante y no se
 * ensanche, igual que en E0-04 y E2-01.
 *
 * CONTROL NEGATIVO EJECUTADO (DISENO §4.3): sustituyendo `[MARCA_CONSULTA]` por
 * `readonly marcaConsulta?: never`, el caso 6 de pico.tipos.ts DEJA de fallar
 * (una `ConsultaPubMed` con texto arbitrario compila) y `tsc` sale con TS2578.
 * Es decir: si borras la marca, el CI queda VERDE y la aceptación desaparece.
 * Por eso hay un guardián en src/__tests__/pico-extractor.test.ts.
 */
declare const MARCA_TERMINO: unique symbol
declare const MARCA_PICO: unique symbol
declare const MARCA_CONSULTA: unique symbol

// ---------------------------------------------------------------------------
// 2. Topes — GUARDAS DE SOFTWARE, no umbrales clínicos
// ---------------------------------------------------------------------------

/**
 * Los tres son ARBITRARIOS, parametrizables y NO deciden nada médico. Mismo
 * precedente que `MINIMO_CARACTERES_PASAJE = 40` (src/types/evidence.ts:287):
 * guarda de software declarada, sin ADR clínico.
 */

/**
 * Más de 6 palabras es una FRASE, y una frase en PubMed devuelve 0. Es
 * exactamente el aviso que el propio repo ya lleva escrito en
 * src/app/api/expediente/evidencia/route.ts:80 («NO frases largas, que traen 0
 * resultados»).
 */
export const MAXIMO_PALABRAS_TERMINO = 6

/** Tope de COSTE: acota el largo de la consulta y el fan-out de PubMed. */
export const MAXIMO_TERMINOS_POR_FACETA = 5

/** Corta basura larga / prompt injection antes de que llegue a una URL. */
export const MAXIMO_CARACTERES_TERMINO = 80

// ---------------------------------------------------------------------------
// 3. Los tipos
// ---------------------------------------------------------------------------

export type Faceta = 'P' | 'I' | 'C' | 'O'

/** Orden FIJO de ensamblado. Mismo PICO ⇒ misma cadena, siempre. */
export const ORDEN_FACETAS = ['P', 'I', 'C', 'O'] as const satisfies readonly Faceta[]

/**
 * De dónde salió el término. Es trazabilidad, no adorno: permite explicarle al
 * médico por qué la búsqueda dice lo que dice.
 *  - `nota`        : campo estructurado de la nota que pasó SIN cambios.
 *  - `diccionario` : lo tradujo `traducirBasico` (ES→EN determinista).
 *  - `modelo`      : lo aportó el LLM como TÉRMINO (nunca como consulta armada).
 *  - `literal`     : camino degradado (§6.3 del DISEÑO): texto sin facetar.
 */
export type OrigenTermino = 'nota' | 'diccionario' | 'modelo' | 'literal'

export interface TerminoPICO {
  readonly faceta: Faceta
  /** Tal como venía (español o inglés). Trazabilidad; NO entra a la consulta. */
  readonly original: string
  /** Término que SÍ entra a la consulta (inglés, normalizado). */
  readonly busqueda: string
  /** Sinónimos de LA MISMA faceta: se unen con OR. */
  readonly sinonimos: readonly string[]
  readonly origen: OrigenTermino
  readonly [MARCA_TERMINO]: (t: 'termino') => 'termino'
}

export interface PICO {
  /**
   * P OBLIGATORIA (`NoVacio`): sin población/problema no hay pregunta clínica
   * que buscar — un PICO sin ningún eje es la cadena cruda otra vez, disfrazada.
   * I, C y O SÍ pueden faltar: hay preguntas legítimas de sólo P (pronóstico).
   */
  readonly poblacion: NoVacio<TerminoPICO>
  readonly intervencion: readonly TerminoPICO[]
  readonly comparador: readonly TerminoPICO[]
  readonly outcome: readonly TerminoPICO[]
  /** La pregunta original, SÓLO para trazar. Nunca se usa para armar la consulta. */
  readonly preguntaOriginal: string
  /** true si se cayó al camino degradado (P = texto sin facetar). */
  readonly degradado: boolean
  readonly [MARCA_PICO]: (p: 'pico') => 'pico'
}

export interface ConsultaPubMed {
  /** "(a OR b) AND (c)" — ARMADA por código, nunca dictada por el modelo. */
  readonly texto: string
  /** Qué facetas entraron en ESTA consulta (el backoff suelta algunas). */
  readonly facetas: NoVacio<Faceta>
  /**
   * De dónde salió CADA término del texto. Es lo que hace verificable el
   * invariante A2 del DISEÑO (ningún token del texto puede venir de fuera de
   * una faceta declarada) y lo que E2-05 podrá pintarle al médico.
   */
  readonly procedencia: NoVacio<TerminoPICO>
  readonly degradada: boolean
  readonly [MARCA_CONSULTA]: (q: 'consulta') => 'consulta'
}

export type MotivoRechazoPICO =
  | 'ENTRADA_NO_ES_OBJETO'
  | 'SIN_POBLACION'
  | 'FACETA_NO_ES_ARREGLO'
  | 'TERMINO_VACIO'
  | 'CONSULTA_DICTADA_POR_EL_MODELO'
  | 'TERMINO_DEMASIADO_LARGO'
  | 'FIELD_TAG_NO_VERIFICABLE'

// ---------------------------------------------------------------------------
// 4. Fábrica de términos (única puerta a TerminoPICO)
// ---------------------------------------------------------------------------

/** `[tiab]`, `[mh]`, `[MeSH Terms]`… — ver §7.3 del DISEÑO. */
const RE_FIELD_TAG = /\[[^\]]*\]/
/** Operadores booleanos y agrupadores: señal de que alguien armó la consulta. */
const RE_BOOLEANO = /(^|\s)(AND|OR|NOT)(\s|$)|[()[\]"]/i

export interface EntradaTermino {
  readonly faceta: Faceta
  readonly original: string
  readonly busqueda: string
  readonly sinonimos?: readonly string[]
  readonly origen: OrigenTermino
}

/** Valida UNA cadena que va a entrar a la consulta. Total: no lanza. */
function validarCadena(v: string, etiqueta: string): Resultado<string, MotivoRechazoPICO> {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return mal('TERMINO_VACIO', `${etiqueta} está vacío: un término vacío no aporta nada a la búsqueda`)
  // El field tag se comprueba ANTES que el booleano porque `[mh]` cae en ambos
  // patrones y el motivo útil para el llamador es el específico.
  if (RE_FIELD_TAG.test(s)) {
    return mal('FIELD_TAG_NO_VERIFICABLE', `${etiqueta} "${s}" trae un field tag: sin diccionario MeSH no se puede verificar y etiquetar a ciegas produce 0 resultados EN SILENCIO`)
  }
  if (RE_BOOLEANO.test(s)) {
    return mal('CONSULTA_DICTADA_POR_EL_MODELO', `${etiqueta} "${s}" trae operadores booleanos o agrupadores: la consulta la arma el sistema, no quien aporta los términos (no se limpia, porque limpiarlo inventaría un término que nadie escribió)`)
  }
  if (s.length > MAXIMO_CARACTERES_TERMINO) {
    return mal('TERMINO_DEMASIADO_LARGO', `${etiqueta} tiene ${s.length} caracteres (tope ${MAXIMO_CARACTERES_TERMINO})`)
  }
  const palabras = s.split(/\s+/).filter(Boolean)
  if (palabras.length > MAXIMO_PALABRAS_TERMINO) {
    return mal('TERMINO_DEMASIADO_LARGO', `${etiqueta} tiene ${palabras.length} palabras (tope ${MAXIMO_PALABRAS_TERMINO}): eso es una frase, y una frase en PubMed devuelve 0`)
  }
  return ok(s)
}

/**
 * Única puerta de entrada a `TerminoPICO`. Total: no lanza, no inventa y no
 * descarta en silencio (doctrina de `claimDesde`, src/types/evidence.ts:469).
 */
export function termino(e: EntradaTermino): Resultado<TerminoPICO, MotivoRechazoPICO> {
  const rb = validarCadena(e.busqueda, 'el término de búsqueda')
  if (!rb.ok) return rb
  const sinonimos: string[] = []
  for (const s of e.sinonimos ?? []) {
    const rs = validarCadena(s, 'el sinónimo')
    if (!rs.ok) return rs
    // Dedup case-insensitive dentro del propio término (y contra su búsqueda).
    if (rs.valor.toLowerCase() === rb.valor.toLowerCase()) continue
    if (sinonimos.some(x => x.toLowerCase() === rs.valor.toLowerCase())) continue
    sinonimos.push(rs.valor)
  }
  const t: Omit<TerminoPICO, typeof MARCA_TERMINO> = {
    faceta: e.faceta,
    original: typeof e.original === 'string' ? e.original : '',
    busqueda: rb.valor,
    sinonimos,
    origen: e.origen,
  }
  // Aserción inevitable y CONFINADA a la fábrica: la marca es `declare`, no
  // existe en tiempo de ejecución — sólo en el tipo.
  return ok(t as TerminoPICO)
}

// ---------------------------------------------------------------------------
// 5. Fábrica de PICO
// ---------------------------------------------------------------------------

export interface EntradaPICO {
  readonly poblacion: NoVacio<TerminoPICO>
  readonly intervencion?: readonly TerminoPICO[]
  readonly comparador?: readonly TerminoPICO[]
  readonly outcome?: readonly TerminoPICO[]
  readonly preguntaOriginal: string
  readonly degradado?: boolean
}

/**
 * Construye un `PICO`. NO devuelve `Resultado` porque no puede fallar: el
 * compilador ya garantiza que P no está vacía (`NoVacio<TerminoPICO>`) y que
 * cada término salió de `termino()` (marca fantasma). La deduplicación entre
 * facetas nunca puede vaciar P: conserva SIEMPRE la primera aparición.
 */
export function pico(e: EntradaPICO): PICO {
  const vistos = new Set<string>()
  const conservar = (ts: readonly TerminoPICO[]): TerminoPICO[] => {
    const out: TerminoPICO[] = []
    for (const t of ts) {
      const clave = t.busqueda.toLowerCase()
      if (vistos.has(clave)) continue          // dedup case-insensitive, entre facetas
      vistos.add(clave)
      out.push(t)                              // `original` intacto: no se toca el término
      if (out.length >= MAXIMO_TERMINOS_POR_FACETA) break
    }
    return out
  }
  // Orden fijo P→I→C→O: la primera aparición gana, así que el dedup también es
  // determinista (P manda sobre I, I sobre C, etc.).
  const poblacion = conservar(e.poblacion)
  const p: Omit<PICO, typeof MARCA_PICO> = {
    // `poblacion` tiene ≥1 elemento: la entrada era NoVacio y `conservar` sólo
    // descarta repetidos, y el primero nunca puede estar repetido consigo mismo.
    poblacion: poblacion as unknown as NoVacio<TerminoPICO>,
    intervencion: conservar(e.intervencion ?? []),
    comparador: conservar(e.comparador ?? []),
    outcome: conservar(e.outcome ?? []),
    preguntaOriginal: e.preguntaOriginal,
    degradado: e.degradado === true,
  }
  return p as PICO
}

/** Los términos de una faceta concreta. */
export function terminosDeFaceta(p: PICO, f: Faceta): readonly TerminoPICO[] {
  return f === 'P' ? p.poblacion : f === 'I' ? p.intervencion : f === 'C' ? p.comparador : p.outcome
}

// ---------------------------------------------------------------------------
// 6. Ensamblado y backoff (deterministas y puros)
// ---------------------------------------------------------------------------

/**
 * Sinónimos de una misma faceta → OR. Facetas entre sí → AND. Orden fijo
 * P, I, C, O. Booleano de manual: cero criterio clínico.
 */
function armar(p: PICO, facetas: readonly Faceta[]): { texto: string; procedencia: TerminoPICO[] } {
  const grupos: string[] = []
  const procedencia: TerminoPICO[] = []
  for (const f of facetas) {
    const ts = terminosDeFaceta(p, f)
    if (ts.length === 0) continue
    const partes: string[] = []
    for (const t of ts) {
      procedencia.push(t)
      for (const v of [t.busqueda, ...t.sinonimos]) {
        if (!partes.some(x => x.toLowerCase() === v.toLowerCase())) partes.push(v)
      }
    }
    if (partes.length > 0) grupos.push(`(${partes.join(' OR ')})`)
  }
  return { texto: grupos.join(' AND '), procedencia }
}

/** Facetas que REALMENTE tienen términos, en el orden fijo. */
function facetasPresentes(p: PICO): Faceta[] {
  return ORDEN_FACETAS.filter(f => terminosDeFaceta(p, f).length > 0)
}

function consultaDeFacetas(p: PICO, facetas: readonly Faceta[]): ConsultaPubMed {
  const { texto, procedencia } = armar(p, facetas)
  const c: Omit<ConsultaPubMed, typeof MARCA_CONSULTA> = {
    texto,
    // Ambos son no vacíos: `facetas` siempre incluye P y P siempre tiene ≥1
    // término (invariante del tipo `PICO`).
    facetas: facetas as unknown as NoVacio<Faceta>,
    procedencia: procedencia as unknown as NoVacio<TerminoPICO>,
    degradada: p.degradado,
  }
  return c as ConsultaPubMed
}

/**
 * La consulta MÁS ESPECÍFICA: todas las facetas que existan.
 *
 * No devuelve `Resultado` porque no puede fallar: un `PICO` válido siempre tiene
 * P ⇒ siempre hay consulta. Propiedad agradable y buscada.
 */
export function consultaDesdePICO(p: PICO): ConsultaPubMed {
  return consultaDeFacetas(p, facetasPresentes(p))
}

/**
 * BACKOFF determinista: sustituye las tres redes de seguridad ad-hoc de hoy
 * (src/app/api/consultor-evidencia/route.ts:166-173) por una relajación
 * EXPLICABLE, de más específica a más amplia:
 *   1. P AND I AND C AND O (las que existan)
 *   2. P AND I             (se sueltan O y C, que son los que más ceros producen)
 *   3. P sola
 * Encaja tal cual con `buscarEvidenciaMulti`, que ya hace round-robin + dedup
 * por PMID. TODAS las consultas contienen P.
 */
export function consultasDesdePICO(p: PICO): NoVacio<ConsultaPubMed> {
  const presentes = facetasPresentes(p)
  const candidatas: Faceta[][] = [
    presentes,
    presentes.filter(f => f === 'P' || f === 'I'),
    ['P'],
  ]
  const salida: ConsultaPubMed[] = []
  let ultimoLargo = Number.POSITIVE_INFINITY
  for (const facetas of candidatas) {
    // Estrictamente decreciente en número de facetas ⇒ nunca se repite consulta.
    if (facetas.length >= ultimoLargo) continue
    ultimoLargo = facetas.length
    salida.push(consultaDeFacetas(p, facetas))
  }
  return salida as unknown as NoVacio<ConsultaPubMed>
}

// ---------------------------------------------------------------------------
// 7. Extractor 1 — desde el JSON del LLM (la puerta de runtime)
// ---------------------------------------------------------------------------

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const CLAVES_FACETA = [
  ['poblacion', 'P'],
  ['intervencion', 'I'],
  ['comparador', 'C'],
  ['outcome', 'O'],
] as const satisfies readonly (readonly [string, Faceta])[]

/**
 * ÚNICA PUERTA para el JSON del modelo.
 *
 * CAMBIO CONCEPTUAL DE LA UNIDAD: al modelo se le deja de pedir «1-3
 * sub-búsquedas unidas con AND/OR» y se le pide rellenar CUATRO CASILLAS con
 * términos sueltos en inglés. Si aun así devuelve una consulta armada dentro de
 * una casilla, aquí se RECHAZA con motivo y el llamador cae al camino
 * determinista o al degradado — nunca se "arregla" en silencio.
 *
 * Total: no lanza, no inventa, no descarta en silencio.
 */
export function picoDesdeModelo(datos: unknown, preguntaOriginal: string): Resultado<PICO, MotivoRechazoPICO> {
  if (!esObjeto(datos)) return mal('ENTRADA_NO_ES_OBJETO', 'la entrada no es un objeto: no hay facetas que leer')

  // 1) Forma: toda faceta presente tiene que ser un ARREGLO. Se comprueba antes
  //    que nada para que `{poblacion: "recurrent UTI"}` (la consulta cruda
  //    metida en la casilla) no se confunda con "falta la población".
  for (const [clave] of CLAVES_FACETA) {
    const v = datos[clave]
    if (v !== undefined && v !== null && !Array.isArray(v)) {
      return mal('FACETA_NO_ES_ARREGLO', `"${clave}" no es un arreglo de términos sino ${typeof v}: cada faceta se rellena con términos, no con una consulta`)
    }
  }

  // 2) Términos: aquí es donde se defiende la aceptación.
  const porFaceta = new Map<Faceta, TerminoPICO[]>()
  for (const [clave, faceta] of CLAVES_FACETA) {
    const crudos = Array.isArray(datos[clave]) ? (datos[clave] as unknown[]) : []
    const ts: TerminoPICO[] = []
    for (const crudo of crudos) {
      if (typeof crudo !== 'string') {
        return mal('TERMINO_VACIO', `un elemento de "${clave}" no es una cadena (${typeof crudo})`)
      }
      const r = termino({ faceta, original: crudo, busqueda: crudo, origen: 'modelo' })
      if (!r.ok) return mal(r.motivo, `en la faceta "${clave}": ${r.detalle}`)
      ts.push(r.valor)
    }
    porFaceta.set(faceta, ts)
  }

  // 3) Sin P no hay estructura, sólo texto. Ni I sola ni O sola arman búsqueda.
  const poblacion = porFaceta.get('P') ?? []
  if (poblacion.length === 0) {
    return mal('SIN_POBLACION', 'el modelo no aportó población/problema: sin P no hay pregunta clínica que buscar (y rellenarla con la pregunta cruda sería devolver el texto crudo por la puerta de atrás)')
  }

  return ok(pico({
    poblacion: poblacion as unknown as NoVacio<TerminoPICO>,
    intervencion: porFaceta.get('I') ?? [],
    comparador: porFaceta.get('C') ?? [],
    outcome: porFaceta.get('O') ?? [],
    preguntaOriginal,
  }))
}

// ---------------------------------------------------------------------------
// 8. Extractor 2 — determinista, desde campos YA etiquetados de la nota
// ---------------------------------------------------------------------------

/**
 * PHI: aquí NO hay nombre, folio ni identificadores, y la función no los
 * aceptaría aunque se los pasaran (no están en el tipo). El texto libre de la
 * nota tampoco entra. Los términos viajan a PubMed, que es un TERCERO.
 */
export interface EntradaNota {
  /** Problema activo de HOY. */
  readonly motivo: string
  readonly diagnosticos: readonly string[]
  readonly medicamentos: readonly string[]
  readonly edad?: number
  readonly sexo?: string
}

export interface OpcionesEncuadre {
  /**
   * Q4 (registrada para el médico dueño, NO bloqueante): el fármaco que el
   * paciente YA TOMA, ¿es la intervención que se evalúa (I) o parte de la
   * población («pacientes en tratamiento con…», P)? Cambia lo que PubMed
   * devuelve. Default DECLARADO y reversible por parámetro: 'I'.
   */
  readonly medicamentosComo?: 'I' | 'P'
  /**
   * Edad y sexo quedan FUERA por defecto: acotan de más y son el vector obvio de
   * re-identificación en una URL saliente hacia un tercero.
   */
  readonly incluirDemografia?: boolean
}

/**
 * Traducción de sexo. Es traducción LITERAL de dos palabras, no categorización
 * clínica. Lo que NO se hace, a propósito: mapear la EDAD a una categoría
 * ('pediatric', 'elderly'…), porque esos cortes son criterio clínico que nadie
 * ha decidido en este repo — inventarlos sería la peor falla posible aquí.
 */
const SEXO_EN: Record<string, string> = {
  f: 'female', femenino: 'female', femenina: 'female', mujer: 'female',
  m: 'male', masculino: 'male', hombre: 'male',
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Limpia lo que en el camino DETERMINISTA es sólo puntuación de una nota escrita
 * por un humano.
 *
 * ASIMETRÍA DELIBERADA con `picoDesdeModelo`: allá un `(`, un `[` o un `OR`
 * significan que el modelo intentó DICTAR la consulta ⇒ se rechaza. Aquí
 * significan que el médico escribió un paréntesis en su nota ⇒ se limpian, como
 * `traducirBasico` ya limpia comas y signos de interrogación.
 */
function limpiarTextoDeNota(s: string): string {
  return s
    .replace(/[()[\]"]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !/^(and|or|not)$/i.test(w))
    .join(' ')
}

/**
 * Recorta a un TÉRMINO sin cortar a mitad de palabra (cortar a mitad inventaría
 * un token que nadie escribió). El texto completo se conserva en `original`.
 */
function recortarATermino(s: string): string {
  const out: string[] = []
  for (const w of s.trim().split(/\s+/).filter(Boolean)) {
    if (out.length >= MAXIMO_PALABRAS_TERMINO) break
    const largo = out.length ? out.join(' ').length + 1 + w.length : w.length
    if (largo > MAXIMO_CARACTERES_TERMINO) break
    out.push(w)
  }
  return out.join(' ')
}

/** Construye un término desde texto libre en español, sin inferir facetas. */
function terminoDesdeTexto(texto: string, faceta: Faceta, origenSiLiteral: OrigenTermino = 'nota'): TerminoPICO | null {
  const crudo = typeof texto === 'string' ? texto.trim() : ''
  if (!crudo) return null
  const traducido = traducirBasico(limpiarTextoDeNota(crudo))
  const busqueda = recortarATermino(limpiarTextoDeNota(traducido))
  if (!busqueda) return null
  // `origen`: 'diccionario' si la traducción CAMBIÓ algo; si pasó igual (nombres
  // latinos, fármacos que se escriben igual), el término viene tal cual del campo.
  const entrada = sinAcentos(crudo.toLowerCase())
  const origen: OrigenTermino = origenSiLiteral === 'literal'
    ? 'literal'
    : (traducido !== entrada ? 'diccionario' : 'nota')
  const r = termino({ faceta, original: crudo, busqueda, origen })
  return r.ok ? r.valor : null
}

/**
 * Extractor DETERMINISTA (sin LLM) desde los campos que la ruta ya tiene
 * etiquetados. No infiere nada de prosa libre: se apoya en que la nota ya dice
 * qué campo es qué.
 *
 * CRITERIO CONSERVADO del código de hoy (src/app/api/expediente/evidencia/
 * route.ts:68-72): el MOTIVO manda sobre las comorbilidades ⇒ va PRIMERO en P.
 * LO QUE CAMBIA: deja de CONCATENAR diagnóstico y fármacos en una sola cadena
 * (`route.ts:73`), que es justo lo que impedía relajar una faceta sin la otra.
 */
export function picoDesdeNota(e: EntradaNota, opts: OpcionesEncuadre = {}): Resultado<PICO, MotivoRechazoPICO> {
  const facetaMedicamentos: Faceta = opts.medicamentosComo ?? 'I'

  const poblacion: TerminoPICO[] = []
  const motivo = terminoDesdeTexto(e.motivo ?? '', 'P')
  if (motivo) poblacion.push(motivo)
  for (const dx of e.diagnosticos ?? []) {
    const t = terminoDesdeTexto(dx, 'P')
    if (t) poblacion.push(t)
  }

  if (opts.incluirDemografia) {
    if (typeof e.sexo === 'string' && e.sexo.trim()) {
      const en = SEXO_EN[sinAcentos(e.sexo.trim().toLowerCase())]
      // Un valor de sexo que no está en el mapa NO se adivina: simplemente no entra.
      if (en) {
        const r = termino({ faceta: 'P', original: e.sexo, busqueda: en, origen: 'diccionario' })
        if (r.ok) poblacion.push(r.valor)
      }
    }
    if (typeof e.edad === 'number' && Number.isFinite(e.edad) && e.edad >= 0) {
      // La edad entra como CIFRA literal. NO se traduce a categoría etaria:
      // dónde empieza "pediátrico" o "anciano" es criterio clínico sin decidir.
      const r = termino({ faceta: 'P', original: String(e.edad), busqueda: `${Math.trunc(e.edad)} years`, origen: 'nota' })
      if (r.ok) poblacion.push(r.valor)
    }
  }

  if (poblacion.length === 0) {
    return mal('SIN_POBLACION', 'la nota no trae motivo ni diagnóstico: sin P no hay búsqueda que armar (y rellenarla con el texto libre de la nota sería devolver el texto crudo por la puerta de atrás, además de mandar prosa clínica a un tercero)')
  }

  const medicamentos: TerminoPICO[] = []
  for (const med of e.medicamentos ?? []) {
    const t = terminoDesdeTexto(med, facetaMedicamentos)
    if (t) medicamentos.push(t)
  }

  // Q4 parametrizada: los fármacos van a I (default) o se suman a P.
  const pFinal = facetaMedicamentos === 'P' ? [...poblacion, ...medicamentos] : poblacion
  const iFinal = facetaMedicamentos === 'I' ? medicamentos : []

  return ok(pico({
    poblacion: pFinal as unknown as NoVacio<TerminoPICO>,
    intervencion: iFinal,
    preguntaOriginal: e.motivo ?? '',
  }))
}

// ---------------------------------------------------------------------------
// 9. Extractor 3 — la salida de emergencia, MARCADA
// ---------------------------------------------------------------------------

/**
 * Camino DEGRADADO. Hoy existen tres redes de seguridad de texto crudo para no
 * devolver 0 resultados; si E2-05 las quitara sin sustituto, se REGRESARÍA una
 * funcionalidad que el médico ya vio funcionar. Este es el sustituto honesto.
 *
 * NO infiere facetas (asignar faceta a partir de prosa española sería inventar):
 * mete todo en P y MARCA `degradado: true`, bandera que viaja hasta
 * `ConsultaPubMed.degradada`. El camino crudo sigue existiendo, pero deja de ser
 * INDISTINGUIBLE del bueno — que es exactamente lo que hoy ocurre.
 */
export function picoDegradadoDesdeTexto(texto: string): Resultado<PICO, MotivoRechazoPICO> {
  const t = terminoDesdeTexto(texto, 'P', 'literal')
  if (!t) {
    return mal('SIN_POBLACION', 'del texto no quedó ningún término buscable tras quitar el relleno')
  }
  return ok(pico({
    poblacion: [t],
    preguntaOriginal: typeof texto === 'string' ? texto : '',
    degradado: true,
  }))
}
