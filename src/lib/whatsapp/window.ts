/**
 * Ventana de servicio de 24 h de WhatsApp — Iteración WA-1 · TEMPLATES_AND_WINDOW.
 *
 * Regla de Meta/WhatsApp: fuera de las 24 h desde el ÚLTIMO mensaje ENTRANTE del
 * usuario, un negocio NO puede enviar texto libre; debe usar una plantilla (HSM)
 * previamente aprobada. Dentro de la ventana, el texto libre es válido.
 *
 * Todo aquí es PURO (sin red/DB) → testeable en aislamiento.
 */

export const VENTANA_SERVICIO_MS = 24 * 60 * 60 * 1000

/**
 * ¿La ventana de servicio de 24 h sigue abierta?
 * @param ultimoEntranteISO  instante del último mensaje entrante del usuario (ISO) o null si nunca escribió
 * @param ahoraMs            Date.now() del momento del envío
 */
export function ventanaAbierta(ultimoEntranteISO: string | null | undefined, ahoraMs: number): boolean {
  if (!ultimoEntranteISO) return false // nunca escribió → no hay sesión abierta
  const t = Date.parse(ultimoEntranteISO)
  if (Number.isNaN(t)) return false
  return ahoraMs - t < VENTANA_SERVICIO_MS
}

/** Un mensaje PROACTIVO fuera de la ventana requiere plantilla (HSM). */
export function requierePlantilla(ultimoEntranteISO: string | null | undefined, ahoraMs: number): boolean {
  return !ventanaAbierta(ultimoEntranteISO, ahoraMs)
}

/**
 * Canal a usar para un mensaje PROACTIVO, según ventana y disponibilidad de
 * plantilla aprobada para esa clínica:
 *  - 'texto'     → ventana abierta: texto libre válido.
 *  - 'plantilla' → ventana cerrada pero hay plantilla aprobada configurada.
 *  - 'omitir'    → ventana cerrada y SIN plantilla: NO se envía texto libre
 *                  (Meta lo rechazaría). Se omite y se registra.
 */
export function decidirCanalProactivo(input: {
  ventanaAbierta: boolean
  plantillaDisponible: boolean
}): 'texto' | 'plantilla' | 'omitir' {
  if (input.ventanaAbierta) return 'texto'
  return input.plantillaDisponible ? 'plantilla' : 'omitir'
}
