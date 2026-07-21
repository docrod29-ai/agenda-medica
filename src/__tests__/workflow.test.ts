import { describe, it, expect } from 'vitest'
import { accionesPendientes, resumenAcciones } from '@/lib/workflow'
import type { Appointment } from '@/types'
import type { Membresia } from '@/lib/membresias'

const cita = (o: Partial<Appointment>): Appointment => ({
  id: 'c', pacienteId: 'p', pacienteNombre: 'Ana', pacienteTelefono: '', fechaHora: '2026-07-30 10:00',
  duracion: 30, tipo: 'seguimiento', estado: 'atendida', origen: 'manual', medicoNombre: 'Dr',
  confirmadoPaciente: false, createdAt: '', updatedAt: '', ...o,
} as Appointment)

const memb = (o: Partial<Membresia>): Membresia => ({
  pacienteId: 'p', pacienteNombre: 'Beto', planId: 'x', planNombre: 'Plan', precio: 500,
  periodicidad: 'mensual', inicio: '2026-06-01', proximoCobro: '2026-07-01', estado: 'activa', creadoPor: 'u', ...o,
} as Membresia)

describe('Workflow Orchestrator', () => {
  it('junta cobros pendientes, membresías vencidas y citas por confirmar, priorizadas', () => {
    const acc = accionesPendientes({
      hoy: '2026-07-30',
      citas: [
        cita({ id: 'a', estado: 'atendida' }),                          // cobrar (alta)
        cita({ id: 'b', estado: 'atendida', cobroId: 'x' }),            // ya cobrada → nada
        cita({ id: 'c', estado: 'pendiente-confirmar', pacienteNombre: 'Cira' }), // confirmar (media)
        cita({ id: 'd', estado: 'atendida', cobroExento: true }),       // cortesía → nada
      ],
      cobros: [],
      membresias: [memb({ proximoCobro: '2026-07-01' })],              // vencida (alta)
    })
    const tipos = acc.map(a => a.tipo)
    expect(tipos).toContain('cobrar')
    expect(tipos).toContain('membresia_vencida')
    expect(tipos).toContain('confirmar_cita')
    // Las de prioridad alta van primero
    expect(acc[0].prioridad).toBe('alta')
    expect(resumenAcciones(acc).alta).toBe(2)  // cobrar + membresía
  })

  it('caso limpio no inventa acciones', () => {
    const acc = accionesPendientes({ hoy: '2026-07-30', citas: [cita({ estado: 'atendida', cobroId: 'x' })], cobros: [], membresias: [] })
    expect(acc).toHaveLength(0)
  })
})
