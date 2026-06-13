import { describe, it, expect } from 'vitest'
import { hoyISO, sumarDiasISO, instanteMX, yaPaso } from '@/lib/timezone'

describe('hoyISO', () => {
  it('devuelve formato YYYY-MM-DD', () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('es estable (misma llamada, mismo día)', () => {
    expect(hoyISO()).toBe(hoyISO())
  })
})

describe('sumarDiasISO', () => {
  it('suma días sin cruzar mal el mes', () => {
    expect(sumarDiasISO('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDiasISO('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('resta días', () => {
    expect(sumarDiasISO('2026-06-15', -7)).toBe('2026-06-08')
  })
  it('maneja año bisiesto (2028)', () => {
    expect(sumarDiasISO('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('cruce de año', () => {
    expect(sumarDiasISO('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('instanteMX', () => {
  it('ancla la hora de pared MX a UTC-6', () => {
    // 09:00 en MX (UTC-6) = 15:00 UTC
    const d = instanteMX('2026-06-15', '09:00')
    expect(d.toISOString()).toBe('2026-06-15T15:00:00.000Z')
  })
  it('una cita a medianoche MX no se corre de día en UTC', () => {
    // 00:00 MX = 06:00 UTC del MISMO día
    const d = instanteMX('2026-06-15', '00:00')
    expect(d.toISOString()).toBe('2026-06-15T06:00:00.000Z')
  })
})

describe('yaPaso', () => {
  it('fecha pasada → true', () => {
    expect(yaPaso('2020-01-01', '10:00')).toBe(true)
  })
  it('fecha futura lejana → false', () => {
    expect(yaPaso('2099-01-01', '10:00')).toBe(false)
  })
})
