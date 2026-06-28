import { describe, it, expect } from 'vitest'
import { recomendaciones } from '@/lib/inmuno/recomendaciones'
import { compose } from '@/lib/inmuno/compose'
import { hostFlags, TX_EST_CATS, TX_CHIPS } from '@/lib/inmuno/catalogos'

const titulos = (v: Record<string, string>) => recomendaciones({ v, nowMs: 0 }).map((r) => r.titulo)

describe('inmuno — recomendaciones (coherencia)', () => {
  it('SOT en curso → recomienda PJP', () => {
    expect(titulos({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' })).toContain('Profilaxis para Pneumocystis indicada')
  })
  it('SOT pre-protocolo → NO recomienda PJP, sí tamizaje', () => {
    const t = titulos({ hc_huesped: 'SOT — Renal', hc_is_estado: 'Va a iniciar (pre-protocolo)' })
    expect(t).toContain('Pre-protocolo (aún sin inmunosupresión)')
    expect(t).not.toContain('Profilaxis para Pneumocystis indicada')
  })
  it('estado de IS sin definir → pide definirlo, sin PJP', () => {
    const t = titulos({ hc_huesped: 'SOT — Renal', hc_is_estado: '' })
    expect(t).toContain('Define el estado de inmunosupresión')
    expect(t).not.toContain('Profilaxis para Pneumocystis indicada')
  })
  it('VIH con CD4 bajo → profilaxis por CD4', () => {
    expect(titulos({ hc_huesped: 'VIH', hc_cd4: '150' }).some((x) => x.startsWith('VIH — profilaxis por CD4'))).toBe(true)
  })
  it('resultado positivo → recomendación dirigida', () => {
    expect(titulos({ hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso', hc_res_cmvpcr: 'Positivo' })).toContain('Citomegalovirus detectable')
  })
})

describe('inmuno — hepatitis B por patrón', () => {
  const base = { hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }
  it('HBsAg+ → activa', () => {
    expect(titulos({ ...base, hc_res_hbsag: 'Positivo' })).toContain('Hepatitis B activa (HBsAg positivo)')
  })
  it('anti-HBc+ / HBsAg- → resuelta u oculta (reactivación)', () => {
    const r = recomendaciones({ v: { ...base, hc_res_hbsag: 'Negativo', hc_res_antihbc: 'Positivo' }, nowMs: 0 })
    const hbv = r.find((x) => x.titulo.includes('resuelta u oculta'))
    expect(hbv).toBeTruthy()
    expect(hbv!.detalle).toMatch(/rituximab/)
  })
  it('tres negativos → susceptible (vacunar)', () => {
    expect(titulos({ ...base, hc_res_hbsag: 'Negativo', hc_res_antihbc: 'Negativo', hc_res_antihbs: 'Negativo' })).toContain('Hepatitis B: susceptible')
  })
})

describe('inmuno — serologías por resultado', () => {
  const base = { hc_huesped: 'SOT — Renal', hc_is_estado: 'En curso' }
  it('CMV IgG+ y VZV-', () => {
    const t = titulos({ ...base, hc_res_cmv: 'Positivo', hc_res_vzv: 'Negativo' })
    expect(t).toContain('CMV IgG positivo (receptor seropositivo)')
    expect(t).toContain('VZV seronegativo')
  })
})

describe('inmuno — compose (negativos concisos + solo grupos mostrados)', () => {
  it('chip marcado → presentes + resto negado', () => {
    const row = compose({ hc_cb_comorb_dm2: '1' }, new Set(['comorb'])).find((r) => r[0] === 'Comorbilidades')
    expect(row?.[1]).toBe('Presentes: DM2 (resto negado)')
  })
  it('nada marcado → frase breve', () => {
    const row = compose({}, new Set(['comorb'])).find((r) => r[0] === 'Comorbilidades')
    expect(row?.[1]).toBe('Sin comorbilidades referidas')
  })
  it('grupo no mostrado → omitido', () => {
    expect(compose({ hc_cb_disp_cvc: '1' }, new Set(['comorb'])).some((r) => r[0] === 'Dispositivos')).toBe(false)
  })
  it('resultados capturados se documentan', () => {
    const row = compose({ hc_res_cmvpcr: 'Positivo' }, new Set()).find((r) => r[0] === 'Resultados')
    expect(row?.[1]).toMatch(/CMV PCR: positivo/)
  })
})

describe('inmuno — catálogos', () => {
  it('hostFlags reconoce SOT como trasplante', () => {
    expect(hostFlags('SOT — Renal').isTx).toBe(true)
    expect(hostFlags('VIH').isTx).toBe(false)
  })
  it('hepatitis B está separada por prueba', () => {
    const basal = TX_EST_CATS.find((c) => c.cat === 'Serologías basales')!
    expect(Object.keys(basal.items)).toEqual(expect.arrayContaining(['hbsag', 'antihbc', 'antihbs', 'hbvdna']))
  })
  it('chips de inmunosupresión incluyen biológicos clave', () => {
    expect(Object.keys(TX_CHIPS.inmuno.items)).toEqual(expect.arrayContaining(['anticd20', 'antitnf', 'eculizumab']))
  })
})
