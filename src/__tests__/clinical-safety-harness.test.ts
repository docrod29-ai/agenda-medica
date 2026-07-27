/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLINICAL SAFETY HARNESS — golden datasets de las fórmulas deterministas.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Origen: un revisor externo detectó que FIB-4 salía 3053.54 en vez de 3.05
 * (error de escala 1000× por unidad de plaquetas). Ese bug prueba que un motor
 * "determinista" puede tener un 1000× sin que nadie lo note. Este arnés fija el
 * VALOR EXACTO de cada fórmula contra constantes calculadas de forma
 * independiente (no re-implementa la fórmula en el test: pin de números).
 *
 * REGLA: si una fórmula clínica falla aquí, el build se cae (este archivo corre en
 * el CI de vitest). Añadir más golden y más fórmulas es trabajo continuo; esta es
 * la base. Fórmulas objetivo pendientes de golden dedicado se marcan TODO.
 *
 * Las constantes esperadas se derivaron con una implementación de referencia
 * separada (documentadas en el commit); aquí solo se comparan contra el motor real.
 */
import { describe, it, expect } from 'vitest'
import { ckdEpi2021, cockcroftGault } from '@/lib/expediente/funcion-renal'
import { meld } from '@/lib/expediente/calculadoras'
import { fib4 } from '@/lib/expediente/cardiometabolico/masld'
import { apfel } from '@/lib/expediente/cirugia'

describe('CLINICAL SAFETY HARNESS · CKD-EPI 2021', () => {
  // El motor devuelve PRECISIÓN COMPLETA (decisión del Dr, L6); el redondeo es de
  // presentación. Golden: valor de referencia (race-free 2021), redondeado al mostrar.
  it.each([
    ['H, Cr 1.0, 40a', 1.0, 40, 'Masculino' as const, 98],
    ['M, Cr 0.7, 40a', 0.7, 40, 'Femenino' as const, 112],
    ['H, Cr 4.0, 70a (falla renal)', 4.0, 70, 'Masculino' as const, 15],
  ])('%s → %d mL/min/1.73m² (al redondear)', (_l, cr, edad, sexo, esperado) => {
    expect(Math.round(ckdEpi2021(cr, edad, sexo))).toBe(esperado)
  })
  it('devuelve PRECISIÓN COMPLETA (no redondea el motor)', () => {
    const v = ckdEpi2021(1.0, 40, 'Masculino')
    expect(v).toBeCloseTo(97.575, 2)
    expect(Number.isInteger(v)).toBe(false)   // el motor NO redondea
  })
  it('firma flexible: Sexo o booleano (esMujer) dan el mismo resultado', () => {
    expect(ckdEpi2021(0.7, 40, 'Femenino')).toBe(ckdEpi2021(0.7, 40, true))
    expect(ckdEpi2021(1.0, 40, 'Masculino')).toBe(ckdEpi2021(1.0, 40, false))
  })
})

describe('CLINICAL SAFETY HARNESS · Cockcroft-Gault', () => {
  it.each([
    ['H, Cr 1.0, 40a, 70kg', 1.0, 40, 'Masculino' as const, 70, 97],
    ['M, Cr 1.2, 60a, 65kg', 1.2, 60, 'Femenino' as const, 65, 51],
  ])('%s → %d mL/min', (_l, cr, edad, sexo, peso, esperado) => {
    expect(cockcroftGault(cr, edad, sexo, peso)).toBe(esperado)
  })
})

describe('CLINICAL SAFETY HARNESS · MELD (UNOS)', () => {
  it('bili 2, INR 1.5, Cr 1.5 → 17', () => {
    expect(meld(2, 1.5, 1.5)).toBe(17)
  })
  it('clamp inferior: valores normales → 6 (mínimo)', () => {
    expect(meld(1, 1, 1)).toBe(6)
  })
  it('clamp superior: valores extremos → 40 (máximo)', () => {
    expect(meld(50, 10, 10)).toBe(40)
  })
})

describe('CLINICAL SAFETY HARNESS · FIB-4 (flagship — el bug que originó el arnés)', () => {
  it('caso del reporte externo (68a, AST 42, plaq 135, ALT 48) → 3.05, NO 3053.54', () => {
    expect(fib4(68, 42, 135, 48)).toBe(3.05)
  })
  it('robustez de unidad: ×10⁹/L y conteo absoluto dan el MISMO resultado', () => {
    expect(fib4(68, 42, 135, 48)).toBe(fib4(68, 42, 135_000, 48))
    expect(fib4(50, 40, 150_000, 25)).toBe(2.67)
  })
  it('entradas inválidas → null (no un número falso)', () => {
    expect(fib4(0, 42, 135, 48)).toBeNull()
    expect(fib4(68, 0, 135, 48)).toBeNull()
    expect(fib4(68, 42, 0, 48)).toBeNull()
    expect(fib4(68, 42, 135, 0)).toBeNull()
  })
})

describe('CLINICAL SAFETY HARNESS · Apfel (NVPO)', () => {
  // Riesgos publicados por nº de factores (0–4): 10/21/39/61/79 %.
  it.each([[0, 10], [1, 21], [2, 39], [3, 61], [4, 79]])(
    '%d factores → %d%% de riesgo', (factores, pct) => {
      expect(apfel(factores).riesgo).toBe(pct)
    })
  it('acota fuera de 0–4 (5 → 4 factores)', () => {
    expect(apfel(5).riesgo).toBe(79)
    expect(apfel(-1).riesgo).toBe(10)
  })
})
