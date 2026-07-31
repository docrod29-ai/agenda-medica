import { describe, it, expect } from 'vitest'
import { crearTokenPaciente, verificarTokenPaciente, linkPortalPaciente } from '@/lib/patient-token'

describe('patient-token', () => {
  it('round-trip: crea y verifica un token válido', () => {
    const t = crearTokenPaciente('clinicA', 'pac123')
    const v = verificarTokenPaciente(t)
    // E0-06: el token declara ALCANCE; sin pedir nada, nace en 'agenda'.
    expect(v).toEqual({ clinicId: 'clinicA', patientId: 'pac123', alcance: 'agenda' })
  })

  it('rechaza token manipulado (firma inválida)', () => {
    const t = crearTokenPaciente('clinicA', 'pac123')
    const [payload] = t.split('.')
    expect(verificarTokenPaciente(`${payload}.firmafalsa`)).toBeNull()
  })

  it('rechaza payload alterado (otro paciente)', () => {
    const t = crearTokenPaciente('clinicA', 'pac123')
    const [, firma] = t.split('.')
    const otroPayload = Buffer.from(JSON.stringify({ c: 'clinicA', p: 'INTRUSO', e: 9999999999 })).toString('base64url')
    expect(verificarTokenPaciente(`${otroPayload}.${firma}`)).toBeNull()
  })

  it('rechaza token expirado', () => {
    const t = crearTokenPaciente('clinicA', 'pac123', -1) // ya vencido
    expect(verificarTokenPaciente(t)).toBeNull()
  })

  it('rechaza entradas basura', () => {
    expect(verificarTokenPaciente(undefined)).toBeNull()
    expect(verificarTokenPaciente('')).toBeNull()
    expect(verificarTokenPaciente('sinpunto')).toBeNull()
    expect(verificarTokenPaciente('a.b.c')).toBeNull()
  })

  it('linkPortalPaciente arma una URL /mi/<token> válida', () => {
    const url = linkPortalPaciente('https://app.example.com/', 'clinicA', 'pac123')
    expect(url.startsWith('https://app.example.com/mi/')).toBe(true)
    const token = url.split('/mi/')[1]
    expect(verificarTokenPaciente(token)).toEqual({ clinicId: 'clinicA', patientId: 'pac123', alcance: 'agenda' })
  })
})
