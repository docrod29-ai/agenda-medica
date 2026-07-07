import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  // uid del token: antes se consultaba el estado de conexión de cualquier uid.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return NextResponse.json({ connected: false })
  try {
    const doc = await adminDb.collection('googleTokens').doc(acc.uid).get()
    return NextResponse.json({ connected: doc.exists && !!doc.data()?.refreshToken })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

export async function DELETE(req: NextRequest) {
  // uid del token: antes cualquiera desconectaba el Google Calendar de otro usuario.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response
  try {
    await adminDb.collection('googleTokens').doc(acc.uid).delete()
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
