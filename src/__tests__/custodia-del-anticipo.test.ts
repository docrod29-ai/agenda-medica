/**
 * A DÓNDE VA EL DINERO DEL PACIENTE — la decisión pura de N-002 / N-003.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * El anticipo del paciente se cobraba en la cuenta de Stripe de la plataforma
 * (N-002, P0) mientras la pantalla le decía al médico que cobraría por SU liga
 * (N-003, P1). No había ninguna función que dijera por qué vía se cobra.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09, auditor N-negocio; equipo rojo: grep de
 * `transfer_data|on_behalf_of|stripeAccount` en src → cero resultados.
 *
 * ── REGLA (PL-D1 por omisión) ────────────────────────────────────────────────
 * connect (cuenta conectada) > liga-propia (config.anticipoLink) > en-consultorio.
 * La plataforma nunca retiene el dinero. La ruta de Checkout y el portal
 * consumen la MISMA decisión.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * El texto de la pantalla de configuración y la respuesta de /api/portal
 * (archivos de UI-CONFIG y PORTAL; ver handoff-DINERO). Que Stripe acepte la
 * cuenta conectada.
 */
import { describe, it, expect } from 'vitest'
import { custodiaDelAnticipo, esCuentaConectada, esLigaDePago, TEXTO_DE_LA_VIA } from '@/lib/finanzas/custodia-del-anticipo'

describe('custodiaDelAnticipo', () => {
  it('con cuenta conectada → connect, y se devuelve la cuenta', () => {
    const c = custodiaDelAnticipo({ stripeAccountId: 'acct_1Sintetico', anticipoLink: 'https://mpago.la/x', anticipoMonto: 200 })
    expect(c.via).toBe('connect')
    expect(c.stripeAccountId).toBe('acct_1Sintetico')
    expect(c.monto).toBe(200)
  })

  it('sin cuenta pero con liga https → liga-propia, y se devuelve la liga', () => {
    const c = custodiaDelAnticipo({ anticipoLink: ' https://buy.stripe.test/liga ', anticipoMonto: '150' })
    expect(c.via).toBe('liga-propia')
    expect(c.anticipoLink).toBe('https://buy.stripe.test/liga')
    expect(c.monto).toBe(150)
    expect(c.stripeAccountId).toBeUndefined()
  })

  it('sin cuenta ni liga → en el consultorio, monto 0 si no hay', () => {
    const c = custodiaDelAnticipo({})
    expect(c.via).toBe('en-consultorio')
    expect(c.monto).toBe(0)
  })

  it('una liga que no es https NO se le enseña al paciente', () => {
    expect(custodiaDelAnticipo({ anticipoLink: 'http://inseguro.test/x' }).via).toBe('en-consultorio')
    expect(custodiaDelAnticipo({ anticipoLink: 'javascript:alert(1)' }).via).toBe('en-consultorio')
    expect(custodiaDelAnticipo({ anticipoLink: 'mpago.la/x' }).via).toBe('en-consultorio')
  })

  it('una «cuenta» que no tiene forma de acct_ no cuenta como Connect (probado al revés)', () => {
    expect(esCuentaConectada('acct_abc123')).toBe(true)
    expect(esCuentaConectada('cus_abc123')).toBe(false)
    expect(esCuentaConectada('')).toBe(false)
    expect(esCuentaConectada('acct_')).toBe(false)
    expect(esCuentaConectada(42)).toBe(false)
    expect(custodiaDelAnticipo({ stripeAccountId: 'cus_no_es_cuenta_conectada' }).via).toBe('en-consultorio')
  })

  it('esLigaDePago acepta sólo https bien formado', () => {
    expect(esLigaDePago('https://mpago.la/abc')).toBe(true)
    expect(esLigaDePago('https://')).toBe(false)
    expect(esLigaDePago(null)).toBe(false)
  })

  it('cada vía tiene su frase para el paciente, en español de persona', () => {
    for (const via of ['connect', 'liga-propia', 'en-consultorio'] as const) {
      expect(TEXTO_DE_LA_VIA[via].length).toBeGreaterThan(10)
    }
    expect(TEXTO_DE_LA_VIA['en-consultorio']).toMatch(/consultorio/)
  })

  it('un monto no numérico o negativo se reporta como 0, no como NaN', () => {
    expect(custodiaDelAnticipo({ anticipoMonto: 'abc' }).monto).toBe(0)
    expect(custodiaDelAnticipo({ anticipoMonto: -5 }).monto).toBe(0)
  })
})
