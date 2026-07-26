/**
 * Token firmado para el proxy del formato de receta (/api/receta/diseno) —
 * NEXUS-QUALITY-010.
 *
 * Problema: el proxy sirve membrete/firma/sello tras un GET sin sesión (una
 * <img src> no manda Authorization). Las rutas llevan el uid (28 chars
 * aleatorios), así que no son enumerables, pero una URL FILTRADA (PDF
 * compartido, historial, caché) daba acceso indefinido.
 *
 * Diseño: HMAC-SHA256 sobre `path|exp` con secreto server-side. La URL firmada
 * lleva `&exp=<epoch-segundos>&sig=<hex>` y caduca. El proxy:
 *   - si vienen exp+sig → los VERIFICA SIEMPRE (una firma inválida/vencida se
 *     rechaza aunque el modo estricto esté apagado; nunca degrada a "sin firma").
 *   - si NO vienen → se acepta solo mientras RECETA_DISENO_FIRMA !== 'obligatoria'
 *     (compatibilidad con las URLs guardadas en la config de los médicos).
 *
 * DESPLIEGUE EN DOS PASOS a propósito: primero se acuñan URLs firmadas en el
 * camino de impresión y se PRUEBA la papelería real; solo entonces se pone
 * RECETA_DISENO_FIRMA=obligatoria en Vercel. Así el candado nunca rompe una
 * receta a mitad de consulta.
 *
 * Secreto: RECETA_DISENO_SECRET, con fallback a PORTAL_PACIENTE_SECRET (ya
 * existe en Vercel) para no exigir configuración nueva.
 */
import { createHmac, timingSafeEqual } from 'crypto'

const secreto = (): string =>
  process.env.RECETA_DISENO_SECRET || process.env.PORTAL_PACIENTE_SECRET || ''

/** Vida por defecto de una URL firmada: 24 h (cubre la jornada de impresión). */
export const DISENO_TOKEN_TTL_S = 24 * 60 * 60

const hmac = (path: string, exp: number, sec: string): string =>
  createHmac('sha256', sec).update(`${path}|${exp}`).digest('hex')

/** Firma un path del bucket. Devuelve null si no hay secreto configurado. */
export function firmarPathDiseno(path: string, ahoraMs: number, ttlS: number = DISENO_TOKEN_TTL_S): { exp: number; sig: string } | null {
  const sec = secreto()
  if (!sec || !path) return null
  const exp = Math.floor(ahoraMs / 1000) + ttlS
  return { exp, sig: hmac(path, exp, sec) }
}

export type VerificacionDiseno = 'valida' | 'invalida' | 'vencida' | 'sin_firma' | 'sin_secreto'

/** Verifica exp+sig contra el path. NUNCA lanza. */
export function verificarPathDiseno(path: string, expRaw: string | null, sigRaw: string | null, ahoraMs: number): VerificacionDiseno {
  if (!expRaw && !sigRaw) return 'sin_firma'
  const sec = secreto()
  if (!sec) return 'sin_secreto'
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || !sigRaw) return 'invalida'
  if (exp * 1000 < ahoraMs) return 'vencida'
  const esperado = hmac(path, exp, sec)
  try {
    const a = Buffer.from(esperado, 'hex')
    const b = Buffer.from(String(sigRaw), 'hex')
    if (a.length !== b.length || a.length === 0) return 'invalida'
    return timingSafeEqual(a, b) ? 'valida' : 'invalida'
  } catch {
    return 'invalida'
  }
}

/** ¿El modo estricto está activo? (URLs sin firma se rechazan). */
export const firmaObligatoria = (): boolean => process.env.RECETA_DISENO_FIRMA === 'obligatoria'
