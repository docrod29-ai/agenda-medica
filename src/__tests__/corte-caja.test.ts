import { describe, it, expect } from 'vitest'
import { corteDeCaja, embudoCobro, cuentasPorCobrar } from '@/lib/corte-caja'
import type { Cobro } from '@/lib/cobros'
import type { Appointment } from '@/types'

const cobro = (o: Partial<Cobro>): Cobro => ({
  fecha: '', dia: '2026-07-13', mes: '2026-07', monto: 0, metodo: 'efectivo',
  concepto: 'consulta', createdAt: '', creadoPor: '', ...o,
})
const cita = (o: Partial<Appointment>): Appointment => ({
  id: 'c', pacienteId: 'p', pacienteNombre: 'Paciente', pacienteTelefono: '',
  fechaHora: '2026-07-13 10:00', duracion: 30, tipo: 'primera-vez', estado: 'atendida',
  origen: 'manual' as Appointment['origen'], medicoNombre: 'Dr', confirmadoPaciente: false,
  recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false, consentimientoMensajes: false,
  ...o,
} as Appointment)

describe('corteDeCaja', () => {
  it('suma ingresos, resta reembolsos, aísla efectivo y agrupa por método', () => {
    const r = corteDeCaja([
      cobro({ monto: 800, metodo: 'efectivo' }),
      cobro({ monto: 500, metodo: 'tarjeta_credito' }),
      cobro({ monto: -200, metodo: 'efectivo' }),   // reembolso
      cobro({ monto: 999, metodo: 'efectivo', cancelado: true }), // ignorado
    ])
    expect(r.ingresos).toBe(1300)
    expect(r.reembolsos).toBe(-200)
    expect(r.neto).toBe(1100)
    expect(r.efectivo).toBe(600)   // 800 - 200
    expect(r.nCobros).toBe(3)
    expect(r.porMetodo[0].metodo).toBe('efectivo')
    expect(r.porMetodo.find(m => m.metodo === 'tarjeta_credito')?.monto).toBe(500)
  })
})

describe('embudoCobro', () => {
  it('calcula agendadas/atendidas/cobradas y tasas', () => {
    const citas = [
      cita({ id: 'a', estado: 'atendida' }),
      cita({ id: 'b', estado: 'finalizada' }),
      cita({ id: 'c', estado: 'confirmada' }),   // agendada, no atendida
      cita({ id: 'd', estado: 'cancelada' }),    // no cuenta
      cita({ id: 'e', estado: 'no-asistio' }),   // no-show
    ]
    const cobros = [cobro({ monto: 500, citaId: 'a' })]
    const r = embudoCobro(citas, cobros)
    // agendables = a, b, c, e (excluye 'cancelada'); no-asistió sí se agendó
    expect(r.agendadas).toBe(4)
    expect(r.atendidas).toBe(2)
    expect(r.noAsistio).toBe(1)
    expect(r.cobradas).toBe(1)
    expect(r.montoCobrado).toBe(500)
    expect(r.tasaAsistencia).toBeCloseTo(0.5)
    expect(r.tasaCobro).toBeCloseTo(0.5)
  })

  it('un abono parcial NO da por saldada la consulta, pero su dinero SÍ entra a caja', () => {
    const citas = [cita({ id: 'a', estado: 'atendida' })]
    const cobros = [cobro({ monto: 200, citaId: 'a', concepto: 'abono' })]
    const r = embudoCobro(citas, cobros)
    expect(r.cobradas).toBe(0)      // sigue pendiente: quedó saldo
    expect(r.montoCobrado).toBe(200) // pero los $200 sí entraron
  })
})

describe('cuentasPorCobrar', () => {
  it('lista atendidas sin cobro, más recientes primero', () => {
    const citas = [
      cita({ id: 'a', estado: 'atendida', fechaHora: '2026-07-13 09:00', pacienteNombre: 'Ana' }),
      cita({ id: 'b', estado: 'finalizada', fechaHora: '2026-07-13 11:00', pacienteNombre: 'Beto' }),
      cita({ id: 'c', estado: 'confirmada', pacienteNombre: 'Cira' }), // no atendida
    ]
    const cobros = [cobro({ monto: 400, citaId: 'a' })] // Ana ya pagó
    const r = cuentasPorCobrar(citas, cobros)
    expect(r).toHaveLength(1)
    expect(r[0].paciente).toBe('Beto')
  })
})
