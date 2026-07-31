import { describe, it, expect } from 'vitest'
import { parsearNumeroEs } from '@/lib/voz/comandos-uci'
import { extraerValoresUCIConAvisos } from '@/lib/uci/extraccion'

// Auditoría P1: números dictados ≥100 en palabras se perdían en silencio.
describe('parsearNumeroEs — centenas (0–999)', () => {
  it('cien / ciento', () => {
    expect(parsearNumeroEs('cien')).toBe('100')
    expect(parsearNumeroEs('ciento veinte')).toBe('120')
  })
  it('doscientos … novecientos', () => {
    expect(parsearNumeroEs('doscientos cincuenta')).toBe('250')
    expect(parsearNumeroEs('trescientos sesenta y cinco')).toBe('365')
    expect(parsearNumeroEs('quinientos')).toBe('500')
    expect(parsearNumeroEs('novecientos noventa y nueve')).toBe('999')
  })
  it('sigue parseando 0–99 y decimales', () => {
    expect(parsearNumeroEs('cuarenta y cinco')).toBe('45')
    expect(parsearNumeroEs('cero punto cuatro')).toBe('0.4')
    expect(parsearNumeroEs('siete')).toBe('7')
  })
  it('no inventa: palabra desconocida → null', () => {
    expect(parsearNumeroEs('tropecientos')).toBe(null)
  })
})

describe('extracción UCI captura valores ≥100 dictados', () => {
  it('glucosa "ciento ochenta" → 180', () => {
    const { valores } = extraerValoresUCIConAvisos('glucosa ciento ochenta')
    expect(valores.glucosa).toBe('180')
  })
})
