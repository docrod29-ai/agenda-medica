import { describe, it, expect } from 'vitest'
import { redactarString, sanitize, safeStringify } from '@/lib/security/sanitize'

describe('redactarString', () => {
  it('redacta CURP', () => {
    expect(redactarString('CURP RODR890515HCHMRV01 confirmado')).toContain('[CURP]')
    expect(redactarString('CURP RODR890515HCHMRV01 confirmado')).not.toContain('RODR890515HCHMRV01')
  })
  it('redacta email', () => {
    const r = redactarString('contacto: docrod29@gmail.com')
    expect(r).toContain('[EMAIL]')
    expect(r).not.toContain('docrod29@gmail.com')
  })
  it('redacta JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const r = redactarString(`token=${jwt}`)
    expect(r).toContain('[JWT]')
    expect(r).not.toContain(jwt)
  })
  it('redacta Bearer token', () => {
    const r = redactarString('Authorization: Bearer sk-ant-api03-abcdefghijklmnop1234')
    expect(r).toContain('[TOKEN]')
  })
  it('redacta número de tarjeta', () => {
    const r = redactarString('PAN 4111-1111-1111-1111 procesando')
    expect(r).toContain('[PAN]')
    expect(r).not.toContain('4111')
  })
  it('no toca strings sin PII', () => {
    const limpio = 'paciente con HTA y diabetes'
    expect(redactarString(limpio)).toBe(limpio)
  })
})

describe('sanitize objetos', () => {
  it('redacta llaves sensibles por nombre', () => {
    const r = sanitize({ user: 'david', password: 'super-secreto-123' })
    expect(r).toEqual({ user: 'david', password: '[REDACTED]' })
  })
  it('redacta token, apiKey, authorization', () => {
    const r = sanitize({
      token: 'abc123',
      apiKey: 'sk-foo',
      authorization: 'Bearer xyz',
    })
    expect((r as Record<string, string>).token).toBe('[REDACTED]')
    expect((r as Record<string, string>).apiKey).toBe('[REDACTED]')
    expect((r as Record<string, string>).authorization).toBe('[REDACTED]')
  })
  it('redacta datos clínicos sensibles (transcripcion)', () => {
    const r = sanitize({ tipo: 'consulta', transcripcion: 'paciente refiere dolor' })
    expect((r as Record<string, string>).transcripcion).toBe('[REDACTED]')
    expect((r as Record<string, string>).tipo).toBe('consulta')
  })
  it('redacta recursivamente en objetos anidados', () => {
    const r = sanitize({
      meta: { userId: 'u123', email: 'test@x.com' },
    })
    const meta = (r as Record<string, Record<string, string>>).meta
    expect(meta.email).toBe('[EMAIL]')
    expect(meta.userId).toBe('u123')
  })
  it('redacta arrays preservando longitud', () => {
    const r = sanitize(['a@b.com', 'normal', 'c@d.com'])
    expect(r).toEqual(['[EMAIL]', 'normal', '[EMAIL]'])
  })
  it('convierte Error en objeto plano sanitizado', () => {
    const err = new Error('Falla con email leak@x.com')
    const r = sanitize(err) as { name: string; message: string }
    expect(r.name).toBe('Error')
    expect(r.message).toContain('[EMAIL]')
    expect(r.message).not.toContain('leak@x.com')
  })
  it('limita profundidad para evitar stack overflow', () => {
    type Nodo = { hijo?: Nodo }
    const profundo: Nodo = {}
    let nodo: Nodo = profundo
    for (let i = 0; i < 20; i++) { nodo.hijo = {}; nodo = nodo.hijo }
    const r = sanitize(profundo)
    expect(JSON.stringify(r)).toContain('max-depth')
  })
  it('respeta primitivos', () => {
    expect(sanitize(42)).toBe(42)
    expect(sanitize(true)).toBe(true)
    expect(sanitize(null)).toBe(null)
  })
})

describe('safeStringify', () => {
  it('serializa con redacción', () => {
    const s = safeStringify({ email: 'x@y.com', password: 'abc', tipo: 'A' })
    expect(s).toContain('[EMAIL]')
    expect(s).toContain('[REDACTED]')
    expect(s).toContain('"tipo":"A"')
  })
  it('maneja ciclos sin reventar', () => {
    type Ciclo = { name: string; self?: Ciclo }
    const obj: Ciclo = { name: 'x' }
    obj.self = obj
    const s = safeStringify(obj)
    // No revienta — devuelve "[unserializable]" porque JSON.stringify
    // detecta el ciclo (la profundidad max ya lo cortaría también)
    expect(typeof s).toBe('string')
  })
})
