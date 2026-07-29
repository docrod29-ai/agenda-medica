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
import { tieneModulo, MODULOS_OPT_IN } from './modulos'

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
 *
 * @internal E0-07 — no usar directamente en rutas NUEVAS. Es el «any-member»
 * (cualquier rol pasa) que la unidad de capacidades vino a cerrar: hoy es el paso de
 * MEMBRESÍA que consume `src/lib/authz/verificar.ts`, y las rutas piden una
 * capacidad con `verificarCapacidad(req, clinicId, capacidad)`. Las pocas rutas que
 * todavía lo llaman están declaradas una por una en `authz/registro-rutas.ts` con la
 * decisión que falta, y un test congela esa lista.
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

/**
 * Exige usuario autenticado Y que SU consultorio tenga el MÓDULO indicado
 * (entitlement por plan). Cierra el hueco de que un plan `agenda` llame directo
 * a las API de IA de consulta ("Pro") — el guard de rutas del navegador NO
 * protege las API. Resuelve la clínica del UID y aplica `tieneModulo`.
 *
 * Fail-OPEN solo ante error transitorio de Firestore: preferimos no tumbar la IA
 * a TODOS por un fallo de lectura puntual; el camino normal (clínica que carga
 * bien) sí bloquea. Sin consultorio configurado → bloquea (aún está en /setup).
 */
export async function verificarModuloIA(req: NextRequest, modulo: string): Promise<Acceso> {
  const u = await verificarToken(req)
  if (!u) return err(401, 'No autenticado. Inicia sesión nuevamente.')
  try {
    const miembro = await adminDb.collection('clinic_members').doc(u.uid).get()
    const clinicId = miembro.data()?.clinicId as string | undefined
    if (!clinicId) return err(403, 'Aún no tienes un consultorio configurado.')
    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    const clinic = clinicSnap.data() as { plan?: string; modulos?: string[]; paseLibre?: boolean } | undefined
    if (!tieneModulo(clinic ?? null, modulo)) {
      return err(403, 'Tu plan no incluye la IA de consulta. Mejora a Clínica o Pro para usar esta función.')
    }
    return { ok: true, uid: u.uid, email: u.email, clinicId, role: miembro.data()?.role }
  } catch {
    // Error transitorio de Firestore. Para módulos de consulta (expediente) se es
    // fail-OPEN: no tumbar la IA de todos por una lectura puntual. Pero para los
    // módulos OPT-IN de pago (UCI/Hospitalización) se falla CERRADO: no dar acceso
    // técnico a una función cara sin poder verificar el entitlement.
    if (MODULOS_OPT_IN.includes(modulo)) {
      return err(503, 'No se pudo verificar tu plan en este momento. Intenta de nuevo en unos segundos.')
    }
    return { ok: true, uid: u.uid, email: u.email }
  }
}

/**
 * Como verificarMiembro, pero además exige rol médico o admin.
 *
 * @internal E0-07 — SIN CONSUMIDORES en `src/app/api` (un test lo comprueba). Se
 * conserva porque su semántica es la definición de `rolesCon('clinico.escribir')` y
 * `nucleo/autorizacion-servidor.test.ts` la usa como oráculo del gate binario que
 * había antes. En rutas se usa `verificarCapacidad` con la capacidad concreta.
 */
export async function verificarMedico(req: NextRequest, clinicId: string): Promise<Acceso> {
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso
  if (acceso.role !== 'medico' && acceso.role !== 'admin') {
    return err(403, 'Requiere rol de médico.')
  }
  return acceso
}
