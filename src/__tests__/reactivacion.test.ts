import { describe, it, expect } from 'vitest'
import { diasEntre, pacientesParaReactivar, msgReactivacion, msgReferido } from '@/lib/reactivacion'
import type { Patient } from '@/types'

const px = (o: Partial<Patient>): Patient => ({
  id: o.id ?? 'x', nombre: o.nombre ?? 'N', telefono: o.telefono ?? '5551234567',
  noShowCount: 0, cancelacionCount: 0, createdAt: '2026-01-01', updatedAt: '', creadoPor: '', ...o,
})

describe('diasEntre', () => {
  it('cuenta días entre fechas', () => {
    expect(diasEntre('2026-07-01', '2026-07-13')).toBe(12)
    expect(diasEntre('2026-01-01', '2026-01-01')).toBe(0)
  })
})

describe('pacientesParaReactivar', () => {
  const hoy = '2026-07-13'
  it('incluye última cita más vieja que el umbral, excluye recientes', () => {
    const ps = [
      px({ id: 'a', nombre: 'Viejo', ultimaCita: '2026-01-01' }),   // ~193 días → sí
      px({ id: 'b', nombre: 'Reciente', ultimaCita: '2026-07-01' }), // 12 días → no
    ]
    const r = pacientesParaReactivar(ps, hoy, 90)
    expect(r.map(c => c.paciente.id)).toEqual(['a'])
    expect(r[0].tuvoCita).toBe(true)
  })
  it('incluye alta vieja sin ninguna cita, marca tuvoCita=false', () => {
    const r = pacientesParaReactivar([px({ id: 'c', ultimaCita: undefined, createdAt: '2026-01-01' })], hoy, 90)
    expect(r).toHaveLength(1)
    expect(r[0].tuvoCita).toBe(false)
  })
  it('excluye a quien no tiene teléfono', () => {
    const r = pacientesParaReactivar([px({ telefono: '', whatsapp: '', ultimaCita: '2025-01-01' })], hoy, 90)
    expect(r).toHaveLength(0)
  })
  it('ordena por más tiempo sin volver', () => {
    const ps = [
      px({ id: 'menos', ultimaCita: '2026-03-01' }),
      px({ id: 'mas', ultimaCita: '2025-06-01' }),
    ]
    expect(pacientesParaReactivar(ps, hoy, 90).map(c => c.paciente.id)).toEqual(['mas', 'menos'])
  })
})

describe('mensajes', () => {
  it('reactivación usa primer nombre y firma opcional', () => {
    const m = msgReactivacion('María López', 'Dr. Pérez')
    expect(m).toContain('Hola María')
    expect(m).toContain('— Dr. Pérez')
  })
  it('referido incluye el enlace de reserva', () => {
    expect(msgReferido('Dr. Pérez', 'https://x.mx/reservar/abc')).toContain('https://x.mx/reservar/abc')
  })
})
