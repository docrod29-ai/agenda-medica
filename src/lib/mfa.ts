'use client'
/**
 * MFA (Multi-Factor Authentication) usando Firebase Auth Identity Platform.
 *
 * Implementa el segundo factor por TOTP (apps como Google Authenticator, Authy, 1Password).
 * Recomendado para roles médicos por mejor práctica + LFPDPPP Art. 19 (medidas de seguridad).
 *
 * Nota: el proyecto Firebase debe estar en Identity Platform (no Firebase Auth legacy).
 * Si no lo está, las funciones lanzan un error explicativo.
 */

import {
  multiFactor, TotpMultiFactorGenerator, TotpSecret,
  PhoneAuthProvider, type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export interface TotpEnrollResult {
  secret: TotpSecret
  qrCodeUrl: string       // otpauth:// URL para scan
  manualKey: string       // clave en base32 para pegado manual
}

/** Inicia el enrolamiento TOTP. Devuelve el secret + QR para que el usuario lo escanee. */
export async function iniciarEnrolamientoTotp(displayName = 'Agenda Médica'): Promise<TotpEnrollResult> {
  const user = auth.currentUser
  if (!user) throw new Error('No hay sesión activa')

  // Generar nuevo secret TOTP
  const session = await multiFactor(user).getSession()
  const totpSecret = await TotpMultiFactorGenerator.generateSecret(session)

  const qrCodeUrl = totpSecret.generateQrCodeUrl(user.email ?? 'medico', displayName)
  return {
    secret: totpSecret,
    qrCodeUrl,
    manualKey: totpSecret.secretKey,
  }
}

/** Completa el enrolamiento verificando el código TOTP ingresado por el usuario. */
export async function completarEnrolamientoTotp(secret: TotpSecret, codigo: string, alias = 'Llave TOTP'): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('No hay sesión activa')

  const credential = TotpMultiFactorGenerator.assertionForEnrollment(secret, codigo)
  await multiFactor(user).enroll(credential, alias)
}

/** Lista los factores MFA enrolados del usuario. */
export function listarFactores(user: User | null) {
  if (!user) return []
  return multiFactor(user).enrolledFactors
}

/** Desactiva un factor MFA por su uid */
export async function desactivarFactor(factorUid: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('No hay sesión activa')
  await multiFactor(user).unenroll(factorUid)
}

// Re-export útil
export { multiFactor, PhoneAuthProvider }
