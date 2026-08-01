/**
 * ¿ESTÁN ENCENDIDOS LOS EVENTOS QUE EL CÓDIGO SABE ATENDER?
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * Stripe sólo envía los eventos a los que el endpoint está SUSCRITO. El código
 * del webhook puede saber atender `charge.refunded` perfectamente y, si nadie lo
 * marcó en el panel, **el evento no llega nunca**: reembolsos y contracargos
 * pasan sin dejar rastro y el resultado es idéntico a no haberlo programado.
 *
 * Es el fallo de «escrito, probado y sin conectar», sólo que el eslabón que
 * falta no está en el repositorio — está en una casilla de un panel web. Por eso
 * no basta con un test: ninguno puede verla.
 *
 * Lo que sí se puede es **preguntárselo a Stripe** y ponerlo en la consola del
 * dueño, para que deje de depender de que alguien se acuerde.
 *
 * Módulo PURO: recibe la lista de eventos suscritos y decide. Quien habla con
 * Stripe es la ruta.
 */

/**
 * Eventos que el webhook sabe atender HOY.
 *
 * Esta lista es el contrato: si mañana se maneja uno nuevo en
 * `api/stripe/webhook`, se añade aquí y la consola avisará sola de que hay que
 * encenderlo. Si se deja de manejar uno, se quita y deja de pedirse.
 */
export const EVENTOS_QUE_ATENDEMOS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const

/**
 * Eventos cuya ausencia cuesta DINERO, no comodidad.
 *
 * Sin los tres, a un cliente se le devuelve el dinero —o su banco lo reclama— y
 * su suscripción sigue viva: se queda con el producto y sin pagar. Los demás
 * degradan el servicio; éstos abren un agujero en la caja.
 */
export const EVENTOS_CRITICOS = [
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const

export interface SaludWebhook {
  /** El endpoint está dado de alta en Stripe. */
  configurado: boolean
  /** De los que atendemos, cuáles NO están suscritos. */
  faltantes: string[]
  /** De los faltantes, cuáles cuestan dinero. */
  faltanCriticos: string[]
  /** Qué decirle al dueño. Vacío cuando no hay nada que decir. */
  aviso: string
}

/**
 * Decide el estado a partir de lo que Stripe reporta.
 *
 * `suscritos` puede traer `'*'`: en el panel de Stripe eso significa «todos los
 * eventos», y entonces no falta ninguno. Tratarlo como un nombre literal habría
 * marcado los nueve como faltantes en una cuenta perfectamente configurada — un
 * falso positivo que enseña a ignorar el aviso.
 */
export function evaluarWebhook(suscritos: readonly string[] | null): SaludWebhook {
  if (suscritos === null) {
    return {
      configurado: false,
      faltantes: [...EVENTOS_QUE_ATENDEMOS],
      faltanCriticos: [...EVENTOS_CRITICOS],
      aviso: 'No se encontró ningún webhook de Stripe apuntando a esta aplicación. Sin él, NADA de lo que pasa en Stripe llega a NexusMED: ni altas, ni pagos, ni reembolsos.',
    }
  }
  if (suscritos.includes('*')) {
    return { configurado: true, faltantes: [], faltanCriticos: [], aviso: '' }
  }

  const set = new Set(suscritos)
  const faltantes = EVENTOS_QUE_ATENDEMOS.filter(e => !set.has(e))
  const faltanCriticos = EVENTOS_CRITICOS.filter(e => !set.has(e))

  if (faltanCriticos.length > 0) {
    return {
      configurado: true, faltantes, faltanCriticos,
      aviso: `Faltan ${faltanCriticos.length} evento(s) de devolución en tu webhook de Stripe: ${faltanCriticos.join(', ')}. El código ya sabe atenderlos, pero Stripe no los envía si no están marcados — hoy un reembolso o un contracargo deja la suscripción activa y el ingreso contado. Actívalos en Developers → Webhooks → Add events.`,
    }
  }
  if (faltantes.length > 0) {
    return {
      configurado: true, faltantes, faltanCriticos: [],
      aviso: `Tu webhook de Stripe no está suscrito a: ${faltantes.join(', ')}. El código los atiende, pero no llegan.`,
    }
  }
  return { configurado: true, faltantes: [], faltanCriticos: [], aviso: '' }
}

export const POR_QUE_NO_BASTA_UN_TEST =
  'Porque el eslabón que falta no está en el repositorio: es una casilla en el ' +
  'panel de Stripe. Ninguna prueba puede verla, y el síntoma —un reembolso que ' +
  'no cancela nada— tarda semanas en notarse. Preguntárselo a Stripe y ponerlo ' +
  'en la consola convierte «acuérdate de ir a picarle» en algo que se ve solo.'
