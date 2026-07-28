import { describe, it, expect } from 'vitest'
import { crearTokenReceta, verificarTokenReceta, linkVerificacionReceta } from '@/lib/receta-token'

const base = { clinicId: 'clinicA', notaId: 'nota123', folio: 'R-0001', doctorNombre: 'Dr. Prueba', cedula: '1234567' }

describe('receta-token', () => {
  it('round-trip: crea y verifica un token válido', () => {
    const t = crearTokenReceta(base)
    const v = verificarTokenReceta(t)
    expect(v).not.toBeNull()
    expect(v!.clinicId).toBe('clinicA')
    expect(v!.notaId).toBe('nota123')
    expect(v!.folio).toBe('R-0001')
    expect(v!.doctorNombre).toBe('Dr. Prueba')
    expect(v!.cedula).toBe('1234567')
    expect(v!.emitido).toBeInstanceOf(Date)
    expect(v!.expira.getTime()).toBeGreaterThan(v!.emitido.getTime())
  })

  it('NO contiene datos del paciente en el payload (solo ids + info del prescriptor)', () => {
    const t = crearTokenReceta(base)
    const [payloadB64] = t.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    // Solo llaves esperadas; ninguna de paciente (nombre, dx, medicamento, curp, tel)
    expect(Object.keys(payload).sort()).toEqual(['c', 'dc', 'dn', 'e', 'f', 'i', 'n', 'v'])
  })

  it('rechaza token manipulado (firma inválida)', () => {
    const t = crearTokenReceta(base)
    const [payload] = t.split('.')
    expect(verificarTokenReceta(`${payload}.firmafalsa`)).toBeNull()
  })

  it('rechaza payload alterado (otra cédula) conservando firma', () => {
    const t = crearTokenReceta(base)
    const [, firma] = t.split('.')
    const alterado = Buffer.from(JSON.stringify({ v: 1, c: 'clinicA', n: 'nota123', f: 'R-0001', dn: 'Dr. Prueba', dc: 'CEDULA-FALSA', i: 1, e: 9999999999 })).toString('base64url')
    expect(verificarTokenReceta(`${alterado}.${firma}`)).toBeNull()
  })

  it('rechaza token expirado', () => {
    const t = crearTokenReceta({ ...base, ttlDias: -1 })
    expect(verificarTokenReceta(t)).toBeNull()
  })

  it('rechaza entradas basura', () => {
    expect(verificarTokenReceta(undefined)).toBeNull()
    expect(verificarTokenReceta(null)).toBeNull()
    expect(verificarTokenReceta('')).toBeNull()
    expect(verificarTokenReceta('sinpunto')).toBeNull()
    expect(verificarTokenReceta('a.b.c')).toBeNull()
  })

  it('dominio separado: un token de paciente NO verifica como receta', () => {
    // firma de receta usa prefijo "receta:"; un payload sin ese dominio no debe pasar
    const t = crearTokenReceta(base)
    const [payloadB64] = t.split('.')
    // firma SIN el prefijo de dominio → inválida
    const { createHmac } = require('node:crypto') as typeof import('node:crypto')
    const secret = process.env.PORTAL_PACIENTE_SECRET || 'dev-portal-secret-no-usar-en-produccion-0123456789'
    const firmaSinDominio = createHmac('sha256', secret).update(payloadB64).digest('base64url')
    expect(verificarTokenReceta(`${payloadB64}.${firmaSinDominio}`)).toBeNull()
  })

  it('linkVerificacionReceta arma una URL /verificar/<token> válida', () => {
    const url = linkVerificacionReceta('https://app.example.com/', base)
    expect(url.startsWith('https://app.example.com/verificar/')).toBe(true)
    const token = url.split('/verificar/')[1]
    expect(verificarTokenReceta(token)!.folio).toBe('R-0001')
  })

  // Auditoría papelería 2026-07 (#19): huella del contenido ligada al QR.
  it('embebe la huella del contenido y la devuelve al verificar', () => {
    const t = crearTokenReceta({ ...base, contenidoHash: 'deadbeef' })
    const v = verificarTokenReceta(t)
    expect(v).not.toBeNull()
    expect(v!.contenidoHash).toBe('deadbeef')
  })

  it('sin contenidoHash el token sigue siendo válido (recetas viejas/sin meds)', () => {
    const v = verificarTokenReceta(crearTokenReceta(base))
    expect(v).not.toBeNull()
    expect(v!.contenidoHash).toBeUndefined()
  })

  // E0-01: huella de los medicamentos de la NOTA (la calcula el servidor).
  it('embebe la huella de la nota (hn) y la devuelve al verificar', () => {
    const v = verificarTokenReceta(crearTokenReceta({ ...base, huellaNota: '0badcafe' }))
    expect(v!.huellaNota).toBe('0badcafe')
    expect(v!.firmaVersion).toBe(2)
  })

  it('sin huella de nota el token sigue siendo válido (notas sin medicamentos)', () => {
    expect(verificarTokenReceta(crearTokenReceta(base))!.huellaNota).toBeUndefined()
  })

  /**
   * RETRO-COMPATIBILIDAD: hay tokens v=1 impresos en recetas con TTL de 2 años.
   * Subir FIRMA_VERSION es solo de EMISIÓN; verificar no debe filtrar por versión
   * o esos QRs dirían "No verificable" de un día para otro.
   */
  it('un token LEGADO v=1 (payload armado a mano) sigue verificando', () => {
    const { createHmac } = require('node:crypto') as typeof import('node:crypto')
    const secret = process.env.PORTAL_PACIENTE_SECRET || 'dev-portal-secret-no-usar-en-produccion-0123456789'
    const ahora = Math.floor(Date.now() / 1000)
    const payload = { v: 1, c: 'clinicA', n: 'nota123', f: 'R-0001', dn: 'Dr. Prueba', dc: '1234567', i: ahora, e: ahora + 86400 }
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const firma = createHmac('sha256', secret).update('receta:' + payloadB64).digest('base64url')
    const v = verificarTokenReceta(`${payloadB64}.${firma}`)
    expect(v).not.toBeNull()
    expect(v!.firmaVersion).toBe(1)
    expect(v!.cedula).toBe('1234567')
    expect(v!.huellaNota).toBeUndefined()
  })

  it('alterar la huella del contenido invalida la firma', () => {
    const t = crearTokenReceta({ ...base, contenidoHash: 'aaaa1111' })
    const [payloadB64, firma] = t.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    payload.h = 'bbbb2222' // manipular el contenido
    const payloadAlterado = Buffer.from(JSON.stringify(payload)).toString('base64url')
    // Con la firma vieja sobre el payload nuevo → inválido (no tiene el secreto).
    expect(verificarTokenReceta(`${payloadAlterado}.${firma}`)).toBeNull()
  })
})
