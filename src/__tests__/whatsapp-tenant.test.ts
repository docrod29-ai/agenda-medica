import { describe, it, expect } from 'vitest'
import { permiteFallbackUnicoTenant } from '@/lib/whatsapp/tenant'

describe('WhatsApp aislamiento de tenant (Iter. 4 · TENANT_CONNECTIONS)', () => {
  // La garantía dura: en multi-tenant, un identificador desconocido NUNCA
  // cae a una clínica → cero acceso cruzado.
  it('con 2+ clínicas, un phoneNumberId desconocido NO cae a ninguna (sin fallback)', () => {
    expect(permiteFallbackUnicoTenant({ numClinicas: 2, phoneNumberId: 'desconocido' })).toBe(false)
    expect(permiteFallbackUnicoTenant({ numClinicas: 17, phoneNumberId: 'desconocido' })).toBe(false)
    expect(permiteFallbackUnicoTenant({
      numClinicas: 5, phoneNumberId: 'x', envPhoneId: 'x',
    })).toBe(false) // aunque el env coincida, con multi-tenant no hay catch-all
  })

  it('con 0 clínicas nunca resuelve tenant', () => {
    expect(permiteFallbackUnicoTenant({ numClinicas: 0, phoneNumberId: 'x' })).toBe(false)
  })

  it('instalación single-tenant: permite catch-all si el env no contradice', () => {
    // sin env configurado → todo el tráfico es de la única clínica
    expect(permiteFallbackUnicoTenant({ numClinicas: 1, phoneNumberId: 'cualquiera' })).toBe(true)
    // env configurado y coincide
    expect(permiteFallbackUnicoTenant({
      numClinicas: 1, phoneNumberId: '123', envPhoneId: '123',
    })).toBe(true)
  })

  it('single-tenant pero el env contradice al entrante → rechaza (número ajeno)', () => {
    expect(permiteFallbackUnicoTenant({
      numClinicas: 1, phoneNumberId: '999', envPhoneId: '123',
    })).toBe(false)
  })
})
