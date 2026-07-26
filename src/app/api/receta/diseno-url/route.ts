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

export const runtime = 'nodejs'

const PATH_OK = /^receta-diseno\/[^./][^:]*$/

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const body = await req.json().catch(() => ({})) as { paths?: unknown }
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === 'string').slice(0, 20) : []
  if (paths.length === 0) return NextResponse.json({ ok: false, error: 'paths requerido' }, { status: 400 })

  const urls: Record<string, string> = {}
  for (const p of paths) {
    if (!PATH_OK.test(p) || p.includes('..')) continue
    const base = `/api/receta/diseno?path=${encodeURIComponent(p)}`
    const t = firmarPathDiseno(p, Date.now())
    urls[p] = t ? `${base}&exp=${t.exp}&sig=${t.sig}` : base
  }
  return NextResponse.json({ ok: true, urls })
}
