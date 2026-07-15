import { describe, it, expect } from 'vitest'
import { parsearStatuses, esOptoutDeMeta, esFalloPermanente } from '@/lib/whatsapp/status'

describe('Parseo de estados de entrega (Iter. 6)', () => {
  it('extrae los campos de un status de Meta/360dialog', () => {
    const value = {
      statuses: [
        { id: 'wamid.A', status: 'delivered', recipient_id: '5215512345678', timestamp: '1700000000' },
        { id: 'wamid.B', status: 'read', recipient_id: '5215512345678', timestamp: '1700000100' },
      ],
    }
    const out = parsearStatuses(value)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ wamid: 'wamid.A', estado: 'delivered', telefono: '5215512345678' })
    expect(out[1].estado).toBe('read')
  })

  it('captura el error de un status failed', () => {
    const value = {
      statuses: [{ id: 'wamid.C', status: 'failed', recipient_id: '52155', errors: [{ code: 131050, title: 'Re-engagement' }] }],
    }
    const [s] = parsearStatuses(value)
    expect(s.estado).toBe('failed')
    expect(s.errorCode).toBe(131050)
    expect(s.errorTitulo).toBe('Re-engagement')
  })

  it('ignora entradas sin wamid y payloads sin statuses', () => {
    expect(parsearStatuses({ statuses: [{ status: 'sent' }] })).toEqual([])
    expect(parsearStatuses({})).toEqual([])
    expect(parsearStatuses(null)).toEqual([])
    expect(parsearStatuses(undefined)).toEqual([])
  })
})

describe('Clasificación de errores (Iter. 6)', () => {
  it('131050 es opt-out de Meta y fallo permanente', () => {
    expect(esOptoutDeMeta(131050)).toBe(true)
    expect(esFalloPermanente(131050)).toBe(true)
  })
  it('131026 (no entregable) es permanente pero no opt-out', () => {
    expect(esFalloPermanente(131026)).toBe(true)
    expect(esOptoutDeMeta(131026)).toBe(false)
  })
  it('un código transitorio/desconocido no es permanente ni opt-out', () => {
    expect(esFalloPermanente(131047)).toBe(false) // solo requiere plantilla, no permanente
    expect(esFalloPermanente(undefined)).toBe(false)
    expect(esOptoutDeMeta(undefined)).toBe(false)
  })
})
