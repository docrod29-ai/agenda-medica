import { describe, it, expect } from 'vitest'
import { CALCULADORAS, calculadorasSugeridas, ckdEpi2021, meld } from '@/lib/expediente/calculadoras'

const calc = (id: string) => CALCULADORAS.find(c => c.id === id)!

describe('Sugerencia contextual por diagnóstico', () => {
  it('fibrilación auricular sugiere CHA₂DS₂-VASc y HAS-BLED', () => {
    const ids = calculadorasSugeridas('Fibrilación auricular no valvular').map(c => c.id)
    expect(ids).toContain('cha2ds2vasc')
    expect(ids).toContain('hasbled')
  })
  it('neumonía sugiere CURB-65; sin acentos también', () => {
    expect(calculadorasSugeridas('Neumonía adquirida en la comunidad').map(c => c.id)).toContain('curb65')
    expect(calculadorasSugeridas('neumonia').map(c => c.id)).toContain('curb65')
  })
  it('dolor abdominal en FID sugiere Alvarado', () => {
    expect(calculadorasSugeridas('Dolor abdominal en fosa iliaca derecha').map(c => c.id)).toContain('alvarado')
  })
  it('texto vacío no sugiere nada', () => {
    expect(calculadorasSugeridas('')).toHaveLength(0)
    expect(calculadorasSugeridas('   ')).toHaveLength(0)
  })
})

describe('CHA₂DS₂-VASc', () => {
  it('mujer de 78 con HTA y DM = 1+1+2+1 = 5 → anticoagular', () => {
    const r = calc('cha2ds2vasc').calcular({ mujer: 1, hta: 1, edad75: 1, dm: 1 })
    expect(r.puntaje).toBe(5)
    expect(r.nivel).toBe('alto')
    expect(r.interpretacion).toMatch(/anticoagulaci[óo]n/i)
  })
  it('hombre sin factores = 0 → no anticoagular', () => {
    const r = calc('cha2ds2vasc').calcular({})
    expect(r.puntaje).toBe(0)
    expect(r.nivel).toBe('bajo')
  })
  it('el umbral es distinto por sexo (mujer necesita ≥3)', () => {
    const mujer2 = calc('cha2ds2vasc').calcular({ mujer: 1, hta: 1 })   // 2 puntos
    expect(mujer2.nivel).not.toBe('alto')                                // en mujer, 2 aún no es alto
    const hombre2 = calc('cha2ds2vasc').calcular({ hta: 1, dm: 1 })      // 2 puntos
    expect(hombre2.nivel).toBe('alto')
  })
})

describe('HAS-BLED', () => {
  it('≥3 = riesgo alto pero NO contraindica anticoagular', () => {
    const r = calc('hasbled').calcular({ hta: 1, renal: 1, edad65: 1 })
    expect(r.puntaje).toBe(3)
    expect(r.nivel).toBe('alto')
    expect(r.interpretacion).toMatch(/no contraindica/i)
  })
})

describe('Wells', () => {
  it('TEP > 4 → probable, va a angioTAC (no dímero D)', () => {
    const r = calc('wells-tep').calcular({ tvp: 1, alternativo: 1 })   // 3+3
    expect(r.puntaje).toBe(6)
    expect(r.categoria).toMatch(/probable/i)
    expect(r.interpretacion).toMatch(/angioTAC/i)
  })
  it('TEP ≤4 → improbable, dímero D', () => {
    const r = calc('wells-tep').calcular({ fc: 1 })   // 1.5
    expect(r.interpretacion).toMatch(/d[íi]mero/i)
  })
  it('TVP resta 2 si hay dx alternativo más probable', () => {
    const r = calc('wells-tvp').calcular({ cancer: 1, dolor: 1, alternativo: 1 })  // 1+1-2 = 0
    expect(r.puntaje).toBe(0)
    expect(r.categoria).toMatch(/improbable/i)
  })
})

describe('CURB-65 y qSOFA', () => {
  it('CURB-65 ≥3 → hospitalizar', () => {
    const r = calc('curb65').calcular({ confusion: 1, fr: 1, edad65: 1 })
    expect(r.puntaje).toBe(3)
    expect(r.interpretacion).toMatch(/hospitalizar/i)
  })
  it('qSOFA ≥2 → positivo', () => {
    const r = calc('qsofa').calcular({ fr: 1, tas: 1 })
    expect(r.categoria).toMatch(/positivo/i)
    expect(r.nivel).toBe('alto')
  })
  it('qSOFA negativo NO descarta sepsis', () => {
    const r = calc('qsofa').calcular({ fr: 1 })
    expect(r.interpretacion).toMatch(/no descarta/i)
  })
})

describe('Centor, Alvarado, HEART, Glasgow, Child-Pugh', () => {
  it('Centor ≤1 → sin antibiótico ni prueba', () => {
    const r = calc('centor').calcular({ fiebre: 1, edad: 0 })
    expect(r.interpretacion).toMatch(/no hacer prueba|sintom/i)
  })
  it('Alvarado ≥7 → valoración quirúrgica', () => {
    const r = calc('alvarado').calcular({ migracion: 1, dolorFid: 1, leucocitosis: 1, rebote: 1, anorexia: 1 })
    expect(r.puntaje).toBe(7)
    expect(r.interpretacion).toMatch(/quir[úu]rgic/i)
  })
  it('HEART ≤3 → riesgo bajo, alta temprana razonable', () => {
    const r = calc('heart').calcular({ historia: 1, ecg: 0, edad: 1, factores: 1, troponina: 0 })
    expect(r.puntaje).toBe(3)
    expect(r.nivel).toBe('bajo')
  })
  it('Glasgow ≤8 → grave, proteger vía aérea', () => {
    const r = calc('glasgow').calcular({ ocular: 2, verbal: 2, motora: 4 })
    expect(r.puntaje).toBe(8)
    expect(r.interpretacion).toMatch(/v[íi]a a[ée]rea/i)
  })
  it('Child-Pugh 5 = clase A; 11 = clase C', () => {
    expect(calc('child-pugh').calcular({ bili: 1, albumina: 1, inr: 1, ascitis: 1, encefalopatia: 1 }).categoria).toBe('Clase A')
    expect(calc('child-pugh').calcular({ bili: 3, albumina: 3, inr: 2, ascitis: 2, encefalopatia: 1 }).categoria).toBe('Clase C')
  })
})

describe('Fórmulas: CKD-EPI 2021 y MELD', () => {
  it('CKD-EPI: hombre 60 años, Cr 1.0 ≈ 89 mL/min/1.73m²', () => {
    const tfg = ckdEpi2021(1.0, 60, false)
    expect(tfg).toBeGreaterThan(85)
    expect(tfg).toBeLessThan(95)
  })
  it('CKD-EPI: a igual creatinina, la mujer tiene TFG menor', () => {
    expect(ckdEpi2021(1.0, 60, true)).toBeLessThan(ckdEpi2021(1.0, 60, false))
  })
  it('CKD-EPI: creatinina más alta → TFG más baja', () => {
    expect(ckdEpi2021(3.0, 60, false)).toBeLessThan(ckdEpi2021(1.0, 60, false))
  })
  it('MELD queda acotado entre 6 y 40 y sube con la severidad', () => {
    expect(meld(1, 1, 1)).toBeGreaterThanOrEqual(6)
    expect(meld(30, 4, 5)).toBeLessThanOrEqual(40)
    expect(meld(10, 2.5, 3)).toBeGreaterThan(meld(1.2, 1.1, 1))
  })
  it('MELD topa la creatinina en 4 (diálisis)', () => {
    expect(meld(2, 1.5, 4)).toBe(meld(2, 1.5, 8))
  })
})
