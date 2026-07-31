/**
 * NEXUS-QUALITY-010 — token firmado con caducidad para el proxy del formato de
 * receta. La firma liga path+exp con HMAC; inválida o vencida se rechaza SIEMPRE;
 * sin firma es 'sin_firma' (el proxy decide por RECETA_DISENO_FIRMA).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { firmarPathDiseno, verificarPathDiseno, DISENO_TOKEN_TTL_S } from '@/lib/receta-diseno-token'

const PATH = 'receta-diseno/uid123/membrete.png'
const T0 = 1_800_000_000_000 // epoch ms fijo (determinista)

let prevSecret: string | undefined
beforeEach(() => { prevSecret = process.env.RECETA_DISENO_SECRET; process.env.RECETA_DISENO_SECRET = 'secreto-de-prueba' })
afterEach(() => { if (prevSecret === undefined) delete process.env.RECETA_DISENO_SECRET; else process.env.RECETA_DISENO_SECRET = prevSecret })

describe('firmar + verificar', () => {
  it('una URL firmada verifica como válida dentro de su vida', () => {
    const t = firmarPathDiseno(PATH, T0)!
    expect(t.exp).toBe(Math.floor(T0 / 1000) + DISENO_TOKEN_TTL_S)
    expect(verificarPathDiseno(PATH, String(t.exp), t.sig, T0 + 60_000)).toBe('valida')
  })
  it('vencida → vencida (no válida)', () => {
    const t = firmarPathDiseno(PATH, T0)!
    expect(verificarPathDiseno(PATH, String(t.exp), t.sig, T0 + (DISENO_TOKEN_TTL_S + 10) * 1000)).toBe('vencida')
  })
  it('firma de OTRO path no sirve (no se puede reusar el token en otra imagen)', () => {
    const t = firmarPathDiseno(PATH, T0)!
    expect(verificarPathDiseno('receta-diseno/uid123/firma.png', String(t.exp), t.sig, T0)).toBe('invalida')
  })
  it('manipular el exp invalida la firma (no se puede extender la vida)', () => {
    const t = firmarPathDiseno(PATH, T0)!
    expect(verificarPathDiseno(PATH, String(t.exp + 9999), t.sig, T0)).toBe('invalida')
  })
  it('sig basura / no-hex → invalida, nunca lanza', () => {
    const t = firmarPathDiseno(PATH, T0)!
    expect(verificarPathDiseno(PATH, String(t.exp), 'zzzz', T0)).toBe('invalida')
    expect(verificarPathDiseno(PATH, 'NaN', t.sig, T0)).toBe('invalida')
  })
  it('sin exp ni sig → sin_firma (compatibilidad decidida por el proxy)', () => {
    expect(verificarPathDiseno(PATH, null, null, T0)).toBe('sin_firma')
  })
  it('sin secreto configurado: firmar devuelve null y verificar reporta sin_secreto', () => {
    delete process.env.RECETA_DISENO_SECRET
    const prevPortal = process.env.PORTAL_PACIENTE_SECRET
    delete process.env.PORTAL_PACIENTE_SECRET
    expect(firmarPathDiseno(PATH, T0)).toBeNull()
    expect(verificarPathDiseno(PATH, '123', 'abc', T0)).toBe('sin_secreto')
    if (prevPortal !== undefined) process.env.PORTAL_PACIENTE_SECRET = prevPortal
  })
})
