/**
 * GET /api/clinic/miembros?clinicId=XXX
 *
 * Lista los miembros de UNA clínica. Se sirve desde el servidor (Admin SDK) para
 * NO exponer un `list` abierto de clinic_members en las Firestore Rules (que
 * permitiría a cualquier usuario autenticado enumerar el directorio —correos,
 * roles— de OTRAS clínicas: fuga cross-tenant / LFPDPPP).
 *
 * Resp: { ok, miembros: [{ uid, role, email, displayName?, invitadoPor?, createdAt? }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  try {
    const snap = await adminDb.collection('clinic_members').where('clinicId', '==', clinicId).get()
    const miembros = snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return { uid: d.id, role: x.role, email: x.email, displayName: x.displayName, invitadoPor: x.invitadoPor, createdAt: x.createdAt }
    })
    return NextResponse.json({ ok: true, miembros })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo listar el equipo' }, { status: 500 })
  }
}
