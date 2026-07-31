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
  PhoneAuthProvider, getMultiFactorResolver,
  type User, type MultiFactorError, type MultiFactorResolver,
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

/**
 * LOGIN con MFA: cuando el primer factor (correo/Google) sale bien pero la cuenta
 * tiene un 2º factor, Firebase lanza `auth/multi-factor-auth-required`. Esto obtiene
 * el "resolvedor" con el que se completa el acceso pidiendo el código de 6 dígitos.
 * Devuelve null si el error NO es de MFA (para no confundirlo con otros fallos).
 */
export function obtenerResolverMfa(error: unknown): MultiFactorResolver | null {
  const code = (error as { code?: string })?.code
  if (code !== 'auth/multi-factor-auth-required') return null
  return getMultiFactorResolver(auth, error as MultiFactorError)
}

/** Completa el inicio de sesión resolviendo el 2º factor TOTP con el código de 6 dígitos. */
export async function resolverLoginTotp(resolver: MultiFactorResolver, codigo: string): Promise<void> {
  const factor = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? resolver.hints[0]
  if (!factor) throw new Error('Esta cuenta no tiene un segundo factor TOTP configurado.')
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(factor.uid, codigo.trim())
  await resolver.resolveSignIn(assertion)
}

// Re-export útil
export { multiFactor, PhoneAuthProvider }
export type { MultiFactorResolver }
