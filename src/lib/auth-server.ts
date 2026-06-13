/**
 * Autenticación server-side para API routes — ISO 27001.
 *
 * PROBLEMA QUE RESUELVE: las API routes usan Firebase Admin SDK, que OMITE
 * las firestore.rules. Sin verificar el ID-token del usuario, cualquiera con
 * la URL puede invocarlas (quemar API keys de IA, acceder datos de otra
 * clínica). Estos helpers cierran ese hueco.
 *
 * Dos niveles:
 *  - verificarUsuario(req): exige un ID-token válido de Firebase (usuario
 *    logueado). Suficiente para rutas que NO tocan datos de una clínica
 *    específica (ej. procesar transcripción con IA — solo evita abuso anónimo).
 *  - verificarMiembro(req, clinicId): además exige que el usuario sea miembro
 *    de ESE clinicId (anti cross-tenant). Para rutas que leen/escriben datos
 *    de la clínica.
 *
 * Uso en una route:
 *   const acceso = await verificarUsuario(req)
 *   if (!acceso.ok) return acceso.response   // 401/403 ya armado
 *   // ... acceso.uid disponible
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from './firebase-admin'

export interface AccesoOk {
  ok: true
  uid: string
  email?: string
  clinicId?: string
  role?: string
}
export interface AccesoErr {
  ok: false
  response: NextResponse
}
export type Acceso = AccesoOk | AccesoErr

function err(status: number, mensaje: string): AccesoErr {
  return { ok: false, response: NextResponse.json({ ok: false, error: mensaje }, { status }) }
}

/** Extrae y verifica el ID-token de Firebase del header Authorization. */
async function verificarToken(req: NextRequest): Promise<{ uid: string; email?: string } | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}

/**
 * Exige usuario autenticado (cualquier sesión válida de Firebase).
 * Para rutas que no son cross-tenant pero deben bloquear acceso anónimo
 * (ej. endpoints de IA que consumen API keys de pago).
 */
export async function verificarUsuario(req: NextRequest): Promise<Acceso> {
  const u = await verificarToken(req)
  if (!u) return err(401, 'No autenticado. Inicia sesión nuevamente.')
  return { ok: true, uid: u.uid, email: u.email }
}

/**
 * Exige usuario autenticado Y miembro del clinicId indicado.
 * Para rutas que leen/escriben datos de una clínica específica.
 */
export async function verificarMiembro(req: NextRequest, clinicId: string): Promise<Acceso> {
  const u = await verificarToken(req)
  if (!u) return err(401, 'No autenticado. Inicia sesión nuevamente.')
  if (!clinicId) return err(400, 'Falta clinicId')
  try {
    const snap = await adminDb.collection('clinic_members').doc(u.uid).get()
    const data = snap.data()
    if (!snap.exists || data?.clinicId !== clinicId) {
      return err(403, 'No tienes acceso a esta clínica.')
    }
    return { ok: true, uid: u.uid, email: u.email, clinicId, role: data?.role }
  } catch {
    return err(500, 'Error verificando membresía')
  }
}

/** Como verificarMiembro, pero además exige rol médico o admin. */
export async function verificarMedico(req: NextRequest, clinicId: string): Promise<Acceso> {
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso
  if (acceso.role !== 'medico' && acceso.role !== 'admin') {
    return err(403, 'Requiere rol de médico.')
  }
  return acceso
}
