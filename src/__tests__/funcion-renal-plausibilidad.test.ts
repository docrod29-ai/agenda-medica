/**
 * L4 auditoría maestra — guarda de unidad/plausibilidad en la calculadora renal
 * de la receta. Una creatinina fuera del rango posible en mg/dL (probable µmol/L
 * o typo) no debe producir una TFG falsa que dispare ajustes renales inventados.
 * (Guarda de SOFTWARE — la fórmula y los umbrales clínicos no cambian.)
 */
import { describe, it, expect } from 'vitest'
import { evaluarFuncionRenal, CREAT_MGDL_MAX } from '@/lib/expediente/funcion-renal'
import { mgPorDl } from '@/types/clinical-quantity'

/**
 * E0-05: migración mecánica a ClinicalQuantity. Ni un valor esperado cambió.
 * Estos casos siguen siendo IMPRESCINDIBLES: el tipo impide que llegue una
 * cantidad ETIQUETADA µmol/L, pero NO ve un valor que es µmol/L viniendo
 * etiquetado mg/dL desde el laboratorio — eso sólo lo atrapa esta guarda.
 */

describe('guarda de plausibilidad de creatinina', () => {
  it('valor en µmol/L (80) → datoImplausible, sin TFG', () => {
    const r = evaluarFuncionRenal(mgPorDl(80), 60, 'Masculino')
    expect(r.datoImplausible).toBe(true)
    expect(r.egfrCkdEpi).toBeNull()   // E0-05: NaN → null
  })
  it('creatinina 0 o negativa → datoImplausible (antes daba Infinity)', () => {
    expect(evaluarFuncionRenal(mgPorDl(0), 60, 'Masculino').datoImplausible).toBe(true)
    expect(evaluarFuncionRenal(mgPorDl(-1), 60, 'Femenino').datoImplausible).toBe(true)
  })
  it('creatinina normal en mg/dL (1.0) → sí calcula TFG', () => {
    const r = evaluarFuncionRenal(mgPorDl(1.0), 40, 'Masculino')
    expect(r.datoImplausible).toBeUndefined()
    expect(r.egfrCkdEpi).not.toBeNull()
    expect(r.egfrCkdEpi!.valor).toBeGreaterThan(0)
  })
  it('el techo es de unidad, no clínico: 25 mg/dL (falla renal extrema) aún calcula', () => {
    expect(evaluarFuncionRenal(mgPorDl(CREAT_MGDL_MAX), 50, 'Masculino').datoImplausible).toBeUndefined()
  })
})
