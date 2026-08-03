/**
 * GUARDIÁN + GOLDEN — a las 3am ya pasa algo.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Buscado en todo `src/`: `slack|pagerduty|nodemailer|resend|sendgrid|SMTP` →
 * **cero coincidencias**. No existía **ningún** canal de alerta a un ser humano.
 * El plan de respuesta a incidentes define el canal de detección como un buzón, y
 * el propio documento dice entre paréntesis «(definir buzón real)».
 *
 * Y `cron_runs|ultimaEjecucion|heartbeat|latido` → cero también: **nada
 * registraba que un cron hubiera corrido**. El de recordatorios recorre los
 * consultorios en serie, sin `maxDuration` declarado; cuando se acaba el tiempo
 * dejan de recibir recordatorios **siempre los mismos** —los del final de la
 * lista— y la ruta responde `200`.
 *
 * Si el cron dejara de correr una semana entera, la única señal sería que los
 * pacientes no llegan.
 *
 * ── LA REGLA QUE ORDENA TODO ESTO ────────────────────────────────────────────
 *
 * **Si no se pudo avisar, se dice.** Un canal de alertas que devuelve éxito
 * cuando no está configurado es peor que no tenerlo: se da por cubierto lo que
 * sigue descubierto — que es exactamente el fallo que viene a reparar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  diagnosticar, loQueDueleGritar, PERIODO_MIN, MARGEN, POR_QUE_UN_VIGILANTE_APARTE,
  type Latido,
} from '@/lib/ops/latido'
import { POR_QUE_NO_MIENTE, LO_QUE_HACE_FALTA_DEL_DR } from '@/lib/ops/alerta'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const AHORA = Date.parse('2026-08-03T12:00:00.000Z')
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString()
const latido = (min: number, ok = true): Latido =>
  ({ job: 'reminders', ultimaEjecucion: hace(min), ok, duracionMs: 1000 })

describe('el diagnóstico distingue casos que no son lo mismo', () => {
  it('un trabajo que corrió hace poco está VIVO', () => {
    expect(diagnosticar('reminders', latido(10), AHORA).estado).toBe('vivo')
  })

  it('uno que lleva más de dos periodos sin correr está TARDE', () => {
    // reminders late cada 60 min; con margen 2, el corte son 120.
    expect(diagnosticar('reminders', latido(121), AHORA).estado).toBe('tarde')
    expect(diagnosticar('reminders', latido(119), AHORA).estado).toBe('vivo')
  })

  it('el margen existe para no enseñar a ignorar las alertas', () => {
    /**
     * Un retraso puntual —una ejecución lenta, un despliegue en medio— no es una
     * avería. Gritar por eso es la forma más común de quedarse sin alertas.
     */
    expect(MARGEN).toBe(2)
  })

  it('NUNCA no es lo mismo que TARDE', () => {
    /**
     * Un trabajo recién desplegado todavía no ha latido; uno que dejó de correr
     * hace un mes sí tiene un latido, sólo que viejo. Sin ninguno, lo que hay
     * que revisar es el despliegue, no el trabajo.
     */
    expect(diagnosticar('reminders', undefined, AHORA).estado).toBe('nunca')
    expect(diagnosticar('reminders', latido(9999), AHORA).estado).toBe('tarde')
  })

  it('corrió a tiempo pero FALLÓ: también duele', () => {
    const d = diagnosticar('reminders', latido(10, false), AHORA)
    expect(d.estado).toBe('con_error')
  })

  it('un latido con fecha ilegible se trata como si no hubiera', () => {
    const roto = { ...latido(10), ultimaEjecucion: 'ayer' }
    expect(diagnosticar('reminders', roto, AHORA).estado).toBe('nunca')
  })

  it('sólo se grita lo que no está vivo', () => {
    const ds = [
      diagnosticar('reminders', latido(10), AHORA),
      diagnosticar('limpiar-audio', undefined, AHORA),
    ]
    expect(loQueDueleGritar(ds).map(d => d.job)).toEqual(['limpiar-audio'])
  })
})

describe('el canal de alerta NO miente', () => {
  it('sin webhook configurado, `enviada: false` con su razón', () => {
    // No se puede probar el envío sin red; lo que sí se congela es que el módulo
    // NUNCA devuelve éxito por «no había nada que hacer».
    const s = leer('src', 'lib', 'ops', 'alerta.ts')
    expect(s).toContain("porQue: 'No hay OPS_ALERTA_WEBHOOK configurado: la alerta no llegó a nadie.'")
    expect(s).not.toContain('enviada: true, porQue')
  })

  it('exige https: un webhook en claro mandaría el estado de la plataforma', () => {
    const s = leer('src', 'lib', 'ops', 'alerta.ts')
    expect(s).toContain("if (!/^https:\\/\\//.test(url))")
  })

  it('tiene timeout: una alerta lenta no puede colgar un cron', () => {
    const s = leer('src', 'lib', 'ops', 'alerta.ts')
    expect(s).toContain('AbortController')
    expect(s).toContain('const TIMEOUT_MS = 5000')
  })

  it('no filtra la URL del webhook al registro', () => {
    // Un webhook lleva su secreto EN LA RUTA: registrar la URL entera lo publica
    // en los logs.
    const s = leer('src', 'lib', 'ops', 'alerta.ts')
    const i = s.indexOf("safeLog.warn('[ops/alerta] el webhook falló'")
    expect(s.slice(i, i + 200)).not.toContain('url')
  })

  it('está escrito por qué no miente, y qué hace falta del Dr.', () => {
    expect(POR_QUE_NO_MIENTE).toMatch(/peor que no tenerlo/i)
    expect(LO_QUE_HACE_FALTA_DEL_DR).toMatch(/OPS_ALERTA_WEBHOOK/)
  })
})

describe('el vigilante', () => {
  const ruta = leer('src', 'app', 'api', 'cron', 'vigilante', 'route.ts')

  it('vive APARTE de lo que vigila', () => {
    /**
     * Si el cron de recordatorios deja de dispararse, un aviso escrito DENTRO de
     * él tampoco se dispara.
     */
    expect(POR_QUE_UN_VIGILANTE_APARTE).toMatch(/no puede vivir dentro/i)
  })

  it('diagnostica sobre la lista DECLARADA, no sobre los latidos encontrados', () => {
    // Al revés, un trabajo que nunca llegó a latir —el caso más grave— sería
    // invisible: no habría documento que revisar.
    expect(ruta).toContain('Object.keys(PERIODO_MIN).map(job => diagnosticar(job, porJob.get(job), arranque))')
  })

  it('devuelve SI la alerta salió o no', () => {
    // Un vigilante que responde «ok» cuando no pudo avisar a nadie es el mismo
    // fallo que viene a reparar.
    expect(ruta).toContain('alerta }')
  })

  it('él también late', () => {
    expect(ruta).toContain("registrarLatido('vigilante'")
  })

  it('con el mismo candado fail-closed', () => {
    expect(ruta).toContain('CRON_SECRET no configurado (fail-closed)')
  })
})

describe('GUARDIÁN — todo cron de vercel.json late en sus DOS salidas', () => {
  const vercel = JSON.parse(leer('vercel.json')) as { crons: { path: string }[] }

  it('hay crons declarados (si no, el guardián pasaría vacío)', () => {
    expect(vercel.crons.length).toBeGreaterThan(2)
  })

  for (const c of JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')).crons as { path: string }[]) {
    const job = c.path.replace('/api/cron/', '')
    it(`${job}: registra su latido al terminar Y al fallar`, () => {
      /**
       * Un cron sin latido es invisible para el vigilante, y añadirlo sin
       * acordarse de esto es la forma de volver al punto de partida sin que
       * nadie lo note.
       */
      const s = leer('src', 'app', 'api', 'cron', job, 'route.ts')
      const usos = s.match(/registrarLatido\(/g) ?? []
      expect(usos.length, `${job} debe latir en éxito y en error`).toBeGreaterThanOrEqual(2)
    })

    it(`${job}: tiene un periodo declarado para poder vigilarlo`, () => {
      // Un cron sin periodo no se vigila, y nadie se entera de eso tampoco.
      // El vigilante no se vigila a sí mismo por definición.
      if (job === 'vigilante') return
      expect(Object.keys(PERIODO_MIN), job).toContain(job)
    })
  }

  it('el cron de recordatorios declara `maxDuration`', () => {
    /**
     * Sin él, Vercel le daba el tiempo por omisión. Recorre todos los
     * consultorios en serie mandando WhatsApp: cuando se acababa, dejaban de
     * recibir recordatorios siempre los mismos y la ruta respondía 200.
     */
    expect(leer('src', 'app', 'api', 'cron', 'reminders', 'route.ts')).toContain('export const maxDuration = 300')
  })
})
