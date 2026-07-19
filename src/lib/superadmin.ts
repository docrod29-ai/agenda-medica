/**
 * SUPERADMIN de la plataforma (dueño) — control de suscripciones.
 *
 * Este es el nivel MÁS alto: por encima de cualquier clínica. Solo el/los
 * correo(s) dueño(s) de la plataforma pueden ver el panel `/superadmin`
 * (todos los clientes, quién paga, cuánto, a quién dar pase libre).
 *
 * La lista de dueños sale de la env `SUPERADMIN_EMAILS` (separados por coma).
 * Si no está configurada, cae al dueño conocido para que funcione sin fricción.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import admin from './firebase-admin'

const DEFAULT_OWNER = 'docrod29@gmail.com'

/** Correos con acceso de superadmin (normalizados a minúsculas). */
export function superadminEmails(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? DEFAULT_OWNER
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function esSuperadmin(email?: string | null): boolean {
  if (!email) return false
  return superadminEmails().includes(email.trim().toLowerCase())
}

export interface SuperadminOk { ok: true; uid: string; email: string }
export interface SuperadminErr { ok: false; response: NextResponse }
export type SuperadminAcceso = SuperadminOk | SuperadminErr

/**
 * Verifica que el solicitante sea DUEÑO de la plataforma (ID-token válido +
 * correo en la lista). Úsalo al inicio de toda ruta `/api/superadmin/*`.
 */
export async function verificarSuperadmin(req: NextRequest): Promise<SuperadminAcceso> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) }
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7).trim())
    // El correo NO basta: hay que haber demostrado que es tuyo.
    //
    // Hallazgo de la auditoría: el alta es autoservicio con contraseña y no exige
    // verificar el correo. Hoy no es explotable porque el único superadmin ya tiene
    // cuenta y Firebase no deja registrar un correo existente. Pero en cuanto se
    // añada un correo NUEVO a SUPERADMIN_EMAILS (p. ej. soporte@), cualquiera puede
    // ir a /registro, darse de alta con esa dirección y quedarse con la consola de
    // la plataforma entera sin recibir un solo correo. Es una trampa armada
    // esperando un cambio de configuración rutinario.
    if (!decoded.email_verified) {
      return { ok: false, response: NextResponse.json({ ok: false, error: 'Verifica tu correo antes de entrar a la consola del dueño' }, { status: 403 }) }
    }
    if (!esSuperadmin(decoded.email)) {
      return { ok: false, response: NextResponse.json({ ok: false, error: 'Acceso restringido al dueño de la plataforma' }, { status: 403 }) }
    }
    return { ok: true, uid: decoded.uid, email: decoded.email! }
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 }) }
  }
}

/** Precio mensual (MXN) por plan — para estimar MRR. El cobro real lo hace Stripe;
 *  el ingreso REGISTRADO se calcula de `platform_payments` (webhook). */
export const PRECIO_PLAN_MXN: Record<string, number> = {
  trial: 0,
  cortesia: 0,
  basico: 699,
  pro: 999,
  clinica: 1799,
}

export const PLAN_LABEL: Record<string, string> = {
  trial: 'Prueba',
  cortesia: 'Pase libre',
  basico: 'Básico',
  pro: 'Pro',
  clinica: 'Clínica',
}

export const ESTADO_LABEL: Record<string, string> = {
  active: 'Activa',
  trial: 'En prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  past_due: 'Pago vencido',
}
