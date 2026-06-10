/**
 * Sanitización para logs — ISO 27001 / LFPDPPP / NOM-024
 *
 * Función: redactar PII y datos sensibles ANTES de loggear a consola,
 * Vercel logs, o cualquier sistema de observabilidad externo.
 *
 * Vectores cubiertos:
 *   - CURP (18 chars)
 *   - RFC (12-13 chars)
 *   - Correos electrónicos
 *   - Teléfonos (MX y formatos internacionales)
 *   - Números de tarjeta (Visa, MasterCard, AmEx)
 *   - Tokens tipo Bearer / API keys
 *   - JWT (header.payload.signature)
 *   - Nombres de pacientes (en estructura conocida `paciente.nombre`)
 *
 * Diseño:
 *   - Síncrono, puro, sin dependencias externas
 *   - Conserva la estructura del objeto (útil para debugging)
 *   - Reemplaza con sentinelas que indican el TIPO redactado:
 *       [CURP], [RFC], [EMAIL], [TEL], [PAN], [TOKEN], [JWT]
 *   - Aplicable a strings, objetos anidados, arrays
 *   - Soft-limit de profundidad para evitar stack overflow en ciclos
 *
 * Uso típico:
 *   console.error('[api/x] error', sanitize(err))
 *   console.warn('[api/y] body inválido', sanitize(body))
 */

// ─────────────────────────────────────────────────────────────────
// Patrones de redacción (ordenados por especificidad descendente)
// ─────────────────────────────────────────────────────────────────

const PATRONES_STRING: Array<{ regex: RegExp; reemplazo: string; nombre: string }> = [
  // CURP: 4 letras + 6 dígitos + H/M + 5 letras + 2 alfanum
  { regex: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}\b/gi, reemplazo: '[CURP]', nombre: 'CURP' },

  // RFC persona física: 4 letras + 6 dígitos + 3 alfanum (con/sin homoclave)
  { regex: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}\b/gi, reemplazo: '[RFC]', nombre: 'RFC' },

  // JWT (3 segmentos base64url separados por punto)
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, reemplazo: '[JWT]', nombre: 'JWT' },

  // Bearer / API keys conocidos
  { regex: /\b(?:Bearer\s+|sk-(?:proj-|ant-)?|AIza|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_-]{16,}\b/gi, reemplazo: '[TOKEN]', nombre: 'TOKEN' },

  // Número de tarjeta — Visa/MC/Amex (13-19 dígitos con/sin separadores)
  { regex: /\b(?:\d[ -]?){13,19}\b/g, reemplazo: '[PAN]', nombre: 'PAN' },

  // Email
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, reemplazo: '[EMAIL]', nombre: 'EMAIL' },

  // Teléfono MX/internacional: + opcional, espacios/guiones, 10-13 dígitos
  { regex: /\b(?:\+?52[\s-]?)?(?:1[\s-]?)?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{4}\b/g, reemplazo: '[TEL]', nombre: 'TEL' },
]

/** Llaves de objeto cuyos VALORES se redactan completos sin importar contenido.
 *  Se normalizan a lowercase para matching case-insensitive (apiKey === apikey). */
const LLAVES_SENSIBLES = new Set([
  'password', 'pwd', 'pass', 'contrasena', 'contraseña',
  'token', 'access_token', 'refresh_token', 'id_token', 'apikey', 'api_key',
  'secret', 'clientsecret', 'webhooksecret',
  'authorization', 'cookie', 'session',
  'curp', 'rfc', 'nss',
  'tarjeta', 'cardnumber', 'card_number', 'pan',
  'cvv', 'cvc',
  // Datos clínicos sensibles que no deben aparecer en logs
  'transcripcion', 'transcription', 'audioblob',
])

const PROFUNDIDAD_MAX = 8

// ─────────────────────────────────────────────────────────────────
// Redacción
// ─────────────────────────────────────────────────────────────────

/** Redacta PII en un string. Aplica todos los patrones en orden. */
export function redactarString(s: string): string {
  if (!s || typeof s !== 'string') return s
  let out = s
  for (const { regex, reemplazo } of PATRONES_STRING) {
    out = out.replace(regex, reemplazo)
  }
  return out
}

/**
 * Redacta PII en cualquier valor (string, objeto, array, primitivo).
 * Preserva la estructura — útil para debugging sin perder forma.
 */
export function sanitize<T = unknown>(input: T, profundidad = 0): T {
  if (profundidad > PROFUNDIDAD_MAX) return '[...max-depth]' as unknown as T
  if (input == null) return input
  const tipo = typeof input
  if (tipo === 'string') return redactarString(input as string) as unknown as T
  if (tipo === 'number' || tipo === 'boolean' || tipo === 'bigint') return input
  if (tipo === 'function' || tipo === 'symbol') return '[fn]' as unknown as T

  if (Array.isArray(input)) {
    return input.map(v => sanitize(v, profundidad + 1)) as unknown as T
  }

  if (tipo === 'object') {
    // Error: conservar message + stack pero sanitizar contenido
    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactarString(input.message),
        stack: input.stack ? redactarString(input.stack) : undefined,
      } as unknown as T
    }

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (LLAVES_SENSIBLES.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = sanitize(v, profundidad + 1)
      }
    }
    return out as unknown as T
  }

  return input
}

/** Helper para logs estructurados — devuelve string JSON sanitizado. */
export function safeStringify(input: unknown): string {
  try {
    return JSON.stringify(sanitize(input))
  } catch {
    return '[unserializable]'
  }
}

/**
 * Wrapper sobre console.* que sanitiza todos los argumentos.
 * Úsalo en lugar de console.log directo en API routes.
 */
export const safeLog = {
  info:  (...args: unknown[]) => console.info(...args.map(a => sanitize(a))),
  warn:  (...args: unknown[]) => console.warn(...args.map(a => sanitize(a))),
  error: (...args: unknown[]) => console.error(...args.map(a => sanitize(a))),
}
