/**
 * Política de reintentos con backoff — Iteración 10 · RELIABILITY (outbox/DLQ).
 *
 * Un mensaje proactivo de un solo disparo (aviso de lista de espera) que falla por
 * un error transitorio hoy se pierde. Esta política decide cuándo reintentar y
 * cuándo rendirse (dead-letter). Los fallos PERMANENTES/opt-out llegan por el
 * webhook de estado (Iter. 6) y no se reintentan.
 *
 * Todo PURO (sin red/DB) → testeable.
 *
 * ── REG-391: UN INTENTO QUE NO ERA DEL MENSAJE ──────────────────────────────
 *
 * Hasta REG-391 todo fallo gastaba un reintento. Con el cron cada hora y cinco
 * intentos, **cinco horas de caída del proveedor mataban toda la cola**: avisos
 * de lista de espera que nadie mandó, huecos de agenda que nadie ocupó, y ni un
 * error a la vista porque el sistema hizo exactamente lo que dice hacer.
 *
 * Un intento que se estrelló contra un proveedor ausente no es un intento del
 * mensaje. Se PAUSA en vez de gastarlo — y la pausa también está acotada, porque
 * una cola que sólo crece es la otra forma de perder un mensaje.
 */

export const MAX_INTENTOS = 5
export const BASE_MS = 5 * 60 * 1000        // 5 min
export const TOPE_MS = 6 * 60 * 60 * 1000   // 6 h

/** Retroceso exponencial acotado. `intento` es 1-based (1 = tras el 1er fallo). */
export function backoffMs(intento: number): number {
  const n = Math.max(1, Math.floor(intento))
  const ms = BASE_MS * Math.pow(2, n - 1)
  return Math.min(ms, TOPE_MS)
}

/** Instante ISO del próximo intento, dado el nº de intentos ya realizados. */
export function proximoIntentoISO(intentos: number, ahoraMs: number): string {
  return new Date(ahoraMs + backoffMs(intentos)).toISOString()
}

/** ¿Se agotaron los reintentos? (→ dead-letter). */
export function agotado(intentos: number, max = MAX_INTENTOS): boolean {
  return intentos >= max
}

/** ¿Ya venció el próximo intento programado? Sin fecha válida → sí (procesar ya). */
export function vencido(proximoIntentoISO: string | null | undefined, ahoraMs: number): boolean {
  if (!proximoIntentoISO) return true
  const t = Date.parse(proximoIntentoISO)
  return Number.isNaN(t) ? true : ahoraMs >= t
}

/* ── REG-391 · qué hacer cuando el que falla es el proveedor ──────────────── */

/**
 * Cuánto esperar tras una caída del proveedor.
 *
 * Del orden del enfriamiento máximo del interruptor (`red/interruptor.ts`): más
 * corto no serviría de nada —el interruptor seguiría abierto— y más largo
 * retrasaría un aviso cuando el proveedor ya volvió. Con el cron cada hora, lo
 * que de verdad decide es el ciclo siguiente; esta cifra sólo evita que una
 * entrada se repita dentro de la misma pasada.
 */
export const PAUSA_POR_PROVEEDOR_MS = 5 * 60 * 1000

/**
 * Tope de pausas. ≈3 días con el cron cada hora.
 *
 * Una cola que nunca se rinde crece sin fin y acaba siendo otra forma de perder
 * el mensaje, sólo que más lenta. A los tres días el hueco de agenda que este
 * aviso ofrecía ya pasó, así que la entrada muere — pero **muere diciendo que
 * murió por el proveedor**, no por haber agotado sus reintentos, que es una
 * frase distinta y manda a mirar a otro sitio.
 */
export const PAUSAS_MAXIMAS = 72

export type Reprogramacion =
  /** Fallo del mensaje: gasta reintento y retrocede. */
  | { accion: 'reintentar'; intentos: number; proximoIntentoAt: string }
  /** Fallo del proveedor: NO gasta reintento. */
  | { accion: 'pausar'; pausas: number; proximoIntentoAt: string }
  /** Se acabó. `porQue` distingue de qué murió. */
  | { accion: 'dead-letter'; intentos: number; pausas: number; porQue: 'reintentos_agotados' | 'proveedor_caido' }

/**
 * Qué hacer con una entrada que acaba de fallar. PURO.
 *
 * `intentos` y `pausas` son los que la entrada YA llevaba.
 */
export function decidirReprogramacion(
  entrada: { intentos: number; pausas: number },
  esDelProveedor: boolean,
  ahoraMs: number,
): Reprogramacion {
  if (esDelProveedor) {
    const pausas = entrada.pausas + 1
    if (pausas >= PAUSAS_MAXIMAS) {
      return { accion: 'dead-letter', intentos: entrada.intentos, pausas, porQue: 'proveedor_caido' }
    }
    return { accion: 'pausar', pausas, proximoIntentoAt: new Date(ahoraMs + PAUSA_POR_PROVEEDOR_MS).toISOString() }
  }
  const intentos = entrada.intentos + 1
  if (agotado(intentos)) {
    return { accion: 'dead-letter', intentos, pausas: entrada.pausas, porQue: 'reintentos_agotados' }
  }
  return { accion: 'reintentar', intentos, proximoIntentoAt: proximoIntentoISO(intentos, ahoraMs) }
}
