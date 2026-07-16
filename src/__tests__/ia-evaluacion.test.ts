import { describe, it, expect } from 'vitest'
import { evaluarCaso, equivalente, resumirEvaluacion, evaluarConjunto, type CasoOro } from '@/lib/ia/evaluacion'

describe('Arnés de validación de IA', () => {
  it('equivalente: laxo por acentos/contención', () => {
    expect(equivalente('Bronquitis aguda', 'bronquitis aguda')).toBe(true)
    expect(equivalente('Hipertensión', 'hipertension arterial')).toBe(true)
    expect(equivalente('Diabetes', 'asma')).toBe(false)
  })

  it('evaluarCaso: correctos, incorrectos y faltantes', () => {
    const oro: CasoOro = {
      id: '1', entrada: 'paciente con tos y fiebre, diagnostico bronquitis',
      esperado: { diagnostico: 'bronquitis', motivo: 'tos y fiebre', plan: 'antibiótico' },
    }
    const r = evaluarCaso(oro, { id: '1', campos: { diagnostico: 'bronquitis aguda', motivo: 'cefalea' } })
    expect(r.correctos).toContain('diagnostico')  // contención
    expect(r.incorrectos).toContain('motivo')     // distinto
    expect(r.faltantes).toContain('plan')         // ausente
  })

  it('detecta alucinación: campo sin sustento en entrada ni en el oro', () => {
    const oro: CasoOro = { id: '2', entrada: 'dolor de cabeza', esperado: { motivo: 'dolor de cabeza' } }
    const r = evaluarCaso(oro, { id: '2', campos: { motivo: 'dolor de cabeza', alergias: 'penicilina' } })
    expect(r.alucinaciones).toContain('alergias') // no estaba en la entrada
  })

  it('NO marca alucinación si el dato sí está en la entrada', () => {
    const oro: CasoOro = { id: '3', entrada: 'refiere alergia a penicilina', esperado: {} }
    const r = evaluarCaso(oro, { id: '3', campos: { alergias: 'penicilina' } })
    expect(r.alucinaciones).not.toContain('alergias')
  })

  it('campos prohibidos que aparecen cuentan como alucinación', () => {
    const oro: CasoOro = { id: '4', entrada: 'x', esperado: {}, prohibidos: ['receta'] }
    const r = evaluarCaso(oro, { id: '4', campos: { receta: 'algo' } })
    expect(r.alucinaciones).toContain('receta')
  })

  it('resumen calcula exactitud, error y alucinaciones/caso', () => {
    const { resumen } = evaluarConjunto(
      [
        { id: 'a', entrada: 'tos', esperado: { dx: 'gripe', plan: 'reposo' } },
        { id: 'b', entrada: 'fiebre', esperado: { dx: 'infeccion' } },
      ],
      [
        { id: 'a', campos: { dx: 'gripe' } },              // 1 correcto, 1 faltante (plan)
        { id: 'b', campos: { dx: 'otra cosa' } },          // 1 incorrecto
      ],
    )
    expect(resumen.casos).toBe(2)
    expect(resumen.camposEsperados).toBe(3)
    expect(resumen.correctos).toBe(1)
    expect(resumen.exactitudCampo).toBeCloseTo(1 / 3, 2)
    expect(resumen.tasaError).toBeCloseTo(2 / 3, 2)
  })

  it('lista vacía no rompe (sin división por cero)', () => {
    expect(resumirEvaluacion([])).toMatchObject({ casos: 0, exactitudCampo: 0, tasaError: 0 })
  })
})
