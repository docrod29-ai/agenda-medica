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

/** La IP del que reporta, para poder frenarlo sin tener su uid. */
function ipDe(req: NextRequest): string {
  const h = req.headers.get('x-forwarded-for') ?? ''
  return h.split(',')[0].trim() || 'desconocida'
}

export async function POST(req: NextRequest) {
  /**
   * SE ACEPTA SIN SESIÓN, Y ESO ES EL ARREGLO.
   *
   * Esta ruta exigía `verificarUsuario`, así que el mini-Sentry **sólo aceptaba
   * reportes de un usuario con sesión válida**. Quedaban ciegas justo las
   * caídas que más importan:
   *
   *   · el boundary GLOBAL, que se activa cuando ni el layout carga;
   *   · cualquier fallo en el login, donde por definición no hay sesión todavía.
   *
   * O sea: la falla más grave era la única que no se podía reportar.
   *
   * Se acepta anónimo, con su propio freno por IP y marcado como tal — un
   * reporte sin dueño vale menos que uno con dueño, y quien lo lea tiene que
   * poder distinguirlos.
   */
  const acceso = await verificarUsuario(req)
  const anonimo = !acceso.ok
  /**
   * El freno del anónimo es MÁS estrecho: sin sesión no hay a quién cortarle el
   * abuso, sólo una IP que se comparte. Cinco por hora bastan para un boundary
   * global —que dispara una vez por caída, con dedup en el cliente— y no
   * alcanzan para inundar la colección.
   */
  const limite = anonimo
    ? await limitarOResponder(`errores-anon:${ipDe(req)}`, 5, 3600)
    : await limitarOResponder(`errores:${acceso.uid}`, 20, 300)
  if (limite) return NextResponse.json({ ok: true })  // silencioso: nunca molesta al usuario

  let body: { mensaje?: string; stack?: string; ruta?: string; ua?: string; origen?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }
  const mensaje = String(body.mensaje ?? '').slice(0, 300)
  if (!mensaje) return NextResponse.json({ ok: true })

  try {
    await adminDb.collection('errores').add({
      mensaje,
      // Un reporte sin dueño vale menos que uno con dueño: se distingue.
      anonimo,
      stack: String(body.stack ?? '').slice(0, 1500),
      ruta: String(body.ruta ?? '').slice(0, 200),
      ua: String(body.ua ?? '').slice(0, 200),
      origen: String(body.origen ?? 'cliente').slice(0, 40),
      uid: acceso.ok ? acceso.uid : '',
      email: acceso.ok ? (acceso.email ?? '') : '',
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
