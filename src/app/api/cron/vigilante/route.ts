/**
 * GET /api/cron/vigilante
 *
 * EL QUE MIRA SI LOS DEMÁS SIGUEN VIVOS.
 *
 * El vigilante vive fuera de los trabajos que vigila. Además de latidos y saldo
 * de proveedores, consume los incidentes de plataforma ya agrupados por #315:
 * registrar un fallo sin que el canal que despierta al dueño lo lea seguía
 * dejando el mismo punto ciego operativo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { saldosDeProveedores } from '@/lib/finanzas/saldo-servidor'
import { avisoDeSaldo, type SaldoProveedor } from '@/lib/finanzas/saldo-proveedores'
import { safeLog } from '@/lib/security/sanitize'
import {
  leerLatidos, diagnosticar, loQueDueleGritar, PERIODO_MIN, registrarLatido,
  type Latido,
} from '@/lib/ops/latido'
import { enviarAlertaOps } from '@/lib/ops/alerta'
import { incidentesRecientes } from '@/lib/ia/incidentes-servidor'
import { incidentesNuevosParaAlerta, resumenIncidentesParaOps } from '@/lib/incidents/vigilancia'

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

    /**
     * ── EL SALDO DE LOS PROVEEDORES, EN EL MISMO VIGILANTE ──────────────────
     *
     * Si el saldo de un proveedor crítico llega a cero, muchas consultas pueden
     * perder capacidad a la vez. Se lee aquí para avisar antes de que el médico
     * sea quien descubra la caída.
     */
    const saldos = await saldosDeProveedores(arranque).catch(() => [] as SaldoProveedor[])
    const saldosQueDuelen = saldos.filter(x => x.nivel !== 'ok')

    /**
     * ── INCIDENTES DE PLATAFORMA — EL PUNTO CIEGO QUE FALTABA ───────────────
     *
     * `reportarFalloIA` ya guardaba `platform_incidentes`, pero el vigilante no
     * los leía. Eso dejaba una incidencia correctamente registrada sin ninguna
     * ruta hacia el dueño. Se leen sólo ids técnicos agrupados y el latido
     * recuerda cuáles ya avisó; no viaja pregunta, nota, paciente ni respuesta
     * del proveedor.
     */
    const marcaAnterior = porJob.get('vigilante')?.detalle?.incidentesAlertados
    const incidentes = await incidentesRecientes(100)
    const vigilanciaIncidentes = incidentesNuevosParaAlerta(incidentes, marcaAnterior, arranque)

    let alerta: unknown = { enviada: false, porQue: 'No había nada que avisar.' }
    let alertaSaldo: unknown = { enviada: false, porQue: 'No había saldo bajo que avisar.' }
    let alertaIncidentes: unknown = { enviada: false, porQue: 'No había incidentes nuevos de plataforma que avisar.' }

    if (saldosQueDuelen.length) {
      alertaSaldo = await enviarAlertaOps({
        titulo: `Saldo bajo con ${saldosQueDuelen.length} proveedor(es) de IA`,
        detalle: saldosQueDuelen.map(avisoDeSaldo).filter(Boolean).join('\n'),
        gravedad: saldosQueDuelen.some(x => x.nivel === 'agotado' || x.nivel === 'critico') ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
    }

    if (vigilanciaIncidentes.nuevos.length) {
      alertaIncidentes = await enviarAlertaOps({
        titulo: `${vigilanciaIncidentes.nuevos.length} incidente(s) nuevo(s) de plataforma`,
        detalle: resumenIncidentesParaOps(vigilanciaIncidentes.nuevos),
        gravedad: vigilanciaIncidentes.nuevos.some(i => i.urgente) ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
      safeLog.warn(`[cron/vigilante] ${vigilanciaIncidentes.nuevos.length} incidente(s) de plataforma nuevo(s)`)
    }

    if (duelen.length) {
      alerta = await enviarAlertaOps({
        titulo: `${duelen.length} trabajo(s) automático(s) sin latido correcto`,
        detalle: duelen.map(d => `· ${d.job}: ${d.porQue}`).join('\n'),
        gravedad: duelen.some(d => d.estado === 'nunca' || d.estado === 'tarde') ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
      safeLog.warn(`[cron/vigilante] ${duelen.map(d => `${d.job}=${d.estado}`).join(', ')}`)
    }

    // El vigilante también late. Su detalle guarda sólo contadores y los ids
    // técnicos de grupos ya avisados, nunca contenido clínico.
    await registrarLatido('vigilante', {
      ok: true,
      duracionMs: Date.now() - arranque,
      detalle: {
        vigilados: ds.length,
        conProblema: duelen.length,
        saldosBajos: saldosQueDuelen.length,
        incidentesActivos: vigilanciaIncidentes.activos,
        incidentesNuevos: vigilanciaIncidentes.nuevos.length,
        incidentesAlertados: vigilanciaIncidentes.marca,
      },
    })

    return NextResponse.json({
      ok: true,
      diagnostico: ds,
      saldos,
      incidentes: {
        activos: vigilanciaIncidentes.activos,
        nuevos: vigilanciaIncidentes.nuevos.length,
      },
      alerta,
      alertaSaldo,
      alertaIncidentes,
    })
  } catch (e) {
    safeLog.error('[cron/vigilante]', e)
    await registrarLatido('vigilante', {
      ok: false, duracionMs: Date.now() - arranque, error: e instanceof Error ? e.message : 'error',
    })
    return NextResponse.json({ ok: false, error: 'El vigilante falló' }, { status: 500 })
  }
}
