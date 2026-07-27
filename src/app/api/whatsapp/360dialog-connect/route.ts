import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { verificarMedico } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'

const TTL_MIN = 15

/**
 * Emite el nonce de un solo uso para el alta de 360dialog.
 *
 * Existe porque el callback NO puede confiar en el clinicId que llega por la
 * URL: quien la conociera podía apuntar un canal propio de WhatsApp al
 * consultorio de otro y quedarse con sus mensajes. El clinicId queda guardado
 * aquí, del lado del servidor, ligado al usuario que sí demostró pertenecer.
 */
export async function POST(req: NextRequest) {
  const { clinicId } = await req.json().catch(() => ({ clinicId: '' }))
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })

  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  const nonce = randomUUID()
  await adminDb.collection('oauthStates').doc(nonce).set({
    uid: acc.uid,
    clinicId,
    proveedor: 'whatsapp-360dialog',
    exp: Date.now() + TTL_MIN * 60_000,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, nonce })
}
