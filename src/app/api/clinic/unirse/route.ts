/**
 * POST /api/clinic/unirse   { code }
 *
 * Acepta una invitación de forma SEGURA y ATÓMICA (Admin SDK):
 *  - Valida la invitación (existe, no usada, no expirada).
 *  - Crea clinic_members/{uid} con el ROL de la invitación (no uno elegido por el cliente).
 *  - Marca la invitación como usada — todo en una transacción (evita doble uso).
 *
 * Cierra el P0: antes el cliente escribía clinic_members/{uid} directo, así que
 * cualquiera podía auto-asignarse rol admin en CUALQUIER clínica. Ahora el rol y
 * el clinicId salen SIEMPRE de la invitación validada en el servidor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response
  const uid = acc.uid

  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, motivo: 'Datos inválidos' }, { status: 400 }) }
  const code = String(body.code ?? '').trim()
  if (!code) return NextResponse.json({ ok: false, motivo: 'Falta el código' }, { status: 400 })

  const invRef = adminDb.collection('clinic_invitations').doc(code)
  const memberRef = adminDb.collection('clinic_members').doc(uid)

  try {
    // ¿Ya pertenece a una clínica?
    const memberSnap = await memberRef.get()
    if (memberSnap.exists) {
      const existing = memberSnap.data() as { clinicId?: string }
      const inv = await invRef.get()
      const invClinic = inv.exists ? (inv.data() as { clinicId?: string }).clinicId : undefined
      if (existing.clinicId && existing.clinicId === invClinic) return NextResponse.json({ ok: true, clinicId: existing.clinicId })
      return NextResponse.json({ ok: false, motivo: 'Ya perteneces a otra clínica. Cierra sesión y crea una cuenta nueva para aceptar esta invitación.' }, { status: 409 })
    }

    const resultado = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(invRef)
      if (!snap.exists) return { ok: false, motivo: 'Invitación no encontrada.' }
      const inv = snap.data() as { clinicId: string; role: string; used?: boolean; expiresAt?: string; creadoPor?: string }
      if (inv.used === true) return { ok: false, motivo: 'Esta invitación ya fue usada.' }
      if (inv.expiresAt && new Date() > new Date(inv.expiresAt)) return { ok: false, motivo: 'Esta invitación ha expirado.' }

      tx.set(memberRef, {
        clinicId: inv.clinicId,
        role: inv.role,               // ROL desde la invitación validada (no del cliente)
        email: acc.email ?? '',
        invitadoPor: inv.creadoPor ?? '',
        createdAt: new Date().toISOString(),
      })
      tx.update(invRef, { used: true, usedBy: uid, usedAt: new Date().toISOString() })
      return { ok: true, clinicId: inv.clinicId }
    })
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 })
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
