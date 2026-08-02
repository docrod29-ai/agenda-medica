/**
 * GET /api/superadmin/costos?mes=YYYY-MM
 *
 * Lo que costó de verdad la IA, leído del libro de costos
 * (`platform_cost_ledger`). Sólo el dueño de la plataforma.
 *
 * ── LO QUE ESTA RUTA NO HACE ─────────────────────────────────────────────────
 *
 * No completa lo que falta. Si un modelo no tiene tarifa cargada, su costo va
 * `null` y aparece en `modelosSinTarifa` — no se estima, no se promedia, no se
 * suma como cero. §Y: «si no existe información suficiente, INSUFFICIENT_DATA.
 * Nunca inventar». Un total calculado sobre la mitad de las llamadas no es un
 * total, y en un tablero se ve exactamente igual que uno completo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { porFeature as latenciaPorFeature, porModelo as latenciaPorModelo } from '@/lib/observabilidad/latencias'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { safeLog } from '@/lib/security/sanitize'
import { resumir, soloCogs, porClave, suficiente, type EventoCosto } from '@/lib/finanzas/cost-ledger'
import { incidentesRecientes } from '@/lib/ia/incidentes-servidor'
import { stripe } from '@/lib/stripe'
import { evaluarWebhook, modoDeLaLlave, type SaludWebhook } from '@/lib/finanzas/webhook-stripe-salud'

/**
 * Le pregunta a Stripe a qué eventos está suscrito el webhook de esta app.
 *
 * Nunca lanza: si Stripe no responde —o la llave no tiene permiso de leer
 * endpoints— la consola sigue mostrando los costos. Un fallo de esta lectura no
 * puede tumbar el tablero, pero tampoco puede fingir que todo está bien: se
 * devuelve `null` y quien pinta decide qué decir.
 */
async function saludDelWebhook(): Promise<SaludWebhook | null> {
  try {
    const { data } = await stripe.webhookEndpoints.list({ limit: 100 })
    // El endpoint de esta app, no cualquiera: una cuenta de Stripe puede servir
    // a varios sitios y mirar el ajeno daría un verde falso.
    const mio = data.find(e => e.url.includes('/api/stripe/webhook'))
    // El modo sale del PREFIJO de la llave, nunca de la llave.
    return evaluarWebhook(mio ? mio.enabled_events : null, modoDeLaLlave(process.env.STRIPE_SECRET_KEY))
  } catch {
    return null
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const mesActual = () => new Date().toISOString().slice(0, 7)

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  const mes = (req.nextUrl.searchParams.get('mes') || mesActual()).slice(0, 7)
  try {
    // El asiento guarda `ts` en ISO, así que el mes es un prefijo de cadena: un
    // rango [mes-01, mes-32) ordena igual y no necesita índice compuesto.
    const snap = await adminDb.collection('platform_cost_ledger')
      .where('ts', '>=', `${mes}-01`)
      .where('ts', '<', `${mes}-32`)
      .limit(5000)
      .get()

    const eventos = snap.docs.map(d => d.data() as EventoCosto)
    const cogs = soloCogs(eventos)
    const total = resumir(eventos)

    /**
     * Incidencias de la llave de la PLATAFORMA, en la misma respuesta.
     *
     * Viven aquí y no en una ruta nueva a propósito: el dueño ya abre esta
     * pantalla para ver lo que gasta, y «la IA está caída» es exactamente la
     * clase de cosa que tiene que encontrarse sin ir a buscarla. Una alerta que
     * vive en su propia pantalla es una alerta que nadie ve.
     */
    const [incidentes, webhook] = await Promise.all([
      incidentesRecientes(20),
      saludDelWebhook(),
    ])

    return NextResponse.json({
      ok: true,
      mes,
      incidentes,
      /** ¿Hay algo caído AHORA que le cueste dinero o clientes? */
      hayUrgente: incidentes.some(i => i.urgente === true),
      /**
       * Estado del webhook de Stripe. `null` si no se pudo preguntar.
       *
       * El código puede saber atender un reembolso y no recibirlo nunca porque
       * nadie marcó la casilla en el panel. Esa casilla no la ve ningún test —
       * está fuera del repositorio— así que se pregunta y se muestra.
       */
      webhook,
      // El total de TODO y el de COGS son distintos a propósito: el gasto de I+D
      // del fundador no es costo de servir a ningún cliente (§CD).
      total,
      cogs: resumir(cogs),
      /** ¿Se puede AFIRMAR el costo, o falta demasiada tarifa? */
      confiable: suficiente(total),
      /**
       * CUÁNTO TARDA Y CUÁNTO FALLA — el tablero técnico del charter.
       *
       * `latenciaMs` y `fallo` se llevan anotando en cada asiento desde que
       * existe el gateway, y no los leía nadie: esta pantalla sumaba dinero y
       * tokens, que es la mitad de la pregunta. La otra mitad estaba en el
       * mismo documento, sin usar.
       */
      latenciasPorFeature: latenciaPorFeature(eventos),
      latenciasPorModelo: latenciaPorModelo(eventos),
      porFeature: porClave(eventos, e => e.feature),
      porModelo: porClave(eventos, e => e.modelo),
      porClase: porClave(eventos, e => e.clase),
      // Si se alcanzó el tope, el tablero tiene que decirlo: un total truncado
      // en silencio se lee como un total.
      truncado: snap.size >= 5000,
    })
  } catch (err) {
    safeLog.error('[superadmin/costos]', err)
    return NextResponse.json({ ok: false, error: 'No se pudo leer el libro de costos.' }, { status: 500 })
  }
}
