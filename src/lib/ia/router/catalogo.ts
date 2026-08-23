/**
 * CATÁLOGO DE CAPACIDADES — qué modelos existen, cuáles se pueden llamar de
 * verdad, y qué se sabe (y qué no) de cada uno.
 *
 * #313 §C. Provider-neutral: describe capacidades, no marcas. El gateway sigue
 * siendo el único que habla con nadie.
 *
 * ── LA DISTINCIÓN QUE EVITA LA MENTIRA MÁS FÁCIL DE ESTE MÓDULO ──────────────
 *
 * Un catálogo que quiere «soportar Gemini en el futuro» acaba con una fila de
 * Gemini, y esa fila acaba pareciendo un proveedor conectado. Aquí no puede
 * pasar por construcción:
 *
 *  · `Proveedor` (de `protocolo.ts`) es a quién SE LE PUEDE PAGAR HOY. No se
 *    amplía por un candidato futuro: ampliarla haría que `URL[proveedor]` del
 *    gateway tuviera que crecer y el compilador dejaría de proteger.
 *  · `ProveedorCandidato` es a quién se podría considerar. Es un superconjunto,
 *    y `esEjecutable()` es la única puerta que deja pasar de uno al otro.
 *
 * Un candidato futuro puede aparecer en un informe de sombra y jamás salir
 * elegido en producción. Hay una prueba para eso.
 *
 * ── LO QUE ESTE CATÁLOGO NO AFIRMA ───────────────────────────────────────────
 *
 * **Límites de contexto y de salida en `null`.** Se sabía la tentación:
 * escribir 200 000 de memoria. Un límite inventado no falla nunca — hasta la
 * consulta de una hora, que es justo la que lo necesitaba. Mientras no estén
 * cargados con fuente, una tarea que pida contexto largo no encuentra candidato
 * y lo DICE, en vez de elegir a ciegas.
 *
 * **Precios: ninguno escrito aquí.** Salen de `precios-modelo.ts`, que ya lleva
 * `fuente` y `consultado` por tarifa. Copiarlos habría creado la segunda tabla
 * de precios que el repositorio ya pagó una vez (P0-2 del superadmin).
 *
 * **Calidad: ninguna afirmada aquí.** La evidencia es un dato de entrada del
 * router, no una propiedad del catálogo. Ver `calidad.ts`.
 *
 * Módulo PURO.
 */
import type { Proveedor } from '@/lib/ia/protocolo'
import { costoUsd, tarifaDe } from '@/lib/finanzas/precios-modelo'
import type { ClaseLatencia, ClaseTarea } from '@/lib/ia/router/tareas'

/**
 * A quién se PODRÍA considerar, hoy o algún día.
 *
 * Superconjunto de `Proveedor` a propósito, y declarado aparte para no tocar el
 * tipo que el gateway usa para resolver la URL. Añadir aquí un nombre no
 * conecta nada.
 */
export type ProveedorCandidato = Proveedor | 'google' | 'otro'

/** Los que el gateway sabe llamar HOY. `assemblyai` no: es una cola, no una API de mensajes. */
export const EJECUTABLES: readonly ProveedorCandidato[] = ['anthropic', 'openai']

/**
 * En qué estado está una fila del catálogo.
 *
 * `declarado` es la fila honesta de un candidato futuro: se puede razonar sobre
 * él, compararlo en un informe, y no se puede ejecutar.
 */
export type EstadoModelo =
  /** Hay llave, hay ruta y el gateway sabe llamarlo. */
  | 'configurado'
  /** Existe como candidato. NO está conectado. Nunca se ejecuta. */
  | 'declarado'
  /** Estuvo y se retiró. Se deja para leer el histórico del libro de costos. */
  | 'retirado'

/** Cómo garantiza el modelo una salida parseable. */
export type SalidaEstructurada =
  /** El proveedor tiene un modo (`response_format`). Es garantía. */
  | 'nativa'
  /** Sólo se le pide en el prompt. No es garantía. */
  | 'por_prompt'
  /** No aplica. */
  | 'no'

export interface CapacidadModelo {
  proveedor: ProveedorCandidato
  /** Id EXACTO tal como lo espera el proveedor. Es la clave contra la tarifa. */
  modeloId: string
  estado: EstadoModelo
  /** Clases de tarea para las que este modelo se considera candidato. */
  clasesSoportadas: readonly ClaseTarea[]
  salidaEstructurada: SalidaEstructurada
  /** Tokens de contexto. `null` = NO CARGADO. Nunca se supone. */
  limiteContexto: number | null
  /** Tokens de salida. `null` = NO CARGADO. */
  limiteSalida: number | null
  latencia: ClaseLatencia
  /** Restricciones técnicas o de licencia. Texto libre, para el informe. */
  restricciones: readonly string[]
  /** Por qué está en el catálogo y qué falta por cargarle. */
  notas: string
}

/**
 * Lo que el repositorio YA llama, más un candidato futuro declarado.
 *
 * Las filas `configurado` no son una propuesta: son los ids que hoy aparecen en
 * `src/app/api/**` y en `TARIFAS`. Añadir aquí un modelo que nadie llama sería
 * declarar una capacidad que no existe.
 *
 * Las clases soportadas son una declaración de CANDIDATURA («este modelo se
 * considera para esta tarea»), no de calidad («este modelo la hace bien»). Lo
 * segundo sólo lo puede decir la evidencia.
 */
export const CATALOGO: readonly CapacidadModelo[] = [
  {
    proveedor: 'anthropic', modeloId: 'claude-haiku-4-5', estado: 'configurado',
    clasesSoportadas: ['transcription_cleanup', 'extraction_structuring', 'coding_suggestion'],
    salidaEstructurada: 'por_prompt', limiteContexto: null, limiteSalida: null,
    latencia: 'interactiva', restricciones: [],
    notas: 'Se llama hoy en ayuda-bot y en el perfil «live». Límites sin cargar: falta fuente.',
  },
  {
    proveedor: 'anthropic', modeloId: 'claude-sonnet-5', estado: 'configurado',
    clasesSoportadas: [
      'transcription_cleanup', 'extraction_structuring', 'note_rendering',
      'coding_suggestion', 'clinical_reasoning', 'evidence_synthesis',
    ],
    salidaEstructurada: 'por_prompt', limiteContexto: null, limiteSalida: null,
    latencia: 'normal', restricciones: [],
    notas: 'El más usado del repositorio. Límites sin cargar: falta fuente.',
  },
  {
    proveedor: 'anthropic', modeloId: 'claude-sonnet-4-6', estado: 'configurado',
    clasesSoportadas: ['transcription_cleanup', 'extraction_structuring', 'note_rendering', 'clinical_reasoning'],
    salidaEstructurada: 'por_prompt', limiteContexto: null, limiteSalida: null,
    latencia: 'normal', restricciones: [],
    notas: 'Respaldo de la cascada de Sonnet. Límites sin cargar.',
  },
  {
    proveedor: 'anthropic', modeloId: 'claude-opus-4-8', estado: 'configurado',
    clasesSoportadas: ['note_rendering', 'clinical_reasoning', 'evidence_synthesis', 'second_opinion'],
    salidaEstructurada: 'por_prompt', limiteContexto: null, limiteSalida: null,
    latencia: 'diferida', restricciones: [],
    notas: 'Razonamiento premium («no escatimar» — decisión del dueño). Límites sin cargar.',
  },
  {
    proveedor: 'openai', modeloId: 'gpt-5', estado: 'configurado',
    clasesSoportadas: ['safety_review', 'second_opinion', 'evidence_synthesis', 'extraction_structuring'],
    // OpenAI sí tiene modo JSON: `cuerpoOpenAI` pone `response_format` cuando
    // se le pide. Eso es una garantía del proveedor, no una instrucción.
    salidaEstructurada: 'nativa', limiteContexto: null, limiteSalida: null,
    latencia: 'normal', restricciones: [],
    notas: 'Verificador de nota y segunda opinión. Límites sin cargar.',
  },
  {
    /**
     * CANDIDATO FUTURO — NO CONECTADO.
     *
     * Existe para que el catálogo pueda razonar sobre un tercer proveedor sin
     * fingir que se puede llamar. `estado: 'declarado'` y `proveedor: 'google'`
     * (que NO está en `Proveedor`) lo dejan fuera de `esEjecutable()` por dos
     * caminos independientes. No hay llave, no hay contrato, no hay gasto
     * autorizado — y contratarlo es decisión del dueño, no de este archivo.
     */
    proveedor: 'google', modeloId: 'gemini-candidato', estado: 'declarado',
    clasesSoportadas: ['extraction_structuring', 'note_rendering', 'second_opinion'],
    salidaEstructurada: 'no', limiteContexto: null, limiteSalida: null,
    latencia: 'normal',
    restricciones: [
      'Sin llave configurada.',
      'Sin contrato con el proveedor: requiere autorización del dueño.',
      'El gateway no sabe hablar este protocolo.',
    ],
    notas: 'Fila de candidatura. Demuestra que el catálogo admite un proveedor futuro sin poder ejecutarlo.',
  },
]

/**
 * ¿Se puede LLAMAR de verdad a este modelo?
 *
 * Dos condiciones, las dos necesarias: que el proveedor sea uno de los que el
 * gateway sabe llamar, y que la fila esté configurada. Un candidato futuro
 * falla las dos.
 */
export function esEjecutable(c: CapacidadModelo): boolean {
  return c.estado === 'configurado' && EJECUTABLES.includes(c.proveedor)
}

/** ¿Este modelo se considera candidato para esta clase de tarea? */
export function soporta(c: CapacidadModelo, clase: ClaseTarea): boolean {
  return c.clasesSoportadas.includes(clase)
}

/**
 * ¿Garantiza salida parseable?
 *
 * `por_prompt` NO cuenta. Pedir JSON en el prompt es una instrucción, y una
 * instrucción no es una compuerta — el repositorio ya aprendió esa lección en
 * `minimizar-phi.ts`. Cuando la tarea parsea la salida, un modelo que sólo lo
 * promete en el texto puede devolver prosa y romper aguas abajo.
 */
export function garantizaEstructura(c: CapacidadModelo): boolean {
  return c.salidaEstructurada === 'nativa'
}

/**
 * ¿Cabe una entrada de este tamaño?
 *
 * `null` en los límites significa NO SE SABE, y no se sabe **no es que sí**.
 * Cuando la tarea declara que necesita contexto largo y el límite no está
 * cargado, la respuesta es `false`: es el lado que falla cerrado.
 */
export function cabe(c: CapacidadModelo, entradaTokens: number, salidaTokens: number, contextoLargo: boolean): boolean {
  if (contextoLargo && (c.limiteContexto == null || c.limiteSalida == null)) return false
  if (c.limiteContexto != null && entradaTokens > c.limiteContexto) return false
  if (c.limiteSalida != null && salidaTokens > c.limiteSalida) return false
  return true
}

/* ════════════════════════════════════════════════════════════════════════
   COSTO ESPERADO — calculado con la tabla que YA tiene procedencia
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Banda de costo. No es una cifra de facturación: es para ORDENAR candidatos.
 *
 * `desconocida` cuando el modelo no tiene tarifa cargada. Nunca `baja` por
 * defecto: un modelo sin tarifa que se ordenara como barato ganaría todas las
 * comparaciones justo por no haberse medido — el error exacto que el libro de
 * costos evita con `sin_tarifa` en vez de `$0`.
 */
export type BandaCosto = 'baja' | 'media' | 'alta' | 'desconocida'

export interface CostoEsperado {
  /** USD estimados de una llamada de este tamaño. `null` si no hay tarifa. */
  usd: number | null
  banda: BandaCosto
  /** Procedencia de la tarifa usada. Sin esto la cifra no se cita. */
  fuenteTarifa: string | null
  /** Fecha en que se consultó la tarifa. */
  tarifaConsultada: string | null
}

/**
 * Cortes de banda, en USD por llamada.
 *
 * Son de MÉTODO, no de negocio: sólo sirven para agrupar candidatos en un
 * informe legible. La decisión fina la toma el orden por `usd`, que es exacto.
 * Se declaran para que nadie los lea como un umbral de precio.
 */
export const CORTE_BANDA = { baja: 0.01, media: 0.10 } as const

export function bandaDe(usd: number | null): BandaCosto {
  if (usd == null) return 'desconocida'
  if (usd < CORTE_BANDA.baja) return 'baja'
  if (usd < CORTE_BANDA.media) return 'media'
  return 'alta'
}

/**
 * Cuánto costaría esta llamada, con la tarifa vigente en la fecha dada.
 *
 * Delega ENTERO en `costoUsd`: la vigencia de las promociones, el precio de
 * caché y el cobro por minuto ya están resueltos allí, con su fuente y su fecha.
 * Reimplementarlo aquí habría sido el segundo libro de precios.
 */
export function costoEsperado(
  c: CapacidadModelo, entradaTokens: number, salidaTokens: number, fechaISO?: string,
): CostoEsperado {
  const r = costoUsd(c.modeloId, { entrada: Math.max(0, entradaTokens), salida: Math.max(0, salidaTokens) }, fechaISO)
  const t = r.tarifa ?? tarifaDe(c.modeloId)
  return {
    usd: r.usd,
    banda: bandaDe(r.usd),
    fuenteTarifa: t?.fuente ?? null,
    tarifaConsultada: t?.consultado ?? null,
  }
}

/** Los candidatos del catálogo para una clase de tarea, sin filtrar por nada más. */
export function candidatosDe(clase: ClaseTarea, catalogo: readonly CapacidadModelo[] = CATALOGO): CapacidadModelo[] {
  return catalogo.filter(c => soporta(c, clase) && c.estado !== 'retirado')
}

export const POR_QUE_UN_CANDIDATO_FUTURO_NO_AMPLIA_EL_TIPO_PROVEEDOR =
  'Porque `Proveedor` es a quién se le puede pagar hoy, y el gateway resuelve ' +
  'su URL con un `Record<Proveedor, string>`: ampliarla por un candidato ' +
  'futuro obligaría a inventarle una URL o a dejarla vacía, y el compilador ' +
  'dejaría de avisar del siguiente. Un catálogo puede nombrar a quien no ' +
  'llama; el tipo del que cobra, no.'

export const POR_QUE_LOS_LIMITES_VAN_EN_NULL =
  'Porque un límite de contexto escrito de memoria no falla nunca — hasta la ' +
  'consulta de una hora, que es justo la que lo necesitaba. Con `null`, una ' +
  'tarea que pide contexto largo se queda sin candidato y lo dice; con un ' +
  'número inventado, elige a ciegas y se entera el médico.'
