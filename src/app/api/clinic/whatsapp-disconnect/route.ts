/**
 * POST /api/clinic/whatsapp-disconnect
 * Removes WhatsApp credentials from the clinic and the index collection.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await req.json()
    if (!clinicId) return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    const acceso = await verificarMiembro(req, clinicId)
    if (!acceso.ok) return acceso.response

    // Read current api_key so we can delete the index entry
    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    const currentApiKey = clinicSnap.data()?.whatsapp?.apiKey as string | undefined

    // Remove from clinic doc
    await adminDb.collection('clinics').doc(clinicId).update({
      whatsapp: {
        provider: 'none',
        connected: false,
        apiKey: null,
        phoneNumberId: null,
        phoneNumber: null,
        connectedAt: null,
      },
      updatedAt: new Date().toISOString(),
    })

    // Remove index entry
    if (currentApiKey) {
      await adminDb.collection('whatsapp_channels').doc(currentApiKey).delete()
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[whatsapp-disconnect]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
