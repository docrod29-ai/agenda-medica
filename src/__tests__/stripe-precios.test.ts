/**
 * GUARDIÁN: no se cobra un ciclo distinto del que se ofreció.
 *
 * `priceIdDe` hacía `ANUAL[plan] || MENSUAL[plan]`, y los precios anuales están
 * declarados como «opcionales». Si faltaba la variable de entorno, el cliente
 * compraba ANUAL —la pantalla ya le había enseñado el precio del año y «2 meses
 * gratis»— y Stripe le abría una suscripción MENSUAL, con los metadatos
 * afirmando `ciclo: 'anual'`. Nadie se enteraba hasta el segundo cargo.
 *
 * Cobrar un ciclo distinto del ofrecido no es un fallback: es cobrar otra cosa.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV_ORIGINAL = { ...process.env }

async function cargarStripe() {
  vi.resetModules()
  return import('@/lib/stripe')
}

describe('priceIdDe', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_AGENDA = 'price_agenda_mensual'
    process.env.STRIPE_PRICE_CLINICA = 'price_clinica_mensual'
  })
  afterEach(() => { process.env = { ...ENV_ORIGINAL } })

  it('con precio anual configurado, devuelve el ANUAL', async () => {
    process.env.STRIPE_PRICE_CLINICA_ANUAL = 'price_clinica_anual'
    const { priceIdDe } = await cargarStripe()
    expect(priceIdDe('clinica', 'anual')).toBe('price_clinica_anual')
  })

  it('SIN precio anual, NO cae al mensual: lanza', async () => {
    delete process.env.STRIPE_PRICE_CLINICA_ANUAL
    const { priceIdDe } = await cargarStripe()
    // Lo que hacía antes: devolver el mensual y dejar que se cobrara así.
    expect(() => priceIdDe('clinica', 'anual')).toThrow(/ANUAL/i)
  })

  it('el mensual sigue funcionando igual', async () => {
    delete process.env.STRIPE_PRICE_CLINICA_ANUAL
    const { priceIdDe } = await cargarStripe()
    expect(priceIdDe('clinica', 'mensual')).toBe('price_clinica_mensual')
  })
})
