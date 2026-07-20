import { describe, it, expect } from 'vitest'
import { cambiosPorTransicion, contadorDeEstado, esAtencionEfectiva } from '@/lib/agenda/contadores-paciente'

/**
 * De estos contadores dependen el badge de riesgo de no-show, el CRM, la campaña
 * de reactivación y la retención NOM-004. Contar de más marca a un paciente
 * cumplido como incumplido; contar de menos deja el motor ciego, que es como
 * estaba. Lo difícil es no contar dos veces al reeditar la cita.
 */
describe('qué contador toca', () => {
  it('no-asistio suma no-shows; cancelada suma cancelaciones', () => {
    expect(contadorDeEstado('no-asistio')).toBe('noShowCount')
    expect(contadorDeEstado('cancelada')).toBe('cancelacionCount')
  })

  it('los estados normales no suman nada', () => {
    for (const e of ['solicitada', 'confirmada', 'en-sala', 'atendida', 'pagada'] as const) {
      expect(contadorDeEstado(e)).toBeNull()
    }
  })

  it('atendida, finalizada y pagada cuentan como atención efectiva', () => {
    expect(esAtencionEfectiva('atendida')).toBe(true)
    expect(esAtencionEfectiva('finalizada')).toBe(true)
    expect(esAtencionEfectiva('pagada')).toBe(true)
    expect(esAtencionEfectiva('confirmada')).toBe(false)
  })
})

describe('transiciones', () => {
  const F = '2026-07-20 10:00'

  it('confirmada → no-asistio suma un no-show', () => {
    expect(cambiosPorTransicion('confirmada', 'no-asistio', F)).toEqual({ contador: 'noShowCount' })
  })

  it('REGRESIÓN: guardar de nuevo una cita ya marcada NO vuelve a sumar', () => {
    // Reabrir el modal de una cita en "no-asistio" y guardar sin cambiar el estado
    // no debe inflar el contador. Sin esta guarda, editar el motivo de una cita
    // marcaría al paciente como si hubiera faltado otra vez.
    expect(cambiosPorTransicion('no-asistio', 'no-asistio', F)).toEqual({})
    expect(cambiosPorTransicion('cancelada', 'cancelada', F)).toEqual({})
  })

  it('atender la cita fija la última cita, con la FECHA de la cita y no la de hoy', () => {
    expect(cambiosPorTransicion('confirmada', 'atendida', F)).toEqual({ ultimaCita: '2026-07-20' })
  })

  it('pasar de atendida a pagada no vuelve a fijar la última cita', () => {
    expect(cambiosPorTransicion('atendida', 'pagada', F)).toEqual({})
  })

  it('confirmar o poner en sala no cambia nada del paciente', () => {
    expect(cambiosPorTransicion('solicitada', 'confirmada', F)).toEqual({})
    expect(cambiosPorTransicion('confirmada', 'en-sala', F)).toEqual({})
  })

  it('rectificar de no-asistio a atendida registra la atención', () => {
    // No se descuenta el no-show ya sumado: la falta ocurrió y queda en el
    // historial. Lo que sí se registra es que finalmente se atendió.
    expect(cambiosPorTransicion('no-asistio', 'atendida', F)).toEqual({ ultimaCita: '2026-07-20' })
  })
})
