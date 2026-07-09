/**
 * POST /api/config/imagen
 *
 * Sube una imagen (data URL base64) a Firebase Storage DESDE EL SERVIDOR (Admin
 * SDK). Se hizo así porque la subida desde el navegador (uploadBytes +
 * getDownloadURL) dependía de reglas/CORS y fallaba silenciosamente → las
 * imágenes caían a base64 e inflaban el documento de config (tope 1MB). El Admin
 * SDK no depende de reglas ni CORS.
 *
 * Body: { dataUrl: "data:image/...;base64,...", key: "membrete" | "firma" | ... }
 * Resp: { ok, url: "/api/receta/diseno?path=..." }  (URL proxeada same-origin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import admin from '@/lib/firebase-admin'

export const runtime = 'nodejs'
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

export async function POST(req: NextRequest) {
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response

  let body: { dataUrl?: string; key?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const dataUrl = String(body.dataUrl ?? '')
  const key = String(body.key ?? 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'img'
  const mm = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!mm) return NextResponse.json({ ok: false, error: 'Imagen inválida (se esperaba data URL base64)' }, { status: 400 })

  const contentType = mm[1].toLowerCase()
  let buffer: Buffer
  try { buffer = Buffer.from(mm[2], 'base64') } catch { return NextResponse.json({ ok: false, error: 'base64 inválido' }, { status: 400 }) }
  if (buffer.length > 8_000_000) return NextResponse.json({ ok: false, error: 'Imagen mayor a 8 MB' }, { status: 413 })

  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `receta-diseno/${acc.uid}/${key}-${Date.now()}.${ext}`

  try {
    const bucket = admin.storage().bucket(BUCKET)
    await bucket.file(path).save(buffer, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=86400' } })
    return NextResponse.json({ ok: true, url: `/api/receta/diseno?path=${encodeURIComponent(path)}` })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'error de Storage' }, { status: 502 })
  }
}
