/**
 * GET /api/cron/asientos — concilia el cobro por asiento de TODOS los
 * consultorios, cada noche.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El cupo de IA escala con los médicos PRESENTES y se aplica al instante. El
 * cobro vive en `medicosContratados`, y hasta hoy **el único sitio del
 * repositorio que lo escribía** era el botón «sincronizar» de una pantalla de
 * configuración.
 *
 * Nadie pulsa ese botón. Un consultorio da de alta cinco médicos, los cinco
 * reciben su cuota esa misma tarde, y la suscripción sigue cobrando uno —
 * indefinidamente. Es una fuga que crece con el éxito.
 *
 * ── VA EN LOS DOS SENTIDOS, Y ESO NO ES UN DETALLE ───────────────────────────
 *
 * También AJUSTA A LA BAJA. Un consultorio que da de baja a dos médicos deja de
 * pagar por ellos esa misma noche, sin tener que pedirlo. Un cobro automático
 * que sólo sube no es una conciliación: es una trampa, y la primera vez que un
 * cliente lo note se lleva por delante la confianza en todo lo demás.
 *
 * ── LA REGLA NO ESTÁ AQUÍ ────────────────────────────────────────────────────
 *
 * Está en `lib/finanzas/asientos.ts`, compartida con el botón. Si Stripe no se
 * puede ajustar, NO se marca como contratado — copiar esa regla habría
 * garantizado que un día difirieran, y la que difiriera dejaría médicos
 * habilitados sin cobrar hasta el cierre de mes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { redactarString } from '@/lib/security/sanitize'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { stripe, priceMedicoDe, type PlanKey } from '@/lib/stripe'
import { contarMedicos } from '@/lib/ai-keys'
import { queHacer, itemsParaStripe, itemPrevio } from '@/lib/finanzas/asientos'
import { registrarLatido } from '@/lib/ops/latido'
import { correlacionDeTrabajo } from '@/lib/observabilidad/correlacion'

export const maxDuration = 300

/** Tope de consultorios por corrida. Si se alcanza, se DECLARA. */
const TOPE = 500
const ES_PLAN_ASIENTOS = (p: string) => p === 'clinica' || p === 'premium'

export async function GET(req: NextRequest) {
  /* REG-566 — la traza de ESTA ejecución, acuñada al arrancar: un trabajo de
     fondo no nace de un navegador, así que no acepta la que le manden. */
  const correlacion = correlacionDeTrabajo()
  const t0 = Date.now()
  /**
   * Fail-closed: un endpoint que MUEVE DINERO no queda abierto. Si el secreto no
   * está configurado, no corre — prefiero una conciliación que no ocurre a una
   * que puede disparar cualquiera.
   */
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  }

  let ajustados = 0, alDia = 0, noAjustables = 0, fallos = 0, recortado = false
  const pendientes: { clinicId: string; porQue: string; medicos: number; contratados: number }[] = []

  try {
    const snap = await adminDb.collection('clinics').limit(TOPE).get()
    if (snap.size >= TOPE) recortado = true

    for (const doc of snap.docs) {
      const clinicId = doc.id
      const c = doc.data() as Record<string, unknown>
      const plan = String(c?.plan ?? '')
      if (!ES_PLAN_ASIENTOS(plan)) continue

      try {
        const medicos = await contarMedicos(clinicId)
        const contratados = Number(c?.medicosContratados ?? 1)
        const stripeSubscriptionId = String(c?.stripeSubscriptionId ?? '')
        const seatPrice = priceMedicoDe(plan as PlanKey)

        const decision = queHacer({ conAsientos: true, medicos, contratados, stripeSubscriptionId, seatPrice })

        if (decision.estado === 'al_dia') { alDia++; continue }
        if (decision.estado === 'no_ajustable') {
          noAjustables++
          /**
           * NO se marca como contratado, y se DEVUELVE en la respuesta con su
           * motivo. Un consultorio que no se puede conciliar y del que nadie se
           * entera es exactamente la fuga de antes, con un cron delante.
           */
          pendientes.push({ clinicId, porQue: decision.porQue, medicos, contratados })
          continue
        }
        if (decision.estado === 'sin_asientos') continue

        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
        const items = itemsParaStripe(decision.extras, seatPrice, itemPrevio(sub, seatPrice))
        if (items.length) {
          await stripe.subscriptions.update(stripeSubscriptionId, { items, proration_behavior: 'create_prorations' })
        }
        await doc.ref.set({ medicosContratados: medicos }, { merge: true })
        ajustados++
      } catch (e) {
        /**
         * Un consultorio que falla NO detiene la conciliación de los demás: un
         * error de Stripe en uno dejaría a los otros cuatrocientos sin conciliar
         * durante otro día entero.
         */
        fallos++
        safeLog.error(`[cron/asientos] ${clinicId}`, e)
      }
    }
  } catch (e) {
    safeLog.error('[cron/asientos]', e)
    await registrarLatido('asientos', { correlacion, ok: false, duracionMs: Date.now() - t0, error: redactarString(String(e)).slice(0, 160) })
    return NextResponse.json({ ok: false, error: 'no se pudo conciliar' }, { status: 500 })
  }

  await registrarLatido('asientos', {
      correlacion,
    ok: true, duracionMs: Date.now() - t0,
    detalle: { ajustados, alDia, noAjustables, fallos, recortado },
  })
  return NextResponse.json({ ok: true, ajustados, alDia, noAjustables, fallos, recortado, pendientes })
}
