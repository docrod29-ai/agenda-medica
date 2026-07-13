/**
 * Rastreo de errores propio (mini-Sentry). El cliente reporta errores no
 * atrapados aquí; se guardan en Firestore `errores` (server-only, Admin SDK) y
 * el dueño los ve en /superadmin/errores. Sin PII: solo mensaje, stack corto,
 * ruta y user-agent. Con rate-limit anti-spam.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { verificarSuperadmin } from '@/lib/superadmin'
import { limitarOResponder } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response
  // Anti-spam: máx 20 reportes / 5 min por usuario (un bug en loop no inunda).
  const limite = await limitarOResponder(`errores:${acceso.uid}`, 20, 300)
  if (limite) return NextResponse.json({ ok: true })  // silencioso: nunca molesta al usuario

  let body: { mensaje?: string; stack?: string; ruta?: string; ua?: string; origen?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }
  const mensaje = String(body.mensaje ?? '').slice(0, 300)
  if (!mensaje) return NextResponse.json({ ok: true })

  try {
    await adminDb.collection('errores').add({
      mensaje,
      stack: String(body.stack ?? '').slice(0, 1500),
      ruta: String(body.ruta ?? '').slice(0, 200),
      ua: String(body.ua ?? '').slice(0, 200),
      origen: String(body.origen ?? 'cliente').slice(0, 40),
      uid: acceso.uid,
      email: acceso.email ?? '',
      fecha: new Date().toISOString(),
      visto: false,
    })
  } catch { /* nunca romper por el propio rastreo */ }
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const g = await verificarSuperadmin(req)
  if (!g.ok) return g.response
  try {
    const snap = await adminDb.collection('errores').orderBy('fecha', 'desc').limit(200).get()
    const errores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ ok: true, errores })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const g = await verificarSuperadmin(req)
  if (!g.ok) return g.response
  try {
    const { id, visto } = await req.json()
    if (id) await adminDb.collection('errores').doc(String(id)).set({ visto: !!visto }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
}
