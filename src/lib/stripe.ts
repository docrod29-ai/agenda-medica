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
  premium:  process.env.STRIPE_PRICE_PREMIUM  ?? '',  // plan "Pro" ($1,899)
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

/** Price ID de suscripción según plan + ciclo (cae a mensual si no hay anual configurado). */
export function priceIdDe(plan: PlanKey, ciclo: Ciclo): string {
  if (ciclo === 'anual') return STRIPE_PRICES_ANUAL[plan] || STRIPE_PRICES[plan]
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
