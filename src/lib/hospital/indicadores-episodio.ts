/**
 * INDICADORES DEL EPISODIO — días por tipo de unidad, boarding y reingreso.
 *
 * Lo que hace posible este módulo no es una fórmula nueva: es que la unidad ya
 * tenga **tipo** y que cada traslado deje su marca de tiempo. Con el servicio
 * como texto libre, ninguna de estas cuentas se podía hacer.
 *
 * ── SON CUENTAS SOBRE HECHOS, NO JUICIOS ─────────────────────────────────────
 *
 * Aquí no hay ningún umbral clínico ni administrativo. «Reingreso a terapia» se
 * devuelve con **las horas que pasaron**; si esas horas cuentan como
 * bounce-back lo decide la unidad, y por eso la ventana entra como parámetro
 * obligatorio. Ver `FALTA_VENTANA_REINGRESO`.
 *
 * ── LO QUE NO SE ASUME ───────────────────────────────────────────────────────
 *
 * Un tramo en una unidad **sin tipo configurado** no se reparte entre los demás:
 * va a `horasSinClasificar` y se declara. Repartirlo inflaría los días-UCI o los
 * días-piso con tiempo que nadie sabe dónde ocurrió — y en un costeo por
 * paquete eso es dinero inventado.
 *
 * Módulo PURO.
 */

import type { TipoUnidad, Unidad } from '@/lib/hospital/unidades'
import { resolverUnidad } from '@/lib/hospital/unidades'

/** Un tramo del episodio en una unidad. `hasta` ausente = sigue ahí. */
export interface TramoUnidad {
  servicio: string
  desde: string
  hasta?: string | null
}

export interface IndicadoresEpisodio {
  /** Horas en cada tipo de unidad. Sólo aparecen los tipos con tiempo real. */
  horasPorTipo: Partial<Record<TipoUnidad, number>>
  /** Horas en unidades sin tipo. NO se reparten. */
  horasSinClasificar: number
  /** Servicios que causaron ese hueco. */
  serviciosSinTipo: string[]
  /** Horas desde el ingreso a urgencias hasta salir de urgencias. `null` si no pasó por ahí. */
  horasEnUrgencias: number | null
  /** Cada entrada a una unidad crítica, en orden. */
  entradasACritica: string[]
  /** Total de horas del episodio cubiertas por tramos. */
  horasTotales: number
}

const H = 3_600_000

export const FALTA_VENTANA_REINGRESO =
  'NEEDS_CLINICAL_REVIEW: qué separación entre dos estancias en terapia cuenta ' +
  'como reingreso (bounce-back) lo define la unidad. El módulo devuelve las ' +
  'horas reales entre una salida y la siguiente entrada; no fija la ventana.'

/**
 * Reconstruye los tramos a partir de la historia de movimientos.
 *
 * @param servicioActual el servicio en el que está AHORA (el último tramo queda
 *   abierto).
 * @param movimientos traslados con su fecha, en cualquier orden.
 * @param ingresoIso inicio del episodio.
 */
export function tramosDeEpisodio(
  ingresoIso: string,
  movimientos: readonly { fecha: string; servicioDestino: string }[],
  servicioInicial: string,
): TramoUnidad[] {
  const ordenados = [...movimientos]
    .filter(m => !Number.isNaN(Date.parse(m.fecha)))
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))

  const tramos: TramoUnidad[] = [{ servicio: servicioInicial, desde: ingresoIso }]
  for (const m of ordenados) {
    tramos[tramos.length - 1].hasta = m.fecha
    tramos.push({ servicio: m.servicioDestino, desde: m.fecha })
  }
  return tramos
}

/**
 * Cuenta horas por tipo de unidad.
 *
 * @param finIso instante de cierre para el tramo abierto (ahora, o el egreso).
 */
export function indicadoresEpisodio(
  tramos: readonly TramoUnidad[],
  unidades: readonly Unidad[],
  finIso: string,
): IndicadoresEpisodio {
  const fin = Date.parse(finIso)
  if (Number.isNaN(fin)) throw new Error(`indicadoresEpisodio: instante inválido «${finIso}»`)

  const horasPorTipo: Partial<Record<TipoUnidad, number>> = {}
  const sinTipo = new Set<string>()
  const entradasACritica: string[] = []
  let horasSinClasificar = 0
  let horasTotales = 0
  let horasEnUrgencias: number | null = null
  let criticaPrevia = false

  for (const t of tramos) {
    const desde = Date.parse(t.desde)
    if (Number.isNaN(desde)) continue
    const hasta = t.hasta != null && !Number.isNaN(Date.parse(t.hasta)) ? Date.parse(t.hasta) : fin
    // Un tramo invertido no resta tiempo: se ignora y no contamina el total.
    if (hasta < desde) continue
    const horas = (hasta - desde) / H
    horasTotales += horas

    const r = resolverUnidad(t.servicio, unidades)
    if (r.tipo === null) {
      horasSinClasificar += horas
      if (r.nombre !== '') sinTipo.add(r.nombre)
      criticaPrevia = false
      continue
    }
    horasPorTipo[r.tipo] = (horasPorTipo[r.tipo] ?? 0) + horas
    if (r.tipo === 'urgencias') horasEnUrgencias = (horasEnUrgencias ?? 0) + horas
    if (r.tipo === 'critica' && !criticaPrevia) entradasACritica.push(t.desde)
    criticaPrevia = r.tipo === 'critica'
  }

  return {
    horasPorTipo, horasSinClasificar,
    serviciosSinTipo: [...sinTipo].sort((a, b) => a.localeCompare(b, 'es')),
    horasEnUrgencias, entradasACritica, horasTotales,
  }
}

export interface Reingreso {
  salidaIso: string
  reentradaIso: string
  horasFuera: number
  /** Sólo si el llamador aportó una ventana. */
  dentroDeVentana?: boolean
}

/**
 * Reingresos a una unidad crítica.
 *
 * Devuelve **las horas reales** entre cada salida de terapia y la siguiente
 * entrada. `ventanaHoras` es opcional: sin ella no se emite juicio, sólo el
 * hecho. Con ella, se marca cuál cae dentro — pero la ventana la fija la unidad
 * (`FALTA_VENTANA_REINGRESO`).
 */
export function reingresosACritica(
  tramos: readonly TramoUnidad[],
  unidades: readonly Unidad[],
  ventanaHoras?: number,
): Reingreso[] {
  const criticos = tramos.map(t => resolverUnidad(t.servicio, unidades).tipo === 'critica')
  const out: Reingreso[] = []

  for (let i = 1; i < tramos.length; i++) {
    if (!criticos[i]) continue
    // Buscar hacia atrás la última estancia crítica cerrada.
    let j = i - 1
    while (j >= 0 && !criticos[j]) j--
    if (j < 0) continue
    const salida = tramos[j].hasta
    const reentrada = tramos[i].desde
    if (salida == null || Number.isNaN(Date.parse(salida)) || Number.isNaN(Date.parse(reentrada))) continue
    const horasFuera = (Date.parse(reentrada) - Date.parse(salida)) / H
    const r: Reingreso = { salidaIso: salida, reentradaIso: reentrada, horasFuera }
    if (ventanaHoras !== undefined && ventanaHoras > 0) r.dentroDeVentana = horasFuera <= ventanaHoras
    out.push(r)
  }
  return out
}

/** Horas a días con un decimal, para mostrar. El cálculo usa las horas exactas. */
export function enDias(horas: number): number {
  return Math.round((horas / 24) * 10) / 10
}
