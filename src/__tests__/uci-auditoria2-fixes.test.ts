/**
 * REGRESIÓN — auditoría del código nuevo del ICU OS (2ª ola).
 */
import { describe, it, expect } from 'vitest'
import { compararLecturas } from '@/lib/uci/correlacion'
import { esModoEspontaneo, analizarVentilacion } from '@/lib/uci/ventilacion'
import { construirSeccionesUCI } from '@/lib/uci/nota'

describe('tendencias: relevancia sobre el delta CRUDO (no el redondeado)', () => {
  it('norepinefrina 0.10 → 0.13 (Δ 0.03) NO se descarta y es relevante', () => {
    const c = compararLecturas({ norepi: 0.10 }, { norepi: 0.13 })
    expect(c.length).toBe(1)
    expect(c[0].relevante).toBe(true)
    expect(c[0].direccion).toBe('sube')
  })
  it('cambio por debajo del umbral no es relevante (PAM Δ2 < 5)', () => {
    expect(compararLecturas({ pam: 72 }, { pam: 74 })[0].relevante).toBe(false)
  })
})

describe('modo espontáneo bloquea driving pressure/compliance', () => {
  it('esModoEspontaneo', () => {
    expect(esModoEspontaneo('PSV')).toBe(true)
    expect(esModoEspontaneo('CPAP')).toBe(true)
    expect(esModoEspontaneo('AC-VC')).toBe(false)
  })
  it('en PSV, driving pressure se BLOQUEA aunque haya Pplat y PEEP', () => {
    const r = analizarVentilacion({ pplat: '26', peep: '10', esfuerzoEspontaneo: true })
    expect(r.drivingPressure.ok).toBe(false)
  })
  it('la nota en modo PSV no imprime un driving pressure', () => {
    const s = construirSeccionesUCI({ modo: 'PSV', pplat: '26', peep: '10' })
    const resp = s.find(x => x.key === 'respiratorio')!.value
    expect(resp).not.toMatch(/Driving pressure/)
  })
})

describe('nota: SOFA usa los 4 vasopresores', () => {
  it('epinefrina alta se refleja en el SOFA de la nota (contexto)', () => {
    // epi 0.3 (>0.1) → cardiovascular 4; con el resto normal, SOFA ≥ 4.
    const conEpi = construirSeccionesUCI({ epi: '0.3', pas: '80', pad: '60', glasgow: '15', plaquetas: '200', bili: '0.5', creat: '1.0' })
    const sinEpi = construirSeccionesUCI({ pas: '80', pad: '60', glasgow: '15', plaquetas: '200', bili: '0.5', creat: '1.0' })
    const sofa = (secs: { key: string; value: string }[]) => Number((secs.find(x => x.key === 'contexto')!.value.match(/SOFA (\d+)/) || [])[1] || 0)
    // epi 0.3 > 0.1 → subscore cardiovascular 4 (antes la nota lo ignoraba → CV 0-1).
    expect(sofa(conEpi)).toBeGreaterThanOrEqual(4)
    expect(sofa(conEpi)).toBeGreaterThan(sofa(sinEpi))
  })
})
