import { describe, it, expect } from 'vitest'
import { recsFarmacos } from '@/lib/inmuno/farmacos'
import { recomendaciones } from '@/lib/inmuno/recomendaciones'

const titulos = (v: Record<string, string>) => recsFarmacos(v).map((r) => r.titulo)
const on = (k: string) => ({ ['hc_cb_inmuno_' + k]: '1' })

describe('inmuno — motor por fármaco (basado en guías, con cita)', () => {
  it('anti-CD20 → tamizaje VHB + profilaxis + PJP/hipogamma/LMP, con fuente', () => {
    const recs = recsFarmacos(on('anticd20'))
    expect(recs.some((r) => /tamizaje de hepatitis B/i.test(r.titulo))).toBe(true)
    expect(recs.some((r) => /profilaxis antiviral de VHB/i.test(r.titulo))).toBe(true)
    expect(recs.every((r) => !!r.fuente)).toBe(true)  // todas citadas
  })

  it('anti-CD20 con HBsAg positivo → profilaxis marcada como ALTA y menciona el positivo', () => {
    const r = recsFarmacos({ ...on('anticd20'), hc_res_hbsag: 'Positivo' }).find((x) => /profilaxis antiviral de VHB/i.test(x.titulo))!
    expect(r.sev).toBe('alta')
    expect(/positivo/i.test(r.detalle)).toBe(true)
  })

  it('anti-TNF → descartar TB latente antes de iniciar', () => {
    expect(titulos(on('antitnf')).some((t) => /TB latente/i.test(t))).toBe(true)
  })

  it('eculizumab → vacunación antimeningocócica (KDIGO)', () => {
    const r = recsFarmacos(on('eculizumab'))[0]
    expect(/meningoc/i.test(r.titulo)).toBe(true)
    expect(r.fuente).toMatch(/KDIGO/)
  })

  it('esteroide dosis alta → profilaxis de Pneumocystis (ASH)', () => {
    const r = recsFarmacos(on('estalta'))
    expect(r.some((x) => /Pneumocystis/i.test(x.titulo))).toBe(true)
    expect(r.some((x) => /ASH 2020/.test(x.fuente || ''))).toBe(true)
  })

  it('bortezomib → profilaxis de herpes zóster', () => {
    expect(titulos(on('proteasoma')).some((t) => /herpes zóster/i.test(t))).toBe(true)
  })

  it('mTOR → nota de protección frente a CMV', () => {
    expect(titulos(on('mtor')).some((t) => /CMV/i.test(t))).toBe(true)
  })

  it('belatacept → contraindicado en EBV-seronegativos', () => {
    expect(titulos(on('belatacept')).some((t) => /EBV-seronegativos/i.test(t))).toBe(true)
  })

  it('sin fármaco → sin recomendaciones por fármaco', () => {
    expect(recsFarmacos({}).length).toBe(0)
  })

  it('integración: el fármaco dispara recomendaciones aunque NO haya huésped declarado', () => {
    const recs = recomendaciones({ v: on('anticd20'), nowMs: 0 })
    expect(recs.some((r) => /hepatitis B/i.test(r.titulo))).toBe(true)
  })

  it('integración: sin huésped y sin fármaco ni resultados → vacío (no ruido)', () => {
    expect(recomendaciones({ v: { hc_motivo: 'otro' }, nowMs: 0 })).toHaveLength(0)
  })
})
