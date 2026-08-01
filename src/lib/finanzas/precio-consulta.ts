/**
 * CUÁNTO CUESTA ESTA CONSULTA, segun la lista de precios del consultorio.
 *
 * ── POR QUÉ SALE DE LA PANTALLA ──────────────────────────────────────────────
 *
 * Esta regla vivía dentro del componente de Consulta, así que sólo existía ahí.
 * Consecuencia concreta: al cobrar desde **Citas** —que es por donde cobra la
 * asistente, o sea la mayoría de las veces— el modal abría con el importe
 * VACÍO. Y sin precio no hay nada contra qué restar los abonos, así que el saldo
 * pendiente tampoco podía calcularse justo en la pantalla donde más falta hace.
 *
 * Una regla de negocio que sólo funciona desde una de las dos puertas no es una
 * regla: es una casualidad de dónde se escribió.
 *
 * Módulo PURO.
 */

export interface ServicioConPrecio {
  servicio: string
  precio: number
}

/**
 * El precio que corresponde a un tipo de cita, o `undefined` si no se sabe.
 *
 * `undefined` y no `0`: un cero se pintaría como «esta consulta cuesta nada» y
 * se cobraría así. Cuando no hay lista de precios, la respuesta honesta es que
 * no se sabe, y quien cobra teclea el importe como hasta ahora.
 *
 * El emparejamiento es por PREFIJO del tipo de cita («primera-vez» → «primera»)
 * porque los tipos internos llevan guiones y los servicios que escribe el médico
 * están en prosa: «Consulta de primera vez». Si nada coincide se usa el primero
 * de la lista, que es el servicio principal del consultorio.
 */
export function precioSugerido(
  precios: readonly ServicioConPrecio[] | null | undefined,
  tipoCita: string | null | undefined,
): number | undefined {
  const lista = (precios ?? []).filter(p => p && Number.isFinite(Number(p.precio)) && Number(p.precio) > 0)
  if (!lista.length) return undefined
  const tipo = String(tipoCita ?? '').toLowerCase().trim()
  const raiz = tipo.split('-')[0]
  const coincide = raiz ? lista.find(p => String(p.servicio ?? '').toLowerCase().includes(raiz)) : undefined
  return Number((coincide ?? lista[0]).precio)
}
