import { describe, it, expect } from 'vitest'
import { EntidadesExtraidas, buildNerUserPrompt } from '@/lib/expediente/medical-ner'

describe('EntidadesExtraidas — contrato del schema (defaults)', () => {
  it('objeto vacío {} rellena todos los arrays y el cross_check', () => {
    const r = EntidadesExtraidas.parse({})
    expect(r.conditions).toEqual([])
    expect(r.medications).toEqual([])
    expect(r.procedures).toEqual([])
    expect(r.anatomy).toEqual([])
    expect(r.tests).toEqual([])
    expect(r.allergies).toEqual([])
    expect(r.cross_check.alergia_vs_medicamento).toEqual([])
    expect(r.cross_check.interacciones_farmacologicas).toEqual([])
  })

  it('una condición mínima recibe los defaults (estado activo, certeza confirmado)', () => {
    const r = EntidadesExtraidas.parse({ conditions: [{ texto: 'DM2' }] })
    expect(r.conditions[0].estado).toBe('activo')
    expect(r.conditions[0].certeza).toBe('confirmado')
    expect(r.conditions[0].cie10).toBe('')
  })

  it('un medicamento mínimo recibe via=desconocida y necesita_ajuste=no', () => {
    const r = EntidadesExtraidas.parse({ medications: [{ texto: 'Metformina' }] })
    expect(r.medications[0].via).toBe('desconocida')
    expect(r.medications[0].necesita_ajuste).toBe('no')
    expect(r.medications[0].generico).toBe('')
  })

  it('preserva un cross-check de RIESGO_MAXIMO', () => {
    const r = EntidadesExtraidas.parse({
      cross_check: {
        alergia_vs_medicamento: [{
          alergeno: 'Penicilina', farmaco_riesgoso: 'Amoxicilina',
          riesgo: 'anafilaxia', RIESGO_MAXIMO: true,
        }],
      },
    })
    expect(r.cross_check.alergia_vs_medicamento[0].RIESGO_MAXIMO).toBe(true)
    expect(r.cross_check.alergia_vs_medicamento[0].riesgo).toBe('anafilaxia')
  })

  it('rechaza un enum inválido (via inexistente)', () => {
    expect(() => EntidadesExtraidas.parse({ medications: [{ texto: 'x', via: 'intratecal' }] })).toThrow()
  })

  it('rechaza una condición sin el campo requerido texto', () => {
    expect(() => EntidadesExtraidas.parse({ conditions: [{ cie10: 'E11' }] })).toThrow()
  })
})

describe('buildNerUserPrompt', () => {
  it('incluye el texto fuente y las instrucciones de cross-check', () => {
    const p = buildNerUserPrompt('Paciente con fiebre y tos.')
    expect(p).toContain('Paciente con fiebre y tos.')
    expect(p.toLowerCase()).toContain('cross-check')
  })

  it('trunca el texto a 12000 caracteres', () => {
    const largo = 'a'.repeat(20000)
    const p = buildNerUserPrompt(largo)
    // el bloque incrustado no debe exceder 12000 'a'
    expect(p).not.toContain('a'.repeat(12001))
    expect(p).toContain('a'.repeat(12000))
  })

  // Auditoría 2026-07 (P1): alergias del expediente entran al cross-check.
  it('incrusta las alergias registradas del expediente cuando se pasan', () => {
    const p = buildNerUserPrompt('Nota sin alergias dictadas.', ['Penicilina', 'Sulfas'])
    expect(p).toContain('Penicilina')
    expect(p).toContain('Sulfas')
    expect(p.toUpperCase()).toContain('REGISTRADAS')
    expect(p.toLowerCase()).toContain('expediente')
  })

  it('no agrega el bloque de alergias si la lista viene vacía o indefinida', () => {
    const sin = buildNerUserPrompt('Nota.')
    const vacio = buildNerUserPrompt('Nota.', [])
    expect(sin.toUpperCase()).not.toContain('ALERGIAS YA REGISTRADAS')
    expect(vacio.toUpperCase()).not.toContain('ALERGIAS YA REGISTRADAS')
  })

  it('ignora entradas vacías/espacios en la lista de alergias', () => {
    const p = buildNerUserPrompt('Nota.', ['  ', '', 'Yodo'])
    expect(p).toContain('Yodo')
    expect(p.toUpperCase()).toContain('ALERGIAS YA REGISTRADAS')
  })
})
