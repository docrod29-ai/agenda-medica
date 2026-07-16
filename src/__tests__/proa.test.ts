import { describe, it, expect } from 'vitest'
import { detectarAntimicrobianos, construirPlanPROA } from '@/lib/expediente/proa'

describe('detectarAntimicrobianos', () => {
  it('detecta antibióticos comunes', () => {
    const meds = [{ nombre: 'Meropenem' }, { nombre: 'Levofloxacino' }]
    const found = detectarAntimicrobianos(meds)
    expect(found).toContain('Meropenem')
    expect(found).toContain('Levofloxacino')
  })

  it('detecta combinaciones (piperacilina/tazobactam por el primer componente)', () => {
    const found = detectarAntimicrobianos([{ nombre: 'Piperacilina/Tazobactam' }])
    expect(found).toEqual(['Piperacilina/Tazobactam'])
  })

  it('NO marca fármacos no antimicrobianos', () => {
    const found = detectarAntimicrobianos([{ nombre: 'Paracetamol' }, { nombre: 'Omeprazol' }])
    expect(found).toEqual([])
  })

  it('ignora nombres vacíos o ausentes', () => {
    const found = detectarAntimicrobianos([{ nombre: '' }, {}, { nombre: '   ' }])
    expect(found).toEqual([])
  })

  it('no duplica el mismo medicamento repetido', () => {
    const found = detectarAntimicrobianos([{ nombre: 'Meropenem' }, { nombre: 'Meropenem' }])
    expect(found).toEqual(['Meropenem'])
  })

  it('es insensible a acentos y mayúsculas', () => {
    const found = detectarAntimicrobianos([{ nombre: 'FLUCONAZOL' }])
    expect(found).toEqual(['FLUCONAZOL'])
  })
})

describe('construirPlanPROA', () => {
  it('sin antimicrobianos → plan vacío y sin recordatorios', () => {
    const plan = construirPlanPROA([{ nombre: 'Paracetamol' }])
    expect(plan.hayAntimicrobianos).toBe(false)
    expect(plan.antimicrobianos).toEqual([])
    expect(plan.fechaReevaluacion).toBe('')
    expect(plan.recordatorios).toEqual([])
  })

  it('con antimicrobiano → marca reevaluación y 5 recordatorios de stewardship', () => {
    const plan = construirPlanPROA([{ nombre: 'Meropenem' }])
    expect(plan.hayAntimicrobianos).toBe(true)
    expect(plan.antimicrobianos).toEqual(['Meropenem'])
    expect(plan.recordatorios).toHaveLength(5)
    // fechas ISO YYYY-MM-DD
    expect(plan.fechaReevaluacion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(plan.ventana).toMatch(/^\d{4}-\d{2}-\d{2} a \d{4}-\d{2}-\d{2}$/)
  })

  it('los recordatorios cubren los ejes de stewardship (indicación, desescalar, IV→VO, duración)', () => {
    const plan = construirPlanPROA([{ nombre: 'Vancomicina' }])
    const texto = plan.recordatorios.join(' ').toLowerCase()
    expect(texto).toContain('indicaci')
    expect(texto).toContain('desescalar')
    expect(texto).toMatch(/iv.?vo|iv→vo/)
    expect(texto).toContain('duraci')
  })

  it('la ventana de reevaluación es hoy+2 a hoy+3 (48-72h)', () => {
    const plan = construirPlanPROA([{ nombre: 'Ceftriaxona' }])
    const [inicio, fin] = plan.ventana.split(' a ')
    expect(plan.fechaReevaluacion).toBe(inicio)
    // fin debe ser un día después del inicio
    const dIni = new Date(inicio + 'T00:00:00Z').getTime()
    const dFin = new Date(fin + 'T00:00:00Z').getTime()
    expect(dFin - dIni).toBe(24 * 60 * 60 * 1000)
  })
})
