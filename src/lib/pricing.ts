/**
 * Motor de precios de paquetes. Un paquete puede cobrarse de 3 formas:
 *   · 'fijo'       → un precio único al mes (como antes).
 *   · 'por_medico' → escala con los MÉDICOS que usan el consultorio: el 1º vale
 *                    `precioBase` y cada médico adicional suma `precioPorUnidad`.
 *   · 'por_cama'   → escala con el TAMAÑO del hospital: `precioBase` + una cuota
 *                    `precioPorUnidad` por cada cama.
 *
 * Módulo puro (sin imports) — se usa en el servidor (consola del dueño) y en
 * cualquier vista que quiera mostrar el desglose.
 */
export type ModeloPrecio = 'fijo' | 'por_medico' | 'por_cama'

export interface PrecioPaquete {
  modeloPrecio?: ModeloPrecio
  precio?: number           // usado en 'fijo' (y como respaldo de base)
  precioBase?: number       // base de 'por_medico' / 'por_cama'
  precioPorUnidad?: number  // por médico adicional / por cama
}

export interface TamanoCliente {
  medicos: number  // médicos activos del consultorio
  camas: number    // camas del hospital
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Precio mensual REAL del paquete para un cliente de cierto tamaño. */
export function calcularPrecioPaquete(p: PrecioPaquete, ctx: TamanoCliente): number {
  const modelo = p.modeloPrecio ?? 'fijo'
  const base = n(p.precioBase ?? p.precio)
  const unidad = n(p.precioPorUnidad)

  if (modelo === 'por_medico') {
    const medicos = Math.max(1, Math.floor(n(ctx.medicos)) || 1) // el consultorio siempre tiene ≥1 médico
    return Math.round(base + Math.max(0, medicos - 1) * unidad)
  }
  if (modelo === 'por_cama') {
    const camas = Math.max(0, Math.floor(n(ctx.camas)))
    return Math.round(base + camas * unidad)
  }
  return Math.round(n(p.precio ?? base))
}

/** Explica el cobro en una línea legible para la consola del dueño. */
export function explicarPrecio(p: PrecioPaquete, ctx: TamanoCliente): string {
  const modelo = p.modeloPrecio ?? 'fijo'
  const base = n(p.precioBase ?? p.precio)
  const unidad = n(p.precioPorUnidad)
  const total = calcularPrecioPaquete(p, ctx)
  if (modelo === 'por_medico') {
    const medicos = Math.max(1, Math.floor(n(ctx.medicos)) || 1)
    return `${medicos} médico${medicos !== 1 ? 's' : ''}: base $${base} + ${Math.max(0, medicos - 1)} × $${unidad} = $${total}/mes`
  }
  if (modelo === 'por_cama') {
    const camas = Math.max(0, Math.floor(n(ctx.camas)))
    return `${camas} cama${camas !== 1 ? 's' : ''}: base $${base} + ${camas} × $${unidad} = $${total}/mes`
  }
  return `$${total}/mes (fijo)`
}
