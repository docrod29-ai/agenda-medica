/**
 * GET /api/cron/audio-nom004
 *
 * BORRA EL AUDIO DE CONSULTA QUE YA CUMPLIÓ LA NOM-004.
 *
 * ── QUÉ AUTORIZÓ EL DUEÑO, Y QUÉ NO ─────────────────────────────────────────
 *
 * Autorizó **conservar** el audio (8-ago-2026) y **borrarlo según la NOM-004**
 * (2-sep-2026). Esta ruta es lo segundo, y sólo lo segundo: la nota, la
 * transcripción y el sello **se quedan**. Aquí caduca un archivo de audio.
 *
 * `src/lib/ops/retencion.ts` dice, y sigue siendo cierto, que un barrendero que
 * se lleve por delante un dato clínico es infinitamente peor que una colección
 * que crece — por eso ese cron no toca el expediente. Éste es OTRA ruta a
 * propósito, para no aflojar aquel invariante: allí sigue prohibido, aquí hay
 * una autorización explícita y acotada a un archivo.
 *
 * ── POR QUÉ SE RECORRE POR PACIENTE Y NO POR BUCKET ─────────────────────────
 *
 * Listar el bucket y preguntar por cada objeto «¿de quién eres?» exige una
 * consulta por archivo y un índice de `collectionGroup` sobre `audioPath`.
 * Recorrer por paciente no necesita índice nuevo —las notas de un paciente son
 * una subcolección— y tiene una propiedad mejor: **un objeto que ninguna nota
 * referencia nunca se visita**, así que no puede borrarse por accidente. Es la
 * misma negativa que ya declara `veredictoNom004` para el huérfano, hecha
 * estructura.
 *
 * Consecuencia declarada: el audio anterior a REG-509 —el que no dejó ruta en su
 * nota— **esta ruta no lo borra nunca**. Limpiarlo es otro problema y no se
 * resuelve adivinando de quién era.
 *
 * ── SECO POR OMISIÓN ────────────────────────────────────────────────────────
 *
 * Sin `?aplicar=1` **cuenta y no borra**. Borrar PHI es irreversible y merece el
 * mismo gesto aparte que el botón del backfill: primero se mira el número, y
 * sólo entonces se aplica. Los recuentos son recuentos: nunca nombres, nunca
 * rutas, nunca identificadores de paciente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import admin, { adminDb } from '@/lib/firebase-admin'
import { evaluarRetencion } from '@/lib/retencion'
import { veredictoNom004 } from '@/lib/expediente/audio-nom004'
import { registrarLatido } from '@/lib/ops/latido'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

const CRON_SECRET = process.env.CRON_SECRET
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

/** Tope por ejecución: el cron corre a diario y no debe agotar su tiempo. */
const PACIENTES_POR_PASADA = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  // Fail-closed, igual que los otros crons: un endpoint que borra no puede
  // quedar abierto por no tener secreto configurado.
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
    }
  } else if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!BUCKET) {
    // Se DECLARA en vez de responder 200 con cero borrados: «0 borrados» y «no
    // pude mirar» se leen igual desde fuera, y sólo uno significa que hay PHI
    // esperando.
    return NextResponse.json({
      ok: false,
      error: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no configurado: el barrido no puede mirar el bucket.',
    }, { status: 503 })
  }

  const aplicar = req.nextUrl.searchParams.get('aplicar') === '1'
  const arranque = Date.now()

  try {
    const bucket = admin.storage().bucket(BUCKET)
    const clinicas = await adminDb.collection('clinics').select().get()

    let pacientesMirados = 0
    let sinVeredicto = 0      // no_evaluable: no se pudo fechar el último acto
    let vencidos = 0
    let elegibles = 0         // audios que la norma ya permite borrar
    let borrados = 0
    let fallos = 0
    let truncada = false

    for (const c of clinicas.docs) {
      if (pacientesMirados >= PACIENTES_POR_PASADA) { truncada = true; break }
      const pacientes = await adminDb
        .collection('clinics').doc(c.id).collection('patients')
        .limit(PACIENTES_POR_PASADA - pacientesMirados).get()

      for (const p of pacientes.docs) {
        pacientesMirados++
        const notasSnap = await adminDb
          .collection('clinics').doc(c.id)
          .collection('patients').doc(p.id)
          .collection('notas').get()

        const notas = notasSnap.docs.map(d => d.data() as NotaMedica)
        const retencion = evaluarRetencion({ id: p.id, ...p.data() } as Patient, notas)
        if (retencion.estado === 'no_evaluable') { sinVeredicto++; continue }
        if (retencion.estado !== 'vencido') continue
        vencidos++

        for (const n of notas) {
          if (!n.audioPath) continue
          const v = veredictoNom004({ ruta: n.audioPath, retencion })
          if (!v.borrar) continue
          elegibles++
          if (!aplicar) continue
          try {
            await bucket.file(n.audioPath).delete({ ignoreNotFound: true })
            borrados++
          } catch (e) {
            fallos++
            // Sin la ruta: lleva el uid del médico y la clave de la consulta.
            safeLog.warn('[cron/audio-nom004] no se pudo borrar un audio vencido', e)
          }
        }
      }
    }

    await registrarLatido('audio-nom004', {
      ok: true, duracionMs: Date.now() - arranque,
      // Recuentos, nunca contenido: estos documentos llevan PHI.
      detalle: { modo: aplicar ? 'aplicado' : 'seco', pacientesMirados, elegibles, borrados },
    })

    return NextResponse.json({
      ok: true,
      // Modo, primero: un acta que no diga si borró o sólo contó no sirve.
      modo: aplicar ? 'aplicado' : 'seco (sin ?aplicar=1 no se borra nada)',
      pacientesMirados,
      /** No se pudo fechar su último acto: NO se tocó nada suyo. */
      sinVeredicto,
      vencidos,
      elegibles,
      borrados,
      fallos,
      /** Si se llenó el tope quedan más: un retraso acumulado no debe parecer vacío. */
      truncada,
      ms: Date.now() - arranque,
    })
  } catch (e) {
    safeLog.error('[cron/audio-nom004] el barrido falló', e)
    await registrarLatido('audio-nom004', { ok: false, duracionMs: Date.now() - arranque, error: 'el barrido falló' })
    return NextResponse.json({ ok: false, error: 'el barrido falló' }, { status: 500 })
  }
}
