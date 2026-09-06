/**
 * A DÓNDE VA EL DINERO DEL PACIENTE.
 *
 * ── EL FALLO (N-002, Panel de Lujo 2026-09, P0 · severidad 5) ────────────────
 *
 * El anticipo que pagaba el paciente desde su portal se cobraba con el cliente
 * de Stripe de la PLATAFORMA —el mismo que cobra la suscripción del médico—,
 * sin `stripeAccount`, sin `transfer_data`, sin `on_behalf_of`. El dinero
 * quedaba en el balance de la plataforma y el webhook lo asentaba en
 * `clinics/{id}/cobros` como cobro del consultorio: el corte de caja reportaba
 * dinero que el médico nunca recibió. El equipo rojo buscó en todo `src/`
 * cualquier mecanismo de liquidación: cero resultados.
 *
 * Mientras tanto, la pantalla de configuración le decía al médico «pega tu link
 * de pago propio … el paciente verá un botón Pagar anticipo» (N-003), y ese
 * enlace sólo se enseñaba cuando el pago por la app FALLABA.
 *
 * ── LA REGLA (decisión por omisión PL-D1) ────────────────────────────────────
 *
 * Retener fondos de terceros sin contrato es regulatorio y contractual, y no lo
 * decide ningún agente. Así que:
 *
 *   · `connect`         — el consultorio tiene cuenta conectada de Stripe
 *                         (`clinics/{id}.stripeAccountId`, `acct_…`): el Checkout
 *                         se abre CON destino a esa cuenta y el dinero nunca se
 *                         queda en la plataforma. Es la vía correcta y la que
 *                         `membresias.ts` ya daba por supuesta.
 *   · `liga-propia`     — sin Connect pero con `config.anticipoLink`: el botón
 *                         del portal abre la liga del médico (MercadoPago, Clip,
 *                         Payment Link…). El consultorio cobra por su cuenta y
 *                         registra el cobro en ventanilla.
 *   · `en-consultorio`  — ni lo uno ni lo otro: no hay botón de pago; se paga
 *                         al llegar.
 *
 * Mientras un consultorio no tenga cuenta conectada, la ruta de Checkout de la
 * plataforma responde 409 y NO abre sesión. Activar Connect exige una cuenta de
 * Stripe con Connect habilitado del dueño de la plataforma: está registrado en
 * `decisiones-DINERO.md` y en `docs/pendientes-externos.md`.
 *
 * Módulo PURO: decide y explica. Lo consumen la ruta de Checkout (servidor) y,
 * por handoff, la respuesta del portal y su pantalla.
 */

export type ViaDeCobroDelAnticipo = 'connect' | 'liga-propia' | 'en-consultorio'

export interface CustodiaDelAnticipo {
  via: ViaDeCobroDelAnticipo
  /** Cuenta conectada de Stripe del consultorio, sólo en `connect`. */
  stripeAccountId?: string
  /** Liga propia del consultorio, sólo en `liga-propia`. */
  anticipoLink?: string
  /** Importe configurado (0 si no hay). */
  monto: number
  /** Para la bitácora y el mensaje al paciente. */
  porQue: string
}

export interface EntradaCustodia {
  /** `clinics/{id}.stripeAccountId` — la cuenta conectada, si existe. */
  stripeAccountId?: unknown
  /** `config.anticipoLink` — la liga propia del médico. */
  anticipoLink?: unknown
  /** `config.anticipoMonto`. */
  anticipoMonto?: unknown
}

/** Una cuenta conectada de Stripe siempre empieza por `acct_`. */
export function esCuentaConectada(v: unknown): v is string {
  return typeof v === 'string' && /^acct_\w+$/.test(v.trim())
}

/** Una liga de pago tiene que ser https; lo demás no se le enseña a un paciente. */
export function esLigaDePago(v: unknown): v is string {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:'
  } catch { return false }
}

export function custodiaDelAnticipo(e: EntradaCustodia): CustodiaDelAnticipo {
  const monto = Number(e.anticipoMonto)
  const montoOk = Number.isFinite(monto) && monto > 0 ? monto : 0
  if (esCuentaConectada(e.stripeAccountId)) {
    return {
      via: 'connect',
      stripeAccountId: e.stripeAccountId.trim(),
      monto: montoOk,
      porQue: 'el consultorio tiene cuenta conectada de Stripe: el cobro se abre con destino a esa cuenta',
    }
  }
  if (esLigaDePago(e.anticipoLink)) {
    return {
      via: 'liga-propia',
      anticipoLink: e.anticipoLink.trim(),
      monto: montoOk,
      porQue: 'sin cuenta conectada, el paciente paga por la liga propia del consultorio y el cobro se registra en ventanilla',
    }
  }
  return {
    via: 'en-consultorio',
    monto: montoOk,
    porQue: 'sin cuenta conectada ni liga propia no hay cobro en línea: se paga en el consultorio',
  }
}

/** Lo que el portal le dice al paciente en cada vía. Texto de persona, es-MX. */
export const TEXTO_DE_LA_VIA: Record<ViaDeCobroDelAnticipo, string> = {
  connect: 'Se aplica a tu próxima cita y queda registrado en el consultorio.',
  'liga-propia': 'Pagas por el enlace de tu consultorio; avísales para que lo registren en tu cita.',
  'en-consultorio': 'El anticipo se paga en el consultorio.',
}

export const POR_QUE_NO_SE_COBRA_EN_LA_CUENTA_DE_LA_PLATAFORMA =
  'Porque dinero ajeno en cuenta propia no es una función incompleta: es custodia de ' +
  'fondos de terceros sin contrato. Hasta que exista la cuenta conectada del ' +
  'consultorio, el cobro en línea no se abre, y la liga propia del médico —que la ' +
  'pantalla ya le pedía— es la que se enseña.'
