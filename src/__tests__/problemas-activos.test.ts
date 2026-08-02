/**
 * GOLDEN — «qué tiene el paciente».
 *
 * Es la segunda pregunta de cualquier consulta —después de qué toma— y el
 * expediente no la respondía de un vistazo: los diagnósticos viven dentro de
 * cada nota, así que «sus problemas» era «lo que escribí la última vez que lo
 * vi».
 *
 * Lo que se protege aquí es la misma regla del silencio que en la medicación:
 * una consulta por gripa que no habla de la diabetes NO resuelve la diabetes.
 */
import { describe, it, expect } from 'vitest'
import { problemasActivos, resumenProblemas, estaVigente, haceCuanto } from '@/lib/expediente/problemas-activos'
import type { Diagnostico } from '@/types/expediente'

const dx = (descripcion: string, over: Partial<Diagnostico> = {}): Diagnostico => ({
  descripcion, tipo: 'definitivo', estado: 'activo', ...over,
})

describe('estaVigente', () => {
  it('lo descartado y lo diferencial no son problemas del paciente', () => {
    expect(estaVigente(dx('Cáncer', { tipo: 'descartado' }))).toBe(false)
    expect(estaVigente(dx('Cáncer', { tipo: 'diferencial' }))).toBe(false)
  })

  it('lo resuelto tampoco', () => {
    expect(estaVigente(dx('Neumonía', { estado: 'resuelto' }))).toBe(false)
  })

  it('lo activo y lo crónico sí', () => {
    expect(estaVigente(dx('Hipertensión', { estado: 'cronico' }))).toBe(true)
    expect(estaVigente(dx('Faringitis'))).toBe(true)
  })
})

describe('problemasActivos', () => {
  it('NO mencionar un problema no lo resuelve', () => {
    // La regla que sostiene el módulo entero.
    const r = problemasActivos([
      { fecha: '2026-01-10', diagnosticos: [dx('Diabetes mellitus tipo 2', { estado: 'cronico' })] },
      { fecha: '2026-06-01', diagnosticos: [dx('Faringitis')] },
    ])
    expect(r.map(p => p.diagnostico.descripcion)).toContain('Diabetes mellitus tipo 2')
    expect(r).toHaveLength(2)
  })

  it('manda lo que se dijo POR ÚLTIMA VEZ de cada problema', () => {
    const r = problemasActivos([
      { fecha: '2026-01-10', diagnosticos: [dx('Neumonía')] },
      { fecha: '2026-03-01', diagnosticos: [dx('Neumonía', { estado: 'resuelto' })] },
    ])
    expect(r).toEqual([])
  })

  it('el código CIE-10 reconoce el mismo problema aunque cambie el texto', () => {
    // «DM2» y «Diabetes mellitus tipo 2» se escriben de veinte formas.
    const r = problemasActivos([
      { fecha: '2026-01-10', diagnosticos: [dx('DM2', { codigoCIE10: 'E11', estado: 'cronico' })] },
      { fecha: '2026-06-01', diagnosticos: [dx('Diabetes mellitus tipo 2', { codigoCIE10: 'E11', estado: 'resuelto' })] },
    ])
    expect(r).toEqual([])
  })

  it('lo crónico va primero: no puede esconderse detrás de tres catarros', () => {
    const r = problemasActivos([
      { fecha: '2026-01-10', diagnosticos: [dx('Hipertensión', { estado: 'cronico' })] },
      { fecha: '2026-06-01', diagnosticos: [dx('Faringitis')] },
      { fecha: '2026-07-01', diagnosticos: [dx('Lumbalgia')] },
    ])
    expect(r[0].diagnostico.descripcion).toBe('Hipertensión')
  })

  it('los borradores no cuentan', () => {
    const r = problemasActivos([
      { fecha: '2026-06-01', diagnosticos: [dx('Faringitis')], estado: 'borrador' },
    ])
    expect(r).toEqual([])
  })

  it('sin notas no hay problemas', () => {
    expect(problemasActivos([])).toEqual([])
  })
})

describe('resumenProblemas', () => {
  it('lo dice sin rodeos cuando no hay nada', () => {
    expect(resumenProblemas([])).toBe('Sin problemas registrados')
  })

  it('con muchos, recorta y dice cuántos faltan', () => {
    const ps = ['A', 'B', 'C', 'D'].map(n => ({ diagnostico: dx(n), dichoEn: '2026-01-01' }))
    expect(resumenProblemas(ps)).toBe('A · B · C y 1 más')
  })
})

describe('haceCuanto', () => {
  it('habla como habla la gente', () => {
    expect(haceCuanto(undefined, '2026-08-01')).toBe('Primera consulta')
    expect(haceCuanto('2026-08-01', '2026-08-01')).toBe('hoy')
    expect(haceCuanto('2026-07-31', '2026-08-01')).toBe('ayer')
    expect(haceCuanto('2026-07-20', '2026-08-01')).toBe('hace 12 días')
    expect(haceCuanto('2026-05-01', '2026-08-01')).toBe('hace 3 meses')
    expect(haceCuanto('2024-08-01', '2026-08-01')).toBe('hace 2 años')
  })
})
