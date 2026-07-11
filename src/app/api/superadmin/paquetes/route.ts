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
import { TODOS_LOS_MODULOS, PAQUETES_SUGERIDOS, PAQUETES_VERSION } from '@/lib/modulos'
import { randomUUID } from 'crypto'

type Any = Record<string, unknown>
const COL = 'platform_packages'

function limpiarModulos(m: unknown): string[] {
  if (!Array.isArray(m)) return []
  return m.map(String).filter(k => TODOS_LOS_MODULOS.includes(k))
}

/**
 * Siembra los paquetes por defecto la PRIMERA vez (marca `platform_meta/paquetes.
 * seeded`). Guardado por la bandera → si el dueño luego borra o edita paquetes,
 * NO se vuelven a crear. Idempotente (ids fijos + set con merge).
 */
async function sembrarSiHaceFalta(now: string) {
  const metaRef = adminDb.collection('platform_meta').doc('paquetes')
  const meta = await metaRef.get()
  // Ya sembrado CON la versión actual → nada que hacer.
  if (meta.exists && (meta.data() as Any).seedVersion === PAQUETES_VERSION) return

  const idsNuevos = new Set(PAQUETES_SUGERIDOS.map(p => p.id))
  const batch = adminDb.batch()
  // Alta/actualización de los paquetes actuales (ids = clave de plan).
  for (const p of PAQUETES_SUGERIDOS) {
    batch.set(adminDb.collection(COL).doc(p.id), {
      nombre: p.nombre, precio: p.precio, modulos: p.modulos, descripcion: p.descripcion,
      orden: p.orden, activo: true,
      modeloPrecio: p.modeloPrecio ?? 'fijo', precioBase: p.precioBase ?? p.precio, precioPorUnidad: p.precioPorUnidad ?? 0,
      updatedAt: now, seededVersion: PAQUETES_VERSION,
    }, { merge: true })
  }
  // Desactiva paquetes VIEJOS del catálogo anterior (consultorio, hospitalario…)
  // que ya no forman parte de los planes actuales — así la consola concuerda.
  const snap = await adminDb.collection(COL).get()
  snap.docs.forEach(d => {
    if (!idsNuevos.has(d.id)) batch.set(d.ref, { activo: false, updatedAt: now }, { merge: true })
  })
  batch.set(metaRef, { seeded: true, seedVersion: PAQUETES_VERSION, seededAt: now }, { merge: true })
  await batch.commit()
}

/**
 * Rellena el MODELO DE COBRO en paquetes que aún no lo tienen (creados antes de
 * esta función). Consultorio (tiene expediente) → por médico; Hospital (tiene
 * hospitalización) → por cama; el resto → fijo. NO pisa el precio que el dueño ya
 * puso: usa el `precio` actual como base. Idempotente (solo toca los que faltan).
 */
async function rellenarModelos(now: string) {
  const snap = await adminDb.collection(COL).get()
  const batch = adminDb.batch()
  let cambios = 0
  snap.docs.forEach(d => {
    const p = d.data() as Any
    if (p.modeloPrecio) return // ya tiene modelo definido → no tocar
    const modulos: string[] = Array.isArray(p.modulos) ? p.modulos.map(String) : []
    let modeloPrecio = 'fijo'; let precioPorUnidad = 0
    if (modulos.includes('hospitalizacion')) { modeloPrecio = 'por_cama'; precioPorUnidad = 40 }
    else if (modulos.includes('expediente')) { modeloPrecio = 'por_medico'; precioPorUnidad = 250 }
    batch.set(d.ref, { modeloPrecio, precioBase: Number(p.precio ?? 0), precioPorUnidad, updatedAt: now }, { merge: true })
    cambios++
  })
  if (cambios > 0) await batch.commit()
}

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response
  try {
    const now = new Date().toISOString()
    await sembrarSiHaceFalta(now)
    await rellenarModelos(now)
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

    const modeloPrecio = ['fijo', 'por_medico', 'por_cama'].includes(String(p.modeloPrecio)) ? String(p.modeloPrecio) : 'fijo'
    const precioBase = Math.max(0, Number(p.precioBase ?? p.precio ?? 0))
    const precioPorUnidad = Math.max(0, Number(p.precioPorUnidad ?? 0))
    const data = {
      nombre,
      // 'precio' se mantiene = base para vistas simples y como respaldo del modelo 'fijo'.
      precio: modeloPrecio === 'fijo' ? Math.max(0, Number(p.precio ?? 0)) : precioBase,
      modulos,
      descripcion: String(p.descripcion ?? '').slice(0, 200),
      orden: Number(p.orden ?? 0),
      activo: p.activo !== false,
      modeloPrecio, precioBase, precioPorUnidad,
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
