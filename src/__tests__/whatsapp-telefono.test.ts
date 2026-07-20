import { describe, it, expect } from 'vitest'
import { normalizarTelefonoWa } from '@/lib/whatsapp/consent'

describe('la baja de WhatsApp y el envío usan la misma clave de teléfono', () => {
  it('el número como lo manda WhatsApp (con el 1 de móvil) y como lo captura recepción convergen', () => {
    const comoLoMandaWa = normalizarTelefonoWa('5215551234567')   // 13 díg, con el 1
    const comoLoCaptura  = normalizarTelefonoWa('5551234567')      // 10 díg
    const conEspacios    = normalizarTelefonoWa('52 555 123 4567') // 12 díg formateado
    expect(comoLoMandaWa).toBe('525551234567')
    expect(comoLoCaptura).toBe(comoLoMandaWa)
    expect(conEspacios).toBe(comoLoMandaWa)
  })

  it('no toca un número que ya está en forma canónica', () => {
    expect(normalizarTelefonoWa('525551234567')).toBe('525551234567')
  })

  it('no confunde un 1 legítimo que NO es el prefijo de móvil', () => {
    // 52 + 10 dígitos que empiezan por 1 (no hay 13º dígito): se respeta.
    expect(normalizarTelefonoWa('521234567890')).toBe('521234567890')
  })
})
