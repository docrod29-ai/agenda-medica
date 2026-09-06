/**
 * POST /api/clinic/unirse   { code }
 *
 * Acepta una invitación de forma SEGURA y ATÓMICA (Admin SDK):
 *  - Valida la invitación (existe, no usada, no expirada).
 *  - Crea clinic_members/{uid} con el ROL de la invitación (no uno elegido por el cliente).
 *  - Marca la invitación como usada — todo en una transacción (evita doble uso).
 *
 * Cierra el P0: antes el cliente escribía clinic_members/{uid} directo, así que
 * cualquiera podía auto-asignarse rol admin en CUALQUIER clínica. Ahora el rol y
 * el clinicId salen SIEMPRE de la invitación validada en el servidor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { DEFAULT_CONFIG } from '@/types'
import { safeLog } from '@/lib/security/sanitize'
// SIN CADUCIDAD NO ES VÁLIDA (ZL-011): la vigencia la decide un módulo puro
// compartido con el cliente, para que los dos lados no digan cosas distintas.
import { invitacionVigente } from '@/lib/security/invitacion-vigente'

/** Crea la ficha del médico en el catálogo (para su agenda) si aún no existe
 *  una con ese correo. Toma el horario base de la config de la clínica. */
async function crearMedicoSiFalta(clinicId: string, email: string, nombre?: string, especialidad?: string) {
  const docsCol = adminDb.collection('clinics').doc(clinicId).collection('doctors')
  if (email) {
    const ya = await docsCol.where('email', '==', email).limit(1).get()
    if (!ya.empty) return  // ya tiene ficha → no duplicar
  }
  const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
  const cfg = (cfgSnap.exists ? cfgSnap.data() : {}) as Record<string, unknown>
  const now = new Date().toISOString()
  await docsCol.add({
    nombre: (nombre?.trim() || email.split('@')[0] || 'Médico'),
    especialidad: especialidad?.trim() || '',
    telefono: '',
    email: email || '',
    activo: true,
    horario: cfg.horario ?? DEFAULT_CONFIG.horario,
    duraciones: cfg.duraciones ?? DEFAULT_CONFIG.duraciones,
    intervaloMinutos: cfg.intervaloMinutos ?? DEFAULT_CONFIG.intervaloMinutos ?? 10,
    zonaHoraria: cfg.zonaHoraria ?? DEFAULT_CONFIG.zonaHoraria ?? 'America/Mexico_City',
    createdAt: now,
    updatedAt: now,
  })
}

export async function POST(req: NextRequest) {
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response
  const uid = acc.uid

  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, motivo: 'Datos inválidos' }, { status: 400 }) }
  const code = String(body.code ?? '').trim()
  if (!code) return NextResponse.json({ ok: false, motivo: 'Falta el código' }, { status: 400 })

  const invRef = adminDb.collection('clinic_invitations').doc(code)
  const memberRef = adminDb.collection('clinic_members').doc(uid)

  try {
    // ¿Ya pertenece a una clínica?
    const memberSnap = await memberRef.get()
    if (memberSnap.exists) {
      const existing = memberSnap.data() as { clinicId?: string }
      const inv = await invRef.get()
      const invClinic = inv.exists ? (inv.data() as { clinicId?: string }).clinicId : undefined
      if (existing.clinicId && existing.clinicId === invClinic) return NextResponse.json({ ok: true, clinicId: existing.clinicId })
      return NextResponse.json({ ok: false, motivo: 'Ya perteneces a otra clínica. Cierra sesión y crea una cuenta nueva para aceptar esta invitación.' }, { status: 409 })
    }

    const resultado = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(invRef)
      if (!snap.exists) return { ok: false as const, motivo: 'Invitación no encontrada.' }
      const inv = snap.data() as { clinicId: string; role: string; used?: boolean; expiresAt?: string; creadoPor?: string; nombreInvitado?: string; especialidad?: string }
      const vigencia = invitacionVigente(inv, Date.now())
      if (!vigencia.ok) return { ok: false as const, motivo: vigencia.motivo }

      tx.set(memberRef, {
        clinicId: inv.clinicId,
        role: inv.role,               // ROL desde la invitación validada (no del cliente)
        email: acc.email ?? '',
        invitadoPor: inv.creadoPor ?? '',
        createdAt: new Date().toISOString(),
      })
      tx.update(invRef, { used: true, usedBy: uid, usedAt: new Date().toISOString() })
      return { ok: true as const, clinicId: inv.clinicId, role: inv.role, nombreInvitado: inv.nombreInvitado, especialidad: inv.especialidad }
    })

    // UNA SOLA LISTA: si el que se une es MÉDICO, se crea SOLO su ficha en el
    // catálogo de "Médicos" (para que tenga agenda) — así el admin no tiene que
    // agregarlo aparte. Se omite si ya existe una ficha con su correo.
    if (resultado.ok && resultado.role === 'medico') {
      try { await crearMedicoSiFalta(resultado.clinicId, acc.email ?? '', resultado.nombreInvitado, resultado.especialidad) } catch { /* no bloquea el alta */ }
    }

    return NextResponse.json({ ok: resultado.ok, clinicId: resultado.ok ? resultado.clinicId : undefined, motivo: resultado.ok ? undefined : resultado.motivo }, { status: resultado.ok ? 200 : 409 })
  } catch (e) {
    // El mensaje del Admin SDK no viaja al navegador (S-006 · REG-534).
    safeLog.error('[clinic/unirse]', e)
    return NextResponse.json({ ok: false, motivo: 'No se pudo aceptar la invitación. Intenta de nuevo en un momento.' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
