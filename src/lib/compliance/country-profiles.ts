/**
 * Configuración normativa por país (LATAM).
 *
 * Esta capa permite operar la app en distintos países sin reescribir lógica.
 * Cada perfil define qué consentimientos son requeridos, política de
 * conservación del expediente, almacenamiento, transferencia, etc.
 *
 * IMPORTANTE: La información jurídica aquí declarada es una BASE DE PARTIDA
 * para implementación técnica. Cada país requiere validación legal local
 * antes de uso en producción. Cuando el campo es `null` significa
 * "no confirmado — requiere revisión legal local".
 */

export type CountryCode =
  | 'MX' | 'CO' | 'AR' | 'CL' | 'PE' | 'BR' | 'UY' | 'PY' | 'BO'
  | 'EC' | 'CR' | 'PA' | 'GT' | 'HN' | 'SV' | 'NI' | 'DO' | 'VE'

export type PolicyValue<T> = T | 'requires_legal_review'

export interface CountryProfile {
  countryCode: CountryCode
  countryName: string
  currency: string                                  // ISO 4217
  defaultTimezone: string                           // IANA TZ
  defaultLanguage: 'es' | 'pt'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

  // Consentimientos requeridos
  privacyNoticeRequired: boolean                    // Aviso de privacidad
  informedConsentRequired: boolean                  // Consentimiento informado clínico
  telemedicineConsentRequired: boolean              // Consentimiento de teleconsulta
  voiceRecordingConsentRequired: boolean            // Grabación de audio en consulta
  dataExportConsentRequired: boolean                // Exportar expediente del paciente

  // Conservación del expediente
  ehrRetentionYears: PolicyValue<number>            // años mínimos requeridos
  // Firma electrónica/digital
  electronicSignatureRequired: PolicyValue<boolean>
  digitalSignatureRequired: PolicyValue<boolean>    // firma con certificado vs simple

  // Receta
  electronicPrescriptionAllowed: PolicyValue<boolean>
  prescriptionRetentionYears: PolicyValue<number>

  // Almacenamiento y transferencia
  cloudStorageAllowed: PolicyValue<boolean>
  crossBorderTransferAllowed: PolicyValue<boolean>
  crossBorderTransferRequiresConsent: PolicyValue<boolean>

  // Derechos del titular
  patientDataAccessRight: boolean                   // derecho de acceso
  patientDataCorrectionRight: boolean
  patientDataDeletionRight: PolicyValue<boolean>    // varía: salud queda como excepción
  breachNotificationRequired: PolicyValue<boolean>
  breachNotificationDeadlineDays: PolicyValue<number>

  // Auditoría / acceso
  auditLogRequired: boolean
  auditLogRetentionYears: PolicyValue<number>

  // Voz/IA
  voiceRecordingAuditRequired: boolean              // bitácora de grabaciones
  aiInHealthcareRegulation: PolicyValue<boolean>    // ¿norma específica IA en salud?

  // Autoridad
  dataProtectionAuthority: string                   // nombre de la autoridad
  healthEhrAuthority: string                        // autoridad sanitaria

  // Referencias
  regulatoryReferences: string[]                    // nombres de normas/leyes
  lastReviewedDate: string | null                   // ISO date
  needsLegalReview: boolean                         // SIEMPRE recordar revisión local
  notes?: string
}

// ─────────────────────────────────────────────────────────────
// PERFILES POR PAÍS
// ─────────────────────────────────────────────────────────────

const MX: CountryProfile = {
  countryCode: 'MX', countryName: 'México', currency: 'MXN',
  defaultTimezone: 'America/Mexico_City', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,                  // LFPDPPP
  informedConsentRequired: true,                // NOM-004
  telemedicineConsentRequired: true,
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 5,                         // NOM-004 mínimo
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: true,
  prescriptionRetentionYears: 2,
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review', // salud tiene excepción
  breachNotificationRequired: true,
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,                       // NOM-024
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'INAI',
  healthEhrAuthority: 'Secretaría de Salud',
  regulatoryReferences: [
    'NOM-004-SSA3-2012 (Expediente Clínico)',
    'NOM-024-SSA3-2012 (Sistemas de información de registros electrónicos para la salud)',
    'LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares)',
    'LFPDPPSO (Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados)',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const CO: CountryProfile = {
  countryCode: 'CO', countryName: 'Colombia', currency: 'COP',
  defaultTimezone: 'America/Bogota', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,                  // Ley 1581 / Decreto 1377
  informedConsentRequired: true,                // Resolución 1995 (historia clínica)
  telemedicineConsentRequired: true,            // Resolución 2654/2019, Ley 2015/2020 HCEU
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 'requires_legal_review',   // ver Resolución 1995
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: true,
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: true,
  breachNotificationDeadlineDays: 15,           // SIC
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'SIC (Superintendencia de Industria y Comercio)',
  healthEhrAuthority: 'MinSalud',
  regulatoryReferences: [
    'Ley 1581 de 2012 (Protección de Datos)',
    'Decreto 1377 de 2013',
    'Resolución 1995 de 1999 (Historia Clínica)',
    'Resolución 2654 de 2019 (Telesalud)',
    'Ley 2015 de 2020 (Historia Clínica Electrónica Única)',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const AR: CountryProfile = {
  countryCode: 'AR', countryName: 'Argentina', currency: 'ARS',
  defaultTimezone: 'America/Argentina/Buenos_Aires', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,                  // Ley 25.326
  informedConsentRequired: true,                // Ley 26.529 (Derechos del Paciente)
  telemedicineConsentRequired: true,
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 10,                        // Ley 26.529 art. 18
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review', // Ley 25.506
  electronicPrescriptionAllowed: true,          // Ley 27.553
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: 'requires_legal_review',
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'AAIP (Agencia de Acceso a la Información Pública)',
  healthEhrAuthority: 'Ministerio de Salud',
  regulatoryReferences: [
    'Ley 25.326 (Protección de Datos Personales)',
    'Ley 26.529 (Derechos del Paciente, Historia Clínica)',
    'Ley 27.553 (Recetas y Tele-asistencia electrónica)',
    'Ley 25.506 (Firma Digital)',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const CL: CountryProfile = {
  countryCode: 'CL', countryName: 'Chile', currency: 'CLP',
  defaultTimezone: 'America/Santiago', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,                  // Ley 19.628 (en reforma a 2024)
  informedConsentRequired: true,                // Ley 20.584 derechos y deberes del paciente
  telemedicineConsentRequired: true,
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 'requires_legal_review',
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: true,
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: 'requires_legal_review',
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: 'requires_legal_review',
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'Agencia de Protección de Datos (en implementación)',
  healthEhrAuthority: 'MINSAL',
  regulatoryReferences: [
    'Ley 19.628 (Vida Privada)',
    'Ley 20.584 (Derechos y Deberes del Paciente)',
    'Norma Técnica MINSAL sobre ficha clínica',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const PE: CountryProfile = {
  countryCode: 'PE', countryName: 'Perú', currency: 'PEN',
  defaultTimezone: 'America/Lima', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,
  informedConsentRequired: true,
  telemedicineConsentRequired: true,
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 'requires_legal_review',
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: 'requires_legal_review',
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: 'requires_legal_review',
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'ANPD (Autoridad Nacional de Protección de Datos)',
  healthEhrAuthority: 'MINSA',
  regulatoryReferences: [
    'Ley 29733 (Protección de Datos)',
    'Ley 30024 (Registro Nacional de Historias Clínicas Electrónicas)',
    'Decreto Supremo 009-2017-SA',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const BR: CountryProfile = {
  countryCode: 'BR', countryName: 'Brasil', currency: 'BRL',
  defaultTimezone: 'America/Sao_Paulo', defaultLanguage: 'pt', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,                  // LGPD
  informedConsentRequired: true,
  telemedicineConsentRequired: true,            // Resolução CFM 2.314/2022
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 20,                        // CFM 1.821/2007 (mínimo histórico)
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: true,
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: true,
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'ANPD',
  healthEhrAuthority: 'CFM / Ministério da Saúde',
  regulatoryReferences: [
    'LGPD (Lei 13.709/2018)',
    'Resolução CFM 1.821/2007 (Manuseio do prontuário eletrônico)',
    'Resolução CFM 2.314/2022 (Telemedicina)',
    'Lei 14.510/2022 (Telessaúde)',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

const UY: CountryProfile = {
  countryCode: 'UY', countryName: 'Uruguay', currency: 'UYU',
  defaultTimezone: 'America/Montevideo', defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
  privacyNoticeRequired: true,
  informedConsentRequired: true,
  telemedicineConsentRequired: true,
  voiceRecordingConsentRequired: true,
  dataExportConsentRequired: true,
  ehrRetentionYears: 'requires_legal_review',
  electronicSignatureRequired: 'requires_legal_review',
  digitalSignatureRequired: 'requires_legal_review',
  electronicPrescriptionAllowed: 'requires_legal_review',
  prescriptionRetentionYears: 'requires_legal_review',
  cloudStorageAllowed: true,
  crossBorderTransferAllowed: 'requires_legal_review',
  crossBorderTransferRequiresConsent: true,
  patientDataAccessRight: true,
  patientDataCorrectionRight: true,
  patientDataDeletionRight: 'requires_legal_review',
  breachNotificationRequired: 'requires_legal_review',
  breachNotificationDeadlineDays: 'requires_legal_review',
  auditLogRequired: true,
  auditLogRetentionYears: 'requires_legal_review',
  voiceRecordingAuditRequired: true,
  aiInHealthcareRegulation: false,
  dataProtectionAuthority: 'URCDP',
  healthEhrAuthority: 'MSP',
  regulatoryReferences: [
    'Ley 18.331 (Protección de Datos)',
    'Decreto 396/003 / Historia Clínica Electrónica Nacional',
  ],
  lastReviewedDate: '2026-05-26',
  needsLegalReview: true,
}

/** Plantilla genérica para países con menor cobertura informativa. */
function placeholderProfile(code: CountryCode, name: string, currency: string, tz: string): CountryProfile {
  return {
    countryCode: code, countryName: name, currency,
    defaultTimezone: tz, defaultLanguage: 'es', dateFormat: 'DD/MM/YYYY',
    privacyNoticeRequired: true, informedConsentRequired: true,
    telemedicineConsentRequired: true, voiceRecordingConsentRequired: true,
    dataExportConsentRequired: true,
    ehrRetentionYears: 'requires_legal_review',
    electronicSignatureRequired: 'requires_legal_review',
    digitalSignatureRequired: 'requires_legal_review',
    electronicPrescriptionAllowed: 'requires_legal_review',
    prescriptionRetentionYears: 'requires_legal_review',
    cloudStorageAllowed: 'requires_legal_review',
    crossBorderTransferAllowed: 'requires_legal_review',
    crossBorderTransferRequiresConsent: 'requires_legal_review',
    patientDataAccessRight: true, patientDataCorrectionRight: true,
    patientDataDeletionRight: 'requires_legal_review',
    breachNotificationRequired: 'requires_legal_review',
    breachNotificationDeadlineDays: 'requires_legal_review',
    auditLogRequired: true,
    auditLogRetentionYears: 'requires_legal_review',
    voiceRecordingAuditRequired: true,
    aiInHealthcareRegulation: false,
    dataProtectionAuthority: 'Por confirmar',
    healthEhrAuthority: 'Por confirmar',
    regulatoryReferences: ['Información no confirmada; requiere revisión legal local'],
    lastReviewedDate: null,
    needsLegalReview: true,
    notes: 'Perfil base para activación rápida. Revisión legal local OBLIGATORIA antes de producción.',
  }
}

export const COUNTRY_PROFILES: Record<CountryCode, CountryProfile> = {
  MX, CO, AR, CL, PE, BR, UY,
  PY: placeholderProfile('PY', 'Paraguay', 'PYG', 'America/Asuncion'),
  BO: placeholderProfile('BO', 'Bolivia', 'BOB', 'America/La_Paz'),
  EC: placeholderProfile('EC', 'Ecuador', 'USD', 'America/Guayaquil'),
  CR: placeholderProfile('CR', 'Costa Rica', 'CRC', 'America/Costa_Rica'),
  PA: placeholderProfile('PA', 'Panamá', 'PAB', 'America/Panama'),
  GT: placeholderProfile('GT', 'Guatemala', 'GTQ', 'America/Guatemala'),
  HN: placeholderProfile('HN', 'Honduras', 'HNL', 'America/Tegucigalpa'),
  SV: placeholderProfile('SV', 'El Salvador', 'USD', 'America/El_Salvador'),
  NI: placeholderProfile('NI', 'Nicaragua', 'NIO', 'America/Managua'),
  DO: placeholderProfile('DO', 'República Dominicana', 'DOP', 'America/Santo_Domingo'),
  VE: placeholderProfile('VE', 'Venezuela', 'VES', 'America/Caracas'),
}

export function getCountryProfile(code: CountryCode): CountryProfile {
  return COUNTRY_PROFILES[code] ?? COUNTRY_PROFILES.MX
}

export function listCountries(): Array<{ code: CountryCode; name: string }> {
  return Object.values(COUNTRY_PROFILES).map(p => ({ code: p.countryCode, name: p.countryName }))
}
