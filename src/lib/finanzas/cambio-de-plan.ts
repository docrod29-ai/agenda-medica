/**
 * CAMBIAR DE PLAN NO ES DAR DE ALTA OTRA SUSCRIPCIÓN.
 *
 * ── EL FALLO (N-001, Panel de Lujo 2026-09, P0) ──────────────────────────────
 *
 * El cambio de plan estaba implementado como «alta nueva + cancelar lo demás»:
 * el botón abría un Checkout NUEVO que cobraba el plan completo, y el webhook
 * cancelaba la suscripción anterior a secas — sin prorrateo, sin nota de
 * crédito y sin escribir nada en la clínica. Un consultorio en plan anual,
 * pagado entero en enero, que en marzo subía a Pro perdía diez meses ya pagados
 * y ninguna pantalla lo decía. Y no sólo el anual: cualquier cambio a mitad de
 * ciclo se cobraba entero.
 *
 * El equipo rojo confirmó que el ÚNICO `proration_behavior` del repositorio
 * vivía en el ajuste de asientos, nunca en el cambio de plan.
 *
 * ── LA REGLA (decisión por omisión PL-D2: prorrateo nativo) ──────────────────
 *
 * 1. Si el consultorio YA tiene una suscripción viva, el cambio de plan es un
 *    `subscriptions.update` del ítem del plan con `proration_behavior:
 *    'create_prorations'`: Stripe acredita el tiempo no consumido y cobra sólo
 *    la diferencia. El Checkout queda para el ALTA, no para el cambio.
 * 2. Si por lo que sea llegan a coexistir dos suscripciones (portal de Stripe,
 *    carrera), la que sobra se cancela CON prorrateo (`prorate` + `invoice_now`)
 *    y queda constancia del crédito en `clinics/{id}` para poder explicarlo.
 *
 * Este módulo es la parte PURA de esa decisión: qué ítem es el del plan y qué
 * hay que hacer. Quien habla con Stripe vive en las rutas.
 */

import type { PlanKey } from '@/lib/stripe'

/** Lo mínimo de un ítem de suscripción de Stripe que hace falta para decidir. */
export interface ItemDeSuscripcion {
  id: string
  priceId?: string | null
  quantity?: number | null
  nickname?: string | null
}

/**
 * El ítem del PLAN, no `items.data[0]`.
 *
 * Stripe no garantiza el orden de los ítems. Con un asiento de médico
 * adicional en la suscripción, `data[0]` puede ser el precio del asiento. Es
 * la misma elección que hace el webhook al deducir el plan cobrado.
 */
export function elegirItemDelPlan(
  items: readonly ItemDeSuscripcion[],
  preciosConocidos: Readonly<Record<string, PlanKey>>,
): ItemDeSuscripcion | undefined {
  const conocidos = new Set(Object.keys(preciosConocidos))
  return items.find(i => conocidos.has(String(i.priceId ?? '')))
    ?? items.find(i => (i.quantity ?? 1) === 1 && !String(i.nickname ?? '').toLowerCase().includes('medico'))
    ?? items[0]
}

export type DecisionCambioDePlan =
  /** Ya está en ese precio: no hay nada que cobrar ni que cambiar. */
  | { que: 'sin-cambio'; porQue: string }
  /** Actualizar el ítem en sitio, con prorrateo. */
  | { que: 'actualizar'; itemId: string; porQue: string }
  /** No hay suscripción viva que actualizar: toca alta nueva por Checkout. */
  | { que: 'alta-nueva'; porQue: string }

/** Estados en los que una suscripción se puede actualizar en sitio. */
const VIVAS = new Set(['active', 'trialing', 'past_due'])

export function decidirCambioDePlan(args: {
  status: string | null | undefined
  itemPlan: ItemDeSuscripcion | undefined
  priceNuevo: string
}): DecisionCambioDePlan {
  if (!args.status || !VIVAS.has(args.status)) {
    return { que: 'alta-nueva', porQue: `la suscripción está en estado «${args.status ?? 'desconocido'}»: no se actualiza, se da de alta` }
  }
  if (!args.itemPlan) {
    return { que: 'alta-nueva', porQue: 'la suscripción viva no tiene ningún ítem de plan reconocible' }
  }
  if (String(args.itemPlan.priceId ?? '') === args.priceNuevo) {
    return { que: 'sin-cambio', porQue: 'la suscripción ya cobra exactamente ese precio' }
  }
  return {
    que: 'actualizar',
    itemId: args.itemPlan.id,
    porQue: 'hay una suscripción viva: se cambia el precio en sitio y Stripe prorratea lo no consumido',
  }
}

/**
 * Constancia que se escribe en `clinics/{id}` cuando se compensa un empalme
 * cancelando una suscripción sobrante. Es lo que permite explicarle al médico
 * qué pasó con lo que ya había pagado.
 */
export interface ConstanciaDeCambioDePlan {
  en: string
  suscripcionNueva: string
  suscripcionesCanceladas: { id: string; prorrateo: 'stripe' | 'no-confirmado' }[]
  creditoPorProrrateo: string
}

export const TEXTO_CREDITO_POR_PRORRATEO =
  'La suscripción anterior se canceló con prorrateo (prorate + invoice_now): Stripe ' +
  'abona a la cuenta del cliente el tiempo no consumido y lo descuenta de los siguientes cobros.'

export const POR_QUE_SE_ACTUALIZA_EN_SITIO =
  'Porque un Checkout nuevo cobra el plan entero y cancela el anterior sin devolver ' +
  'nada: el que pagó un año en enero y sube de plan en marzo perdía diez meses. ' +
  'Stripe sabe prorratear; sólo había que pedírselo.'
