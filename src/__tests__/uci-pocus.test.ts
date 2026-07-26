/**
 * nexusmed-icu-009 · CRITICAL_CARE_ULTRASOUND (POCUS)
 * Umbrales verificados + bloqueo por condiciones invalidantes + huecos honestos.
 */
import { describe, it, expect } from 'vitest'
import {
  disfuncionVD_TAPSE, sobrecargaVD_VDVI, signo6060, distensibilidadVCI,
  presionesLlenado_Ee, lineasB, neumotorax, obstruccionTSVI,
  vexus, pulsatilidadPorta, scoreRegionLUS, lusAeration, respuestaPLR,
} from '@/lib/uci/pocus'

describe('POCUS — corazón derecho', () => {
  it('TAPSE < 16 = disfunción VD', () => {
    expect(disfuncionVD_TAPSE(14).hallazgo).toMatch(/disfunción/)
    expect(disfuncionVD_TAPSE(20).hallazgo).toMatch(/normal/)
    expect(disfuncionVD_TAPSE(undefined).bloqueado).toBe(true)
  })
  it('VD/VI > 1.0 = sobrecarga', () => {
    expect(sobrecargaVD_VDVI(1.3).hallazgo).toMatch(/sobrecarga/)
  })
  it('60/60 distingue agudo vs crónico', () => {
    expect(signo6060(45, 40).hallazgo).toMatch(/aguda/)   // PAT<60 + IT<60
    expect(signo6060(45, 70).hallazgo).toMatch(/crónica/) // PAT<60 + IT>60
  })
})

describe('POCUS — VCI, llenado, TSVI', () => {
  it('distensibilidad VCI BLOQUEA si no hay ventilación mecánica', () => {
    expect(distensibilidadVCI(20, 10, false).bloqueado).toBe(true)
    const r = distensibilidadVCI(24, 18, true) // (24-18)/18 = 33%
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(33)
    expect(r.hallazgo).toMatch(/respondedor/)
  })
  it('E/e′: <8 normal, >14 elevado, 8–14 indeterminado', () => {
    expect(presionesLlenado_Ee(6).hallazgo).toMatch(/normales/)
    expect(presionesLlenado_Ee(16).hallazgo).toMatch(/elevadas/)
    expect(presionesLlenado_Ee(10).hallazgo).toMatch(/indeterminado/)
  })
  it('obstrucción TSVI > 30 mmHg alerta contra inotrópicos', () => {
    expect(obstruccionTSVI(45).interpretacion).toMatch(/NO escalar inotrópicos/)
  })
})

describe('POCUS — pulmón', () => {
  it('líneas B > 3 = síndrome intersticial', () => {
    expect(lineasB(5).hallazgo).toMatch(/intersticial/)
    expect(lineasB(2).hallazgo).toMatch(/sin/)
  })
  it('neumotórax: ausencia de sliding SIN punto pulmonar NO es diagnóstica', () => {
    expect(neumotorax(false, false).interpretacion).toMatch(/NO diagnóstica/)
    expect(neumotorax(false, true).hallazgo).toMatch(/confirmado/)
    expect(neumotorax(true).hallazgo).toMatch(/presente/)
  })
})

describe('VExUS-C (Beaubien-Souligny 2020)', () => {
  it('grado por VCI y patrones graves', () => {
    expect(vexus({ vciCm: 1.8 }).valor).toBe(0)                                   // VCI < 2
    expect(vexus({ vciCm: 2.3, hepatica: 'leve', porta: 'normal', renal: 'normal' }).valor).toBe(1) // 0 graves
    expect(vexus({ vciCm: 2.3, hepatica: 'grave', porta: 'leve', renal: 'normal' }).valor).toBe(2)  // 1 grave
    expect(vexus({ vciCm: 2.3, hepatica: 'grave', porta: 'grave', renal: 'normal' }).valor).toBe(3) // 2 graves
  })
  it('bloquea si VCI dilatada pero sin Doppler', () => {
    expect(vexus({ vciCm: 2.5 }).bloqueado).toBe(true)
  })
  it('pulsatilidad de porta clasifica el patrón', () => {
    expect(pulsatilidadPorta(50, 20).patron).toBe('grave')   // PF 60% ≥ 50
    expect(pulsatilidadPorta(50, 30).patron).toBe('leve')    // PF 40%
    expect(pulsatilidadPorta(50, 40).patron).toBe('normal')  // PF 20%
  })
})

describe('LUS aeration score (ESICM-ESPNIC 2025)', () => {
  it('score por región y total 0–36', () => {
    expect(scoreRegionLUS({ patronA: true })).toBe(0)
    expect(scoreRegionLUS({ lineasB: 4 })).toBe(1)
    expect(scoreRegionLUS({ pctPleuraAnormal: 70 })).toBe(2)
    expect(scoreRegionLUS({ consolidacionCm: 3 })).toBe(3)
    const total = lusAeration([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3])
    expect(total.total).toBe(18)
  })
  it('bloquea si no hay 12 regiones', () => {
    expect(lusAeration([1, 2, 3]).bloqueado).toBe(true)
  })
})

describe('PLR (Monnet 2016 / Vignon 2017)', () => {
  it('ΔCO/SV ≥ 10% = respondedor; especifica parámetro', () => {
    expect(respuestaPLR(12, 'CO').hallazgo).toMatch(/respondedor/)
    expect(respuestaPLR(8, 'LVOT_VTI').hallazgo).toMatch(/no respondedor/)
    expect(respuestaPLR(12, undefined).bloqueado).toBe(true)   // falta parámetro
  })
  it('presión de pulso NO es criterio válido', () => {
    expect(respuestaPLR(15, 'PP').bloqueado).toBe(true)
  })
})
