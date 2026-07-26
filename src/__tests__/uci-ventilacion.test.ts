/**
 * nexusmed-icu-006 · VENTILATION_ENGINE
 * Candados del motor determinista de ventilación. Prueba tanto el cálculo
 * correcto como el BLOQUEO (si falta un dato o la condición no es válida, NO
 * calcula — un bloqueo es un resultado correcto).
 */
import { describe, it, expect } from 'vitest'
import {
  normalizarFiO2, pesoPredichoPBW, vtPorPBW, indiceKirby,
  drivingPressure, complianceEstatica, analizarVentilacion,
} from '@/lib/uci/ventilacion'

describe('normalizarFiO2', () => {
  it('convierte % a decimal y acepta decimal', () => {
    expect(normalizarFiO2(40).fio2).toBe(0.4)
    expect(normalizarFiO2('40%').fio2).toBe(0.4)
    expect(normalizarFiO2(0.4).fio2).toBe(0.4)
    expect(normalizarFiO2(100).fio2).toBe(1)
  })
  it('BLOQUEA fuera de rango y sin dato', () => {
    expect(normalizarFiO2(15).fio2).toBeNull()   // 15% < 21%
    expect(normalizarFiO2(undefined).fio2).toBeNull()
    expect(normalizarFiO2(120).fio2).toBeNull()
  })
  it('advierte con FiO2 alta', () => {
    expect(normalizarFiO2(70).advertencia).toMatch(/toxicidad/)
    expect(normalizarFiO2(40).advertencia).toBeUndefined()
  })
})

describe('pesoPredichoPBW (ARDSNet)', () => {
  it('calcula por sexo (talla 170 cm)', () => {
    // H: 50 + 0.91·(170−152.4) = 66.0 ; M: 45.5 + 0.91·17.6 = 61.5
    expect(pesoPredichoPBW('M', 170).pbw).toBe(66)
    expect(pesoPredichoPBW('F', 170).pbw).toBe(61.5)
  })
  it('BLOQUEA sin sexo o sin talla', () => {
    expect(pesoPredichoPBW(undefined, 170).pbw).toBeNull()
    expect(pesoPredichoPBW('M', undefined).pbw).toBeNull()
    expect(pesoPredichoPBW('M', 60).pbw).toBeNull() // talla no fisiológica
  })
})

describe('vtPorPBW', () => {
  it('calcula y alerta si > 8 mL/kg', () => {
    const r = vtPorPBW(420, 66)          // 6.4 mL/kg → protector
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(6.4)
    expect(r.advertencias).toHaveLength(0)
    const alto = vtPorPBW(600, 66)       // 9.1 mL/kg → alerta
    expect(alto.advertencias[0]).toMatch(/protección pulmonar/)
  })
  it('BLOQUEA sin VT o sin PBW', () => {
    expect(vtPorPBW(undefined, 66).ok).toBe(false)
    expect(vtPorPBW(420, null).ok).toBe(false)
    expect(vtPorPBW(420, null).faltantes).toContain('peso predicho (PBW: sexo + talla)')
  })
})

describe('indiceKirby (PaO2/FiO2)', () => {
  it('calcula y clasifica Berlin (reporte, no diagnóstico)', () => {
    const r = indiceKirby(82, 0.4, 'arterial')   // 205 → SDRA leve por oxigenación
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(205)
    expect(r.interpretacion).toMatch(/no se diagnostica automáticamente/)
  })
  it('BLOQUEA gasometría venosa (nunca oxigenación arterial con venosa)', () => {
    const r = indiceKirby(45, 0.4, 'venosa')
    expect(r.ok).toBe(false)
    expect(r.motivoBloqueo).toMatch(/venosa/)
  })
  it('BLOQUEA sin FiO2 normalizada o sin muestra', () => {
    expect(indiceKirby(82, null, 'arterial').ok).toBe(false)
    expect(indiceKirby(82, 0.4, undefined).ok).toBe(false)
  })
})

describe('drivingPressure', () => {
  it('calcula Pplat − PEEP y alerta si > 15', () => {
    const r = drivingPressure(24, 8)          // 16 → alerta
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(16)
    expect(r.advertencias.some(a => /elevado/.test(a))).toBe(true)
  })
  it('BLOQUEA con esfuerzo espontáneo o pausa inválida', () => {
    expect(drivingPressure(24, 8, { esfuerzoEspontaneo: true }).ok).toBe(false)
    expect(drivingPressure(24, 8, { pausaValida: false }).ok).toBe(false)
  })
  it('BLOQUEA sin Pplat o sin PEEP; advierte si auto-PEEP no medido', () => {
    expect(drivingPressure(undefined, 8).ok).toBe(false)
    expect(drivingPressure(24, undefined).ok).toBe(false)
    expect(drivingPressure(24, 8).advertencias.some(a => /Auto-PEEP/.test(a))).toBe(true)
  })
  it('resta el auto-PEEP cuando se proporciona', () => {
    expect(drivingPressure(24, 8, { autoPeep: 3 }).valor).toBe(13) // 24 − (8+3)
  })
})

describe('complianceEstatica', () => {
  it('calcula VT / driving pressure', () => {
    const r = complianceEstatica(420, 14)   // 30
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(30)
  })
  it('BLOQUEA con driving pressure ≤ 0 o ausente', () => {
    expect(complianceEstatica(420, 0).ok).toBe(false)
    expect(complianceEstatica(420, null).ok).toBe(false)
  })
})

describe('analizarVentilacion (orquestador — el ejemplo del prompt)', () => {
  it('caso respiratorio del intensivista', () => {
    const a = analizarVentilacion({
      sexo: 'M', tallaCm: 170, vtMl: 420, fio2: 40, fio2Unidad: '%',
      pplat: 24, peep: 8, pao2: 82, muestraGasometria: 'arterial',
    })
    expect(a.version).toBe('1.0.0')
    expect(a.fio2.valor).toBe(0.4)
    expect(a.pbw.valor).toBe(66)
    expect(a.vtPorPbw.valor).toBe(6.4)
    expect(a.drivingPressure.valor).toBe(16)   // 24 − 8
    expect(a.complianceEstatica.valor).toBe(26) // 420 / 16 = 26.25 → 26
    expect(a.indiceKirby.valor).toBe(205)       // 82 / 0.4
    expect(a.advertencias.length).toBeGreaterThan(0) // DP elevado
  })
  it('no inventa nada: si faltan datos, cada cálculo se bloquea de forma independiente', () => {
    const a = analizarVentilacion({ vtMl: 420 })
    expect(a.pbw.valor).toBeNull()
    expect(a.vtPorPbw.ok).toBe(false)
    expect(a.drivingPressure.ok).toBe(false)
    expect(a.indiceKirby.ok).toBe(false)
  })
})
