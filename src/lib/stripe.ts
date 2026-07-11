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

/** Price ID de la RECARGA de créditos (pago ÚNICO, no suscripción). */
export const STRIPE_PRICE_RECARGA = process.env.STRIPE_PRICE_RECARGA ?? ''

/** Nivel de IA que activa cada plan (define Sonnet vs Opus + cupo de créditos). */
export function nivelDePlan(plan: PlanKey): 'pro' | 'premium' {
  return plan === 'premium' || plan === 'hospital' ? 'premium' : 'pro'
}
