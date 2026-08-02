/**
 * GOLDEN — «qué está tomando el paciente hoy».
 *
 * Es la primera pregunta de cualquier consulta y el expediente no la respondía:
 * los medicamentos viven dentro de cada nota, así que «lo que toma» era «lo que
 * escribí la última vez que lo vi».
 *
 * Lo que se protege aquí es la regla del silencio: no mencionar un fármaco en la
 * nota de hoy NO es suspenderlo. Si eso se rompe, la medicación crónica
 * desaparece de la lista — y de ahí sale una interacción no vista.
 */
import { describe, it, expect } from 'vitest'
import {
  medicamentosVigentes, estadoDeOrden, estaVigente, resumenVigentes,
} from '@/lib/expediente/ordenes-medicamento'
import type { Medicamento } from '@/types/expediente'

const med = (nombre: string, over: Partial<Medicamento> = {}): Medicamento => ({
  nombre, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 h', duracion: '7 días', ...over,
})

describe('El estado de una orden sin marca', () => {
  it('se lee como ACTIVA', () => {
    // Todo lo prescrito antes de que el campo existiera no lo lleva, y cuando se
    // escribió significaba justamente «está tomando esto».
    expect(estadoDeOrden(med('Metformina'))).toBe('activa')
    expect(estaVigente(med('Metformina'))).toBe(true)
  })

  it('lo suspendido no está vigente', () => {
    expect(estaVigente(med('Ibuprofeno', { estado: 'suspendida' }))).toBe(false)
    expect(estaVigente(med('Ibuprofeno', { estado: 'cancelada' }))).toBe(false)
    expect(estaVigente(med('Ibuprofeno', { estado: 'terminada' }))).toBe(false)
  })
})

describe('medicamentosVigentes', () => {
  it('manda lo que se dijo POR ÚLTIMA VEZ de cada fármaco', () => {
    const v = medicamentosVigentes([
      { fecha: '2026-01-10', medicamentos: [med('Ibuprofeno')] },
      { fecha: '2026-03-01', medicamentos: [med('Ibuprofeno', { estado: 'suspendida' })] },
    ])
    expect(v).toEqual([])
  })

  it('y si se REANUDA después, vuelve a estar vigente', () => {
    const v = medicamentosVigentes([
      { fecha: '2026-03-01', medicamentos: [med('Ibuprofeno', { estado: 'suspendida' })] },
      { fecha: '2026-05-01', medicamentos: [med('Ibuprofeno', { estado: 'activa' })] },
    ])
    expect(v.map(x => x.medicamento.nombre)).toEqual(['Ibuprofeno'])
  })

  it('NO MENCIONAR un fármaco no lo suspende', () => {
    // La regla que sostiene el módulo entero. Si esto se rompe, la metformina
    // desaparece de la lista en cuanto haya una consulta que no hable de ella.
    const v = medicamentosVigentes([
      { fecha: '2026-01-10', medicamentos: [med('Metformina', { duracion: 'indefinido' })] },
      { fecha: '2026-06-01', medicamentos: [med('Paracetamol')] },   // consulta por otra cosa
    ])
    expect(v.map(x => x.medicamento.nombre).sort()).toEqual(['Metformina', 'Paracetamol'])
  })

  it('el nombre se reconoce entre notas aunque cambie el formato', () => {
    const v = medicamentosVigentes([
      { fecha: '2026-01-10', medicamentos: [med('  METFORMINA ')] },
      { fecha: '2026-06-01', medicamentos: [med('Metformina', { estado: 'suspendida' })] },
    ])
    expect(v).toEqual([])
  })

  it('los borradores no cuentan: la nota de hoy todavía se está escribiendo', () => {
    const v = medicamentosVigentes([
      { fecha: '2026-01-10', medicamentos: [med('Metformina')] },
      { fecha: '2026-06-01', medicamentos: [med('Metformina', { estado: 'borrador' })] },
    ])
    // Manda la última nota REAL, no la que se está tecleando.
    expect(v.map(x => x.medicamento.nombre)).toEqual(['Metformina'])
    expect(v[0].dichoEn).toBe('2026-01-10')
  })

  it('un fármaco sin nombre no entra a la lista', () => {
    expect(medicamentosVigentes([{ fecha: '2026-01-01', medicamentos: [med('   ')] }])).toEqual([])
  })

  it('sin notas no hay medicación', () => {
    expect(medicamentosVigentes([])).toEqual([])
  })
})

describe('resumenVigentes', () => {
  it('lo dice sin rodeos cuando no hay nada', () => {
    expect(resumenVigentes([])).toBe('Sin medicación registrada')
  })

  it('con muchos, recorta y dice cuántos faltan', () => {
    const vs = ['A', 'B', 'C', 'D', 'E'].map(n => ({ medicamento: med(n), dichoEn: '2026-01-01' }))
    expect(resumenVigentes(vs)).toBe('A · B · C y 2 más')
  })
})
