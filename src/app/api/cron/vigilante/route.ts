/**
 * GET /api/cron/vigilante
 *
 * EL QUE MIRA SI LOS DEMÁS SIGUEN VIVOS.
 *
 * ── POR QUÉ ES UN CRON APARTE ────────────────────────────────────────────────
 *
 * El vigilante no puede vivir dentro del trabajo que vigila: si el cron de
 * recordatorios deja de dispararse, un aviso escrito **dentro** de él tampoco se
 * dispara. Por eso mira los latidos de los otros desde fuera.
 *
 * ── LO QUE DEVUELVE Y POR QUÉ IMPORTA ────────────────────────────────────────
 *
 * El diagnóstico completo, **incluido si la alerta salió o no**. Un vigilante
 * que responde `200 ok` cuando no pudo avisar a nadie es el mismo fallo que
 * viene a reparar: una respuesta tranquilizadora sobre un sistema que no lo
 * está.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import {
  leerLatidos, diagnosticar, loQueDueleGritar, PERIODO_MIN, registrarLatido,
  type Latido,
} from '@/lib/ops/latido'
import { enviarAlertaOps } from '@/lib/ops/alerta'

const CRON_SECRET = process.env.CRON_SECRET

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  // Mismo candado fail-closed que los otros crons.
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
    }
  } else if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const arranque = Date.now()
  try {
    const latidos = await leerLatidos()
    const porJob = new Map<string, Latido>(latidos.map(l => [l.job, l]))

    /**
     * Se diagnostica sobre la lista DECLARADA de trabajos, no sobre los latidos
     * encontrados. Al revés, un trabajo que nunca llegó a latir —el caso más
     * grave— sería invisible: no habría documento que revisar.
     */
    const ds = Object.keys(PERIODO_MIN).map(job => diagnosticar(job, porJob.get(job), arranque))
    const duelen = loQueDueleGritar(ds)

    let alerta: unknown = { enviada: false, porQue: 'No había nada que avisar.' }
    if (duelen.length) {
      alerta = await enviarAlertaOps({
        titulo: `${duelen.length} trabajo(s) automático(s) sin latido correcto`,
        detalle: duelen.map(d => `· ${d.job}: ${d.porQue}`).join('\n'),
        gravedad: duelen.some(d => d.estado === 'nunca' || d.estado === 'tarde') ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
      safeLog.warn(`[cron/vigilante] ${duelen.map(d => `${d.job}=${d.estado}`).join(', ')}`)
    }

    // El vigilante también late: si se cae ÉL, el propio diagnóstico lo enseña
    // la próxima vez que alguien mire.
    await registrarLatido('vigilante', {
      ok: true, duracionMs: Date.now() - arranque,
      detalle: { vigilados: ds.length, conProblema: duelen.length },
    })

    return NextResponse.json({ ok: true, diagnostico: ds, alerta })
  } catch (e) {
    safeLog.error('[cron/vigilante]', e)
    await registrarLatido('vigilante', {
      ok: false, duracionMs: Date.now() - arranque, error: e instanceof Error ? e.message : 'error',
    })
    return NextResponse.json({ ok: false, error: 'El vigilante falló' }, { status: 500 })
  }
}
