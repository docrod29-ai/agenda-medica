import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tokens firmados para el Portal del Paciente (magic-link sin contraseña).
 *
 * Formato: base64url(payload).base64url(hmacSHA256(payload))
 * payload = { c: clinicId, p: patientId, e: expEpochSegundos }
 *
 * El token va atado a UN paciente de UNA clínica y caduca. La API verifica
 * la firma y nunca devuelve/modifica datos de otro paciente.
 *
 * SOLO servidor (usa node:crypto). No importar desde componentes cliente.
 */

const DIAS_DEFECTO = 30

interface PayloadPaciente {
  c: string // clinicId
  p: string // patientId
  e: number // exp epoch (segundos)
}

function getSecret(): string {
  const s = process.env.PORTAL_PACIENTE_SECRET
  if (s && s.length >= 16) return s
  // Fallback SOLO para desarrollo local. En producción es obligatoria.
  if (process.env.NODE_ENV !== 'production') {
    return 'dev-portal-secret-no-usar-en-produccion-0123456789'
  }
  throw new Error('PORTAL_PACIENTE_SECRET no configurada')
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function firmar(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
}

/** Crea un token firmado para un paciente. ttlDias por defecto 30. */
export function crearTokenPaciente(clinicId: string, patientId: string, ttlDias = DIAS_DEFECTO): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDias * 86400
  const payload: PayloadPaciente = { c: clinicId, p: patientId, e: exp }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${firmar(payloadB64)}`
}

export interface TokenVerificado {
  clinicId: string
  patientId: string
}

/** Verifica firma + caducidad. Devuelve null si es inválido o expiró. */
export function verificarTokenPaciente(token: string | undefined | null): TokenVerificado | null {
  if (!token || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const [payloadB64, firmaRecibida] = partes

  // Comparación en tiempo constante
  const esperada = firmar(payloadB64)
  const a = Buffer.from(firmaRecibida)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: PayloadPaciente
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload.c || !payload.p || !payload.e) return null
  if (Math.floor(Date.now() / 1000) > payload.e) return null // expirado

  return { clinicId: payload.c, patientId: payload.p }
}

/** URL absoluta del portal para enviar por WhatsApp. */
export function linkPortalPaciente(baseUrl: string, clinicId: string, patientId: string, ttlDias = DIAS_DEFECTO): string {
  const token = crearTokenPaciente(clinicId, patientId, ttlDias)
  return `${baseUrl.replace(/\/$/, '')}/mi/${token}`
}
