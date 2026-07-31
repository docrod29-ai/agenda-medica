/**
 * GOLDEN — disponibilidad de la agenda.
 *
 * A2 de la auditoría maestra: este módulo decide **qué horarios ve un paciente
 * en el portal público** y no tenía un solo test, pese a que su propio historial
 * está lleno de fallos («slots fantasma cada 10 min», «32 lugares de un horario
 * corrupto», «agendar en domingo o en festivo»).
 *
 * Lo que se protege no es que la lista sea bonita: es que **no aparezca un hueco
 * que no existe**. Un paciente que reserva un hueco fantasma se presenta a una
 * consulta que nadie tiene apuntada.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validarHorarioDia, getDaySchedule, getAvailableSlots, hasConflict, getWeekDates,
} from '@/lib/availability'
import type { ClinicConfig, Appointment } from '@/types'

/** Una cita del lunes. `fechaHora` es 'YYYY-MM-DD HH:mm' y la duración es `duracion`. */
const cita = (hora: string, over: Record<string, unknown> = {}): Appointment[] =>
  [{ id: 'a1', fechaHora: `${LUNES} ${hora}`, duracion: 30, estado: 'confirmada', ...over }] as unknown as Appointment[]

const dia = { activo: true, inicio: '09:00', fin: '13:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
  intervaloMinutos: 30,
  diasFestivos: [],
  zonaHoraria: 'America/Mexico_City',
  horario: {
    lunes: dia, martes: dia, miercoles: dia, jueves: dia, viernes: dia,
    sabado: { activo: false, inicio: '09:00', fin: '13:00' },
    domingo: { activo: false, inicio: '09:00', fin: '13:00' },
  },
  ...over,
} as unknown as ClinicConfig)

// 2026-08-03 es lunes; 2026-08-09 es domingo.
const LUNES = '2026-08-03'
const DOMINGO = '2026-08-09'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-01T15:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('Un horario corrupto NO produce huecos', () => {
  it('fin antes que inicio se rechaza', () => {
    // «Mejor cero lugares que 32 fantasma»: si el horario está al revés, ofrecer
    // huecos manda pacientes a una hora que no existe.
    expect(validarHorarioDia('13:00', '09:00').valido).toBe(false)
    expect(getAvailableSlots(LUNES, 30, [], cfg({
      horario: { ...cfg().horario, lunes: { activo: true, inicio: '13:00', fin: '09:00' } },
    } as Partial<ClinicConfig>))).toEqual([])
  })

  it('una jornada imposible tampoco', () => {
    expect(validarHorarioDia('00:00', '23:59').valido).toBe(false)
  })

  it('un horario normal sí', () => {
    const v = validarHorarioDia('09:00', '13:00')
    expect(v.valido).toBe(true)
    expect(v.startMin).toBe(540)
    expect(v.endMin).toBe(780)
  })
})

describe('Los días cerrados están cerrados', () => {
  it('domingo inactivo no da horario', () => {
    expect(getDaySchedule(DOMINGO, cfg())).toBeNull()
    expect(getAvailableSlots(DOMINGO, 30, [], cfg())).toEqual([])
  })

  it('un festivo cierra un día que normalmente abre', () => {
    expect(getDaySchedule(LUNES, cfg({ diasFestivos: [LUNES] }))).toBeNull()
  })
})

describe('Ni un hueco de más', () => {
  it('el paso nunca es menor que la duración de la cita', () => {
    /**
     * El fallo histórico: con intervalo 10 y citas de 30, salían huecos cada 10
     * minutos — tres pacientes citados sobre la misma media hora.
     */
    const slots = getAvailableSlots(LUNES, 30, [], cfg({ intervaloMinutos: 10 }))
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'])
  })

  it('ninguna cita termina después del cierre', () => {
    // Con 60 min en una jornada 09:00-13:00, el último hueco es 12:00.
    const slots = getAvailableSlots(LUNES, 60, [], cfg())
    expect(slots[slots.length - 1]).toBe('12:00')
  })

  it('una duración absurda cae a un valor seguro y no cuelga', () => {
    // 0 o NaN dejaban el bucle sin avanzar: nunca terminaba.
    for (const d of [0, -30, NaN]) {
      const slots = getAvailableSlots(LUNES, d, [], cfg())
      expect(slots.length).toBeGreaterThan(0)
      expect(slots.length).toBeLessThan(40)
    }
  })

  it('un hueco ocupado no se ofrece', () => {
    const citas = cita('10:00')
    expect(getAvailableSlots(LUNES, 30, citas, cfg())).not.toContain('10:00')
  })

  it('salvo que sea la cita que se está reagendando', () => {
    // Si no, mover una cita a su propia hora sería imposible.
    const citas = cita('10:00')
    expect(getAvailableSlots(LUNES, 30, citas, cfg(), 'a1')).toContain('10:00')
  })
})

describe('hasConflict mira el DÍA, no sólo los solapes', () => {
  it('domingo choca aunque no haya ninguna cita', () => {
    // Cuando no hay huecos, la interfaz cambia el desplegable por un campo
    // libre: sin esta guarda se agendaba en domingo sin un solo aviso.
    expect(hasConflict(DOMINGO, '10:00', 30, [], undefined, [], undefined, cfg())).toBe(true)
  })

  it('un festivo también', () => {
    expect(hasConflict(LUNES, '10:00', 30, [], undefined, [], undefined, cfg({ diasFestivos: [LUNES] }))).toBe(true)
  })

  it('una cita que se sale del cierre choca', () => {
    // Subir la duración DESPUÉS de elegir la hora dejaba la cita terminando
    // después de que el consultorio cerró.
    expect(hasConflict(LUNES, '12:30', 60, [], undefined, [], undefined, cfg())).toBe(true)
    expect(hasConflict(LUNES, '12:00', 60, [], undefined, [], undefined, cfg())).toBe(false)
  })

  it('y antes de abrir', () => {
    expect(hasConflict(LUNES, '08:00', 30, [], undefined, [], undefined, cfg())).toBe(true)
  })

  it('dos citas que se pisan chocan', () => {
    const citas = cita('10:00')
    expect(hasConflict(LUNES, '10:15', 30, citas, undefined, [], undefined, cfg())).toBe(true)
    expect(hasConflict(LUNES, '10:30', 30, citas, undefined, [], undefined, cfg())).toBe(false)
  })
})

describe('La semana', () => {
  it('son siete días y empieza en lunes', () => {
    const semana = getWeekDates(new Date('2026-08-05T12:00:00'))
    expect(semana).toHaveLength(7)
    expect(semana[0].getDay()).toBe(1)
  })
})
