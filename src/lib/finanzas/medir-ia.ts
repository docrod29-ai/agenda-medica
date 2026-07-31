/**
 * Extrae el `usage` de la respuesta de cada proveedor.
 *
 * Los dos ya lo devuelven en cada llamada y hasta hoy se TIRABA — ése era el
 * P0-1 de la auditoría: el costo real de NexusMED era desconocido porque nadie
 * leía tres números que venían en el mismo JSON de la respuesta.
 *
 * Formatos distintos, misma información:
 *   Anthropic → usage.input_tokens · output_tokens · cache_read_input_tokens
 *   OpenAI    → usage.prompt_tokens · completion_tokens
 *
 * Módulo PURO.
 */
import type { Uso } from '@/lib/finanzas/precios-modelo'

type Json = Record<string, unknown>
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0)

/** Lee el uso de una respuesta, venga del proveedor que venga. */
export function usoDe(respuesta: unknown): Uso {
  const r = (respuesta ?? {}) as Json
  const u = (r.usage ?? {}) as Json
  const entrada = num(u.input_tokens) || num(u.prompt_tokens)
  const salida = num(u.output_tokens) || num(u.completion_tokens)
  const entradaCache =
    num(u.cache_read_input_tokens) ||
    num((u.prompt_tokens_details as Json | undefined)?.cached_tokens)
  return { entrada, salida, entradaCache }
}

/** ¿La respuesta traía uso? Si no, hay que enterarse: significa que se perdió. */
export function trajoUso(u: Uso): boolean {
  return u.entrada + u.salida + (u.entradaCache ?? 0) > 0
}
