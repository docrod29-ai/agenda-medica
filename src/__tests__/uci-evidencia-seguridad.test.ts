/**
 * nexusmed-icu-018 (evidencia) + icu-012 (seguridad)
 * La evidencia está bien anclada y las alertas están citadas y jerarquizadas.
 */
import { describe, it, expect } from 'vitest'
import { REGLAS_UCI, FUENTES, evidenciaDe, citarFuente, reglasDe } from '@/lib/uci/evidencia'
import { analizarSeguridadUCI, aptoMovilizacion } from '@/lib/uci/seguridad'

describe('Motor de evidencia citada', () => {
  it('toda regla apunta a una fuente REAL existente', () => {
    for (const r of REGLAS_UCI) {
      expect(FUENTES[r.fuenteId], `fuente de ${r.ruleId}`).toBeTruthy()
      expect(Array.isArray(r.limitaciones)).toBe(true)
    }
  })
  it('evidenciaDe devuelve regla + fuente (metas de PAM séptica = ESICM 2025)', () => {
    const ev = evidenciaDe('map.septico')
    expect(ev?.regla.umbral).toMatch(/65/)
    expect(ev?.fuente.organizacion).toBe('ESICM')
    expect(ev?.fuente.anio).toBe(2025)
  })
  it('cita legible y filtro por dominio', () => {
    expect(citarFuente(FUENTES.mcclave2016)).toMatch(/SCCM\/ASPEN/)
    expect(reglasDe('pocus').length).toBeGreaterThan(3)
    expect(reglasDe('hemodinamia').length).toBeGreaterThan(3)
  })
  it('los DOIs presentes son de POCUS 2026 (no se inventan PMIDs)', () => {
    expect(FUENTES.pocusRowe2026.doi).toContain('10.1097')
    expect(FUENTES.esicm2025.pmid).toBeUndefined()  // no se fabrica PMID
  })
})

describe('Motor de seguridad — alertas jerarquizadas y citadas', () => {
  it('ordena por severidad y marca crítico el pH < 7.20', () => {
    const al = analizarSeguridadUCI({ ph: 7.1, glucosa: 190, pam: 60 })
    expect(al[0].nivel).toBe('critica')
    expect(al[0].parametro).toBe('pH')
    expect(al[0].fuenteId).toBe('esicm2025')
  })
  it('hipoglucemia crítica; glucosa 190 solo moderada', () => {
    expect(analizarSeguridadUCI({ glucosa: 55 })[0].nivel).toBe('critica')
    const m = analizarSeguridadUCI({ glucosa: 190 })
    expect(m[0].nivel).toBe('moderada')
    expect(m[0].fuenteId).toBe('mcclave2016')
  })
  it('potasio crítico, Pplat alta y dosis sin unidad', () => {
    expect(analizarSeguridadUCI({ potasio: 6.8 }).some(x => x.nivel === 'critica' && x.parametro === 'potasio')).toBe(true)
    expect(analizarSeguridadUCI({ pplat: 34 }).some(x => x.parametro === 'Pplateau' && x.nivel === 'alta')).toBe(true)
    expect(analizarSeguridadUCI({ dosisSinUnidad: true })[0].parametro).toBe('dosis')
  })
  it('sin anomalías → sin alertas', () => {
    expect(analizarSeguridadUCI({ ph: 7.4, glucosa: 120, pam: 75, spo2: 96 })).toHaveLength(0)
  })
  it('cambio de sodio > 10 alerta', () => {
    expect(analizarSeguridadUCI({ sodio: 145, sodioPrevio: 132 }).some(x => x.parametro === 'sodio')).toBe(true)
  })
})

describe('Apto para movilización (tabla PADIS/AHA)', () => {
  it('en rango → apto', () => {
    const r = aptoMovilizacion({ fc: 90, pas: 120, pam: 75, fr: 18, spo2: 95, fio2: 0.4, peep: 6 })
    expect(r.apto).toBe(true)
    expect(r.faltan).toHaveLength(0)
  })
  it('fuera de rango → lista los criterios que faltan', () => {
    const r = aptoMovilizacion({ fc: 140, pas: 120, pam: 55, fr: 18, spo2: 84, fio2: 0.7, peep: 12 })
    expect(r.apto).toBe(false)
    expect(r.faltan).toEqual(expect.arrayContaining(['FC 60–130 lpm', 'PAM 60–100 mmHg', 'SpO2 ≥ 88%', 'FiO2 < 0.6', 'PEEP < 10 cmH2O']))
  })
})
