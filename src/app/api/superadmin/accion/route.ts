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
import { calcularPrecioPaquete } from '@/lib/pricing'
import { guardarNivelIA } from '@/lib/ai-keys'

type Any = Record<string, unknown>

/** Cuenta documentos de una subcolección con agregación (barato). */
async function contar(ref: FirebaseFirestore.CollectionReference): Promise<number> {
  try { return (await ref.count().get()).data().count } catch { return 0 }
}

export async function POST(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  let body: { clinicId?: string; accion?: string; motivo?: string; dias?: number; notas?: string; modulos?: unknown[]; paqueteId?: string; paqueteNombre?: string; nivelIA?: string }
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
      // Da 14 días de gracia (con fecha), si no el gate la bloquea al instante.
      patch = { plan: 'trial', status: 'trial', paseLibre: false, paseLibreMotivo: '', paseLibrePor: '', trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString() }
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
      const d = snap.exists ? (snap.data() as Any) : {}
      const actual = String(d.trialEndsAt ?? '')
      const base = actual && new Date(actual).getTime() > Date.now() ? new Date(actual).getTime() : Date.now()
      const nuevaFecha = new Date(base + dias * 86400000).toISOString()
      // NO degradar una clínica ACTIVA / de PAGO / con pase libre: solo empujar la
      // fecha. Poner status/plan='trial' aquí bloqueaba a clientes que ya pagaban.
      const esActivaOPago = d.status === 'active' || d.paseLibre === true || d.plan === 'cortesia'
      patch = esActivaOPago ? { trialEndsAt: nuevaFecha } : { status: 'trial', plan: 'trial', trialEndsAt: nuevaFecha }
      break
    }
    case 'guardar_notas':
      patch = { notasInternas: String(body.notas ?? '').slice(0, 2000) }
      break
    case 'asignar_modulos': {
      // Asigna a la clínica un conjunto de módulos (paquete o combinación a mano).
      const modulos = (Array.isArray(body.modulos) ? body.modulos : []).map(String).filter(k => TODOS_LOS_MODULOS.includes(k))
      // GUARD: un array vacío se interpretaría como "acceso a TODO" (modulosDe),
      // lo opuesto a lo deseado. Rechazamos: hay que elegir al menos un módulo.
      if (modulos.length === 0) return NextResponse.json({ ok: false, error: 'Elige al menos un módulo (0 módulos daría acceso total).' }, { status: 400 })
      // Calcula el PRECIO del paquete según su modelo de cobro y el TAMAÑO real de
      // la clínica (médicos / camas). Guarda también el modelo → la consola lo
      // recalcula en vivo cuando cambian los médicos/camas.
      let paquetePrecio = 0
      let modeloPrecio: string = 'fijo', precioBase = 0, precioPorUnidad = 0
      if (body.paqueteId) {
        try {
          const pq = await adminDb.collection('platform_packages').doc(String(body.paqueteId)).get()
          const pd = (pq.data() as Any | undefined) ?? {}
          modeloPrecio = String(pd.modeloPrecio ?? 'fijo')
          precioBase = Number(pd.precioBase ?? pd.precio ?? 0)
          precioPorUnidad = Number(pd.precioPorUnidad ?? 0)
          const [medicos, camas] = await Promise.all([
            contar(ref.collection('doctors')),
            contar(ref.collection('camas')),
          ])
          paquetePrecio = calcularPrecioPaquete(
            { modeloPrecio: modeloPrecio as 'fijo' | 'por_medico' | 'por_cama', precio: Number(pd.precio ?? 0), precioBase, precioPorUnidad },
            { medicos, camas },
          )
        } catch { /* */ }
      }
      patch = { modulos, paqueteId: body.paqueteId ?? '', paqueteNombre: body.paqueteNombre ?? '', paquetePrecio, modeloPrecio, precioBase, precioPorUnidad }
      break
    }
    case 'set_nivel_ia': {
      // Nivel de IA (Pro económico / Premium Opus+GPT-5). Vive en el doc de
      // secretos (secretos/ia.nivelIA), no en el doc de la clínica → se escribe
      // aparte y se retorna aquí mismo.
      const nivel = body.nivelIA === 'premium' ? 'premium' : 'pro'
      await guardarNivelIA(clinicId, nivel)
      await adminDb.collection('platform_admin_log').add({
        clinicId, accion, por: acc.email, detalle: { nivelIA: nivel }, fecha: now,
      })
      return NextResponse.json({ ok: true, nivelIA: nivel })
    }
    case 'eliminar_consultorio': {
      // BORRADO DEFINITIVO (irreversible): elimina el consultorio y TODOS sus
      // datos (pacientes, notas, config, secretos, subcolecciones) + libera a los
      // usuarios que le pertenecían (clinic_members). Solo el dueño (superadmin).
      await adminDb.recursiveDelete(ref)
      const miembros = await adminDb.collection('clinic_members').where('clinicId', '==', clinicId).get()
      if (!miembros.empty) {
        const batch = adminDb.batch()
        miembros.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
      await adminDb.collection('platform_admin_log').add({
        clinicId, accion, por: acc.email, detalle: { miembrosLiberados: miembros.size }, fecha: now,
      })
      return NextResponse.json({ ok: true, eliminado: clinicId })
    }
    case 'entrar_a_consultorio': {
      // Reconecta la CUENTA DEL DUEÑO (quien llama) a un consultorio PROPIO cuya
      // membresía quedó apuntando a otro (p. ej. si se creó uno nuevo por error).
      // CANDADO DE PRIVACIDAD: SOLO consultorios que ÉL creó (ownerId === su uid).
      // Nunca puede entrar a la cuenta de otro médico ni ver sus pacientes.
      const dueñoDoc = String(((await ref.get()).data() as Any)?.ownerId ?? '')
      if (dueñoDoc !== acc.uid) {
        return NextResponse.json({ ok: false, error: 'Solo puedes entrar a consultorios que TÚ creaste. No puedes acceder a la cuenta de otro médico.' }, { status: 403 })
      }
      await adminDb.collection('clinic_members').doc(acc.uid).set({
        clinicId, role: 'admin', email: acc.email, updatedAt: now,
      }, { merge: true })
      await adminDb.collection('platform_admin_log').add({
        clinicId, accion, por: acc.email, detalle: { uid: acc.uid }, fecha: now,
      })
      return NextResponse.json({ ok: true, entrarA: clinicId })
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
