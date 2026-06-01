import { describe, it, expect } from 'vitest'
import { estaBloqueado, type TimeBlock } from '@/lib/time-blocks'
import { calcularRiesgoNoShow } from '@/lib/no-show-risk'
import type { Appointment, Patient } from '@/types'

describe('Time blocks', () => {
  const b: TimeBlock = {
    id: '1', desde: '2026-06-01T00:00:00.000Z', hasta: '2026-06-08T00:00:00.000Z',
    tipo: 'vacaciones', createdAt: '2026-05-01', creadoPor: 'test',
  }

  it('Una fecha dentro del bloque queda bloqueada', () => {
    const r = estaBloqueado('2026-06-03 10:00', [b])
    expect(r).not.toBeNull()
    expect(r?.tipo).toBe('vacaciones')
  })
  it('Una fecha antes del bloque no queda bloqueada', () => {
    expect(estaBloqueado('2026-05-30 10:00', [b])).toBeNull()
  })
  it('Una fecha después del bloque no queda bloqueada', () => {
    expect(estaBloqueado('2026-06-09 10:00', [b])).toBeNull()
  })
  it('Bloque específico de un médico no afecta a otro médico', () => {
    const bm: TimeBlock = { ...b, medicoId: 'med-A' }
    expect(estaBloqueado('2026-06-03 10:00', [bm], 'med-B')).toBeNull()
    expect(estaBloqueado('2026-06-03 10:00', [bm], 'med-A')).not.toBeNull()
  })
})

describe('No-show risk', () => {
  const baseAppt: Appointment = {
    id: '1', pacienteId: 'p1', pacienteNombre: 'Test', pacienteTelefono: '5551234567',
    fechaHora: '2026-06-10 10:00', duracion: 30, tipo: 'primera-vez',
    estado: 'confirmada', origen: 'Manual', medicoNombre: 'Dr.',
    confirmadoPaciente: false, recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true, createdAt: '2026-05-01T00:00:00Z', updatedAt: '', creadoPor: 'test', updatedPor: 'test',
  }
  const basePac: Patient = {
    id: 'p1', nombre: 'Test', telefono: '5551234567',
    noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: 'test',
  }

  it('Paciente sin historial + sin confirmar = riesgo medio', () => {
    const r = calcularRiesgoNoShow(baseAppt, basePac)
    expect(r.score).toBeGreaterThan(0)
    expect(['medio', 'alto']).toContain(r.nivel)  // depende del lead time
  })
  it('3 no-shows previos eleva a alto/muy alto', () => {
    const r = calcularRiesgoNoShow(baseAppt, { ...basePac, noShowCount: 3 })
    expect(['alto', 'muy_alto']).toContain(r.nivel)
    expect(r.razones.some(x => x.includes('3 no-shows'))).toBe(true)
  })
  it('Cita confirmada con recordatorio reduce el riesgo', () => {
    const r = calcularRiesgoNoShow(
      { ...baseAppt, confirmadoPaciente: true, recordatorio24hEnviado: true },
      basePac,
    )
    expect(r.score).toBeLessThan(25)
    expect(r.nivel).toBe('bajo')
  })
  it('Recomendación se ajusta al nivel', () => {
    const muyAlto = calcularRiesgoNoShow(baseAppt, { ...basePac, noShowCount: 5, cancelacionCount: 3 })
    expect(muyAlto.recomendacion).toMatch(/Doble confirmación|llamada/)
  })
})
