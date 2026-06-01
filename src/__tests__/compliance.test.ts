import { describe, it, expect } from 'vitest'
import {
  COUNTRY_PROFILES, getCountryProfile, listCountries,
} from '@/lib/compliance/country-profiles'
import {
  requireVoiceConsent, requireInformedConsent, requireTelemedicineConsent,
  requirePrivacyNotice, canStoreInCloud, getComplianceSummary,
  minimumEhrRetentionYears,
} from '@/lib/compliance/policy'

describe('Country profiles', () => {
  it('cubre los 18 países LATAM requeridos', () => {
    const codes = ['MX','CO','AR','CL','PE','BR','UY','PY','BO','EC','CR','PA','GT','HN','SV','NI','DO','VE']
    for (const c of codes) {
      expect(COUNTRY_PROFILES).toHaveProperty(c)
    }
  })
  it('listCountries devuelve los 18', () => {
    expect(listCountries().length).toBe(18)
  })
  it('MX usa NOM-004 y NOM-024 como referencia', () => {
    const mx = getCountryProfile('MX')
    expect(mx.regulatoryReferences.some(r => r.includes('NOM-004'))).toBe(true)
    expect(mx.regulatoryReferences.some(r => r.includes('NOM-024'))).toBe(true)
    expect(mx.ehrRetentionYears).toBe(5)
  })
  it('BR usa LGPD y CFM como referencia', () => {
    const br = getCountryProfile('BR')
    expect(br.regulatoryReferences.some(r => r.includes('LGPD'))).toBe(true)
    expect(br.regulatoryReferences.some(r => r.includes('CFM'))).toBe(true)
  })
  it('CO usa Ley 1581 y Resolución 1995', () => {
    const co = getCountryProfile('CO')
    expect(co.regulatoryReferences.some(r => r.includes('1581'))).toBe(true)
    expect(co.regulatoryReferences.some(r => r.includes('1995'))).toBe(true)
  })
  it('AR usa Ley 26.529 (Derechos del Paciente)', () => {
    const ar = getCountryProfile('AR')
    expect(ar.regulatoryReferences.some(r => r.includes('26.529'))).toBe(true)
    expect(ar.ehrRetentionYears).toBe(10)
  })
  it('países sin perfil específico marcan needsLegalReview=true', () => {
    const ec = getCountryProfile('EC')
    expect(ec.needsLegalReview).toBe(true)
    expect(ec.regulatoryReferences[0]).toMatch(/Información no confirmada/)
  })
  it('TODOS los perfiles requieren revisión legal local por defecto', () => {
    for (const p of Object.values(COUNTRY_PROFILES)) {
      expect(p.needsLegalReview).toBe(true)
    }
  })
})

describe('Policy decisions', () => {
  it('requireVoiceConsent es true en MX, CO, AR, BR (todos los principales)', () => {
    for (const c of ['MX','CO','AR','BR','CL','PE','UY'] as const) {
      expect(requireVoiceConsent(getCountryProfile(c))).toBe(true)
    }
  })
  it('requireInformedConsent es true en todos los perfiles', () => {
    for (const p of Object.values(COUNTRY_PROFILES)) {
      expect(requireInformedConsent(p)).toBe(true)
    }
  })
  it('requirePrivacyNotice es true en todos los perfiles', () => {
    for (const p of Object.values(COUNTRY_PROFILES)) {
      expect(requirePrivacyNotice(p)).toBe(true)
    }
  })
  it('requireTelemedicineConsent es true en todos los perfiles', () => {
    for (const p of Object.values(COUNTRY_PROFILES)) {
      expect(requireTelemedicineConsent(p)).toBe(true)
    }
  })
  it('canStoreInCloud en MX = allowed', () => {
    expect(canStoreInCloud(getCountryProfile('MX'))).toBe('allowed')
  })
  it('canStoreInCloud en perfil placeholder = requires_review', () => {
    expect(canStoreInCloud(getCountryProfile('PY'))).toBe('requires_review')
  })
  it('minimumEhrRetentionYears MX=5, BR=20, AR=10', () => {
    expect(minimumEhrRetentionYears(getCountryProfile('MX'))).toBe(5)
    expect(minimumEhrRetentionYears(getCountryProfile('BR'))).toBe(20)
    expect(minimumEhrRetentionYears(getCountryProfile('AR'))).toBe(10)
  })
})

describe('Compliance summary helper para UI', () => {
  it('MX devuelve resumen con autoridad y referencias', () => {
    const s = getComplianceSummary('MX')
    expect(s.country).toBe('México')
    expect(s.authority).toMatch(/Secretaría de Salud/)
    expect(s.authority).toMatch(/INAI/)
    expect(s.references.length).toBeGreaterThan(0)
    expect(s.consents.privacy).toBe(true)
    expect(s.consents.voice).toBe(true)
    expect(s.needsReview).toBe(true)
  })
})
