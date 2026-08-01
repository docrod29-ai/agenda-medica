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
 * Y una TERCERA unidad que no son tokens: la TRANSCRIPCIÓN se cobra por minuto
 * de audio. El proveedor no la devuelve en `usage`, así que la ruta la adjunta
 * al objeto que pasa aquí. Sin leerla, el gasto de dictado —probablemente el
 * más grande de la plataforma, porque cada consulta se dicta— seguiría siendo
 * cero en el libro.
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
  // Los minutos no vienen dentro de `usage`: los adjunta la ruta de
  // transcripción al nivel superior, porque el proveedor no los reporta.
  const minutosAudio = num(r.minutosAudio) || undefined
  return { entrada, salida, entradaCache, minutosAudio }
}

/**
 * ¿La respuesta traía uso? Si no, hay que enterarse: significa que se perdió.
 *
 * Los MINUTOS cuentan. Una transcripción no tiene tokens —sólo minutos— así que
 * sin ellos aquí, cada dictado se contabilizaba como «llamada sin uso» y su
 * costo se perdía entero.
 */
export function trajoUso(u: Uso): boolean {
  return u.entrada + u.salida + (u.entradaCache ?? 0) + (u.minutosAudio ?? 0) > 0
}
