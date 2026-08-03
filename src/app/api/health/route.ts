/**
 * GET /api/health
 *
 * ¿ESTÁ ARRIBA? — la pregunta que no se podía contestar.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * No existía **ningún** endpoint de salud. `api/calendar/status` es el estado
 * del Google Calendar **de un usuario**, no del sistema.
 *
 * No había forma de saber si Firestore, Stripe, Anthropic/OpenAI o el bucket
 * están arriba, ni un monitor externo que lo comprobara. Y es lo primero que
 * pide un comprador institucional, junto con la página de estado.
 *
 * ── POR QUÉ SIN AUTENTICAR ───────────────────────────────────────────────────
 *
 * Para que lo consulte un monitor externo gratuito cada minuto — **ese es el
 * segundo par de ojos que no existe**. Un endpoint de salud detrás de sesión no
 * lo mira nadie a las 3am.
 *
 * A cambio, sólo devuelve **booleanos, latencias y la versión**. Ni una clave,
 * ni un dato de paciente, ni el mensaje del error de un proveedor —que puede
 * llevar dentro parte de la petición—.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No consume tokens: a los proveedores de IA se les pide su lista de modelos, no
 * una respuesta. Un endpoint de salud que cuesta dinero cada minuto se acaba
 * apagando, y entonces no hay salud que valga.
 */
import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminDb } from '@/lib/firebase-admin'
import { fetchConTimeout } from '@/lib/fetch-con-timeout'
import { leerLatidos, diagnosticar, PERIODO_MIN } from '@/lib/ops/latido'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

/** Cada sonda tiene 3 s. Si una tarda más, para el caso ya está caída. */
const SONDA_MS = 3000

interface Sonda { nombre: string; ok: boolean | null; ms: number; nota?: string }

/**
 * `ok: null` NO es `false`.
 *
 * `false` es «contesté y está mal»; `null` es «no lo pude comprobar» —porque no
 * hay credencial configurada, típicamente—. Confundirlos pintaría de rojo un
 * sistema sano, y una alarma que miente se acaba ignorando.
 */
async function sondear(nombre: string, fn: () => Promise<boolean | null>): Promise<Sonda> {
  const t0 = Date.now()
  try {
    const ok = await fn()
    return { nombre, ok, ms: Date.now() - t0 }
  } catch {
    // El mensaje del proveedor NO se propaga: puede llevar dentro parte de la
    // petición, y esto es público.
    return { nombre, ok: false, ms: Date.now() - t0, nota: 'falló o se agotó el tiempo' }
  }
}

function version(): string {
  try {
    return readFileSync(join(process.cwd(), 'public', 'version.txt'), 'utf8').trim()
  } catch {
    return 'desconocida'
  }
}

export async function GET() {
  const t0 = Date.now()

  const sondas = await Promise.all([
    sondear('firestore', async () => {
      await adminDb.collection('platform_heartbeats').doc('_ping').get()
      return true
    }),
    sondear('anthropic', async () => {
      const k = process.env.ANTHROPIC_API_KEY
      if (!k) return null
      const r = await fetchConTimeout('https://api.anthropic.com/v1/models',
        { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } }, SONDA_MS)
      return r.ok
    }),
    sondear('openai', async () => {
      const k = process.env.OPENAI_API_KEY
      if (!k) return null
      const r = await fetchConTimeout('https://api.openai.com/v1/models',
        { headers: { Authorization: `Bearer ${k}` } }, SONDA_MS)
      return r.ok
    }),
    sondear('stripe', async () => {
      if (!process.env.STRIPE_SECRET_KEY) return null
      const { stripe } = await import('@/lib/stripe')
      await stripe.balance.retrieve()
      return true
    }),
  ])

  // Los trabajos automáticos: un sistema con todo arriba y los crons parados no
  // está sano, y desde fuera se ve idéntico.
  const latidos = await leerLatidos().catch(() => [])
  const porJob = new Map(latidos.map(l => [l.job, l]))
  const trabajos = Object.keys(PERIODO_MIN).map(j => {
    const d = diagnosticar(j, porJob.get(j), Date.now())
    return { job: j, estado: d.estado, minutosDesde: d.minutosDesde ?? null }
  })

  /**
   * `ok` sólo mira lo que se PUDO comprobar.
   *
   * Un proveedor sin credencial en este entorno no es una avería: es una
   * ausencia. Contarlo como caída pondría el semáforo en rojo permanente y el
   * monitor externo dejaría de servir para nada.
   */
  const ok = sondas.every(s => s.ok !== false) && trabajos.every(t => t.estado !== 'tarde')

  return NextResponse.json({
    ok,
    version: version(),
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
    entorno: process.env.VERCEL_ENV ?? 'local',
    ts: new Date().toISOString(),
    dependencias: sondas,
    trabajos,
    msTotal: Date.now() - t0,
  }, {
    // Un estado en caché es un estado mentiroso.
    headers: { 'Cache-Control': 'no-store' },
    status: ok ? 200 : 503,
  })
}
