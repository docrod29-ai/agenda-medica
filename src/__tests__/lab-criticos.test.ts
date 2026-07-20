import { describe, it, expect } from 'vitest'
import { esCriticoLab, evaluarCriticoLab } from '@/lib/hospital/lab-criticos'

describe('la alerta de valor crítico no se dispara al revés ni por el nombre', () => {
  it('sigue detectando lo que debe detectar', () => {
    expect(esCriticoLab('Potasio', 7.2, 'mEq/L')).toBe(true)
    expect(esCriticoLab('Sodio', 118, 'mEq/L')).toBe(true)
    expect(esCriticoLab('Hemoglobina', 5.5, 'g/dL')).toBe(true)
    expect(esCriticoLab('Potasio', 4.0, 'mEq/L')).toBe(false)
  })

  it('sin unidad reportada asume la convencional, como antes', () => {
    expect(esCriticoLab('Potasio', 7.2)).toBe(true)
  })

  it('NO juzga un calcio en mmol/L contra el umbral en mg/dL', () => {
    // 3.5 mmol/L es hipercalcemia severa. Antes se marcaba crítico POR BAJO.
    const r = evaluarCriticoLab('Calcio', 3.5, 'mmol/L')
    expect(r.critico).toBe(false)
    expect(r.evaluable).toBe(false)
    expect(r.motivo).toContain('mmol/L')
  })

  it('NO inunda de falsos críticos por unidades del SI', () => {
    expect(evaluarCriticoLab('Creatinina', 80, 'umol/L').evaluable).toBe(false)
    expect(evaluarCriticoLab('Hemoglobina', 90, 'g/L').evaluable).toBe(false)
  })

  it('la hemoglobina glucosilada no es anemia', () => {
    expect(esCriticoLab('Hemoglobina glucosilada', 6.5, '%')).toBe(false)
    expect(esCriticoLab('HbA1c', 6.5, '%')).toBe(false)
  })

  it('el pH urinario no es acidemia', () => {
    expect(esCriticoLab('pH en orina', 5.5)).toBe(false)
    expect(esCriticoLab('Examen general de orina — pH', 5.5)).toBe(false)
    // El pH de gasometría sí:
    expect(esCriticoLab('pH', 7.05)).toBe(true)
  })

  it('la fosfatasa alcalina no es fósforo', () => {
    expect(esCriticoLab('Fosfatasa alcalina', 120, 'U/L')).toBe(false)
    expect(esCriticoLab('Fósforo', 10, 'mg/dL')).toBe(true)
  })

  it('la creatinina en orina no es la sérica', () => {
    expect(esCriticoLab('Creatinina en orina', 120, 'mg/dL')).toBe(false)
    expect(esCriticoLab('Creatinina', 6, 'mg/dL')).toBe(true)
  })

  it('un estudio sin rango definido no es evaluable, no es "normal"', () => {
    expect(evaluarCriticoLab('Ferritina', 500, 'ng/mL')).toMatchObject({ critico: false, evaluable: false })
  })
})
