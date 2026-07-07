/**
 * POST /api/superadmin/accion
 *
 * Acciones del DUEÑO sobre una clínica (suscripción). Solo superadmin.
 * Toda acción queda en `platform_admin_log` (bitácora del dueño).
 *
 * Body: { clinicId, accion, ... }
 *   accion:
 *     - pase_libre        { motivo? }   → acceso gratis permanente (cortesía)
 *     - quitar_pase_libre               → regresa a 'trial' (deberá poner tarjeta)
 *     - suspender                       → status 'suspended' (bloquea acceso)
 *     - reactivar                       → status 'active'
 *     - extender_prueba   { dias }      → empuja trialEndsAt N días
 *     - guardar_notas     { notas }     → notas internas del dueño
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { TODOS_LOS_MODULOS } from '@/lib/modulos'

type Any = Record<string, unknown>

export async function POST(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  let body: { clinicId?: string; accion?: string; motivo?: string; dias?: number; notas?: string; modulos?: unknown[]; paqueteId?: string; paqueteNombre?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, accion } = body
  if (!clinicId || !accion) return NextResponse.json({ ok: false, error: 'clinicId y accion requeridos' }, { status: 400 })

  const ref = adminDb.collection('clinics').doc(clinicId)
  const now = new Date().toISOString()
  let patch: Any = {}

  switch (accion) {
    case 'pase_libre':
      patch = { plan: 'cortesia', status: 'active', paseLibre: true, paseLibreMotivo: body.motivo ?? '', paseLibrePor: acc.email }
      break
    case 'quitar_pase_libre':
      patch = { plan: 'trial', status: 'trial', paseLibre: false, paseLibreMotivo: '', paseLibrePor: '' }
      break
    case 'suspender':
      patch = { status: 'suspended' }
      break
    case 'reactivar':
      patch = { status: 'active' }
      break
    case 'extender_prueba': {
      const dias = Math.max(1, Math.min(365, Number(body.dias ?? 14)))
      const snap = await ref.get()
      const actual = snap.exists ? String((snap.data() as Any).trialEndsAt ?? '') : ''
      const base = actual && new Date(actual).getTime() > Date.now() ? new Date(actual).getTime() : Date.now()
      patch = { status: 'trial', plan: 'trial', trialEndsAt: new Date(base + dias * 86400000).toISOString() }
      break
    }
    case 'guardar_notas':
      patch = { notasInternas: String(body.notas ?? '').slice(0, 2000) }
      break
    case 'asignar_modulos': {
      // Asigna a la clínica un conjunto de módulos (paquete o combinación a mano).
      const modulos = (Array.isArray(body.modulos) ? body.modulos : []).map(String).filter(k => TODOS_LOS_MODULOS.includes(k))
      patch = { modulos, paqueteId: body.paqueteId ?? '', paqueteNombre: body.paqueteNombre ?? '' }
      break
    }
    default:
      return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  }

  try {
    await ref.update({ ...patch, updatedAt: now })
    await adminDb.collection('platform_admin_log').add({
      clinicId, accion, por: acc.email, detalle: { motivo: body.motivo ?? null, dias: body.dias ?? null }, fecha: now,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
