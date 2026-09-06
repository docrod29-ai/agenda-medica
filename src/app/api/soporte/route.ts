/**
 * Soporte / buzón de la plataforma.
 *   POST  (usuario autenticado)  { tipo, mensaje, email?, nombre?, clinicId? }
 *         → registra una queja / falla / felicitación / duda.
 *   GET   (solo superadmin/dueño) → lista todos los mensajes (buzón).
 *   PATCH (solo superadmin)       { id, estado, respuesta? } → marca visto/resuelto.
 *
 * Colección `soporte`. El cliente NO puede leer el buzón (solo enviar).
 */
import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { safeLog } from '@/lib/security/sanitize'
import { documentoDeSoporte, TIPOS_DE_SOPORTE } from '@/lib/security/soporte-redactado'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { verificarSuperadmin } from '@/lib/superadmin'

type Any = Record<string, unknown>
const TIPOS: readonly string[] = TIPOS_DE_SOPORTE

/**
 * LA PROSA SE REDACTA ANTES DE GUARDARSE (Panel de Lujo S-003). Ver
 * `src/lib/security/soporte-redactado.ts`: la colección es de plataforma y se
 * lee desde fuera del consultorio; `/api/errores` ya lo hacía, esta ruta no.
 */
export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  let body: { tipo?: string; mensaje?: string; email?: string; nombre?: string; clinicId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const tipo = TIPOS.includes(String(body.tipo)) ? String(body.tipo) : 'duda'
  const mensaje = String(body.mensaje ?? '').trim().slice(0, 3000)
  if (!mensaje) return NextResponse.json({ ok: false, error: 'Escribe tu mensaje' }, { status: 400 })

  // Anti-spam: máx. 8 mensajes de soporte cada 10 min por usuario.
  const limite = await limitarOResponder(`soporte:${acceso.uid}`, 8, 600, 'Recibimos varios mensajes tuyos. Espera unos minutos antes de enviar otro.')
  if (limite) return limite

  try {
    // El consultorio del ticket es el de la membresía verificada, no el que diga el cuerpo.
    const miembro = await adminDb.collection('clinic_members').doc(acceso.uid).get()
    const clinicId = String(miembro.data()?.clinicId ?? '')
    await adminDb.collection('soporte').add(documentoDeSoporte({
      uid: acceso.uid, clinicId, tipo, mensaje,
      email: body.email, nombre: body.nombre,
      ahoraIso: new Date().toISOString(),
    }))
    return NextResponse.json({ ok: true })
  } catch (e) {
    safeLog.error('[soporte]', e)
    return errorAlCliente()
  }
}

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response
  try {
    const snap = await adminDb.collection('soporte').orderBy('fecha', 'desc').limit(300).get()
    const mensajes = snap.docs.map(d => ({ id: d.id, ...(d.data() as Any) }))
    return NextResponse.json({ ok: true, mensajes })
  } catch (e) {
    return errorAlCliente()
  }
}

export async function PATCH(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response
  let body: { id?: string; estado?: string; respuesta?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })
  const estado = ['nuevo', 'visto', 'resuelto'].includes(String(body.estado)) ? String(body.estado) : 'visto'
  try {
    await adminDb.collection('soporte').doc(body.id).set({
      estado, respuesta: String(body.respuesta ?? '').slice(0, 2000), atendidoPor: acc.email, atendidoEn: new Date().toISOString(),
    }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorAlCliente()
  }
}

export const runtime = 'nodejs'
