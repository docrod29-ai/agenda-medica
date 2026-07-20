import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { DEFAULT_CONFIG } from '@/types'

/**
 * Alta del consultorio, ATÓMICA.
 *
 * Antes vivía en el cliente (`createClinic`) como cuatro escrituras sueltas:
 * leer `clinic_members/{uid}` → `addDoc(clinics)` → `setDoc(clinic_members)` →
 * `setDoc(config/main)`. El comentario decía que el candado anti-duplicado estaba
 * cerrado, pero un leer-y-luego-escribir no es atómico:
 *
 *  - Dos pestañas en /setup enviando con menos de un segundo de diferencia: ambas
 *    leen que no hay membresía, ambas crean un consultorio, y la segunda PISA la
 *    membresía de la primera. Queda un consultorio huérfano —y facturable— al que
 *    el usuario ya no puede entrar.
 *  - Si `addDoc(clinics)` funciona pero `setDoc(clinic_members)` falla (red,
 *    reglas), queda el consultorio huérfano Y el usuario vuelve a /setup: el
 *    siguiente intento crea otro más.
 *
 * En una transacción las tres escrituras se aplican o no se aplica ninguna, y la
 * lectura de la membresía queda dentro del mismo ámbito. Es el mismo patrón que
 * ya usaba /api/clinic/unirse.
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  let body: { nombreClinica?: string; nombreMedico?: string; especialidad?: string; telefono?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const nombreClinica = String(body.nombreClinica ?? '').trim().slice(0, 160)
  const nombreMedico = String(body.nombreMedico ?? '').trim().slice(0, 160)
  // /setup los pedía y `createClinic` no los aceptaba: se perdían en silencio, y
  // la especialidad alimenta después la firma de la nota y el PDF.
  const especialidad = String(body.especialidad ?? '').trim().slice(0, 120)
  const telefono = String(body.telefono ?? '').replace(/\D/g, '').slice(0, 20)
  if (!nombreClinica || !nombreMedico) {
    return NextResponse.json({ ok: false, error: 'Faltan el nombre del consultorio y el del médico' }, { status: 400 })
  }

  const uid = acceso.uid
  const ahora = new Date().toISOString()
  const finPrueba = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const clinicId = await adminDb.runTransaction(async (tx) => {
      const miembroRef = adminDb.collection('clinic_members').doc(uid)
      const miembro = await tx.get(miembroRef)
      // Si ya pertenece a un consultorio, se devuelve ese: nunca se crea un segundo
      // ni se pisa la membresía existente.
      if (miembro.exists) {
        const cid = miembro.data()?.clinicId
        if (cid) return String(cid)
      }

      // Ref con id generado por adelantado: hace falta para poder escribir la
      // clínica, la membresía y la config en la MISMA transacción.
      const clinicaRef = adminDb.collection('clinics').doc()
      tx.set(clinicaRef, {
        nombreClinica, nombreMedico,
        plan: 'trial', status: 'trial', ownerId: uid,
        trialEndsAt: finPrueba, createdAt: ahora, updatedAt: ahora,
      })
      tx.set(miembroRef, { clinicId: clinicaRef.id, role: 'admin', createdAt: ahora })
      tx.set(clinicaRef.collection('config').doc('main'), {
        ...DEFAULT_CONFIG, nombreClinica, nombreMedico,
        ...(especialidad ? { especialidad } : {}),
        ...(telefono ? { telefono } : {}),
        createdAt: ahora, updatedAt: ahora,
      })
      return clinicaRef.id
    })

    return NextResponse.json({ ok: true, clinicId })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'No se pudo crear el consultorio' },
      { status: 502 },
    )
  }
}
