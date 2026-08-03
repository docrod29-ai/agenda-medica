/**
 * EL LATIDO DE LOS TRABAJOS AUTOMÁTICOS.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * **Nada registra que un cron corrió.** Buscado en todo `src/`:
 * `cron_runs|ultimaEjecucion|heartbeat|latido` → cero coincidencias.
 *
 * El cron de recordatorios recorre los consultorios **en serie**, sin
 * `maxDuration` declarado, y con envíos de WhatsApp sin timeout. Cuando se acaba
 * el tiempo, dejan de recibir recordatorios **siempre los mismos** —los del
 * final de la lista— y la ruta responde `200`.
 *
 * Si el cron dejara de correr una semana entera, la única señal sería que los
 * pacientes no llegan.
 *
 * ── POR QUÉ UN DOCUMENTO POR TRABAJO, Y NO UNA COLECCIÓN ─────────────────────
 *
 * `platform_heartbeats/{job}` se **sobrescribe**: no crece. Un histórico de
 * ejecuciones sería otra colección sin barrendero —el problema que este mismo
 * repositorio ya tiene con `rate_limits` y `platform_csp`— y para saber si algo
 * está vivo sólo hace falta la última vez.
 */
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'

export interface Latido {
  job: string
  /** ISO de la última vez que TERMINÓ, con éxito o con error. */
  ultimaEjecucion: string
  ok: boolean
  duracionMs: number
  /** Cifras del trabajo. Nunca PHI: esto lo lee quien opera, no quien atiende. */
  detalle?: Record<string, string | number | boolean>
  /** El error, si lo hubo. Ya saneado. */
  error?: string
}

const ref = (job: string) => adminDb.collection('platform_heartbeats').doc(job)

/**
 * Deja constancia de que un trabajo terminó.
 *
 * Nunca lanza: un fallo al registrar el latido no puede tumbar el trabajo que
 * acaba de hacerse bien.
 */
export async function registrarLatido(
  job: string,
  datos: { ok: boolean; duracionMs: number; detalle?: Record<string, string | number | boolean>; error?: string },
): Promise<void> {
  try {
    await ref(job).set({
      job,
      ultimaEjecucion: new Date().toISOString(),
      ok: datos.ok,
      duracionMs: Math.max(0, Math.round(datos.duracionMs)),
      ...(datos.detalle ? { detalle: datos.detalle } : {}),
      ...(datos.error ? { error: String(datos.error).slice(0, 300) } : {}),
    })
  } catch (e) {
    safeLog.warn(`[latido] no se pudo registrar el de ${job}`, e)
  }
}

/** Lee todos los latidos. Devuelve `[]` si no se pueden leer. */
export async function leerLatidos(): Promise<Latido[]> {
  try {
    const snap = await adminDb.collection('platform_heartbeats').limit(100).get()
    return snap.docs.map(d => d.data() as Latido)
  } catch {
    return []
  }
}

/**
 * Cada cuánto DEBE latir cada trabajo, en minutos.
 *
 * Sale de `vercel.json` y se declara aquí porque el vigilante necesita saber qué
 * es «tarde» para cada uno. Un guardián comprueba que los dos coincidan: un cron
 * nuevo sin periodo declarado no se vigilaría, y nadie se enteraría de eso
 * tampoco.
 */
export const PERIODO_MIN: Record<string, number> = {
  reminders: 60,        // cada hora
  'limpiar-audio': 1440, // diario
  retencion: 1440,       // diario
}

/**
 * Cuánto margen se le da antes de gritar.
 *
 * Dos periodos: un retraso puntual —una ejecución lenta, un despliegue en medio—
 * no es una avería. Gritar por eso enseña a ignorar las alertas, que es la forma
 * más común de quedarse sin ninguna.
 */
export const MARGEN = 2

export type Estado = 'vivo' | 'tarde' | 'nunca' | 'con_error'

export interface Diagnostico {
  job: string
  estado: Estado
  porQue: string
  minutosDesde?: number
}

/**
 * ¿Está vivo este trabajo?
 *
 * PURO: se le pasa el instante, no lo lee de un reloj escondido.
 */
export function diagnosticar(
  job: string, latido: Latido | undefined, ahoraMs: number,
): Diagnostico {
  const periodo = PERIODO_MIN[job]
  if (latido === undefined) {
    /**
     * `nunca` NO es lo mismo que `tarde`, y la diferencia importa: un trabajo
     * recién desplegado todavía no ha latido, y un trabajo que dejó de correr
     * hace un mes tampoco tiene latido reciente… pero sí tiene uno viejo. Sin
     * ninguno, lo que hay que revisar es el despliegue, no el trabajo.
     */
    return { job, estado: 'nunca', porQue: 'No hay ni un latido: o nunca ha corrido, o nunca llegó a registrarlo.' }
  }
  const t = Date.parse(latido.ultimaEjecucion)
  if (!Number.isFinite(t)) {
    return { job, estado: 'nunca', porQue: 'El latido no tiene una fecha legible.' }
  }
  const minutos = Math.round((ahoraMs - t) / 60_000)
  if (periodo !== undefined && minutos > periodo * MARGEN) {
    return {
      job, estado: 'tarde', minutosDesde: minutos,
      porQue: `Lleva ${minutos} min sin correr y debería hacerlo cada ${periodo} min.`,
    }
  }
  if (!latido.ok) {
    return {
      job, estado: 'con_error', minutosDesde: minutos,
      porQue: `Corrió hace ${minutos} min pero terminó con error: ${latido.error ?? 'sin detalle'}`,
    }
  }
  return { job, estado: 'vivo', minutosDesde: minutos, porQue: `Corrió hace ${minutos} min.` }
}

/** Los que hay que gritar. `vivo` no entra. */
export function loQueDueleGritar(ds: Diagnostico[]): Diagnostico[] {
  return ds.filter(d => d.estado !== 'vivo')
}

export const POR_QUE_UN_VIGILANTE_APARTE =
  'El vigilante no puede vivir dentro del trabajo que vigila: si el cron de ' +
  'recordatorios deja de dispararse, un aviso escrito dentro de él tampoco se ' +
  'dispara. Por eso es un cron propio que mira los latidos de los demás.'
