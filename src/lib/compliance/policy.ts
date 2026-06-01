/**
 * Capa de política: dado un perfil de país, responde preguntas concretas.
 *
 * Diseñada para que la UI/lógica consuma decisiones (¿requiero consentimiento?
 * ¿puedo borrar?) sin tener que entender la norma directamente.
 */
import { CountryProfile, PolicyValue, getCountryProfile, CountryCode } from './country-profiles'

export type Decision = 'allowed' | 'denied' | 'requires_review'

function asDecision<T>(v: PolicyValue<T>, isTrue: (x: T) => boolean): Decision {
  if (v === 'requires_legal_review') return 'requires_review'
  return isTrue(v as T) ? 'allowed' : 'denied'
}

export function requireVoiceConsent(profile: CountryProfile): boolean {
  return profile.voiceRecordingConsentRequired === true
}

export function requireTelemedicineConsent(profile: CountryProfile): boolean {
  return profile.telemedicineConsentRequired === true
}

export function requireInformedConsent(profile: CountryProfile): boolean {
  return profile.informedConsentRequired === true
}

export function requirePrivacyNotice(profile: CountryProfile): boolean {
  return profile.privacyNoticeRequired === true
}

export function canStoreInCloud(profile: CountryProfile): Decision {
  return asDecision(profile.cloudStorageAllowed, v => v === true)
}

export function canTransferCrossBorder(profile: CountryProfile): Decision {
  return asDecision(profile.crossBorderTransferAllowed, v => v === true)
}

export function minimumEhrRetentionYears(profile: CountryProfile): PolicyValue<number> {
  return profile.ehrRetentionYears
}

export function dueRetentionReached(profile: CountryProfile, fechaCreacion: string): boolean {
  const ret = profile.ehrRetentionYears
  if (ret === 'requires_legal_review') return false
  const created = new Date(fechaCreacion).getTime()
  const now = Date.now()
  const yearsMs = (ret as number) * 365.25 * 24 * 60 * 60 * 1000
  return (now - created) >= yearsMs
}

/** Resumen ejecutivo para la UI de configuración de la clínica. */
export function getComplianceSummary(code: CountryCode): {
  country: string
  consents: { privacy: boolean; informed: boolean; tele: boolean; voice: boolean; export: boolean }
  retentionYears: PolicyValue<number>
  cloud: Decision
  crossBorder: Decision
  audit: boolean
  authority: string
  references: string[]
  needsReview: boolean
  lastReviewed: string | null
} {
  const p = getCountryProfile(code)
  return {
    country: p.countryName,
    consents: {
      privacy: p.privacyNoticeRequired,
      informed: p.informedConsentRequired,
      tele: p.telemedicineConsentRequired,
      voice: p.voiceRecordingConsentRequired,
      export: p.dataExportConsentRequired,
    },
    retentionYears: p.ehrRetentionYears,
    cloud: canStoreInCloud(p),
    crossBorder: canTransferCrossBorder(p),
    audit: p.auditLogRequired,
    authority: `${p.healthEhrAuthority} · ${p.dataProtectionAuthority}`,
    references: p.regulatoryReferences,
    needsReview: p.needsLegalReview,
    lastReviewed: p.lastReviewedDate,
  }
}

export { getCountryProfile }
