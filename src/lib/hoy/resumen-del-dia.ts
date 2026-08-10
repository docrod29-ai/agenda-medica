/**
 * EL RECUENTO DEL DÍA, EN UN RENGLÓN — V10 · HOME-001.
 *
 * Sustituye a las cuatro tarjetas KPI que encabezaban la pantalla de inicio.
 * §14 del charter V10 lo dice con estas palabras: *«no construyas un tablero
 * de KPIs genérico para médicos»*, y *«las métricas administrativas van en
 * Operaciones/Analítica»*.
 *
 * No se pierde ningún dato — están los mismos números y además el de mañana.
 * Lo que se pierde es la banda de 130 px, los cuatro circulitos de icono y los
 * cuatro colores decorativos.
 *
 * Vive aparte de la pantalla por dos razones concretas:
 *
 * 1. **Se puede probar.** Las reglas de abajo (qué se calla cuando vale cero,
 *    cuándo el plural cambia, qué lleva color) son decisiones, no formato, y
 *    una decisión sin prueba se deshace sola en el siguiente rediseño.
 * 2. **La regla del color es una sola.** Sólo se destaca lo que pide una
 *    acción HOY. Si mañana alguien quiere pintar de rojo los que no
 *    asistieron, tiene que cambiar esta línea y romper su prueba.
 */

/** Un trozo del renglón. `alerta` = pide una acción hoy, y por eso lleva color. */
export interface ParteDelResumen {
  readonly texto: string
  readonly alerta?: boolean
}

export interface ConteoDelDia {
  readonly total: number
  readonly confirmadas: number
  readonly pendientes: number
  readonly noShow: number
  readonly canceladas: number
  readonly manana: number
}

/** Plural del español para los sustantivos regulares de esta línea. */
function plural(n: number, singular: string, pl: string): string {
  return `${n} ${n === 1 ? singular : pl}`
}

/**
 * Construye el renglón. Devuelve `[]` cuando no hay citas: el estado vacío de
 * la agenda ya dice que el día está libre, y repetirlo como «0 citas ·
 * 0 confirmadas · 0 por confirmar» es ruido que no informa de nada.
 */
export function resumenDelDia(c: ConteoDelDia): ParteDelResumen[] {
  if (c.total <= 0) return []

  const partes: ParteDelResumen[] = [{ texto: plural(c.total, 'cita', 'citas') }]

  /* Un cero no se escribe. «0 no asistieron» ocupa el mismo espacio que el
     dato que sí importa y entrena a saltarse la línea entera. */
  if (c.confirmadas > 0) partes.push({ texto: plural(c.confirmadas, 'confirmada', 'confirmadas') })

  /* EL ÚNICO CON COLOR. Una cita por confirmar es trabajo de hoy: alguien
     tiene que llamar. Lo demás de esta línea ya ocurrió. */
  if (c.pendientes > 0) partes.push({ texto: `${c.pendientes} por confirmar`, alerta: true })

  if (c.noShow > 0) partes.push({ texto: c.noShow === 1 ? '1 no asistió' : `${c.noShow} no asistieron` })
  if (c.canceladas > 0) partes.push({ texto: plural(c.canceladas, 'cancelada', 'canceladas') })

  /* El de mañana va al final: es contexto, no es el día que se está viendo. */
  if (c.manana > 0) partes.push({ texto: `${c.manana} mañana` })

  return partes
}
