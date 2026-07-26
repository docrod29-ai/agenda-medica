/**
 * L4 auditoría maestra — guarda de unidad/plausibilidad en la calculadora renal
 * de la receta. Una creatinina fuera del rango posible en mg/dL (probable µmol/L
 * o typo) no debe producir una TFG falsa que dispare ajustes renales inventados.
 * (Guarda de SOFTWARE — la fórmula y los umbrales clínicos no cambian.)
 */
import { describe, it, expect } from 'vitest'
import { evaluarFuncionRenal, CREAT_MGDL_MAX } from '@/lib/expediente/funcion-renal'

describe('guarda de plausibilidad de creatinina', () => {
  it('valor en µmol/L (80) → datoImplausible, sin TFG', () => {
    const r = evaluarFuncionRenal(80, 60, 'Masculino')
    expect(r.datoImplausible).toBe(true)
    expect(Number.isFinite(r.egfrCkdEpi)).toBe(false)
  })
  it('creatinina 0 o negativa → datoImplausible (antes daba Infinity)', () => {
    expect(evaluarFuncionRenal(0, 60, 'Masculino').datoImplausible).toBe(true)
    expect(evaluarFuncionRenal(-1, 60, 'Femenino').datoImplausible).toBe(true)
  })
  it('creatinina normal en mg/dL (1.0) → sí calcula TFG', () => {
    const r = evaluarFuncionRenal(1.0, 40, 'Masculino')
    expect(r.datoImplausible).toBeUndefined()
    expect(Number.isFinite(r.egfrCkdEpi)).toBe(true)
    expect(r.egfrCkdEpi).toBeGreaterThan(0)
  })
  it('el techo es de unidad, no clínico: 25 mg/dL (falla renal extrema) aún calcula', () => {
    expect(evaluarFuncionRenal(CREAT_MGDL_MAX, 50, 'Masculino').datoImplausible).toBeUndefined()
  })
})
