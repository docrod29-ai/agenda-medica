/**
 * POST /api/config/guardar
 *
 * Guarda un parche parcial de la config DESDE EL SERVIDOR (Admin SDK) y, de
 * paso, COMPACTA el documento: cualquier valor que sea un data-URL base64
 * (imágenes viejas que se colaron al doc) se sube a Storage y se reemplaza por
 * su URL proxeada. Así el documento baja de tamaño y el guardado ENTRA aunque
 * antes tronara con el tope de 1 MB de Firestore ("cannot be written").
 *
 * Por qué existe: `saveConfigPartial` (cliente) hace setDoc merge; si el doc ya
 * está inflado con base64, TODO guardado nuevo falla —incluida la hoja
 * membretada— aunque el campo nuevo sea diminuto. Este endpoint lee el doc
 * completo, lo limpia y lo reescribe en una transacción.
 *
 * Body: { clinicId, patch: Partial<ClinicConfig> }
 * Resp: { ok, migradas: number }   // cuántas imágenes base64 se movieron a Storage
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import admin, { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

/** Sube un data-URL base64 de imagen a Storage y devuelve la URL proxeada. */
async function subirBase64(dataUrl: string, key: string, uid: string, n: number): Promise<string | null> {
  const mm = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!mm) return null
  const contentType = mm[1].toLowerCase()
  let buffer: Buffer
  try { buffer = Buffer.from(mm[2], 'base64') } catch { return null }
  if (buffer.length > 8_000_000) return null  // demasiado grande incluso para Storage
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `receta-diseno/${uid}/${key}-${Date.now()}-${n}.${ext}`
  try {
    await admin.storage().bucket(BUCKET).file(path).save(buffer, {
      contentType, resumable: false, metadata: { cacheControl: 'public, max-age=86400' },
    })
    return `/api/receta/diseno?path=${encodeURIComponent(path)}`
  } catch { return null }
}

/** Recorre el objeto y reemplaza data-URLs base64 por URLs de Storage. Muta in-place. */
async function compactar(obj: unknown, uid: string, ctx: { n: number }, ruta = 'img', prof = 0): Promise<void> {
  if (prof > 6 || obj === null || typeof obj !== 'object') return
  const entradas = Array.isArray(obj) ? obj.map((v, i) => [i, v] as const) : Object.entries(obj as Record<string, unknown>)
  for (const [k, v] of entradas) {
    if (typeof v === 'string') {
      if (v.startsWith('data:image/') && v.includes(';base64,')) {
        const url = await subirBase64(v, `${ruta}-${String(k).replace(/[^a-z0-9_-]/gi, '')}`.slice(0, 40), uid, ctx.n++)
        if (url) (obj as Record<string, unknown>)[k as string] = url
      }
    } else if (v && typeof v === 'object') {
      await compactar(v, uid, ctx, `${ruta}-${String(k).slice(0, 12)}`, prof + 1)
    }
  }
}

/** Merge profundo de mapas (los objetos planos se fusionan; primitivos/arrays reemplazan). */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const prev = out[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' && !Array.isArray(prev)) {
      out[k] = deepMerge(prev as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patch?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const clinicId = String(body.clinicId ?? '')
  const patch = (body.patch && typeof body.patch === 'object') ? body.patch : null
  if (!clinicId || !patch) return NextResponse.json({ ok: false, error: 'Falta clinicId o patch' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  const ref = adminDb.doc(`clinics/${clinicId}/config/main`)
  const ctx = { n: 0 }

  try {
    // 1) Compactar el PARCHE entrante (por si trae base64) antes de mezclar.
    await compactar(patch, acc.uid, ctx, 'patch')

    // 2) Leer doc actual, compactarlo, mezclar el parche y reescribir COMPLETO
    //    (así el doc realmente se ENCOGE; un setDoc merge no borraría el base64
    //    viejo). Sin transacción: la config no se edita en paralelo y las subidas
    //    a Storage dentro de una tx arriesgan timeouts.
    const snap = await ref.get()
    const actual = (snap.exists ? snap.data() : {}) as Record<string, unknown>
    await compactar(actual, acc.uid, ctx, 'cfg')
    const merged = deepMerge(actual, patch)
    merged.updatedAt = new Date().toISOString()
    await ref.set(merged)  // sin merge: reemplaza el doc ya limpio

    return NextResponse.json({ ok: true, migradas: ctx.n })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 180) : 'error al guardar' }, { status: 502 })
  }
}
