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

/* ── Price IDs (set in Stripe Dashboard, add to env vars) ── */
export const STRIPE_PRICES = {
  basico:  process.env.STRIPE_PRICE_BASICO  ?? '',
  pro:     process.env.STRIPE_PRICE_PRO     ?? '',
  clinica: process.env.STRIPE_PRICE_CLINICA ?? '',
} as const

export type PlanKey = keyof typeof STRIPE_PRICES

export const PLAN_NAMES: Record<PlanKey, string> = {
  basico:  'Básico',
  pro:     'Pro',
  clinica: 'Clínica',
}
