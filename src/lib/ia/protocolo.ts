/**
 * PROTOCOLO DE LOS PROVEEDORES DE IA — la parte que se puede probar sin red.
 *
 * Master Loop V3 §P–T (Nexus AI Gateway), P1-1 de la auditoría. Hoy DIECISÉIS
 * rutas llaman a Anthropic y OpenAI por su cuenta, y cada una repite —con
 * variaciones— las mismas cuatro decisiones: qué modelo intentar, cuándo pasar
 * al siguiente, cómo traducir un código HTTP a algo accionable, y cómo sacar el
 * texto de la respuesta.
 *
 * ── POR QUÉ ESTO ES UN MÓDULO Y NO UNA UTILIDAD ──────────────────────────────
 *
 * Porque la repetición ya costó dinero y confianza:
 *
 *   · El Copilot de UCI se quedaba en `max_tokens: 4000` mientras la nota de
 *     consulta ya usaba 24 000. El médico veía «no pudo generar la síntesis»
 *     justo cuando había MÁS datos que sintetizar, y parecía un problema de
 *     llaves.
 *   · «Ambos modelos fallaron o no hay llaves válidas» mezclaba llave revocada,
 *     proveedor caído, límite alcanzado y respuesta ilegible: cuatro problemas
 *     con cuatro arreglos distintos. Un error que no distingue entre ellos no es
 *     un error, es un encogimiento de hombros.
 *   · Y el libro de costos: cablearlo ruta por ruta significa acordarse
 *     dieciséis veces. Lo que se puede olvidar, se olvida.
 *
 * Este archivo es PURO a propósito: la cascada de modelos, la traducción de
 * errores y la lectura de respuestas se pueden fijar con casos sin gastar una
 * llamada. El `fetch` vive en `gateway.ts`.
 */

export type Proveedor = 'anthropic' | 'openai'

/** Lo que salió mal, en términos de qué hacer al respecto. */
export type ClaseFallo =
  /** La llave no sirve o fue revocada. Se arregla en configuración. */
  | 'llave'
  /** Límite de uso alcanzado. Se arregla esperando o subiendo el plan. */
  | 'limite'
  /** Sin saldo en la cuenta del proveedor. */
  | 'saldo'
  /** El proveedor está caído. No es culpa de nadie aquí. */
  | 'proveedor'
  /** El modelo pedido no existe para esa llave. Hay que intentar otro. */
  | 'modelo'
  /** Contestó, pero no se pudo leer lo que mandó. */
  | 'respuesta'
  /** No se pudo ni conectar. */
  | 'red'

export interface Fallo {
  ok: false
  clase: ClaseFallo
  /** Frase para el médico. Dice qué pasó Y qué hacer. */
  motivo: string
  status?: number
}

export interface Exito {
  ok: true
  texto: string
  modelo: string
  /** El modelo se quedó sin espacio: el texto está incompleto y se sabe. */
  truncado: boolean
  /** La respuesta cruda, para leerle el `usage`. */
  bruto: unknown
}

export type Resultado = Exito | Fallo

/* ════════════════════════════════════════════════════════════════════════
   Errores: de un número HTTP a algo que alguien pueda arreglar
   ════════════════════════════════════════════════════════════════════════ */

const NOMBRE: Record<Proveedor, string> = { anthropic: 'Anthropic', openai: 'OpenAI' }

/** Clasifica un código HTTP. La clase es lo que decide qué se hace después. */
export function claseDe(status: number): ClaseFallo {
  if (status === 401 || status === 403) return 'llave'
  if (status === 429) return 'limite'
  if (status === 402) return 'saldo'
  if (status >= 500) return 'proveedor'
  // 400 y 404 se tratan como «ese modelo no está disponible para esta llave»:
  // es lo que devuelven los proveedores cuando el nombre del modelo no existe
  // todavía en la cuenta, y es justo el caso en que vale la pena intentar otro.
  if (status === 400 || status === 404) return 'modelo'
  return 'respuesta'
}

export function motivoDe(proveedor: Proveedor, status: number): string {
  const p = NOMBRE[proveedor]
  switch (claseDe(status)) {
    case 'llave':      return `${p}: la llave no es válida o fue revocada (${status}).`
    case 'limite':     return `${p}: límite de uso alcanzado (429). Espera un momento o revisa el saldo de tu cuenta.`
    case 'saldo':      return `${p}: sin saldo en la cuenta (402).`
    case 'proveedor':  return `${p}: el proveedor está caído (${status}).`
    case 'modelo':     return `${p}: el modelo no está disponible para esta llave (${status}).`
    default:           return `${p}: rechazó la solicitud (${status}).`
  }
}

export function falloHttp(proveedor: Proveedor, status: number): Fallo {
  return { ok: false, clase: claseDe(status), motivo: motivoDe(proveedor, status), status }
}

/**
 * ¿Vale la pena intentar con el siguiente modelo de la lista?
 *
 * Sólo cuando el problema es el MODELO. Reintentar con otro modelo una llave
 * revocada gasta tiempo del médico para llegar al mismo 401, y reintentar un 429
 * empeora el límite que acaba de saltar.
 */
export function siguienteModelo(status: number): boolean {
  return claseDe(status) === 'modelo'
}

/* ════════════════════════════════════════════════════════════════════════
   Respuestas: sacar el texto sin perder lo que el proveedor ya dijo
   ════════════════════════════════════════════════════════════════════════ */

type Json = Record<string, unknown>

/**
 * Lee la respuesta de Anthropic.
 *
 * `stop_reason: 'max_tokens'` se propaga como `truncado` en vez de dejarlo pasar
 * como una respuesta normal: un JSON cortado a media llave no se puede leer, y
 * decir «no se pudo leer la respuesta» manda a buscar el problema al sitio
 * equivocado.
 */
export function leerAnthropic(data: unknown, modeloPedido: string): Resultado {
  const d = (data ?? {}) as Json
  const bloques = Array.isArray(d.content) ? (d.content as Json[]) : []
  const texto = bloques
    .filter(b => b.type === 'text')
    .map(b => String(b.text ?? ''))
    .join('')
  if (!texto) {
    return { ok: false, clase: 'respuesta', motivo: 'Anthropic: contestó sin texto.' }
  }
  return {
    ok: true, texto,
    modelo: typeof d.model === 'string' ? d.model : modeloPedido,
    truncado: d.stop_reason === 'max_tokens',
    bruto: data,
  }
}

/** Lee la respuesta de OpenAI. `finish_reason: 'length'` es su equivalente. */
export function leerOpenAI(data: unknown, modeloPedido: string): Resultado {
  const d = (data ?? {}) as Json
  const opciones = Array.isArray(d.choices) ? (d.choices as Json[]) : []
  const primera = (opciones[0] ?? {}) as Json
  const mensaje = (primera.message ?? {}) as Json
  const texto = String(mensaje.content ?? '')
  if (!texto) {
    return { ok: false, clase: 'respuesta', motivo: 'OpenAI: contestó sin texto.' }
  }
  return {
    ok: true, texto,
    modelo: typeof d.model === 'string' ? d.model : modeloPedido,
    truncado: primera.finish_reason === 'length',
    bruto: data,
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Cuerpos de petición
   ════════════════════════════════════════════════════════════════════════ */

export interface Peticion {
  modelo: string
  system: string
  user: string
  maxTokens: number
  /** Exigir JSON. Sólo OpenAI lo tiene como modo; en Anthropic se pide en el prompt. */
  json?: boolean
  /**
   * Reutilizar el prompt de sistema entre llamadas (Anthropic).
   *
   * No es un detalle de rendimiento: el sistema del Copilot de UCI son ~3 200
   * tokens que se mandan IGUALES en cada pase, y cobrados a precio completo son
   * la mayor parte del costo de una síntesis.
   */
  cacheSystem?: boolean
}

export function cuerpoAnthropic(p: Peticion): Json {
  return {
    model: p.modelo,
    max_tokens: p.maxTokens,
    system: p.cacheSystem
      ? [{ type: 'text', text: p.system, cache_control: { type: 'ephemeral' } }]
      : p.system,
    messages: [{ role: 'user', content: p.user }],
  }
}

export function cuerpoOpenAI(p: Peticion): Json {
  return {
    model: p.modelo,
    messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
    ...(p.json ? { response_format: { type: 'json_object' } } : {}),
    max_completion_tokens: p.maxTokens,
  }
}

export const POR_QUE_UN_SOLO_PROTOCOLO =
  'Dieciséis rutas repetían las mismas cuatro decisiones con variaciones, y las ' +
  'variaciones son las que costaron: el Copilot de UCI se quedó en 4 000 tokens ' +
  'de salida mientras la nota de consulta ya usaba 24 000, y el médico veía ' +
  '«no se pudo generar la síntesis» justo cuando había más datos que sintetizar.'
