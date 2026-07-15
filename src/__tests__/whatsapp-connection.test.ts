import { describe, it, expect } from 'vitest'
import { puedeOperar, transicionValida, conexionSinSecreto, ESTADO_LABEL, type WhatsAppTenantConnection } from '@/lib/whatsapp/connection'

const base: WhatsAppTenantConnection = {
  id: 'c1', tenantId: 't1', provider: 'meta_cloud_api', status: 'connected',
  tokenReference: 'secret://kms/abc',
}

describe('WhatsApp connection (Iter. 2)', () => {
  it('SOLO una conexión connected puede operar', () => {
    expect(puedeOperar({ status: 'connected' })).toBe(true)
    for (const s of ['pending', 'verification_required', 'restricted', 'disconnected'] as const) {
      expect(puedeOperar({ status: s })).toBe(false)
    }
    expect(puedeOperar(null)).toBe(false)
  })

  it('valida transiciones de estado (sin saltos inválidos)', () => {
    expect(transicionValida('pending', 'connected')).toBe(true)
    expect(transicionValida('connected', 'disconnected')).toBe(true)
    expect(transicionValida('disconnected', 'connected')).toBe(true) // reconectar
    expect(transicionValida('restricted', 'pending')).toBe(false)    // inválido
    expect(transicionValida('verification_required', 'restricted')).toBe(false)
  })

  it('cada estado tiene etiqueta legible', () => {
    for (const s of ['pending', 'connected', 'verification_required', 'restricted', 'disconnected'] as const) {
      expect(ESTADO_LABEL[s]).toBeTruthy()
    }
  })

  it('nunca expone el token: conexionSinSecreto quita tokenReference', () => {
    const limpio = conexionSinSecreto(base)
    expect('tokenReference' in limpio).toBe(false)
    expect(limpio.tenantId).toBe('t1')
  })
})
