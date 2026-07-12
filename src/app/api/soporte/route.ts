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
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { verificarSuperadmin } from '@/lib/superadmin'

type Any = Record<string, unknown>
const TIPOS = ['queja', 'falla', 'felicitacion', 'duda', 'sugerencia']

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  let body: { tipo?: string; mensaje?: string; email?: string; nombre?: string; clinicId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const tipo = TIPOS.includes(String(body.tipo)) ? String(body.tipo) : 'duda'
  const mensaje = String(body.mensaje ?? '').trim().slice(0, 3000)
  if (!mensaje) return NextResponse.json({ ok: false, error: 'Escribe tu mensaje' }, { status: 400 })

  try {
    await adminDb.collection('soporte').add({
      uid: acceso.uid,
      email: String(body.email ?? '').slice(0, 160),
      nombre: String(body.nombre ?? '').slice(0, 160),
      clinicId: String(body.clinicId ?? ''),
      tipo,
      mensaje,
      estado: 'nuevo',
      fecha: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 })
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
    return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 })
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
    return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
