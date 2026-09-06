import { describe, it, expect } from 'vitest'
import { crearTokenPaciente, verificarTokenPaciente, linkPortalPaciente, tokenVigente } from '@/lib/patient-token'

describe('patient-token', () => {
  it('round-trip: crea y verifica un token válido', () => {
    const t = crearTokenPaciente('clinicA', 'pac123')
    const v = verificarTokenPaciente(t)
    // E0-06: el token declara ALCANCE; sin pedir nada, nace en 'agenda'.
    expect(v).toEqual({ clinicId: 'clinicA', patientId: 'pac123', alcance: 'agenda', version: 0, documentoId: null, cuidadorId: null })
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
    expect(verificarTokenPaciente(token)).toEqual({ clinicId: 'clinicA', patientId: 'pac123', alcance: 'agenda', version: 0, documentoId: null, cuidadorId: null })
  })
})

/**
 * GOLDEN — un enlace del portal que no se podía revocar.
 *
 * El magic-link va firmado y con fecha, y no había ninguna forma de invalidar
 * uno ya emitido: un teléfono perdido, un número reciclado o un mensaje
 * reenviado a un grupo valían hasta caducar, y la única salida era esperar. Con
 * 30 días de vida, esa espera era un mes.
 */
describe('revocación de enlaces', () => {
  it('un enlace emitido con la versión vigente sirve', () => {
    expect(tokenVigente(3, 3)).toBe(true)
  })

  it('subir la versión del paciente tumba los enlaces anteriores', () => {
    expect(tokenVigente(2, 3)).toBe(false)
    expect(tokenVigente(0, 1)).toBe(false)
  })

  it('los enlaces de antes de que esto existiera siguen valiendo hasta que se revoque', () => {
    // Token sin `v` → versión 0; paciente sin contador → 0.
    expect(tokenVigente(0, undefined)).toBe(true)
  })

  it('una versión MÁS ALTA que la del expediente no deja fuera al paciente', () => {
    // No puede ocurrir salvo por un error de escritura nuestro, y tratarlo como
    // inválido castigaría al paciente por un fallo que no es suyo.
    expect(tokenVigente(5, 3)).toBe(true)
  })

  it('el token viaja con la versión con la que se emitió', () => {
    const t = crearTokenPaciente('c1', 'p1', 1, 'agenda', 7)
    expect(verificarTokenPaciente(t)!.version).toBe(7)
  })
})
