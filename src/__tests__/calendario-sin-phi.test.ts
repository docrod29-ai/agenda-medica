/**
 * GUARDIÁN: al calendario de Google no sale información del paciente.
 *
 * Google Calendar es el único tercero al que salían nombre completo, teléfono y
 * MOTIVO DE CONSULTA en claro, y el evento vive en un calendario que se puede
 * compartir. Este archivo existe para que nadie los devuelva sin darse cuenta:
 * añadir el nombre «para que se vea mejor en el móvil» es exactamente la clase
 * de cambio razonable que reabre el agujero.
 */
import { describe, it, expect } from 'vitest'
import { buildCalendarEvent, iniciales } from '@/lib/google-calendar'
import type { Appointment, ClinicConfig } from '@/types'

// Paciente FICTICIO. Nada de esto es una persona real.
const CITA = {
  id: 'cita-abc123',
  tipo: 'seguimiento',
  fechaHora: '2026-08-10 10:00',
  duracion: 30,
  estado: 'confirmada',
  pacienteId: 'pac-1',
  pacienteNombre: 'Juan Pérez García',
  pacienteTelefono: '6141234567',
  motivo: 'dolor torácico en esfuerzo',
  lugar: 'Consultorio 3',
} as unknown as Appointment

const CONFIG = { zonaHoraria: 'America/Chihuahua' } as unknown as ClinicConfig

describe('iniciales', () => {
  it('reduce el nombre a iniciales', () => {
    expect(iniciales('Juan Pérez García')).toBe('J.P.G.')
    expect(iniciales('Ana López')).toBe('A.L.')
  })

  it('un nombre vacío no produce un título roto', () => {
    // «Seguimiento — » parece un error de la app y no lo es.
    expect(iniciales('')).toBe('Paciente')
    expect(iniciales(undefined)).toBe('Paciente')
  })

  it('no se desborda con nombres muy largos', () => {
    expect(iniciales('María del Carmen de la Cruz Hernández Soto')).toBe('M.D.C.')
  })
})

describe('buildCalendarEvent — nada identificable sale a Google', () => {
  const ev = buildCalendarEvent(CITA, CONFIG)
  const todoElTexto = `${ev.summary}\n${ev.description}`

  it('NO manda el nombre completo del paciente', () => {
    expect(todoElTexto).not.toContain('Juan')
    expect(todoElTexto).not.toContain('Pérez')
    expect(todoElTexto).not.toContain('García')
  })

  it('NO manda el teléfono', () => {
    expect(todoElTexto).not.toContain('6141234567')
    expect(todoElTexto).not.toMatch(/\d{7,}/)   // ninguna ristra que parezca un teléfono
  })

  it('NO manda el motivo de consulta', () => {
    // El dato más sensible del conjunto: en un calendario compartido, el motivo
    // de consulta de una persona no debería poder leerse nunca.
    expect(todoElTexto.toLowerCase()).not.toContain('torácico')
    expect(todoElTexto.toLowerCase()).not.toContain('motivo:')
  })

  it('SÍ deja reconocer la cita: tipo, iniciales y hora', () => {
    expect(ev.summary).toBe('Seguimiento — J.P.G.')
    expect(ev.start.dateTime).toBe('2026-08-10T10:00:00')
    expect(ev.start.timeZone).toBe('America/Chihuahua')
  })

  it('SÍ deja llegar al expediente, con un puntero que exige sesión', () => {
    expect(ev.description).toContain('/citas?cita=cita-abc123')
  })

  it('conserva lo que es de la agenda y no del paciente', () => {
    expect(ev.description).toContain('Consultorio 3')
    expect(ev.description).toContain('confirmada')
  })
})
