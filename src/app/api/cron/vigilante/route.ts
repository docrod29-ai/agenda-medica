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
import { saldosDeProveedores } from '@/lib/finanzas/saldo-servidor'
import { avisoDeSaldo, type SaldoProveedor } from '@/lib/finanzas/saldo-proveedores'
import { safeLog } from '@/lib/security/sanitize'
import {
  leerLatidos, diagnosticar, loQueDueleGritar, PERIODO_MIN, registrarLatido,
  type Latido,
} from '@/lib/ops/latido'
import { enviarAlertaOps } from '@/lib/ops/alerta'
import {
  incidentesSinAvisar, marcarAvisadas, textoDeIncidencias,
} from '@/lib/ia/incidentes-servidor'
import { correlacionDeTrabajo } from '@/lib/observabilidad/correlacion'
import { adminDb } from '@/lib/firebase-admin'
import { averias, comoSeCuenta, firmaDelError } from '@/lib/ops/lo-que-se-repite'
import {
  anomalias, comoSeCuentan as comoSeCuentanAnomalias, COLECCION as COLECCION_AUTHZ,
} from '@/lib/ops/lo-que-no-deberia-pasar'

/**
 * La ventana que mira el vigilante. Es su propio periodo por dos —así una
 * ejecución perdida no deja un hueco ciego—, no un umbral de gravedad.
 */
const VENTANA_DE_ERRORES_MS = 2 * 60 * 60 * 1000
/** Tope de lectura: esto corre cada hora y no puede descargar la colección. */
const TOPE_ERRORES = 300

const CRON_SECRET = process.env.CRON_SECRET

export const maxDuration = 30

export async function GET(req: NextRequest) {
  /* REG-418 — la traza de ESTA ejecución, acuñada al arrancar: un trabajo de
     fondo no nace de un navegador, así que no acepta la que le manden. */
  const correlacion = correlacionDeTrabajo()
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
     * ── EL SALDO DE LOS PROVEEDORES, EN EL MISMO VIGILANTE ────────────────────
     *
     * Petición del Dr.: «estar al pendiente cuánto saldo tengo, para estarle
     * abonando y los clientes no se queden sin IA».
     *
     * Va aquí y no en un cron aparte porque es el mismo trabajo: mirar cada
     * quince minutos si algo está a punto de romperse y avisar a un humano. Un
     * cron nuevo sería otro trabajo que vigilar.
     *
     * Si el saldo de AssemblyAI llega a cero, TODAS las consultas pierden la
     * separación de voces a la vez — enterarse entonces es enterarse tarde.
     */
    const saldos = await saldosDeProveedores(arranque).catch(() => [] as SaldoProveedor[])
    const saldosQueDuelen = saldos.filter(x => x.nivel !== 'ok')

    let alerta: unknown = { enviada: false, porQue: 'No había nada que avisar.' }
    if (saldosQueDuelen.length) {
      await enviarAlertaOps({
        titulo: `Saldo bajo con ${saldosQueDuelen.length} proveedor(es) de IA`,
        detalle: saldosQueDuelen.map(avisoDeSaldo).filter(Boolean).join('\n'),
        gravedad: saldosQueDuelen.some(x => x.nivel === 'agotado' || x.nivel === 'critico') ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
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

    /**
     * ── LA COLA DE WHATSAPP, QUE TAMPOCO GRITABA (REG-397) ───────────────────
     *
     * REG-391 hizo que una caída del proveedor **pause** las entradas en vez de
     * gastarles el presupuesto de reintentos. Bien — pero una cola pausada se ve
     * desde fuera exactamente igual que una tarde tranquila: el cron termina
     * `ok`, `enviados: 0`, y nada parece roto. Y el dead-letter, que existe
     * desde hace mucho, **no lo enseña ninguna pantalla**.
     *
     * Los dos son huecos de agenda que nadie ocupó. Se leen del latido del cron
     * de recordatorios —que ya los cuenta— en vez de recorrer los consultorios
     * otra vez desde aquí.
     */
    const cola = porJob.get('reminders')?.detalle as
      { pausadas?: number; muertas?: number } | undefined
    const pausadas = Number(cola?.pausadas ?? 0)
    const muertas = Number(cola?.muertas ?? 0)
    if (pausadas > 0 || muertas > 0) {
      await enviarAlertaOps({
        titulo: 'Avisos de WhatsApp que no salieron',
        detalle: [
          pausadas > 0 ? `· ${pausadas} en pausa: el proveedor no estaba respondiendo. No han gastado reintentos y se vuelven a intentar solas.` : '',
          muertas > 0 ? `· ${muertas} rendidas (dead-letter). Éstas ya NO se reintentan: hay que mirarlas.` : '',
        ].filter(Boolean).join('\n'),
        /* Una pausa se arregla sola cuando el proveedor vuelve; una rendida, no. */
        gravedad: muertas > 0 ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
    }

    /**
     * ── LA AVERÍA QUE MOTIVÓ TODO ESTO, POR FIN CONECTADA (REG-396) ──────────
     *
     * `incidentes-servidor.ts` nació porque «el 31-jul-2026 la IA de la
     * plataforma estuvo caída y nadie se enteró hasta que el dueño la probó a
     * mano». Anotaba la incidencia en Firestore y **ahí se quedaba**: para verla
     * había que abrir el tablero. El canal de alerta existía; el vigilante
     * gritaba por crons caídos y saldo bajo; de esto, no.
     *
     * Va después de lo demás a propósito: es un aviso, no un diagnóstico, y si
     * su lectura falla no puede llevarse por delante el resto del vigilante.
     */
    const incidencias = await incidentesSinAvisar().catch(() => [] as Record<string, unknown>[])
    let incidenciasAvisadas = 0
    if (incidencias.length) {
      const r = await enviarAlertaOps({
        titulo: `${incidencias.length} incidencia(s) de IA de plataforma sin avisar`,
        detalle: textoDeIncidencias(incidencias),
        gravedad: incidencias.some(i => i.urgente === true) ? 'grave' : 'aviso',
        origen: 'cron/vigilante',
      })
      /**
       * Se marcan SÓLO si el aviso salió. Marcarlas antes convertiría una caída
       * del webhook en un silencio permanente: quedarían como avisadas sin que
       * nadie las hubiera recibido.
       */
      if (r.enviada) incidenciasAvisadas = await marcarAvisadas(incidencias.map(i => String(i.id)))
    }

    /**
     * ── LO QUE REVIENTA EN EL NAVEGADOR, QUE TAMPOCO GRITABA (REG-420) ───────
     *
     * `/api/errores` recoge lo que falla en el cliente y lo escribe en la
     * colección `errores`. Está bien hecho —acepta sin sesión, porque si no la
     * caída más grave sería la única no reportable, y redacta el texto antes de
     * guardarlo— y **ahí se queda**: para enterarse hay que abrir el panel del
     * dueño, o sea sospechar la avería antes de saber que existe.
     *
     * Es la misma forma que REG-396 cerró para los incidentes de IA, en la
     * colección de al lado.
     *
     * No se avisa de todo: un usuario con un error puede ser su navegador o su
     * sesión caducada. Dos personas distintas con el mismo error ya es del
     * producto — ver `lo-que-se-repite.ts` para por qué esa frontera y no un
     * número. Lo que no cruza sigue en la colección; sólo no despierta a nadie.
     *
     * Se marcan como vistas SÓLO si el aviso salió, por lo mismo que las
     * incidencias: marcarlas antes convierte una caída del webhook en silencio.
     */
    let averiasAvisadas = 0
    try {
      const desde = new Date(Date.now() - VENTANA_DE_ERRORES_MS).toISOString()
      const snap = await adminDb.collection('errores')
        .where('visto', '==', false)
        .orderBy('fecha', 'desc')
        .limit(TOPE_ERRORES)
        .get()
      const todos: Record<string, unknown>[] = snap.docs.map(d => {
        const datos = d.data() as Record<string, unknown>
        return { ...datos, id: d.id }
      })
      const recientes = todos.filter(e => String(e.fecha ?? '') >= desde)
      const rotas = averias(recientes as never)
      if (rotas.length) {
        const r = await enviarAlertaOps({
          titulo: `${rotas.length} avería(s) en el navegador, vistas por más de una persona`,
          detalle: comoSeCuenta(rotas),
          gravedad: 'grave',
          origen: 'cron/vigilante',
        })
        if (r.enviada) {
          const firmas = new Set(rotas.map(a => a.firma))
          const aMarcar = recientes.filter(e => firmas.has(firmaDelError(e as never)))
          await Promise.all(aMarcar.map(e =>
            adminDb.collection('errores').doc(String(e.id)).set({ visto: true }, { merge: true })))
          averiasAvisadas = aMarcar.length
        }
      }
    } catch (e) {
      /* Un aviso que falla no puede llevarse por delante el resto del vigilante. */
      safeLog.warn('[cron/vigilante] no se pudieron leer los errores del navegador', e)
    }

    /**
     * ── ANOMALÍAS DE AUTORIZACIÓN — WS-13 / REG-430 ─────────────────────────
     *
     * Las denegaciones se anotaban sólo en el log del servidor, que hay que ir a
     * buscar sabiendo ya lo que se busca. Aquí se lee el PATRÓN, que es lo único
     * que distingue un rol mal configurado de alguien probando dónde entra.
     *
     * NO se marcan como vistas: a diferencia de un error del navegador, una
     * denegación es un registro de seguridad y borrarla del radar por haber
     * avisado una vez perdería la serie. La ventana las deja de contar sola.
     */
    let anomaliasAvisadas = 0
    try {
      const desde = new Date(Date.now() - VENTANA_DE_ERRORES_MS).toISOString()
      const snap = await adminDb.collection(COLECCION_AUTHZ)
        .orderBy('cuando', 'desc')
        .limit(TOPE_ERRORES)
        .get()
      const denegaciones = snap.docs
        .map(d => d.data() as { uid: string; clinicId: string; capacidad: string; ruta: string; cuando: string })
        .filter(d => String(d.cuando ?? '') >= desde)
      const raras = anomalias(denegaciones)
      if (raras.length) {
        const r = await enviarAlertaOps({
          titulo: `${raras.length} anomalía(s) de autorización`,
          detalle: comoSeCuentanAnomalias(raras),
          /* La escala del canal tiene dos escalones y los dos casos son graves:
             un sondeo entre consultorios no es un aviso. */
          gravedad: 'grave',
          origen: 'cron/vigilante',
        })
        if (r.enviada) anomaliasAvisadas = raras.length
      }
    } catch (e) {
      safeLog.warn('[cron/vigilante] no se pudieron leer las denegaciones de autorización', e)
    }

    // El vigilante también late: si se cae ÉL, el propio diagnóstico lo enseña
    // la próxima vez que alguien mire.
    await registrarLatido('vigilante', {
      correlacion,
      ok: true, duracionMs: Date.now() - arranque,
      detalle: {
        vigilados: ds.length, conProblema: duelen.length, saldosBajos: saldosQueDuelen.length,
        incidenciasIA: incidencias.length, incidenciasAvisadas, averiasAvisadas,
        colaPausada: pausadas, colaMuerta: muertas,
      },
    })

    return NextResponse.json({
      ok: true, diagnostico: ds, saldos, alerta,
      incidencias: { sinAvisar: incidencias.length, avisadas: incidenciasAvisadas },
      cola: { pausadas, muertas },
    })
  } catch (e) {
    safeLog.error('[cron/vigilante]', e)
    await registrarLatido('vigilante', {
      correlacion,
      ok: false, duracionMs: Date.now() - arranque, error: e instanceof Error ? e.message : 'error',
    })
    return NextResponse.json({ ok: false, error: 'El vigilante falló' }, { status: 500 })
  }
}
