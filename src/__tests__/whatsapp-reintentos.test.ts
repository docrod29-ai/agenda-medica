import { describe, it, expect } from 'vitest'
import {
  backoffMs, proximoIntentoISO, agotado, vencido, MAX_INTENTOS, BASE_MS, TOPE_MS,
} from '@/lib/whatsapp/reintentos'

const AHORA = Date.parse('2026-07-14T12:00:00Z')

describe('Backoff exponencial acotado (Iter. 10)', () => {
  it('crece exponencialmente desde la base', () => {
    expect(backoffMs(1)).toBe(BASE_MS)        // 5 min
    expect(backoffMs(2)).toBe(BASE_MS * 2)    // 10 min
    expect(backoffMs(3)).toBe(BASE_MS * 4)    // 20 min
  })
  it('se acota al tope', () => {
    expect(backoffMs(99)).toBe(TOPE_MS)
    expect(backoffMs(1)).toBeLessThanOrEqual(TOPE_MS)
  })
  it('valores no válidos se tratan como intento 1', () => {
    expect(backoffMs(0)).toBe(BASE_MS)
    expect(backoffMs(-5)).toBe(BASE_MS)
  })
})

describe('proximoIntentoISO', () => {
  it('suma el backoff al ahora', () => {
    expect(proximoIntentoISO(1, AHORA)).toBe(new Date(AHORA + BASE_MS).toISOString())
    expect(proximoIntentoISO(2, AHORA)).toBe(new Date(AHORA + BASE_MS * 2).toISOString())
  })
})

describe('agotado / vencido', () => {
  it('agotado al llegar al máximo', () => {
    expect(agotado(MAX_INTENTOS - 1)).toBe(false)
    expect(agotado(MAX_INTENTOS)).toBe(true)
  })
  it('vencido: sin fecha o fecha pasada → true; futura → false', () => {
    expect(vencido(undefined, AHORA)).toBe(true)
    expect(vencido('no-fecha', AHORA)).toBe(true)
    expect(vencido(new Date(AHORA - 1000).toISOString(), AHORA)).toBe(true)
    expect(vencido(new Date(AHORA + 60_000).toISOString(), AHORA)).toBe(false)
  })
})
