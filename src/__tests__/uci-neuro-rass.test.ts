/**
 * NEXUS-QUALITY-006 — Coherencia GCS/RASS en el paciente intubado.
 *
 * En un paciente con vía aérea artificial el componente VERBAL del GCS no es
 * valorable ("GCS 15 intubado" es incoherente): la sedación se sigue con RASS.
 * El motor debe marcar el GCS como no valorable y usar/pedir RASS.
 */
import { describe, it, expect } from 'vitest'
import { analizarNeuro, interpretarRASS } from '@/lib/uci/neuro'
import { extraerValoresUCI } from '@/lib/uci/extraccion'

describe('extracción de RASS por voz (incluye negativos)', () => {
  it('"RASS menos 3" → -3', () => {
    expect(extraerValoresUCI('sedación RASS menos tres').rass).toBe('-3')
  })
  it('"RASS 0" → 0', () => {
    expect(extraerValoresUCI('rass cero, despierto').rass).toBe('0')
  })
})

describe('interpretarRASS', () => {
  it('etiqueta y clasifica la sedación', () => {
    expect(interpretarRASS(0).etiqueta).toBe('Alerta y tranquilo')
    expect(interpretarRASS(-2).interpretacion).toMatch(/meta habitual|sedación ligera/i)
    expect(interpretarRASS(-4).interpretacion).toMatch(/profunda|delirium|PADIS/i)
  })
  it('acota a [−5, +4]', () => {
    expect(interpretarRASS(-9).valor).toBe(-5)
    expect(interpretarRASS(7).valor).toBe(4)
  })
})

describe('analizarNeuro — GCS no valorable si intubado', () => {
  it('intubado con GCS 15 → marca incoherencia y GCS no valorable', () => {
    const r = analizarNeuro({ glasgow: 15, intubado: true })
    expect(r.gcsValorable).toBe(false)
    expect(r.banderas.some(b => b.parametro === 'Glasgow' && /intubado|verbal|RASS/i.test(b.mensaje))).toBe(true)
  })
  it('intubado sin RASS → pide registrar RASS', () => {
    const r = analizarNeuro({ intubado: true })
    expect(r.banderas.some(b => b.parametro === 'RASS')).toBe(true)
  })
  it('NO intubado con GCS 7 → sí marca coma (comportamiento previo intacto)', () => {
    const r = analizarNeuro({ glasgow: 7, intubado: false })
    expect(r.gcsValorable).toBe(true)
    expect(r.banderas.some(b => b.parametro === 'Glasgow' && /coma/i.test(b.mensaje))).toBe(true)
  })
  it('intubado con RASS −4 → refleja sedación profunda', () => {
    const r = analizarNeuro({ intubado: true, rass: -4 })
    expect(r.rass.valor).toBe(-4)
    expect(r.banderas.some(b => b.parametro === 'RASS' && /profunda|delirium/i.test(b.mensaje))).toBe(true)
  })
})
