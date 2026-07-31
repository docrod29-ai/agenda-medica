/**
 * POST /api/receta/diseno-url — acuña URLs FIRMADAS para el proxy del formato de
 * receta (NEXUS-QUALITY-010).
 *
 * El camino de impresión llama aquí (autenticado) justo antes de imprimir y
 * cambia las <img src> a las URLs firmadas con caducidad. Las URLs guardadas en
 * la config de los médicos NO se tocan (si se firmaran al subir, caducarían y
 * romperían la papelería después).
 *
 * Body: { paths: string[] }  (paths del bucket: "receta-diseno/<uid>/...")
 * Resp: { ok, urls: Record<path, urlFirmada> }  — si no hay secreto configurado
 * devuelve las URLs sin firma (el proxy las sigue aceptando mientras el candado
 * RECETA_DISENO_FIRMA no esté activo).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { firmarPathDiseno } from '@/lib/receta-diseno-token'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

const PATH_OK = /^receta-diseno\/[^./][^:]*$/

/** clinicId al que pertenece un uid (o null). Para el gate de misma-clínica. */
async function clinicIdDe(uid: string): Promise<string | null> {
  try {
    const s = await adminDb.collection('clinic_members').doc(uid).get()
    return s.exists ? ((s.data()?.clinicId as string | undefined) ?? null) : null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const body = await req.json().catch(() => ({})) as { paths?: unknown }
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === 'string').slice(0, 20) : []
  if (paths.length === 0) return NextResponse.json({ ok: false, error: 'paths requerido' }, { status: 400 })

  // IDOR (auditoría P1): el firmante solo puede acuñar URLs de SU propio diseño o
  // el de un miembro de SU MISMA clínica (la asistente imprime por el médico). El
  // cruce a otra clínica queda bloqueado → no se puede robar la firma/membrete ajeno.
  // El caso común (uid == quien llama) no hace ninguna lectura extra: cero regresión.
  const miClinica = await clinicIdDe(acceso.uid)
  const cacheClinica = new Map<string, string | null>()
  const mismaClinica = async (ownerUid: string): Promise<boolean> => {
    if (ownerUid === acceso.uid) return true
    if (!miClinica) return false
    if (!cacheClinica.has(ownerUid)) cacheClinica.set(ownerUid, await clinicIdDe(ownerUid))
    return cacheClinica.get(ownerUid) === miClinica
  }

  const urls: Record<string, string> = {}
  for (const p of paths) {
    if (!PATH_OK.test(p) || p.includes('..')) continue
    const ownerUid = p.split('/')[1] ?? ''
    if (!ownerUid || !(await mismaClinica(ownerUid))) continue  // no acuñar diseño ajeno
    const base = `/api/receta/diseno?path=${encodeURIComponent(p)}`
    const t = firmarPathDiseno(p, Date.now())
    urls[p] = t ? `${base}&exp=${t.exp}&sig=${t.sig}` : base
  }
  return NextResponse.json({ ok: true, urls })
}
