import { describe, it, expect } from 'vitest'
import {
  metaApoB, interpretarApoB, interpretarLpA,
  calcularNoHDL, calcularRemanente, interpretarRemanente,
  evaluarPanelLipidico,
} from '@/lib/expediente/cardiometabolico/biomarcadores-lipidos'

/**
 * Los umbrales vienen del consenso NLA 2024 (apoB) y de la guía NLA 2024 / ACC-AHA
 * 2026 (Lp(a)). Estos tests los fijan: si alguien los cambia, tiene que ser una
 * decisión consciente y con fuente, no un ajuste al vuelo.
 */
describe('apoB — umbrales de intensificación (NLA 2024)', () => {
  it('muy alto riesgo 60, alto 70, intermedio 90 mg/dL', () => {
    expect(metaApoB('muy-alto')).toBe(60)
    expect(metaApoB('alto')).toBe(70)
    expect(metaApoB('intermedio')).toBe(90)
    expect(metaApoB('limitrofe')).toBe(90)
  })

  it('una apoB por encima del umbral pide intensificar', () => {
    const l = interpretarApoB(95, { categoria: 'alto' })!
    expect(l.recomendaciones.join(' ')).toMatch(/intensificar/i)
  })

  it('en meta no pide intensificar', () => {
    const l = interpretarApoB(65, { categoria: 'alto' })!
    expect(l.nivel).toBe('optimo')
    expect(l.recomendaciones.join(' ')).toMatch(/en meta/i)
  })

  it('DISCORDANCIA: LDL aceptable con apoB alta se señala explícitamente', () => {
    // Es la razón principal de medir apoB: el riesgo sigue a la apoB.
    const l = interpretarApoB(110, { categoria: 'alto', ldl: 85 })!
    expect(l.recomendaciones.join(' ')).toMatch(/discordancia/i)
  })

  it('sin LDL no inventa discordancia', () => {
    const l = interpretarApoB(110, { categoria: 'alto' })!
    expect(l.recomendaciones.join(' ')).not.toMatch(/discordancia/i)
  })

  it('un valor inválido devuelve null, no un cero interpretado', () => {
    expect(interpretarApoB(0)).toBeNull()
    expect(interpretarApoB(-5)).toBeNull()
  })
})

describe('Lp(a) — se mide una vez en la vida', () => {
  it('umbral alto: ≥125 nmol/L o ≥50 mg/dL', () => {
    expect(interpretarLpA(130, 'nmol/L')!.nivel).toBe('alto')
    expect(interpretarLpA(55, 'mg/dL')!.nivel).toBe('alto')
  })

  it('umbral bajo: <75 nmol/L o <30 mg/dL', () => {
    expect(interpretarLpA(50, 'nmol/L')!.nivel).toBe('optimo')
    expect(interpretarLpA(20, 'mg/dL')!.nivel).toBe('optimo')
  })

  it('entre ambos, riesgo intermedio', () => {
    expect(interpretarLpA(100, 'nmol/L')!.nivel).toBe('limitrofe')
    expect(interpretarLpA(40, 'mg/dL')!.nivel).toBe('limitrofe')
  })

  it('siempre dice que basta medirla una vez', () => {
    expect(interpretarLpA(50, 'nmol/L')!.recomendaciones.join(' ')).toMatch(/una vez/i)
  })

  it('elevada: pide tamizaje familiar y advierte de NO ajustar el LDL calculado', () => {
    // Los factores de conversión son inexactos y llevan a infratratar.
    const r = interpretarLpA(200, 'nmol/L')!.recomendaciones.join(' ')
    expect(r).toMatch(/cascada|familiar/i)
    expect(r).toMatch(/INFRATRATAR|no se ajusta/i)
  })
})

describe('cálculos derivados del perfil habitual', () => {
  it('no-HDL = total − HDL', () => {
    expect(calcularNoHDL(200, 50)).toBe(150)
  })

  it('remanente = total − HDL − LDL', () => {
    expect(calcularRemanente(200, 50, 120)).toBe(30)
  })

  it('valores incoherentes no producen un número inventado', () => {
    expect(calcularNoHDL(100, 120)).toBeNull()   // HDL mayor que el total
    expect(calcularNoHDL(0, 50)).toBeNull()
    expect(calcularRemanente(150, 50, 120)).toBeNull()   // daría negativo
  })

  it('un remanente alto orienta a resistencia a la insulina', () => {
    const l = interpretarRemanente(40)!
    expect(l.nivel).toBe('alto')
    expect(l.recomendaciones.join(' ')).toMatch(/insulina|metabólic/i)
  })
})

describe('panel completo: qué falta por pedir', () => {
  it('sin apoB ni Lp(a), pide ambas', () => {
    const p = evaluarPanelLipidico({ colesterolTotal: 200, hdl: 45, ldl: 130, trigliceridos: 120 })
    expect(p.faltantes.join(' ')).toMatch(/apoB/)
    expect(p.faltantes.join(' ')).toMatch(/Lp\(a\)/)
  })

  it('con triglicéridos altos, justifica la apoB por el perfil', () => {
    const p = evaluarPanelLipidico({ colesterolTotal: 240, hdl: 35, ldl: 130, trigliceridos: 300 })
    expect(p.faltantes.find(f => /apoB/.test(f))).toMatch(/subestima|partículas/i)
  })

  it('detecta la discordancia LDL bajo / apoB alta', () => {
    const p = evaluarPanelLipidico({ colesterolTotal: 180, hdl: 40, ldl: 85, apoB: 110 })
    expect(p.discordancias.length).toBeGreaterThan(0)
    expect(p.discordancias.join(' ')).toMatch(/apoB/)
  })

  it('un panel concordante no inventa discordancias', () => {
    const p = evaluarPanelLipidico({ colesterolTotal: 150, hdl: 55, ldl: 70, apoB: 60, lpa: 30 })
    expect(p.discordancias).toHaveLength(0)
  })

  it('no revienta con un panel vacío', () => {
    const p = evaluarPanelLipidico({})
    expect(p.lecturas).toHaveLength(0)
    expect(p.faltantes.length).toBeGreaterThan(0)
  })

  it('cada lectura trae fundamento y referencia, no solo el número', () => {
    const p = evaluarPanelLipidico({ colesterolTotal: 200, hdl: 45, ldl: 120, apoB: 105, lpa: 140 })
    expect(p.lecturas.length).toBeGreaterThan(0)
    for (const l of p.lecturas) {
      expect(l.fundamento.length).toBeGreaterThan(40)
      expect(l.referencia.length).toBeGreaterThan(10)
      expect(l.recomendaciones.length).toBeGreaterThan(0)
    }
  })
})
