import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')

  if (!uid) return NextResponse.json({ connected: false })

  try {
    const doc = await adminDb.collection('googleTokens').doc(uid).get()
    return NextResponse.json({ connected: doc.exists && !!doc.data()?.refreshToken })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')

  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

  try {
    await adminDb.collection('googleTokens').doc(uid).delete()
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
