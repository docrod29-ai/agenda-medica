/**
 * CONCILIACIÓN DE ASIENTOS — que el cobro siga a los médicos sin que nadie
 * pulse un botón.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El cupo de IA del consultorio escala con los médicos PRESENTES: `contarMedicos`
 * lee `clinic_members` y cada médico adicional suma su bolsa de créditos y su
 * tope económico. Se aplica **al instante**, en cuanto se da de alta a alguien.
 *
 * El COBRO, en cambio, vive en `medicosContratados`, y en todo el repositorio
 * hay **un solo sitio que lo escribe**: el `POST /api/stripe/asientos`, o sea el
 * botón «sincronizar» de una pantalla de configuración.
 *
 * Nadie pulsa ese botón. Un consultorio da de alta cinco médicos, los cinco
 * reciben su cuota de IA esa misma tarde, y la suscripción sigue cobrando uno —
 * indefinidamente. Es una fuga que crece con el éxito: cuanto mejor le va al
 * cliente, más regala la plataforma.
 *
 * Y el desajuste tampoco se ve: `requiereActualizar` sólo aparece si alguien
 * abre esa pantalla concreta de ese consultorio concreto.
 *
 * ── POR QUÉ NO SE ARREGLA BAJANDO EL CUPO ────────────────────────────────────
 *
 * La tentación es hacer que el cupo siga a `medicosContratados` —«que reciba lo
 * que paga»— y se acabó la fuga. Sería un error del tamaño del que ya costó caro
 * en v944: un consultorio con cuatro médicos dados de alta y el contador en uno
 * —porque nadie pulsó nunca el botón— vería su presupuesto de IA dividido entre
 * cuatro **de un día para otro**, sin haber hecho nada mal. Se le corta la IA a
 * un cliente que paga por un desfase administrativo nuestro.
 *
 * El cupo sigue a los médicos presentes. Lo que se arregla es que **el cobro
 * deje de depender de un clic**.
 *
 * ── LA REGLA QUE NO SE CRUZA ─────────────────────────────────────────────────
 *
 * Si Stripe no se pudo ajustar, **no se marca como contratado**. Es la misma
 * regla que ya tiene el botón, y por eso esta función es la ÚNICA
 * implementación: el día que las dos difieran, una de las dos dejará médicos
 * habilitados sin cobrar y nadie lo notará hasta el cierre de mes.
 */
import type Stripe from 'stripe'

export type ResultadoConciliacion =
  /** Ya estaba al día: no se tocó Stripe. */
  | { estado: 'al_dia'; medicos: number; contratados: number }
  /** Se ajustó la suscripción y se guardó el nuevo número. */
  | { estado: 'ajustado'; medicos: number; contratados: number; extras: number }
  /** No se pudo ajustar: NO se marca como contratado. Se dice por qué. */
  | { estado: 'no_ajustable'; medicos: number; contratados: number; porQue: string }
  /** El plan no cobra por asiento. */
  | { estado: 'sin_asientos' }

export interface EntradaConciliacion {
  conAsientos: boolean
  /** Médicos dados de alta ahora mismo. */
  medicos: number
  /** Los que la suscripción está cobrando. */
  contratados: number
  stripeSubscriptionId: string
  /** Precio de asiento configurado para el plan, o vacío si no lo hay. */
  seatPrice: string
}

/**
 * Decide QUÉ hay que hacer, sin hacerlo.
 *
 * Separado del efecto a propósito: así la regla —la parte que se puede
 * equivocar— se prueba sin Stripe, sin red y sin base de datos.
 */
export function queHacer(e: EntradaConciliacion): ResultadoConciliacion {
  if (!e.conAsientos) return { estado: 'sin_asientos' }
  if (e.medicos === e.contratados) {
    return { estado: 'al_dia', medicos: e.medicos, contratados: e.contratados }
  }
  if (!e.stripeSubscriptionId) {
    return {
      estado: 'no_ajustable', medicos: e.medicos, contratados: e.contratados,
      porQue: 'este consultorio no tiene una suscripción activa en Stripe',
    }
  }
  if (!e.seatPrice) {
    return {
      estado: 'no_ajustable', medicos: e.medicos, contratados: e.contratados,
      porQue: 'no hay precio de médico adicional configurado para este plan',
    }
  }
  return {
    estado: 'ajustado', medicos: e.medicos, contratados: e.contratados,
    extras: Math.max(0, e.medicos - 1),
  }
}

/**
 * Los ítems que hay que mandarle a Stripe.
 *
 * `extras === 0` con un asiento previo significa BORRAR el ítem, no ponerlo a
 * cero: una cantidad de cero en la suscripción deja la línea viva y algunos
 * informes la siguen contando. Y sin extras y sin ítem previo no hay nada que
 * mandar — el estado en Stripe ya es el correcto.
 */
export function itemsParaStripe(
  extras: number,
  seatPrice: string,
  itemPrevioId: string | null,
): { id?: string; price?: string; quantity?: number; deleted?: boolean }[] {
  if (extras > 0) {
    return [itemPrevioId ? { id: itemPrevioId, quantity: extras } : { price: seatPrice, quantity: extras }]
  }
  return itemPrevioId ? [{ id: itemPrevioId, deleted: true }] : []
}

/** Localiza el ítem del asiento dentro de la suscripción. */
export function itemPrevio(sub: Stripe.Subscription, seatPrice: string): string | null {
  return sub.items.data.find(i => i.price.id === seatPrice)?.id ?? null
}

export const POR_QUE_EL_CUPO_NO_BAJA =
  'La tentación es hacer que el cupo siga a lo CONTRATADO y se acabó la fuga. ' +
  'Sería el error de v944 otra vez: un consultorio con cuatro médicos de alta y ' +
  'el contador en uno —porque nadie pulsó nunca el botón— vería su presupuesto ' +
  'de IA dividido entre cuatro de un día para otro, sin haber hecho nada mal. ' +
  'El cupo sigue a los médicos presentes; lo que se arregla es que el cobro ' +
  'deje de depender de un clic.'

export const POR_QUE_UNA_SOLA_IMPLEMENTACION =
  'Si Stripe no se pudo ajustar, NO se marca como contratado. Es la misma regla ' +
  'que ya tenía el botón, y por eso hay una sola: el día que las dos difieran, ' +
  'una dejará médicos habilitados sin cobrar y nadie lo notará hasta el cierre ' +
  'de mes.'
