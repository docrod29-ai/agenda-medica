/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed       → activate subscription on clinic
 *   - customer.subscription.updated    → update plan/status
 *   - customer.subscription.deleted    → suspend clinic
 *   - invoice.payment_failed           → mark payment overdue
 */

import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { stripe, nivelDePlan } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { agregarCreditosExtra, guardarNivelIA } from '@/lib/ai-keys'
import { MODULOS_DE_PLAN } from '@/lib/modulos'
import type { PlanKey } from '@/lib/stripe'
import type { EstadoDisputa } from '@/lib/finanzas/movimientos'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

/* ── Helper: update clinic status/plan ────────────────────── */
async function updateClinic(clinicId: string, data: Record<string, unknown>) {
  await adminDb.collection('clinics').doc(clinicId).update({
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

async function getClinicIdByCustomer(customerId: string): Promise<string | null> {
  const snap = await adminDb
    .collection('clinics')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0].id
}

/* ── Stripe → nuestro plan (por monto MXN, respaldo si no viene en metadata) ── */
/**
 * Asienta una disputa. Idempotente: UN documento por disputa, reescrito con su
 * estado actual, así que `created` y `closed` acaban en el mismo sitio y los
 * reintentos de Stripe no la duplican.
 *
 * El signo del dinero NO se decide aquí: lo pone `efectivoDe` a partir del tipo
 * y el estado (`src/lib/finanzas/movimientos.ts`), que es el único sitio donde
 * se define «cuánto entró».
 */
async function registrarDisputa(
  d: import('stripe').Stripe.Dispute,
  estado: EstadoDisputa,
  clinicId: string | null,
  livemode: boolean,
) {
  await adminDb.collection('platform_payments').doc(`dispute_${d.id}`).set({
    tipo: 'contracargo',
    estadoDisputa: estado,
    clinicId: clinicId ?? '',
    disputeId: d.id,
    chargeId: typeof d.charge === 'string' ? d.charge : (d.charge?.id ?? ''),
    monto: (d.amount ?? 0) / 100,
    moneda: (d.currency ?? 'mxn').toUpperCase(),
    motivo: d.reason ?? '',
    fecha: new Date((d.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    descripcion: `Contracargo (${d.reason ?? 'sin motivo'})`,
    livemode,
    createdAt: new Date().toISOString(),
  }, { merge: true })
}

function planPorMonto(amount: number): PlanKey {
  // Precios (centavos MXN): 34900 Agenda · 89900 Clínica · 159000 Pro · 349900 Hospital (ver PLANES en @/lib/planes-ia)
  if (amount <= 50000) return 'agenda'
  if (amount <= 120000) return 'clinica'
  if (amount <= 220000) return 'premium'
  return 'hospital'
}
const ES_PLAN = (p: unknown): p is PlanKey => p === 'agenda' || p === 'clinica' || p === 'premium' || p === 'hospital'

/**
 * Estado interno del consultorio a partir del estado de la suscripción de Stripe.
 *
 * La clave está en `past_due`: Stripe emite ese estado —y un
 * `invoice.payment_failed`— en el PRIMER intento fallido del ciclo, no al agotar
 * los reintentos (reintenta a los 3, 5 y 7 días). El manejo anterior suspendía la
 * clínica en ese instante, así que un rechazo transitorio de tarjeta le quitaba
 * al médico el acceso a TODOS los expedientes de sus pacientes el mismo día,
 * aunque el cobro se recuperara 48 h después. Ese es el caso "pierde acceso
 * pagando".
 *
 * Durante el dunning se mantiene el acceso (estado 'active'); solo se corta
 * cuando Stripe da el cobro por definitivamente perdido (`unpaid`) o cancela la
 * suscripción (`canceled`).
 */
function estadoDeSuscripcion(status: string): 'active' | 'suspended' | 'cancelled' {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':      // en reintentos: NO cortar todavía
      return 'active'
    case 'canceled':
      return 'cancelled'
    default:              // unpaid, incomplete_expired, incomplete → sin acceso
      return 'suspended'
  }
}

/** Activa el plan en el consultorio: estado + MÓDULOS (solo lo que compró) + nivel de IA. */
async function activarPlan(clinicId: string, plan: PlanKey, extra: Record<string, unknown>) {
  // modulos = EXACTAMENTE los del plan (candado "solo lo que compró"). Al cambiar
  // de plan se reescribe, así se agregan/quitan funciones según corresponda.
  const modulos = MODULOS_DE_PLAN[plan] ?? MODULOS_DE_PLAN.clinica
  await updateClinic(clinicId, { plan, status: 'active', modulos, ...extra })
  if (plan !== 'agenda') {
    try { await guardarNivelIA(clinicId, nivelDePlan(plan)) } catch { /* no-bloqueante */ }
  }
}

/**
 * Evita EMPALME de suscripciones: cancela cualquier OTRA suscripción activa del
 * mismo cliente, dejando solo la nueva. Así cambiar de plan no acumula cobros.
 */
async function cancelarOtrasSuscripciones(customerId: string, conservarSubId: string) {
  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 20 })
    const trials = await stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 20 })
    const todas = [...subs.data, ...trials.data]
    for (const s of todas) {
      if (s.id !== conservarSubId) {
        await stripe.subscriptions.cancel(s.id).catch(() => { /* ya cancelada / carrera */ })
      }
    }
  } catch { /* no-bloqueante: si falla, no rompe la activación */ }
}

/* ── Route handler ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    safeLog.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  safeLog.info(`[Stripe Webhook] ${event.type}`)

  try {
    switch (event.type) {

      /* ── Checkout completed → suscripción creada O recarga comprada ─── */
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session
        const clinicId = (session.metadata?.clinicId ?? '') as string
        if (!clinicId) break

        // RECARGA (pago único): suma créditos extra al mes en curso. Idempotente
        // por el id de la sesión (Stripe reintenta el webhook).
        if (session.mode === 'payment' && session.metadata?.tipo === 'recarga') {
          const n = Number(session.metadata?.creditos ?? 0)
          if (n > 0) {
            // Candado ATÓMICO: create() falla si el doc ya existe. Antes era
            // get()+set() (no atómico) → dos entregas simultáneas del mismo
            // session.id leían "no procesada" y ambas abonaban (doble crédito).
            const marca = adminDb.collection('recargas_procesadas').doc(session.id)
            try {
              await marca.create({ clinicId, creditos: n, fecha: new Date().toISOString() })
            } catch {
              break  // ya procesada (o carrera perdida) → NO abonar de nuevo
            }
            await agregarCreditosExtra(clinicId, n)
          }
          break
        }

        /**
         * ANTICIPO DEL PACIENTE (pago único desde el portal).
         *
         * Antes NO tenía rama propia, y como el desvío de arriba solo mira
         * `tipo === 'recarga'`, caía en la rama de SUSCRIPCIÓN de abajo. El daño
         * era doble y silencioso:
         *
         *  1. `activarPlan(clinicId, 'clinica')` reescribía el plan del
         *     consultorio. Una clínica en plan Hospital perdía los módulos que
         *     paga, y `stripeSubscriptionId` quedaba en '' porque un pago único no
         *     trae suscripción — rompiendo el vínculo con la suscripción real que
         *     Stripe sigue cobrando. En el otro sentido, una cuenta de prueba se
         *     quedaba con plan Clínica activo para siempre por el importe de un
         *     anticipo.
         *  2. El dinero del paciente no generaba NINGÚN cobro, así que no existía
         *     en Finanzas ni en el corte de caja: la cita salía en "cuentas por
         *     cobrar" ya pagada y la asistente la cobraba otra vez en ventanilla.
         *
         * Se registra el cobro con candado atómico por `session.id` —el mismo
         * patrón que ya usaba la recarga— porque Stripe reintenta el webhook.
         */
        if (session.mode === 'payment' && session.metadata?.tipo === 'paciente_anticipo') {
          const citaId = String(session.metadata?.citaId ?? '')
          const marca = adminDb.collection('anticipos_procesados').doc(session.id)
          try {
            await marca.create({ clinicId, citaId, fecha: new Date().toISOString() })
          } catch {
            break  // ya procesado (o carrera perdida) → NO registrar de nuevo
          }
          /**
           * SI EL EFECTO FALLA, LA MARCA SE RETIRA.
           *
           * La marca se escribe ANTES de registrar el cobro (tiene que ser así:
           * es lo que hace atómica la exclusión entre dos entregas simultáneas
           * del mismo evento). Pero eso abre una ventana: si Firestore falla
           * entre la marca y el cobro, Stripe reintenta, la marca ya existe, se
           * hace `break`… y el cobro no se registra NUNCA.
           *
           * El dinero está cobrado en Stripe, la marca dice «procesado» y en
           * Finanzas no existe. Dinero invisible, que es el peor estado posible.
           *
           * Retirar la marca al fallar devuelve el evento a «no procesado» y el
           * reintento de Stripe —que llega solo, porque devolvemos 500— lo hace
           * de nuevo. Si el borrado también falla, al menos queda el error en el
           * log con el `session.id` para reconciliar a mano.
           */
          try {
          const ahora = new Date()
          const iso = ahora.toISOString()
          const dia = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(ahora)
          const monto = (session.amount_total ?? 0) / 100
          const citaRef = citaId ? adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId) : null
          const cita = citaRef ? (await citaRef.get()).data() as Record<string, unknown> | undefined : undefined
          // INTEGRIDAD DE PAGO (L1 auditoría maestra): solo se SALDA la cita si lo
          // pagado cubre el monto esperado (la tarifa que fijó el servidor en
          // pagoMonto). Un pago parcial se registra como 'abono' y la cita queda
          // 'pendiente-pago' con el saldo, no como 'pagada'. Así corte-caja no la
          // da por cobrada (corte-caja: concepto 'abono' NO salda).
          /**
           * ¿ESTE PAGO SALDA LA CONSULTA, O ES UN ABONO?
           *
           * `pagoMonto` es la tarifa que fijó el servidor. Cuando el consultorio
           * NO tenía tarifa para esa cita, el checkout escribió ahí el anticipo
           * y lo marcó: en ese caso el sistema NO sabe cuánto vale la consulta,
           * así que no puede afirmar que quede saldada — sólo puede decirlo.
           */
          const sinTarifaConocida = cita?.pagoMontoEsAnticipoSinTarifa === true
          const esperado = Number(cita?.pagoMonto) || 0
          const cubre = esperado <= 0 || monto + 0.01 >= esperado
          const cobroRef = await adminDb.collection('clinics').doc(clinicId).collection('cobros').add({
            fecha: iso, dia, mes: dia.slice(0, 7),
            /**
             * `metodo` TIENE que ser un MetodoPago válido.
             *
             * Estaba escrito 'tarjeta', que NO existe en el catálogo (las claves
             * son tarjeta_debito, tarjeta_credito, stripe…). Dos daños: en el
             * desglose por forma de pago del corte la fila salía sin etiqueta, y
             * la exportación a CSV reventaba con TypeError al hacer
             * `METODO_LABEL[c.metodo].replace(...)` — o sea, cualquier periodo
             * con un anticipo en línea no se podía descargar, que es justo el
             * archivo que se le manda al contador.
             */
            monto, metodo: 'stripe', concepto: cubre ? 'consulta' : 'abono',
            descripcion: cubre
              ? (sinTarifaConocida
                  ? 'Anticipo pagado en línea (el consultorio no tenía tarifa fijada para esta cita)'
                  : 'Pago en línea del paciente')
              : 'Abono parcial pagado en línea por el paciente',
            citaId: citaId || undefined,
            patientId: (cita?.pacienteId as string) || undefined,
            patientNombre: (cita?.pacienteNombre as string) || undefined,
            medicoId: (cita?.medicoId as string) || undefined,
            medicoNombre: (cita?.medicoNombre as string) || undefined,
            folio: `CB-${session.id.slice(-7).toUpperCase()}`,
            referenciaExterna: session.id,
            createdAt: iso, creadoPor: 'stripe:anticipo', cancelado: false,
          })
          /**
           * EL `cobroId` ES EL CANDADO CONTRA EL DOBLE COBRO, Y FALTABA.
           *
           * Aquí se marcaba la cita como `pagada` pero SIN `cobroId`. Y el
           * candado de `registrarCobro` (lib/cobros.ts) es exactamente ese
           * campo, igual que la condición que oculta el botón "Cobrar" en la
           * lista de citas.
           *
           * Resultado real, no hipotético: el paciente pagaba su anticipo por
           * el portal, llegaba al consultorio, la asistente seguía viendo el
           * botón "Cobrar" activo y le cobraba otra vez. Nada lo impedía, y el
           * corte de caja sumaba los dos.
           *
           * En el ABONO no se pone: un pago parcial no salda la cita y tiene
           * que poder cobrarse el resto. Es la misma regla que ya aplica
           * `registrarCobro` para los abonos de ventanilla.
           */
          if (citaRef) await citaRef.update(cubre
            ? { estado: 'pagada', pagadoEn: iso, cobroId: cobroRef.id, cobradoEn: iso, updatedAt: iso }
            : { estado: 'pendiente-pago', saldoPendiente: Math.max(0, esperado - monto), abonadoEn: iso, updatedAt: iso })
          } catch (e) {
            await marca.delete().catch(() => { /* ver arriba: queda el error abajo para reconciliar */ })
            console.error('[stripe] anticipo NO registrado, marca retirada para que Stripe reintente', session.id, e)
            throw e  // 500 → Stripe reintenta
          }
          break
        }

        /**
         * SUSCRIPCIÓN: activa el plan + enciende el nivel de IA.
         *
         * La guarda por `mode` es deliberada: cualquier pago único FUTURO que se
         * añada al portal y no tenga rama propia arriba se descartaría aquí en vez
         * de reescribir el plan del consultorio, que es lo que pasó con el
         * anticipo del paciente.
         */
        if (session.mode !== 'subscription') break
        const plan = ES_PLAN(session.metadata?.plan) ? session.metadata!.plan as PlanKey : 'clinica'
        const nuevaSubId = String(session.subscription ?? '')
        await activarPlan(clinicId, plan, { stripeSubscriptionId: nuevaSubId })
        // Evita empalme: cancela cualquier otra suscripción activa del cliente.
        if (session.customer && nuevaSubId) {
          await cancelarOtrasSuscripciones(String(session.customer), nuevaSubId)
        }
        break
      }

      /* ── Subscription updated (upgrade/downgrade/renew) ── */
      case 'customer.subscription.updated': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const clinicId = sub.metadata?.clinicId
          ?? await getClinicIdByCustomer(sub.customer as string)

        if (!clinicId) break

        const item = sub.items.data[0]
        const plan = ES_PLAN(sub.metadata?.plan) ? sub.metadata!.plan as PlanKey : planPorMonto(item.price.unit_amount ?? 0)
        const status = estadoDeSuscripcion(sub.status)

        if (status === 'active') {
          await activarPlan(clinicId, plan, { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status })
        } else {
          await updateClinic(clinicId, { plan, status, stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status })
        }
        break
      }

      /* ── Subscription deleted (cancelled by user or overdue) ── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const clinicId = sub.metadata?.clinicId
          ?? await getClinicIdByCustomer(sub.customer as string)

        if (!clinicId) break

        /**
         * SÓLO SE CANCELA SI LA SUSCRIPCIÓN BORRADA ES LA QUE ESTÁ ACTIVA.
         *
         * ── EL FALLO, QUE ERA EL PEOR DE TODO EL CICLO DE COBRO ────────────
         *
         * Al cambiar de plan, `checkout.session.completed` activa el plan nuevo
         * y acto seguido llama a `cancelarOtrasSuscripciones`, que cancela la
         * VIEJA en Stripe. Stripe emite entonces este evento — de la vieja — y
         * aquí no se comparaba nada: se ponía `status: 'cancelled'` y
         * `stripeSubscriptionId: null` sin condición.
         *
         * O sea: el médico pulsaba «Cambiar a Pro», pagaba, y segundos después
         * su consultorio quedaba CANCELADO. Con eso pierde todas las escrituras
         * (el paywall corta), ve el muro de «Reactiva tu suscripción», y encima
         * se borra el vínculo con la suscripción que acaba de pagar, así que el
         * portal de facturación y los asientos dejan de encontrarla.
         *
         * Y no se recupera solo: `invoice.paid` sólo restaura desde
         * 'suspended', nunca desde 'cancelled'.
         *
         * La comparación con lo que la clínica tiene guardado convierte el
         * evento en lo que siempre debió ser: «se canceló TU suscripción», no
         * «se canceló una suscripción cualquiera de este cliente».
         */
        const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
        const subActual = String(clinicSnap.data()?.stripeSubscriptionId ?? '')
        if (subActual && subActual !== sub.id) {
          safeLog.info(`[Stripe Webhook] subscription.deleted de una suscripción VIEJA (${sub.id}); la clínica ya está en ${subActual}. No se cancela.`)
          break
        }

        await updateClinic(clinicId, {
          status: 'cancelled',
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: 'canceled',
        })
        break
      }

      /* ── DEVOLUCIÓN → el dinero SALE ────────────────────────────────
       *
       * Ninguno de estos tres eventos se manejaba (P0-3 de la auditoría). Si un
       * cliente pedía el dinero de vuelta, o lo reclamaba a su banco, Stripe se
       * lo devolvía y en NexusMED no pasaba NADA: el ingreso seguía contado y la
       * suscripción seguía activa. Le devuelves el dinero y se queda con el
       * producto.
       *
       * NO se cancela el plan automáticamente. Un reembolso puede ser parcial o
       * de cortesía, y cortarle el acceso a un cliente al que se le devolvió una
       * parte por un error de facturación sería peor que el problema. La decisión
       * es del dueño; lo que hace el código es dejar de mentirle sobre la caja y
       * ponerle el caso delante en la consola.
       */
      case 'charge.refunded': {
        const charge = event.data.object as import('stripe').Stripe.Charge
        const clinicId = await getClinicIdByCustomer(String(charge.customer ?? ''))
        /**
         * UN DOCUMENTO POR CARGO, con el total ACUMULADO — no uno por evento.
         *
         * `charge.amount_refunded` es el acumulado del cargo, así que reescribir
         * el mismo documento con ese valor es idempotente por construcción: dan
         * igual los reintentos de Stripe y los reembolsos parciales sucesivos.
         * Un documento por evento habría duplicado la devolución en cada
         * reentrega, que es justo lo que el candado de `invoice.paid` ya evita
         * para los cobros.
         */
        await adminDb.collection('platform_payments').doc(`refund_${charge.id}`).set({
          tipo: 'reembolso',
          clinicId: clinicId ?? '',
          stripeCustomerId: charge.customer ?? '',
          chargeId: charge.id,
          monto: (charge.amount_refunded ?? 0) / 100,
          moneda: (charge.currency ?? 'mxn').toUpperCase(),
          /**
           * LA FECHA ES LA DE LA DEVOLUCIÓN, NO LA DEL CARGO.
           *
           * Aquí iba `charge.created`, que es cuándo se COBRÓ. Un reembolso
           * hecho en agosto sobre un cargo de junio restaba en JUNIO: un mes ya
           * cerrado y declarado. Y como el documento se reescribe con el
           * acumulado, cada reembolso parcial sucesivo volvía a mover ese mismo
           * mes viejo.
           *
           * Se toma la devolución más reciente del cargo; si Stripe no expandió
           * la lista, se usa el instante del evento, que es lo más cercano a la
           * verdad que hay disponible.
           */
          fecha: new Date(
            (charge.refunds?.data?.reduce((max, r) => Math.max(max, r.created ?? 0), 0) || event.created || Math.floor(Date.now() / 1000)) * 1000,
          ).toISOString(),
          /** Cuándo se cobró originalmente. Se conserva para poder conciliar. */
          fechaCargoOriginal: new Date((charge.created ?? 0) * 1000).toISOString(),
          descripcion: 'Reembolso',
          reembolsoTotal: charge.refunded === true,
          livemode: event.livemode === true,
          createdAt: new Date().toISOString(),
        }, { merge: true })
        break
      }

      /* ── CONTRACARGO abierto → el banco retira el dinero ya ───────── */
      case 'charge.dispute.created': {
        const d = event.data.object as import('stripe').Stripe.Dispute
        const clinicId = await getClinicIdByCustomer(
          String((d.charge as unknown as { customer?: string })?.customer ?? ''),
        )
        await registrarDisputa(d, 'abierta', clinicId, event.livemode === true)
        /**
         * Se MARCA la clínica, no se le suspende.
         *
         * Suspender por una disputa abierta castigaría a quien todavía puede
         * ganarla —y las disputas por fraude las abre a veces el banco sin que el
         * cliente sepa—. Pero el dueño tiene que verlo el mismo día: es dinero ya
         * retirado más una comisión, y hay un plazo para responder con pruebas.
         */
        if (clinicId) {
          try {
            await updateClinic(clinicId, { disputaAbierta: true, disputaDesde: new Date().toISOString() })
          } catch { /* no-bloqueante: el movimiento ya quedó asentado */ }
        }
        break
      }

      /* ── CONTRACARGO cerrado → o vuelve el dinero, o se perdió ────── */
      case 'charge.dispute.closed': {
        const d = event.data.object as import('stripe').Stripe.Dispute
        const clinicId = await getClinicIdByCustomer(
          String((d.charge as unknown as { customer?: string })?.customer ?? ''),
        )
        // `won` devuelve el importe; cualquier otro desenlace lo deja fuera.
        const estado = d.status === 'won' ? 'ganada' : 'perdida'
        await registrarDisputa(d, estado, clinicId, event.livemode === true)
        if (clinicId) {
          try {
            await updateClinic(clinicId, { disputaAbierta: false, ultimaDisputa: estado })
          } catch { /* no-bloqueante */ }
        }
        break
      }

      /* ── Payment SUCCEEDED → registra el ingreso ────── */
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        const clinicId = await getClinicIdByCustomer(invoice.customer as string)
        const amount = (invoice.amount_paid ?? 0) / 100  // centavos → MXN
        if (amount <= 0) break
        // Registro idempotente por invoice.id (Stripe reintenta el webhook).
        await adminDb.collection('platform_payments').doc(invoice.id ?? `pay_${event.id}`).set({
          clinicId: clinicId ?? '',
          stripeCustomerId: invoice.customer ?? '',
          invoiceId: invoice.id ?? '',
          monto: amount,
          moneda: (invoice.currency ?? 'mxn').toUpperCase(),
          fecha: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          descripcion: invoice.lines?.data?.[0]?.description ?? 'Suscripción',
          // livemode: distingue un pago REAL de uno de PRUEBA (Stripe en modo test).
          // Sin esto la consola contaba el dinero de prueba como ingreso real.
          livemode: event.livemode === true,
          createdAt: new Date().toISOString(),
        }, { merge: true })
        /**
         * Se RESTAURA el acceso al cobrar. Antes `invoice.paid` no tocaba el
         * estado, así que si la clínica había quedado suspendida por un fallo
         * previo, recuperarse del cobro no la reactivaba: el médico se quedaba
         * fuera hasta que llegara —si llegaba— un `subscription.updated`. Solo se
         * sube a 'active' desde un estado de impago, para no pisar una cancelación
         * en curso.
         */
        if (clinicId) {
          try {
            const snap = await adminDb.collection('clinics').doc(clinicId).get()
            if (snap.get('status') === 'suspended') {
              await updateClinic(clinicId, { status: 'active', pagoVencido: false })
            }
          } catch { /* no-bloqueante: el pago ya quedó registrado */ }
        }
        break
      }

      /* ── Payment failed ────────────────────────────── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        const clinicId = await getClinicIdByCustomer(invoice.customer as string)
        if (!clinicId) break

        /**
         * NO se suspende aquí. Stripe emite este evento en el primer intento
         * fallido del ciclo y sigue reintentando durante días; suspender ya
         * cortaba el acceso por un rechazo transitorio de tarjeta. Se marca el
         * pago como vencido —para poder avisarle al médico— y la suspensión real
         * queda en manos de `subscription.updated` (cuando pase a `unpaid`) o de
         * `subscription.deleted`, que son los estados terminales del dunning.
         */
        await updateClinic(clinicId, { pagoVencido: true })
        break
      }

      default:
        // Unhandled event — that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    safeLog.error(`[Stripe Webhook] Handler error for ${event.type}:`, err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/* Stripe webhooks send raw body — disable Next.js body parsing */
export const runtime = 'nodejs'
