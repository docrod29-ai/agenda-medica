/**
 * GOLDEN — horario partido.
 *
 * Un médico que atiende de 9 a 14 y de 16 a 20 no podía decirlo: el día era un
 * solo tramo. Sus dos salidas eran declarar 9–20 y dejar que el portal ofreciera
 * su hora de comida a los pacientes, o crear un bloqueo a mano para cada día del
 * año.
 *
 * Lo que se protege aquí es que un descanso mal escrito NO deje al médico sin
 * agenda: si la hora de comida está al revés o incompleta, el día sigue
 * funcionando como si no la hubiera. Un día vacío es una pérdida silenciosa de
 * consultas; una comida ofrecida es un choque visible que alguien reporta.
 */
import { describe, it, expect } from 'vitest'
import { descansosEnMinutos, pisaDescanso, getAvailableSlots } from '@/lib/availability'
import type { ClinicConfig } from '@/types'

describe('descansosEnMinutos', () => {
  it('convierte la hora a minutos desde medianoche', () => {
    expect(descansosEnMinutos([{ inicio: '14:00', fin: '16:00' }])).toEqual([{ desde: 840, hasta: 960 }])
  })

  it('sin descansos no hay nada que aplicar', () => {
    expect(descansosEnMinutos()).toEqual([])
    expect(descansosEnMinutos([])).toEqual([])
  })

  it('IGNORA lo que está mal escrito en vez de romper el día', () => {
    // La regla que sostiene el módulo: un día vacío es una pérdida silenciosa de
    // consultas. Si la comida está al revés o a medias, se descarta ESE descanso.
    expect(descansosEnMinutos([
      { inicio: '16:00', fin: '14:00' },   // al revés
      { inicio: '', fin: '16:00' },        // a medias
      { inicio: '25:00', fin: '26:00' },   // no existe
      { inicio: '14:00', fin: '14:00' },   // dura cero
    ])).toEqual([])
  })
})

describe('pisaDescanso', () => {
  const comida = [{ desde: 840, hasta: 960 }]   // 14:00–16:00

  it('basta con solaparse, no hace falta caber dentro', () => {
    expect(pisaDescanso(810, 840, comida)).toBe(false)   // 13:30–14:00, justo antes
    expect(pisaDescanso(820, 850, comida)).toBe(true)    // 13:40–14:10, entra un poco
    expect(pisaDescanso(950, 980, comida)).toBe(true)    // 15:50–16:20, sale un poco
    expect(pisaDescanso(960, 990, comida)).toBe(false)   // 16:00–16:30, justo después
  })
})

const configCon = (descansos?: { inicio: string; fin: string }[]): ClinicConfig => ({
  ...({} as ClinicConfig),
  zonaHoraria: 'America/Mexico_City',
  intervaloMinutos: 30,
  duraciones: { 'primera-vez': 30, seguimiento: 30 } as ClinicConfig['duraciones'],
  horario: {
    lunes: { activo: true, inicio: '09:00', fin: '20:00', descansos },
    martes: { activo: false, inicio: '09:00', fin: '14:00' },
    miercoles: { activo: false, inicio: '09:00', fin: '14:00' },
    jueves: { activo: false, inicio: '09:00', fin: '14:00' },
    viernes: { activo: false, inicio: '09:00', fin: '14:00' },
    sabado: { activo: false, inicio: '09:00', fin: '14:00' },
    domingo: { activo: false, inicio: '09:00', fin: '14:00' },
  },
} as ClinicConfig)

// Un lunes bien lejos, para que «no ofrecer horas del pasado» no interfiera.
const LUNES = '2030-01-07'

describe('getAvailableSlots con horario partido', () => {
  it('no ofrece NINGUNA hora dentro de la comida', () => {
    const slots = getAvailableSlots(LUNES, 30, [], configCon([{ inicio: '14:00', fin: '16:00' }]))
    expect(slots).toContain('13:30')
    expect(slots).toContain('16:00')
    for (const s of slots) expect(s >= '14:00' && s < '16:00').toBe(false)
  })

  it('la cita que TERMINA dentro de la comida tampoco se ofrece', () => {
    // 13:45 con 30 min acabaría a las 14:15. El médico ya estaría comiendo.
    const cfg = configCon([{ inicio: '14:00', fin: '16:00' }])
    cfg.horario.lunes.inicio = '13:45'
    const slots = getAvailableSlots(LUNES, 30, [], cfg)
    expect(slots).not.toContain('13:45')
  })

  it('acepta más de un descanso el mismo día', () => {
    const slots = getAvailableSlots(LUNES, 30, [], configCon([
      { inicio: '11:00', fin: '11:30' },
      { inicio: '14:00', fin: '16:00' },
    ]))
    expect(slots).not.toContain('11:00')
    expect(slots).toContain('11:30')
    expect(slots).not.toContain('15:00')
  })

  it('sin descansos el día se comporta EXACTAMENTE como antes', () => {
    // Compatibilidad hacia atrás: ningún consultorio existente lleva el campo.
    const conCampoVacio = getAvailableSlots(LUNES, 30, [], configCon([]))
    const sinCampo = getAvailableSlots(LUNES, 30, [], configCon(undefined))
    expect(conCampoVacio).toEqual(sinCampo)
    expect(sinCampo).toContain('15:00')
  })

  it('un descanso al revés NO deja al médico sin agenda', () => {
    const slots = getAvailableSlots(LUNES, 30, [], configCon([{ inicio: '16:00', fin: '14:00' }]))
    expect(slots).toContain('15:00')
    expect(slots.length).toBeGreaterThan(10)
  })
})
