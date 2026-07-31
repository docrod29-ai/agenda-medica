/**
 * NEXUS-QUALITY-005 — Seguridad de la extracción de voz de UCI.
 *
 * Dos controles DETERMINISTAS que faltaban y podían envenenar SOFA/APACHE y
 * alertas críticas a partir de un error de dictado/transcripción:
 *   1) Plausibilidad fisiológica: un valor imposible se DESCARTA (no prellena) y
 *      se reporta; no se "corrige" (no inventa).
 *   2) Ambigüedad de decimal "punto uno" (0.1 vs 1): se reporta para confirmar,
 *      antes se descartaba en silencio (10× en una amina).
 */
import { describe, it, expect } from 'vitest'
import { extraerValoresUCI, extraerValoresUCIConAvisos } from '@/lib/uci/extraccion'

describe('plausibilidad fisiológica al extraer de voz', () => {
  it('"potasio cincuenta" NO prellena K (imposible) y lo reporta como implausible', () => {
    const { valores, avisos } = extraerValoresUCIConAvisos('el potasio está en cincuenta')
    expect(valores.k).toBeUndefined()
    expect(avisos.some(a => a.campo === 'k' && a.motivo === 'implausible')).toBe(true)
  })

  it('un valor crítico REAL sí pasa (K 9 no es imposible, solo grave)', () => {
    expect(extraerValoresUCI('potasio nueve').k).toBe('9')
  })

  it('no rompe la vía feliz: valores plausibles se prellenan igual', () => {
    expect(extraerValoresUCI('PEEP 8 FiO2 40 plateau 24')).toMatchObject({ peep: '8', fio2: '40', pplat: '24' })
  })

  it('temperatura imposible (ochenta) se descarta; sodio imposible también', () => {
    const { valores, avisos } = extraerValoresUCIConAvisos('temperatura ochenta, sodio doscientos cincuenta')
    expect(valores.temp).toBeUndefined()
    expect(valores.na).toBeUndefined()
    expect(avisos.filter(a => a.motivo === 'implausible').length).toBeGreaterThanOrEqual(2)
  })
})

describe('firewall de ambigüedad de decimal', () => {
  it('"norepinefrina punto uno" NO adivina (0.1 vs 1): lo reporta como ambiguo', () => {
    const { valores, avisos } = extraerValoresUCIConAvisos('norepinefrina punto uno')
    expect(valores.norepi).toBeUndefined()
    expect(avisos.some(a => a.campo === 'norepi' && a.motivo === 'ambiguo')).toBe(true)
  })

  it('con entero explícito NO es ambiguo: "norepinefrina cero punto uno" → 0.1', () => {
    const { valores, avisos } = extraerValoresUCIConAvisos('norepinefrina cero punto uno')
    expect(valores.norepi).toBe('0.1')
    expect(avisos.some(a => a.campo === 'norepi')).toBe(false)
  })
})
