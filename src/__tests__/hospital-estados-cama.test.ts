import { describe, it, expect } from 'vitest'
import {
  disponibilidad,
  puedeRecibir,
  contarCamas,
  transicionar,
  siguientes,
  coherenteConElTipo,
  TRANSICIONES,
  FALTA_POLITICA_LIMPIEZA,
} from '@/lib/hospital/estados-cama'
import { ESTADO_CAMA_LABEL, type EstadoCama } from '@/types/hospital'

/**
 * Charter §2 — los 7 estados de cama.
 *
 * El defecto que estos casos cierran: `ESTADOS_CAMA_NO_DISPONIBLE` existía en
 * los tipos y NO lo usaba nadie, así que el tablero sumaba a «camas libres» las
 * que estaban en limpieza, en mantenimiento o bloqueadas. Un jefe de guardia que
 * lee «4 libres» y sólo puede usar 1 decide sobre un número que no existe.
 *
 * Datos 100 % sintéticos.
 */

const TODOS = Object.keys(TRANSICIONES) as EstadoCama[]

describe('§2 · disponibilidad real, no un sí/no', () => {
  it('libre es libre', () => {
    expect(disponibilidad('libre').disponibilidad).toBe('disponible')
    expect(puedeRecibir('libre')).toBe(true)
  })

  it('limpieza, mantenimiento y bloqueada NO son camas libres ← el defecto', () => {
    for (const e of ['limpieza', 'mantenimiento', 'bloqueada'] as EstadoCama[]) {
      expect(disponibilidad(e).disponibilidad).toBe('no_disponible')
      expect(puedeRecibir(e)).toBe(false)
    }
  })

  it('reservada tiene bucket PROPIO: contarla como libre anula la reserva', () => {
    // Es el flujo B del charter: apartar la cama antes de que llegue el paciente.
    const d = disponibilidad('reservada')
    expect(d.disponibilidad).toBe('reservada')
    expect(d.motivo).toMatch(/no se le puede asignar otro paciente/)
    expect(puedeRecibir('reservada')).toBe(false)
  })

  it('aislamiento es CONDICIONADA, y dice que la condición la juzga el médico', () => {
    const d = disponibilidad('aislamiento')
    expect(d.disponibilidad).toBe('condicionada')
    expect(d.motivo).toMatch(/criterio médico/)
    expect(puedeRecibir('aislamiento')).toBe(false)
  })

  it('el OCUPANTE manda sobre la etiqueta guardada', () => {
    // El estado es una etiqueta; el ocupante es un hecho.
    expect(disponibilidad('libre', true).disponibilidad).toBe('ocupada')
    expect(disponibilidad('limpieza', true).disponibilidad).toBe('ocupada')
  })

  it('todos los estados dan un motivo: un número de capacidad sin explicación no se audita', () => {
    for (const e of TODOS) expect(disponibilidad(e).motivo.trim()).not.toBe('')
  })

  it('los 7 estados del charter, ni uno menos', () => {
    expect(TODOS).toHaveLength(7)
    for (const e of TODOS) expect(ESTADO_CAMA_LABEL[e]).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · el conteo que el tablero necesita', () => {
  const camas = [
    { estado: 'libre' as EstadoCama },
    { estado: 'libre' as EstadoCama },
    { estado: 'limpieza' as EstadoCama },
    { estado: 'mantenimiento' as EstadoCama },
    { estado: 'reservada' as EstadoCama },
    { estado: 'aislamiento' as EstadoCama },
    { estado: 'libre' as EstadoCama, hayOcupante: true },
  ]

  it('«disponibles» son SÓLO las asignables a cualquiera', () => {
    const c = contarCamas(camas)
    expect(c.disponibles).toBe(2)      // NO 5
    expect(c.total).toBe(7)
  })

  it('cada bucket se cuenta aparte y suman el total', () => {
    const c = contarCamas(camas)
    expect(c).toEqual({
      total: 7, ocupadas: 1, disponibles: 2,
      reservadas: 1, condicionadas: 1, noDisponibles: 2,
    })
    expect(c.ocupadas + c.disponibles + c.reservadas + c.condicionadas + c.noDisponibles)
      .toBe(c.total)
  })

  it('sin camas no se divide entre cero', () => {
    expect(contarCamas([]).total).toBe(0)
    expect(contarCamas([]).disponibles).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · transiciones', () => {
  it('lo que no tiene paso, no pasa', () => {
    expect(transicionar('mantenimiento', 'ocupada', true).permitida).toBe(false)
    expect(transicionar('mantenimiento', 'ocupada', true).motivo).toMatch(/No hay paso/)
  })

  it('el paso normal de un egreso: ocupada → limpieza → libre', () => {
    expect(transicionar('ocupada', 'limpieza', true).permitida).toBe(true)
    expect(transicionar('limpieza', 'libre', true).permitida).toBe(true)
  })

  it('reservar y cancelar la reserva', () => {
    expect(transicionar('libre', 'reservada', true).permitida).toBe(true)
    expect(transicionar('reservada', 'ocupada', true).permitida).toBe(true)
    expect(transicionar('reservada', 'libre', true).permitida).toBe(true)
  })

  it('quedarse igual siempre vale', () => {
    for (const e of TODOS) expect(transicionar(e, e, true).permitida).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · la limpieza entre pacientes NO la decide el módulo', () => {
  it('con la política puesta, ocupada → libre se bloquea', () => {
    const r = transicionar('ocupada', 'libre', true)
    expect(r.permitida).toBe(false)
    expect(r.motivo).toMatch(/pasar por limpieza/)
  })

  it('sin la política, se permite ← no se impone lo que no se preguntó', () => {
    expect(transicionar('ocupada', 'libre', false).permitida).toBe(true)
  })

  it('la política cambia lo que se ofrece en pantalla', () => {
    expect(siguientes('ocupada', true)).toEqual(['limpieza'])
    expect(siguientes('ocupada', false).sort()).toEqual(['libre', 'limpieza'])
  })

  it('se declara que es una decisión de la unidad, no del código', () => {
    expect(FALTA_POLITICA_LIMPIEZA).toMatch(/NEEDS_CLINICAL_REVIEW/)
    expect(FALTA_POLITICA_LIMPIEZA).toMatch(/política de la unidad/)
  })

  it('no existe ningún default de política exportado', async () => {
    const mod = await import('@/lib/hospital/estados-cama')
    expect(Object.keys(mod).filter(k => /DEFAULT|POR_DEFECTO/i.test(k))).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§2 · el tipo y la capacidad no pueden divergir', () => {
  it('ESTADOS_CAMA_NO_DISPONIBLE concuerda con lo que este módulo calcula', () => {
    // Si alguien añade un estado a un lado y no al otro, esto falla antes de que
    // el tablero empiece a contar mal.
    expect(coherenteConElTipo()).toBe(true)
  })

  it('todo estado tiene fila de transiciones', () => {
    for (const e of TODOS) expect(Array.isArray(TRANSICIONES[e])).toBe(true)
  })

  it('ninguna transición apunta a un estado inexistente', () => {
    for (const e of TODOS) {
      for (const h of TRANSICIONES[e]) expect(TODOS).toContain(h)
    }
  })
})
