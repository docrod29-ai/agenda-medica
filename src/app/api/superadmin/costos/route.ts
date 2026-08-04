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
import { resumir, soloCogs, porClave, suficiente, costoPorConsulta, type EventoCosto } from '@/lib/finanzas/cost-ledger'
import { incidentesRecientes } from '@/lib/ia/incidentes-servidor'
import { stripe } from '@/lib/stripe'
import { evaluarWebhook, modoDeLaLlave, type SaludWebhook } from '@/lib/finanzas/webhook-stripe-salud'
import { saldosDeProveedores, PROVEEDORES_VIGILADOS } from '@/lib/finanzas/saldo-servidor'

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
    const [incidentes, webhook, saldos] = await Promise.all([
      incidentesRecientes(20),
      saludDelWebhook(),
      /**
       * CUÁNTO SALDO QUEDA CON CADA PROVEEDOR.
       *
       * Petición del Dr. (3-ago-2026): «estar al pendiente cuánto saldo tengo,
       * para estarle abonando y los clientes no se queden sin IA». Va en la
       * misma pantalla que el gasto porque es la misma pregunta vista al revés:
       * el tablero dice lo que se fue, el saldo dice cuánto falta para que se
       * acabe. Separarlas obligaría a mirar dos sitios para saber una cosa.
       *
       * Nunca tumba el tablero: si falla, se devuelve vacío.
       */
      saldosDeProveedores(Date.now()).catch(() => []),
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
      /** Saldo estimado por proveedor. Ver `saldo-proveedores.ts` para por qué «estimado». */
      saldos,
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
      /**
       * POR MÉDICO Y POR CONSULTA — las dos líneas que faltaban (N6).
       *
       * El libro anota el `uid` en cada asiento desde que existe, y la consola
       * agrupaba por función, modelo y clase: se podía ver qué función cuesta y
       * no **quién** gasta ni **cuánto vale atender a un paciente**, que son las
       * dos preguntas con las que se decide un precio.
       *
       * `uid`, nunca el nombre: el libro de costos no guarda identidades a
       * propósito, y esta pantalla no va a ser la que las introduzca.
       */
      porMedico: porClave(cogs, e => e.uid ?? '(sin médico)'),
      // Sobre COGS, no sobre todo: el gasto de I+D del fundador no es el costo
      // de atender a un paciente.
      porConsulta: costoPorConsulta(cogs),
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

/**
 * POST /api/superadmin/costos — registrar un ABONO a un proveedor de IA.
 *
 * ── POR QUÉ SE REGISTRA A MANO ───────────────────────────────────────────────
 *
 * Se buscó el camino automático: la API de AssemblyAI **no publica** endpoint de
 * saldo ni de consumo, y las otras dos tampoco exponen el saldo de la cuenta.
 * Así que el saldo no se lee, se lleva: el dueño anota lo que abona y el libro de
 * costos ya sabe lo que se gastó.
 *
 * Anotar de más o de menos mueve el aviso, no el servicio — por eso la cifra se
 * llama «estimada» en toda la pantalla.
 */
export async function POST(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const proveedor = String(body.proveedor ?? '').trim().toLowerCase()
    const montoUsd = Number(body.montoUsd)
    const referencia = String(body.referencia ?? '').trim().slice(0, 120)

    if (!PROVEEDORES_VIGILADOS.includes(proveedor as (typeof PROVEEDORES_VIGILADOS)[number])) {
      return NextResponse.json({ ok: false, error: 'Proveedor no reconocido.' }, { status: 400 })
    }
    /**
     * Un abono negativo o cero NO se acepta.
     *
     * No es purismo: un negativo se restaría del cargado y bajaría el saldo sin
     * que nadie hubiera gastado nada — un aviso de agotamiento inventado. Para
     * corregir un error se borra el documento, no se anota su contrario.
     */
    if (!Number.isFinite(montoUsd) || montoUsd <= 0) {
      return NextResponse.json({ ok: false, error: 'El monto tiene que ser un número mayor que cero.' }, { status: 400 })
    }

    await adminDb.collection('platform_recargas').add({
      proveedor,
      montoUsd,
      fecha: new Date().toISOString(),
      ...(referencia ? { referencia } : {}),
      registradoPor: acc.uid,
    })

    return NextResponse.json({ ok: true, saldos: await saldosDeProveedores(Date.now()) })
  } catch (err) {
    safeLog.error('[superadmin/costos POST]', err)
    return NextResponse.json({ ok: false, error: 'No se pudo registrar el abono.' }, { status: 500 })
  }
}
