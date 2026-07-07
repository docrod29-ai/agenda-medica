/**
 * Paquetes de la plataforma — el DUEÑO arma combinaciones de módulos con precio.
 *   GET                              → lista de paquetes
 *   POST { accion:'crear'|'editar', paquete }  → alta/edición
 *   POST { accion:'borrar', id }               → baja
 * Solo superadmin. Colección `platform_packages`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { TODOS_LOS_MODULOS } from '@/lib/modulos'
import { randomUUID } from 'crypto'

type Any = Record<string, unknown>
const COL = 'platform_packages'

function limpiarModulos(m: unknown): string[] {
  if (!Array.isArray(m)) return []
  return m.map(String).filter(k => TODOS_LOS_MODULOS.includes(k))
}

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response
  try {
    const snap = await adminDb.collection(COL).get()
    const paquetes = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Any) }))
      .sort((a, b) => Number((a as Any).orden ?? 0) - Number((b as Any).orden ?? 0))
    return NextResponse.json({ ok: true, paquetes })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  let body: { accion?: string; id?: string; paquete?: Any }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const now = new Date().toISOString()

  try {
    if (body.accion === 'borrar') {
      if (!body.id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 })
      await adminDb.collection(COL).doc(body.id).delete()
      return NextResponse.json({ ok: true })
    }

    const p = body.paquete ?? {}
    const nombre = String(p.nombre ?? '').trim()
    if (!nombre) return NextResponse.json({ ok: false, error: 'El paquete necesita nombre' }, { status: 400 })
    const modulos = limpiarModulos(p.modulos)
    if (modulos.length === 0) return NextResponse.json({ ok: false, error: 'Elige al menos un módulo' }, { status: 400 })

    const data = {
      nombre,
      precio: Math.max(0, Number(p.precio ?? 0)),
      modulos,
      descripcion: String(p.descripcion ?? '').slice(0, 200),
      orden: Number(p.orden ?? 0),
      activo: p.activo !== false,
      updatedAt: now,
    }

    const id = (body.accion === 'editar' && body.id) ? body.id : randomUUID()
    await adminDb.collection(COL).doc(id).set(
      body.accion === 'editar' ? data : { ...data, createdAt: now },
      { merge: true },
    )
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
