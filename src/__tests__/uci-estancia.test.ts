import { describe, it, expect } from 'vitest'
import {
  medirEstancia,
  diasDeCalendario,
  fechaCivil,
  duracionLegible,
  PARA_CALCULOS_USAR_TIMESTAMPS,
} from '@/lib/uci/estancia'

/**
 * «Día UCI» — decisión del Dr. (2026-07-30).
 *
 * No se elige entre bloques de 24 h y día de calendario: **se guardan los tres
 * datos**, porque cada uno responde una pregunta distinta y elegir uno destruye
 * la información del otro.
 *
 * El ejemplo que fijó la decisión está congelado abajo como caso.
 *
 * Datos 100 % sintéticos.
 */

const TZ = 'America/Chihuahua'   // UTC-6 estable

describe('el ejemplo que fijó la decisión', () => {
  // Ingreso lunes 23:50 hora de la unidad = 2026-07-27T23:50 en -06:00
  const INGRESO = '2026-07-27T23:50:00-06:00'
  const MARTES_8 = '2026-07-28T08:00:00-06:00'
  const m = medirEstancia({ admittedAt: INGRESO, unitTimezone: TZ }, MARTES_8)

  it('calendarDayNumber = 2 ← ya es el día siguiente en la unidad', () => {
    expect(m.calendarDayNumber).toBe(2)
  })

  it('elapsedMinutes = 490 (8 h 10 min) ← la duración exacta no se pierde', () => {
    expect(m.elapsedMinutes).toBe(490)
  })

  it('completed24hPeriods = 0 ← no ha cumplido ni un periodo', () => {
    expect(m.completed24hPeriods).toBe(0)
  })

  it('la etiqueta dice LAS DOS COSAS', () => {
    // «Día 1» sería falso para el turno; «Día 2» a secas sugeriría un día entero.
    expect(m.etiqueta).toBe('Día UCI 2 · 8 h de estancia')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('los tres datos no se pisan', () => {
  const ing = '2026-07-27T23:50:00-06:00'

  it('a los 10 minutos: día 1, 0 periodos', () => {
    const m = medirEstancia({ admittedAt: ing, unitTimezone: TZ }, '2026-07-28T00:00:00-06:00')
    expect(m.calendarDayNumber).toBe(2)      // ya cambió el día civil
    expect(m.completed24hPeriods).toBe(0)
    expect(m.elapsedMinutes).toBe(10)
  })

  it('a las 24 h justas: 1 periodo cumplido', () => {
    const m = medirEstancia({ admittedAt: ing, unitTimezone: TZ }, '2026-07-28T23:50:00-06:00')
    expect(m.completed24hPeriods).toBe(1)
    expect(m.calendarDayNumber).toBe(2)
  })

  it('un ingreso a mediodía: el día civil y los periodos van casi a la par', () => {
    const m = medirEstancia({ admittedAt: '2026-07-27T12:00:00-06:00', unitTimezone: TZ },
      '2026-07-30T12:00:00-06:00')
    expect(m.calendarDayNumber).toBe(4)
    expect(m.completed24hPeriods).toBe(3)
  })

  it('la duración exacta se conserva siempre, aunque el día sea el mismo', () => {
    const m = medirEstancia({ admittedAt: '2026-07-30T01:00:00-06:00', unitTimezone: TZ },
      '2026-07-30T23:00:00-06:00')
    expect(m.calendarDayNumber).toBe(1)
    expect(m.elapsedMinutes).toBe(22 * 60)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('la zona horaria es la de la UNIDAD, nunca la del navegador', () => {
  it('es obligatoria: sin ella LANZA, no cae a un default', () => {
    expect(() => medirEstancia({ admittedAt: '2026-07-30T00:00:00Z', unitTimezone: '  ' }, '2026-07-30T12:00:00Z'))
      .toThrowError(/zona horaria de la unidad es obligatoria/)
  })

  it('el mensaje dice POR QUÉ', () => {
    try {
      medirEstancia({ admittedAt: '2026-07-30T00:00:00Z', unitTimezone: '' }, '2026-07-30T12:00:00Z')
    } catch (e) {
      expect(String(e)).toMatch(/mismo día de UCI para quien pasa visita/)
    }
  })

  it('una zona inválida LANZA con la causa clara', () => {
    expect(() => fechaCivil('2026-07-30T00:00:00Z', 'Marte/Olympus'))
      .toThrowError(/zona horaria inválida/)
  })

  it('la MISMA hora real da días distintos en zonas distintas, y eso es correcto', () => {
    // 2026-07-28T05:00Z son las 23:00 del 27 en Chihuahua y las 05:00 del 28 en Madrid.
    const ing = '2026-07-27T20:00:00Z'
    const ahora = '2026-07-28T05:00:00Z'
    const mx = medirEstancia({ admittedAt: ing, unitTimezone: 'America/Chihuahua' }, ahora)
    const es = medirEstancia({ admittedAt: ing, unitTimezone: 'Europe/Madrid' }, ahora)
    expect(mx.calendarDayNumber).toBe(1)
    expect(es.calendarDayNumber).toBe(2)
    // Pero la duración exacta es la MISMA: no depende de husos.
    expect(mx.elapsedMinutes).toBe(es.elapsedMinutes)
    expect(mx.completed24hPeriods).toBe(es.completed24hPeriods)
  })

  it('el mismo instante escrito con otro desfase da el mismo resultado', () => {
    const a = medirEstancia({ admittedAt: '2026-07-27T12:00:00Z', unitTimezone: TZ }, '2026-07-30T12:00:00Z')
    const b = medirEstancia({ admittedAt: '2026-07-27T06:00:00-06:00', unitTimezone: TZ }, '2026-07-30T12:00:00Z')
    // `admittedAt` se devuelve tal cual se recibió —el registro no se reescribe—
    // pero TODO lo derivado tiene que coincidir.
    expect(b.admittedAt).not.toBe(a.admittedAt)
    expect(b.calendarDayNumber).toBe(a.calendarDayNumber)
    expect(b.elapsedMinutes).toBe(a.elapsedMinutes)
    expect(b.completed24hPeriods).toBe(a.completed24hPeriods)
    expect(b.etiqueta).toBe(a.etiqueta)
  })

  it('días de calendario se cuenta por fecha civil, no por milisegundos', () => {
    // 8 h de diferencia real, un día civil de diferencia.
    expect(diasDeCalendario('2026-07-27T23:50:00-06:00', '2026-07-28T08:00:00-06:00', TZ)).toBe(1)
    // 23 h de diferencia real, cero días civiles.
    expect(diasDeCalendario('2026-07-27T00:30:00-06:00', '2026-07-27T23:30:00-06:00', TZ)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('robustez y frontera', () => {
  it('un ingreso en el futuro no produce día 0 ni duración negativa', () => {
    const m = medirEstancia({ admittedAt: '2026-07-31T00:00:00Z', unitTimezone: TZ }, '2026-07-30T12:00:00Z')
    expect(m.calendarDayNumber).toBe(1)
    expect(m.elapsedMinutes).toBe(0)
    expect(m.completed24hPeriods).toBe(0)
  })

  it('fechas inválidas LANZAN', () => {
    expect(() => medirEstancia({ admittedAt: 'ayer', unitTimezone: TZ }, '2026-07-30T12:00:00Z'))
      .toThrowError(/ingreso inválido/)
    expect(() => medirEstancia({ admittedAt: '2026-07-30T00:00:00Z', unitTimezone: TZ }, 'ahora'))
      .toThrowError(/instante inválido/)
  })

  it('la duración legible sube de unidad sin mentir', () => {
    expect(duracionLegible(45)).toBe('45 min')
    expect(duracionLegible(490)).toBe('8 h')
    expect(duracionLegible(47 * 60)).toBe('47 h')
    expect(duracionLegible(50 * 60)).toBe('2 d')
  })

  it('se declara que el número de día NO sirve para calcular', () => {
    // Un balance de «últimas 24 h» se calcula con instantes reales.
    expect(PARA_CALCULOS_USAR_TIMESTAMPS).toMatch(/NUNCA con el número de día/)
    expect(PARA_CALCULOS_USAR_TIMESTAMPS).toMatch(/ventanas exactas/)
  })
})
