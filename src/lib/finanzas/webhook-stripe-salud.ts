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

/**
 * ¿La app está cobrando de verdad, o en el mundo de mentira de Stripe?
 *
 * Stripe tiene dos universos separados: PRUEBA (tarjetas falsas, dinero falso,
 * su propio webhook) y PRODUCCIÓN. Se distinguen por el prefijo de la llave.
 *
 * Importa saberlo porque la confusión es silenciosa y cara: con una llave de
 * prueba en producción, la app **parece** cobrar —el checkout se abre, el pago
 * «pasa», la suscripción se activa— y no entra un solo peso. Nadie se entera
 * hasta que alguien va a mirar el banco.
 *
 * Y los eventos del webhook se configuran POR SEPARADO en cada universo:
 * marcarlos en prueba no los marca en producción.
 */
export type ModoStripe = 'prueba' | 'produccion' | 'sin_llave'

/**
 * Lee el modo del PREFIJO de la llave, nunca la llave.
 *
 * `sk_live_…` es producción, `sk_test_…` es prueba. Sólo se mira el principio y
 * lo que sale de aquí es una palabra de tres opciones: el secreto no viaja ni a
 * la pantalla ni a los registros.
 */
export function modoDeLaLlave(llave: string | undefined | null): ModoStripe {
  const k = (llave ?? '').trim()
  if (!k) return 'sin_llave'
  return k.startsWith('sk_live') || k.startsWith('rk_live') ? 'produccion' : 'prueba'
}

/** Qué decirle al dueño sobre el modo. Vacío cuando no hay nada que decir. */
export function avisoDeModo(modo: ModoStripe): string {
  if (modo === 'produccion') return ''
  if (modo === 'sin_llave') {
    return 'No hay llave de Stripe configurada: la aplicación no puede cobrar nada.'
  }
  return 'La aplicación está usando la llave de PRUEBA de Stripe. Los pagos se simulan: el checkout se abre, la suscripción se activa y NO entra dinero. Además, los eventos del webhook se configuran por separado en cada modo — lo que marques en prueba no aplica en producción.'
}

export interface SaludWebhook {
  /** El endpoint está dado de alta en Stripe. */
  configurado: boolean
  /** De los que atendemos, cuáles NO están suscritos. */
  faltantes: string[]
  /** De los faltantes, cuáles cuestan dinero. */
  faltanCriticos: string[]
  /** Qué decirle al dueño. Vacío cuando no hay nada que decir. */
  aviso: string
  /** ¿Prueba o producción? Sale del prefijo de la llave, nunca de la llave. */
  modo: ModoStripe
  /** Aviso sobre el modo. Vacío en producción. */
  avisoModo: string
}

/**
 * Decide el estado a partir de lo que Stripe reporta.
 *
 * `suscritos` puede traer `'*'`: en el panel de Stripe eso significa «todos los
 * eventos», y entonces no falta ninguno. Tratarlo como un nombre literal habría
 * marcado los nueve como faltantes en una cuenta perfectamente configurada — un
 * falso positivo que enseña a ignorar el aviso.
 */
export function evaluarWebhook(suscritos: readonly string[] | null, modo: ModoStripe = 'sin_llave'): SaludWebhook {
  const avisoModo = avisoDeModo(modo)
  if (suscritos === null) {
    return {
      configurado: false,
      faltantes: [...EVENTOS_QUE_ATENDEMOS],
      faltanCriticos: [...EVENTOS_CRITICOS],
      aviso: 'No se encontró ningún webhook de Stripe apuntando a esta aplicación. Sin él, NADA de lo que pasa en Stripe llega a Ausculta: ni altas, ni pagos, ni reembolsos.',
      modo, avisoModo,
    }
  }
  if (suscritos.includes('*')) {
    return { configurado: true, faltantes: [], faltanCriticos: [], aviso: '', modo, avisoModo }
  }

  const set = new Set(suscritos)
  const faltantes = EVENTOS_QUE_ATENDEMOS.filter(e => !set.has(e))
  const faltanCriticos = EVENTOS_CRITICOS.filter(e => !set.has(e))

  if (faltanCriticos.length > 0) {
    return {
      configurado: true, faltantes, faltanCriticos,
      aviso: `Faltan ${faltanCriticos.length} evento(s) de devolución en tu webhook de Stripe: ${faltanCriticos.join(', ')}. El código ya sabe atenderlos, pero Stripe no los envía si no están marcados — hoy un reembolso o un contracargo deja la suscripción activa y el ingreso contado. Actívalos en Developers → Webhooks → Add events.`,
      modo, avisoModo,
    }
  }
  if (faltantes.length > 0) {
    return {
      configurado: true, faltantes, faltanCriticos: [],
      aviso: `Tu webhook de Stripe no está suscrito a: ${faltantes.join(', ')}. El código los atiende, pero no llegan.`,
      modo, avisoModo,
    }
  }
  return { configurado: true, faltantes: [], faltanCriticos: [], aviso: '', modo, avisoModo }
}

export const POR_QUE_NO_BASTA_UN_TEST =
  'Porque el eslabón que falta no está en el repositorio: es una casilla en el ' +
  'panel de Stripe. Ninguna prueba puede verla, y el síntoma —un reembolso que ' +
  'no cancela nada— tarda semanas en notarse. Preguntárselo a Stripe y ponerlo ' +
  'en la consola convierte «acuérdate de ir a picarle» en algo que se ve solo.'
