/**
 * Resumen de entregabilidad de WhatsApp — Iteración 7 · DELIVERY_DASHBOARD.
 *
 * Agrega los estados almacenados (uno por wamid, el más reciente) en métricas que
 * el médico puede leer: cuántos recordatorios se entregaron, se leyeron o fallaron.
 * PURO (sin red/DB) → testeable.
 */

import type { EstadoMensaje } from '@/lib/whatsapp/status'
import { esFalloPermanente } from '@/lib/whatsapp/status'

export interface FalloPorCodigo {
  codigo: number
  titulo?: string
  cuenta: number
}

export interface ResumenEntregas {
  total: number
  /** Conteo por estado actual (sent/delivered/read/failed/…). */
  porEstado: Record<string, number>
  /** delivered + read (llegaron al teléfono). */
  entregados: number
  /** read (el paciente lo vio). */
  leidos: number
  fallidos: number
  fallosPermanentes: number
  /** entregados / total (0..1). */
  tasaEntrega: number
  /** leidos / entregados (0..1). */
  tasaLectura: number
  /** Fallos agrupados por código de error, de mayor a menor. */
  fallosPorCodigo: FalloPorCodigo[]
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * @param items estados MÁS RECIENTES por wamid (como se guardan en whatsapp_status).
 */
export function resumirEntregas(items: EstadoMensaje[]): ResumenEntregas {
  const porEstado: Record<string, number> = {}
  const codigos = new Map<number, FalloPorCodigo>()
  let entregados = 0, leidos = 0, fallidos = 0, fallosPermanentes = 0

  for (const it of items) {
    const est = it.estado || 'unknown'
    porEstado[est] = (porEstado[est] ?? 0) + 1

    if (est === 'read') { leidos++; entregados++ }
    else if (est === 'delivered') { entregados++ }
    else if (est === 'failed') {
      fallidos++
      if (esFalloPermanente(it.errorCode)) fallosPermanentes++
      if (it.errorCode != null) {
        const prev = codigos.get(it.errorCode)
        if (prev) prev.cuenta++
        else codigos.set(it.errorCode, { codigo: it.errorCode, titulo: it.errorTitulo, cuenta: 1 })
      }
    }
  }

  const total = items.length
  return {
    total,
    porEstado,
    entregados,
    leidos,
    fallidos,
    fallosPermanentes,
    tasaEntrega: total ? redondear(entregados / total) : 0,
    tasaLectura: entregados ? redondear(leidos / entregados) : 0,
    fallosPorCodigo: [...codigos.values()].sort((a, b) => b.cuenta - a.cuenta),
  }
}
