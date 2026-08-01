import Stripe from 'stripe'

/* Lazy singleton — avoids throwing at build time when env var is not set */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
  return _stripe
}

/** Convenience alias used in route handlers */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string]
  },
})

/* ── Price IDs de SUSCRIPCIÓN (crea el precio en Stripe y pega el id en Vercel) ── */
export const STRIPE_PRICES = {
  agenda:   process.env.STRIPE_PRICE_AGENDA   ?? '',
  clinica:  process.env.STRIPE_PRICE_CLINICA  ?? '',
  premium:  process.env.STRIPE_PRICE_PREMIUM  ?? '',  // plan "Pro" ($1,590 — ver PLANES en @/lib/planes-ia)
  hospital: process.env.STRIPE_PRICE_HOSPITAL ?? '',
} as const

export type PlanKey = keyof typeof STRIPE_PRICES

export const PLAN_NAMES: Record<PlanKey, string> = {
  agenda:   'Agenda',
  clinica:  'Clínica',
  premium:  'Pro',
  hospital: 'Hospital',
}

/* ── Price IDs ANUALES (12 meses al precio de 10 = −17%). Opcionales. ── */
export const STRIPE_PRICES_ANUAL = {
  agenda:   process.env.STRIPE_PRICE_AGENDA_ANUAL   ?? '',
  clinica:  process.env.STRIPE_PRICE_CLINICA_ANUAL  ?? '',
  premium:  process.env.STRIPE_PRICE_PREMIUM_ANUAL  ?? '',
  hospital: process.env.STRIPE_PRICE_HOSPITAL_ANUAL ?? '',
} as const

export type Ciclo = 'mensual' | 'anual'

/**
 * Price ID de suscripción según plan + ciclo.
 *
 * ── YA NO CAE A MENSUAL EN SILENCIO ──────────────────────────────────────────
 *
 * Hacía `STRIPE_PRICES_ANUAL[plan] || STRIPE_PRICES[plan]`, y los precios
 * anuales están declarados como «opcionales». Si faltaba la variable, el cliente
 * compraba ANUAL —la pantalla ya le había enseñado el precio del año y «2 meses
 * gratis»— y Stripe le abría una suscripción MENSUAL, con los metadatos
 * afirmando `ciclo: 'anual'`.
 *
 * Nadie se enteraba hasta el segundo cargo. Y para entonces hay que devolver
 * dinero y explicar por qué la aplicación cobró algo distinto de lo que dijo.
 *
 * Cobrar un ciclo distinto del que se ofreció no es un fallback: es cobrar otra
 * cosa. Mejor no dejar comprar y que el dueño configure el precio.
 */
export function priceIdDe(plan: PlanKey, ciclo: Ciclo): string {
  if (ciclo === 'anual') {
    const anual = STRIPE_PRICES_ANUAL[plan]
    if (!anual) {
      throw new Error(
        `El plan ${plan} no tiene precio ANUAL configurado en Stripe. ` +
        'No se abre una suscripción mensual en su lugar: sería cobrar un ciclo distinto del que se ofreció.',
      )
    }
    return anual
  }
  return STRIPE_PRICES[plan]
}

/** Price ID de la RECARGA de créditos (pago ÚNICO, no suscripción). */
export const STRIPE_PRICE_RECARGA = process.env.STRIPE_PRICE_RECARGA ?? ''

/** Price IDs del MÉDICO ADICIONAL (por asiento) — precio recurrente por médico extra. */
export const STRIPE_PRICES_MEDICO: Record<'clinica' | 'premium', string> = {
  clinica: process.env.STRIPE_PRICE_CLINICA_MEDICO ?? '',
  premium: process.env.STRIPE_PRICE_PREMIUM_MEDICO ?? '',
}
/** Price del médico extra según el plan (solo Clínica/Pro tienen asientos). */
export function priceMedicoDe(plan: PlanKey): string {
  if (plan === 'premium') return STRIPE_PRICES_MEDICO.premium
  if (plan === 'clinica') return STRIPE_PRICES_MEDICO.clinica
  return ''
}

/** Nivel de IA que activa cada plan (define Sonnet vs Opus + cupo de créditos). */
export function nivelDePlan(plan: PlanKey): 'pro' | 'premium' {
  return plan === 'premium' || plan === 'hospital' ? 'premium' : 'pro'
}
