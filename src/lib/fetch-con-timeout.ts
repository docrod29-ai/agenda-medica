/**
 * UNA LLAMADA DE RED QUE NO SE PUEDE QUEDAR COLGADA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `lib/ia/gateway.ts` es el módulo que centraliza TODAS las llamadas a Anthropic
 * y OpenAI — y su `fetch` no pasaba `signal`. Lo usan el Copilot de UCI, el bot
 * de ayuda, la redacción del inmunocomprometido (`maxDuration = 300`), la
 * verificación de la nota y la atribución de roles.
 *
 * Un socket colgado del proveedor **inmoviliza el lambda los 300 segundos
 * completos**, facturados por GB-segundo. Y el único módulo que existía para
 * centralizar las llamadas de proveedor era justo el que no tenía la protección.
 *
 * Los envíos de WhatsApp, igual: cinco `fetch` sin timeout dentro de un cron que
 * recorre todos los consultorios **en serie**.
 *
 * ── POR QUÉ UN HELPER Y NO UN `signal` EN CADA SITIO ─────────────────────────
 *
 * Porque `AbortController` tiene una trampa: si no se limpia el temporizador en
 * el camino de ÉXITO, el proceso se queda con un `setTimeout` vivo por cada
 * llamada. En un lambda no se nota; en un servidor de larga vida, sí. Aquí se
 * limpia siempre, en un `finally`, y nadie tiene que acordarse.
 *
 * Módulo PURO en lo que se puede serlo: no lee configuración ni entorno.
 */

/** Lo que se distingue de un fallo de red cualquiera. */
export class TiempoAgotado extends Error {
  constructor(public readonly ms: number, public readonly host: string) {
    super(`Se agotó el tiempo (${ms} ms) esperando a ${host}`)
    this.name = 'TiempoAgotado'
  }
}

const hostDe = (url: string): string => {
  try { return new URL(url).host } catch { return 'destino desconocido' }
}

/**
 * `fetch` con tiempo máximo.
 *
 * @param ms milisegundos antes de abortar.
 * @throws {TiempoAgotado} cuando se agota, para que quien llame pueda decirlo
 *   con esas palabras en vez de un «no se pudo conectar» que manda a buscar el
 *   problema donde no está.
 *
 * Respeta un `signal` que ya venga en `init`: si quien llama tiene su propia
 * cancelación, las dos valen. Perderla sería romper una cancelación que alguien
 * puso a propósito.
 */
export async function fetchConTimeout(
  url: string, init: RequestInit = {}, ms = 60_000,
): Promise<Response> {
  const propio = new AbortController()
  const externa = init.signal
  if (externa) {
    if (externa.aborted) propio.abort()
    else externa.addEventListener('abort', () => propio.abort(), { once: true })
  }
  const t = setTimeout(() => propio.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: propio.signal })
  } catch (e) {
    // Si el aborto fue NUESTRO, se dice que fue el tiempo. Si vino de fuera, se
    // deja pasar el error tal cual: no es lo mismo y confundirlos oculta un
    // cierre deliberado detrás de un «se tardó».
    if (propio.signal.aborted && !externa?.aborted) throw new TiempoAgotado(ms, hostDe(url))
    throw e
  } finally {
    // SIEMPRE. Sin esto queda un temporizador vivo por cada llamada con éxito.
    clearTimeout(t)
  }
}

/**
 * Cuánto se espera a cada tipo de destino.
 *
 * Los proveedores de IA con razonamiento extendido tardan de verdad; un envío de
 * WhatsApp que tarda diez segundos ya está roto. Poner el mismo número a los dos
 * significa o cortar respuestas buenas o dejar colgado un cron.
 */
export const TIMEOUT = {
  /** Anthropic / OpenAI: una nota con razonamiento extendido tarda. */
  ia: 60_000,
  /** WhatsApp: es un POST corto; si tarda más, no va a llegar. */
  whatsapp: 10_000,
  /** Webhooks de operación: una alerta lenta no puede colgar un cron. */
  ops: 5_000,
  /**
   * Fuentes de evidencia (NCBI, openFDA): una consulta corta contra un índice
   * público. Si tarda más, el médico está esperando por nada — y la ruta que
   * las llama corre con `maxDuration = 300` (REG-391).
   */
  evidencia: 15_000,
} as const

export const POR_QUE_UN_HELPER =
  '`AbortController` tiene una trampa: si no se limpia el temporizador en el ' +
  'camino de ÉXITO, queda un `setTimeout` vivo por cada llamada. Aquí se limpia ' +
  'siempre en un `finally` y nadie tiene que acordarse — que es la única forma ' +
  'de que veinte sitios lo hagan bien.'
