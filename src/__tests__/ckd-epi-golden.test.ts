import { describe, it, expect } from 'vitest'
import { ckdEpi2021, creatininaPlausibleMgDl } from '@/lib/expediente/funcion-renal'
import { mgPorDl, valorEn } from '@/types/clinical-quantity'

/**
 * CKD-EPI 2021 — ANCLAJE DE VALOR EXACTO.
 *
 * ── DE DÓNDE SALE ESTE ARCHIVO ───────────────────────────────────────────────
 *
 * La auditoría maestra del 26-jul confirmó dos cosas sobre este motor:
 *
 *   1. estaba DUPLICADO en dos módulos con redondeo distinto — **ya resuelto**:
 *      hoy `calculadoras.ts` re-exporta la única implementación;
 *   2. **CERO tests de valor exacto** — esto.
 *
 * Los casos que había comprobaban cotas y monotonía: «≥ 90», «distinta a», «< 30».
 * Con eso, alguien puede cambiar κ, α o el 0.9938 y **todos siguen pasando**. Y
 * la salida de este motor dispara el ajuste renal de antimicrobianos.
 *
 * ── QUÉ SON ESTOS NÚMEROS, CON HONESTIDAD ────────────────────────────────────
 *
 * Son **anclajes anti-deriva**, calculados con la ecuación canónica tal como está
 * publicada (NKF, sin coeficiente de raza) y con los coeficientes escritos aquí
 * como literales, **independientes** de la implementación.
 *
 * NO son valores copiados de una tabla de referencia validada. Confirmarlos
 * contra la calculadora oficial de la NKF es una comprobación pendiente —
 * `NEEDS_CLINICAL_REVIEW` en el ADR. Lo que estos casos SÍ garantizan hoy es que
 * nadie cambia un coeficiente sin que la suite se entere.
 */

const tfg = (cr: number, edad: number, sexo: 'Masculino' | 'Femenino') =>
  valorEn(ckdEpi2021(mgPorDl(cr), edad, sexo), 'mL/min/1.73m²')

/**
 * La ecuación, escrita AQUÍ desde la publicación, con sus coeficientes a la vista:
 *
 *   eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^edad × (1.012 si mujer)
 *   κ = 0.7 (mujer) / 0.9 (hombre)   ·   α = −0.241 (mujer) / −0.302 (hombre)
 *
 * Es una segunda escritura a propósito: si alguien toca un coeficiente en
 * `funcion-renal.ts`, este oráculo NO cambia y la comparación falla.
 */
function oraculo(scr: number, edad: number, mujer: boolean): number {
  const k = mujer ? 0.7 : 0.9
  const a = mujer ? -0.241 : -0.302
  const r = scr / k
  return 142
    * Math.pow(Math.min(r, 1), a)
    * Math.pow(Math.max(r, 1), -1.200)
    * Math.pow(0.9938, edad)
    * (mujer ? 1.012 : 1)
}

describe('CKD-EPI 2021 · valor exacto, no cotas', () => {
  const CASOS: [number, number, 'Masculino' | 'Femenino', number][] = [
    [0.9, 40, 'Masculino', 110.725600],
    [1.0, 40, 'Masculino', 97.575111],
    [1.0, 50, 'Masculino', 91.691479],
    [1.0, 50, 'Femenino', 68.633497],
    [0.7, 30, 'Femenino', 119.244575],
    [3.0, 70, 'Masculino', 21.665231],
    [2.0, 65, 'Femenino', 27.213539],
    [1.5, 55, 'Masculino', 54.640470],
    [0.5, 25, 'Femenino', 133.401442],
    [1.2, 80, 'Masculino', 61.133780],
  ]

  it.each(CASOS)('Scr %s · %s años · %s → %s mL/min/1.73m²', (cr, edad, sexo, esperado) => {
    expect(tfg(cr, edad, sexo)).toBeCloseTo(esperado, 5)
  })

  it('coincide con la ecuación escrita aparte ← mata la deriva de coeficientes', () => {
    for (const [cr, edad, sexo] of CASOS) {
      expect(tfg(cr, edad, sexo)).toBeCloseTo(oraculo(cr, edad, sexo === 'Femenino'), 9)
    }
  })

  it('el punto de corte κ importa: por encima y por debajo usan ramas distintas', () => {
    // Scr = κ exacto es la frontera. Si alguien invierte min/max, esto revienta.
    expect(tfg(0.9, 50, 'Masculino')).toBeCloseTo(oraculo(0.9, 50, false), 9)
    expect(tfg(0.7, 50, 'Femenino')).toBeCloseTo(oraculo(0.7, 50, true), 9)
    expect(tfg(0.89, 50, 'Masculino')).toBeGreaterThan(tfg(0.91, 50, 'Masculino'))
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('CKD-EPI 2021 · el sexo y la edad no se pueden intercambiar', () => {
  it('a igualdad de todo, la mujer tiene TFG MENOR con esta ecuación', () => {
    // No es un juicio clínico: es lo que da la fórmula con κ y α de mujer.
    expect(tfg(1.0, 50, 'Femenino')).toBeLessThan(tfg(1.0, 50, 'Masculino'))
  })

  it('acepta booleano y cadena, y dan lo MISMO', () => {
    // La firma admite `Sexo | boolean` porque antes había dos implementaciones.
    // Si divergieran, dos pantallas darían dos TFG distintas del mismo paciente.
    const porCadena = valorEn(ckdEpi2021(mgPorDl(1.4), 62, 'Femenino'), 'mL/min/1.73m²')
    const porBooleano = valorEn(ckdEpi2021(mgPorDl(1.4), 62, true), 'mL/min/1.73m²')
    expect(porBooleano).toBe(porCadena)
    const h1 = valorEn(ckdEpi2021(mgPorDl(1.4), 62, 'Masculino'), 'mL/min/1.73m²')
    const h2 = valorEn(ckdEpi2021(mgPorDl(1.4), 62, false), 'mL/min/1.73m²')
    expect(h2).toBe(h1)
  })

  it('más edad, menos TFG, con el mismo Scr', () => {
    expect(tfg(1.0, 80, 'Masculino')).toBeLessThan(tfg(1.0, 30, 'Masculino'))
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('CKD-EPI 2021 · devuelve PRECISIÓN COMPLETA', () => {
  it('no redondea por dentro', () => {
    // Un Math.round interno cambiaría clasificaciones y comparaciones aguas abajo.
    // El redondeo es de la capa que muestra, no del motor.
    const v = tfg(1.0, 50, 'Masculino')
    expect(Number.isInteger(v)).toBe(false)
    expect(v).not.toBe(Math.round(v))
  })

  it('el resultado viene con su unidad, no como número suelto', () => {
    const q = ckdEpi2021(mgPorDl(1.0), 50, 'Masculino')
    expect(() => valorEn(q, 'mL/min/1.73m²')).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('CKD-EPI 2021 · la guarda de unidad sigue en pie', () => {
  it('88 no es una creatinina en mg/dL: viene en µmol/L', () => {
    // El fallo original: 88 µmol/L (≈ 1.0 mg/dL, normal) entraba como 88 mg/dL y
    // producía una falla renal fantasma que contraindicaba antimicrobianos.
    expect(creatininaPlausibleMgDl(88)).toBe(false)
  })

  it('el rango plausible acepta lo normal y lo francamente elevado', () => {
    expect(creatininaPlausibleMgDl(0.5)).toBe(true)
    expect(creatininaPlausibleMgDl(8)).toBe(true)
  })

  it('cero, negativo y no-número no pasan', () => {
    expect(creatininaPlausibleMgDl(0)).toBe(false)
    expect(creatininaPlausibleMgDl(-1)).toBe(false)
    expect(creatininaPlausibleMgDl('1.0')).toBe(false)
    expect(creatininaPlausibleMgDl(NaN)).toBe(false)
  })

  it('el motor no revienta con una creatinina absurda: la guarda es del llamador', () => {
    // Documenta la frontera: `ckdEpi2021` calcula lo que le den; filtrar es de
    // quien llama, y por eso `creatininaPlausibleMgDl` existe y es pública.
    expect(() => tfg(88, 50, 'Masculino')).not.toThrow()
    expect(tfg(88, 50, 'Masculino')).toBeLessThan(1)
  })
})
