/**
 * REGRESIÓN — 10 bugs confirmados por el panel de intensivistas (auditoría UCI).
 * Cada test fija el umbral/comportamiento correcto para que el defecto no reaparezca.
 */
import { describe, it, expect } from 'vitest'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { indiceKirby } from '@/lib/uci/ventilacion'
import { lineasB, obstruccionTSVI, presionesLlenado_Ee } from '@/lib/uci/pocus'
import { extraerValoresUCI } from '@/lib/uci/extraccion'
import { camIcu, calcularAPACHE2 } from '@/lib/uci/scores'
import { analizarSeguridadUCI } from '@/lib/uci/seguridad'

describe('AUDITORÍA · extracción de voz', () => {
  it("'PIP' dictada NO se guarda como PEEP (PIP ≠ PEEP; corrompía el driving pressure)", () => {
    const out = extraerValoresUCI('el pip está en treinta y el plateau en treinta y dos')
    expect(out.peep).toBeUndefined()
    // el plateau sí se captura
    expect(out.pplat).toBe('32')
  })
})

describe('AUDITORÍA · ventilación', () => {
  it('Berlin: P/F frontera exacto se clasifica a la categoría MÁS grave', () => {
    // P/F = 100 → grave (≤100), no moderado
    expect(indiceKirby(60, 0.6, 'arterial').interpretacion).toMatch(/grave/)
    // P/F = 200 → moderado, no leve
    expect(indiceKirby(120, 0.6, 'arterial').interpretacion).toMatch(/moderado/)
    // P/F = 300 → leve, no "sin criterio"
    expect(indiceKirby(180, 0.6, 'arterial').interpretacion).toMatch(/leve/)
  })
  it('la muestra arterial se acepta con mayúscula/variantes (no bloquea el P/F)', () => {
    expect(indiceKirby(90, 0.5, 'Arterial' as never).ok).toBe(true)
    expect(indiceKirby(90, 0.5, 'art' as never).ok).toBe(true)
    // venosa sigue bloqueando
    expect(indiceKirby(90, 0.5, 'venosa').ok).toBe(false)
  })
})

describe('AUDITORÍA · gasometría (detección de MIXTO)', () => {
  it('AG elevado con pH y HCO3 normales → trastorno MIXTO (no "normal")', () => {
    const r = analizarGasometria({ ph: 7.40, paco2: 40, hco3: 24, na: 140, cl: 95, albumina: 4 })
    expect(r.anionGap.elevado).toBe(true)
    expect(r.mixto).toBe(true)
    expect(r.deltaDelta.interpretacion).toMatch(/alcalosis metabólica concomitante|MIXTO/i)
  })
  it('delta-ratio < 1 → acidosis hiperclorémica concomitante (MIXTO)', () => {
    const r = analizarGasometria({ ph: 7.20, paco2: 30, hco3: 14, na: 140, cl: 108, albumina: 4 })
    expect(r.anionGap.elevado).toBe(true)
    expect(r.mixto).toBe(true)
    expect(r.deltaDelta.interpretacion).toMatch(/hiperclor/i)
  })
  it('EPOC (retenedor crónico, cronicidad no especificada) NO se marca mixto inventado', () => {
    const r = analizarGasometria({ ph: 7.34, paco2: 60, hco3: 32 })
    expect(r.trastornoPrimario).toBe('acidosis_respiratoria')
    expect(r.mixto).toBe(false) // HCO3 compatible con compensación crónica
  })
})

describe('AUDITORÍA · POCUS', () => {
  it('líneas B: exactamente 3/espacio ES síndrome intersticial (≥3, no >3)', () => {
    expect(lineasB(3).hallazgo).toMatch(/intersticial/)
    expect(lineasB(2).hallazgo).toMatch(/sin/)
  })
  it('obstrucción TSVI: exactamente 30 mmHg YA es obstrucción (≥30, no >30)', () => {
    expect(obstruccionTSVI(30).hallazgo).toMatch(/obstrucción/)
    expect(obstruccionTSVI(29).hallazgo).toMatch(/sin obstrucción/)
  })
  it("E/e′ se BLOQUEA en FA / valvulopatía / prótesis mitral / marcapasos", () => {
    expect(presionesLlenado_Ee(16, { fa: true }).bloqueado).toBe(true)
    expect(presionesLlenado_Ee(16, { valvulopatiaMitral: true }).bloqueado).toBe(true)
    // sin condiciones invalidantes sí interpreta
    expect(presionesLlenado_Ee(16).ok).toBe(true)
  })
})

describe('AUDITORÍA · scores (re-auditoría)', () => {
  it('CAM-ICU: base+ con Rasgo3 negativo y Rasgo4 no evaluado NO da "negativo" (no evaluable)', () => {
    const r = camIcu({ inicioAgudoOFluctuante: true, inatencion: true, nivelConcienciaAlterado: false })
    expect(r.evaluable).toBe(false)
    expect(r.positivo).toBeNull()
    expect(r.faltan.join(' ')).toMatch(/Rasgo 4/)
    // con Rasgo4 positivo sí resuelve positivo
    expect(camIcu({ inicioAgudoOFluctuante: true, inatencion: true, nivelConcienciaAlterado: false, pensamientoDesorganizado: true }).positivo).toBe(true)
  })
  it('APACHE II: FiO2 ausente es faltante (no cae por defecto a la vía PaO2)', () => {
    const r = calcularAPACHE2({ pao2: 80, edad: 60, glasgow: 15 })
    expect(r.faltantes.some(f => /FiO2/.test(f))).toBe(true)
    expect(r.parcial).toBe(true)
  })
})

describe('AUDITORÍA · seguridad (re-auditoría)', () => {
  it('sodio: umbral ABSOLUTO genera alerta crítica (antes solo evaluaba el ritmo)', () => {
    expect(analizarSeguridadUCI({ sodio: 168 }).some(a => a.parametro === 'sodio' && a.nivel === 'critica')).toBe(true)
    expect(analizarSeguridadUCI({ sodio: 112 }).some(a => a.parametro === 'sodio' && a.nivel === 'critica')).toBe(true)
    expect(analizarSeguridadUCI({ sodio: 140 }).some(a => a.parametro === 'sodio')).toBe(false)
  })
})
