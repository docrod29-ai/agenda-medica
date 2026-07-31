import { describe, it, expect } from 'vitest'
import {
  tareasDePaciente,
  turnoDeEnfermeria,
  ordenarTareas,
  TIPOS_TAREA,
  TAREA_LABEL,
  NO_PRIORIZA_CLINICAMENTE,
  type PacienteEnfermeria,
} from '@/lib/uci/enfermeria'
import type { Indicacion, Administracion } from '@/types/hospital'

/**
 * Charter §40 — vista de enfermería de UCI.
 *
 * Lo que estos casos protegen: que la lista NO invente una prioridad clínica, y
 * que lo que no se atrasa por definición —infusión continua, PRN, dosis única—
 * no aparezca aquí. Una lista de enfermería que grita deja de leerse igual que
 * un MAR que grita.
 *
 * Datos 100 % sintéticos.
 */

const AHORA = '2026-07-30T12:00:00Z'
const GRACIA = 30

const adm = (fecha: string, estado: Administracion['estado'] = 'administrado'): Administracion =>
  ({ fecha, por: 'enf-ficticia', estado })

const ind = (e: Partial<Indicacion> = {}): Indicacion => ({
  id: 'i1', tipo: 'medicamento', descripcion: 'Fármaco ficticio', frecuencia: 'cada 8 h',
  activa: true, fecha: '2026-07-30T00:00:00Z', administraciones: [], ...e,
})

const pac = (e: Partial<PacienteEnfermeria> = {}): PacienteEnfermeria => ({
  internamientoId: 'p1', pacienteNombre: 'Paciente Ficticio', cama: 'UCI-01',
  horasDesdeUltimaToma: 1, indicaciones: [], ...e,
})

describe('§40 · la lista NO prioriza clínicamente, y lo dice', () => {
  it('el aviso está y explica el límite', () => {
    // Un antibiótico atrasado y una vitamina atrasada se ven igual desde aquí.
    expect(NO_PRIORIZA_CLINICAMENTE).toMatch(/no por gravedad clínica/)
    expect(NO_PRIORIZA_CLINICAMENTE).toMatch(/criterio de quien está en la cabecera/)
  })

  it('no existe ningún catálogo de severidad ni de urgencia', async () => {
    const mod = await import('@/lib/uci/enfermeria')
    expect(Object.keys(mod).filter(k =>
      /severidad|urgencia|criticidad|prioridad_clinica|riesgo/i.test(k))).toEqual([])
  })

  it('dos fármacos distintos igual de atrasados producen tareas equivalentes', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [
        ind({ id: 'a', descripcion: 'Antibiótico ficticio', administraciones: [adm('2026-07-30T01:00:00Z')] }),
        ind({ id: 'b', descripcion: 'Vitamina ficticia', administraciones: [adm('2026-07-30T01:00:00Z')] }),
      ],
    }), AHORA, GRACIA)
    expect(t).toHaveLength(2)
    expect(new Set(t.map(x => x.tipo))).toEqual(new Set(['medicamento_atrasado']))
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§40 · lo que NUNCA aparece en la lista', () => {
  it('la infusión continua no es una tarea pendiente', () => {
    // Se titula, no se pasa. Aquí seria ruido permanente.
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ frecuencia: 'infusión continua', fecha: '2026-07-01T00:00:00Z' })],
    }), AHORA, GRACIA)
    expect(t).toEqual([])
  })

  it('el PRN tampoco', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ frecuencia: 'cada 6 h PRN', fecha: '2026-07-01T00:00:00Z' })],
    }), AHORA, GRACIA)
    expect(t).toEqual([])
  })

  it('la dosis única ya dada tampoco', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ frecuencia: 'dosis única', administraciones: [adm('2026-07-29T00:00:00Z')] })],
    }), AHORA, GRACIA)
    expect(t).toEqual([])
  })

  it('una orden suspendida tampoco', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ activa: false, fecha: '2026-07-01T00:00:00Z' })],
    }), AHORA, GRACIA)
    expect(t).toEqual([])
  })

  it('un paciente al día no genera ninguna tarea', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ administraciones: [adm('2026-07-30T11:00:00Z')] })],
    }), AHORA, GRACIA)
    expect(t).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§40 · cada tarea sale de un hecho registrado', () => {
  it('medicamento atrasado, con la frase que redactó el MAR', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ administraciones: [adm('2026-07-30T01:00:00Z')] })],
    }), AHORA, GRACIA)
    expect(t[0].tipo).toBe('medicamento_atrasado')
    expect(t[0].texto).toMatch(/Fármaco ficticio — Atrasada/)
    expect(t[0].desdeIso).toBeTruthy()
  })

  it('medicamento que TOCA, aún sin atraso', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ administraciones: [adm('2026-07-30T03:40:00Z')] })],
    }), AHORA, GRACIA)
    expect(t[0].tipo).toBe('medicamento_toca')
  })

  it('sin ninguna toma en el episodio', () => {
    const t = tareasDePaciente(pac({ horasDesdeUltimaToma: null }), AHORA, GRACIA)
    expect(t[0].tipo).toBe('sin_toma')
    expect(t[0].texto).toMatch(/Sin ninguna toma registrada/)
  })

  it('un horario ilegible es trabajo del médico, pero enfermería se lo topa', () => {
    const t = tareasDePaciente(pac({
      indicaciones: [ind({ frecuencia: 'según esquema', fecha: '2026-07-01T00:00:00Z' })],
    }), AHORA, GRACIA)
    expect(t[0].tipo).toBe('horario_ilegible')
    expect(t[0].texto).toMatch(/No se pudo interpretar el horario/)
  })

  it('la tarea lleva la cama, para poder recorrer la unidad', () => {
    const t = tareasDePaciente(pac({ horasDesdeUltimaToma: null, cama: '  UCI-07  ' }), AHORA, GRACIA)
    expect(t[0].cama).toBe('UCI-07')
  })

  it('sin cama, la tarea sale igual: el paciente no desaparece', () => {
    const t = tareasDePaciente(pac({ horasDesdeUltimaToma: null, cama: '' }), AHORA, GRACIA)
    expect(t[0].cama).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§40 · el turno completo de la unidad', () => {
  const r = turnoDeEnfermeria([
    pac({ internamientoId: 'a', cama: 'UCI-03', indicaciones: [ind({ administraciones: [adm('2026-07-30T01:00:00Z')] })] }),
    pac({ internamientoId: 'b', cama: 'UCI-01', horasDesdeUltimaToma: null }),
    pac({ internamientoId: 'c', cama: 'UCI-02', indicaciones: [ind({ administraciones: [adm('2026-07-30T03:40:00Z')] })] }),
    pac({ internamientoId: 'd', cama: 'UCI-04', indicaciones: [ind({ administraciones: [adm('2026-07-30T11:30:00Z')] })] }),
  ], AHORA, GRACIA)

  it('lo atrasado va primero', () => {
    expect(r.tareas[0].tipo).toBe('medicamento_atrasado')
  })

  it('luego el que no tiene ninguna toma', () => {
    expect(r.tareas[1].tipo).toBe('sin_toma')
  })

  it('el conteo por tipo cuadra con la lista', () => {
    const suma = Object.values(r.conteo).reduce((a, b) => a + b, 0)
    expect(suma).toBe(r.tareas.length)
  })

  it('también dice QUIÉN está al día', () => {
    // Una lista que sólo muestra pendientes no deja ver que el resto está bien.
    expect(r.sinTareas).toEqual(['d'])
  })

  it('dentro del mismo tipo, ordena por cama y no baila entre recargas', () => {
    const dos = turnoDeEnfermeria([
      pac({ internamientoId: 'x', cama: 'UCI-10', horasDesdeUltimaToma: null }),
      pac({ internamientoId: 'y', cama: 'UCI-02', horasDesdeUltimaToma: null }),
    ], AHORA, GRACIA)
    expect(dos.tareas.map(t => t.cama)).toEqual(['UCI-02', 'UCI-10'])
  })

  it('no muta la lista que recibe', () => {
    const t = [...r.tareas]
    ordenarTareas(r.tareas)
    expect(r.tareas).toEqual(t)
  })

  it('unidad vacía: sin tareas y sin inventar', () => {
    expect(turnoDeEnfermeria([], AHORA, GRACIA)).toEqual({ tareas: [], conteo: {}, sinTareas: [] })
  })

  it('una gracia inválida LANZA: no se asume un margen', () => {
    expect(() => turnoDeEnfermeria([pac()], AHORA, -1)).toThrowError(/gracia inválida/)
  })

  it('los cuatro tipos tienen etiqueta', () => {
    for (const t of TIPOS_TAREA) expect(TAREA_LABEL[t]).toBeTruthy()
  })
})
