/**
 * nexusmed-icu-009 · CRITICAL_CARE_ULTRASOUND (POCUS)
 * Umbrales verificados + bloqueo por condiciones invalidantes + huecos honestos.
 */
import { describe, it, expect } from 'vitest'
import {
  disfuncionVD_TAPSE, sobrecargaVD_VDVI, signo6060, distensibilidadVCI,
  presionesLlenado_Ee, lineasB, neumotorax, obstruccionTSVI, vexus, respuestaPLR_VTI,
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

describe('POCUS — huecos honestos (no se inventan)', () => {
  it('VExUS y % de PLR quedan marcados requiereFuente', () => {
    expect(vexus().requiereFuente).toBe(true)
    expect(vexus().bloqueado).toBe(true)
    expect(respuestaPLR_VTI().requiereFuente).toBe(true)
  })
})
