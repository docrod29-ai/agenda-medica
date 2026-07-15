import { describe, it, expect } from 'vitest'
import { esWamidValido, claveDedup, telefonoRedactado } from '@/lib/whatsapp/dedup'

describe('WhatsApp dedup (Iter. 3)', () => {
  it('valida el wamid', () => {
    expect(esWamidValido('wamid.HBgMNTIx')).toBe(true)
    expect(esWamidValido('')).toBe(false)
    expect(esWamidValido(undefined)).toBe(false)
    expect(esWamidValido(123)).toBe(false)
    expect(esWamidValido('x'.repeat(300))).toBe(false)
  })

  it('claveDedup produce un id de documento Firestore seguro (sin / # ? [ ] *)', () => {
    expect(claveDedup('wamid.a/b#c?d[e]*f')).not.toMatch(/[/#?[\]*]/)
    expect(claveDedup('wamid.HBgMNTIx')).toBe('wamid.HBgMNTIx') // ids normales quedan igual
  })

  it('claveDedup es determinista (misma entrada → misma clave)', () => {
    expect(claveDedup('wamid.zzz')).toBe(claveDedup('wamid.zzz'))
  })

  it('telefonoRedactado deja solo los últimos 4 dígitos (sin PII en logs)', () => {
    expect(telefonoRedactado('5215512345678')).toBe('••••5678')
    expect(telefonoRedactado('12')).toBe('••••')
  })
})
