/**
 * GOLDEN — un Google que no contesta NUNCA no puede colgar la agenda pública.
 *
 * ── CÓMO SE LLEGÓ AQUÍ ──────────────────────────────────────────────────────
 *
 * Barriendo las integraciones de servidor que quedaban sin mirar después de la
 * unidad 43 (WhatsApp). El barrido tenía una pregunta concreta, heredada de la
 * unidad 37: **¿dónde se espera a alguien de fuera sin techo de tiempo?**
 *
 * Stripe: ningún `fetch` crudo, nada que arreglar.
 * `api/receta/diseno`: uno, el proxy del membrete.
 * `lib/calendario/ocupado-servidor.ts`: ninguno **y aun así el peor**, porque
 * no usa `fetch` — usa el SDK `googleapis`, que no trae tiempo máximo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Este módulo YA degradaba bien cuando Google falla, y lo tenía razonado por
 * escrito en `POR_QUE_NO_SE_ESCONDE_EL_DIA`: «ni la agenda pública ni el bot se
 * caen porque Google tenga un mal día». El `catch` devuelve el día entero libre
 * y lo declara con `fallo: true`.
 *
 * Pero **un cuelgue es Google teniendo un mal día**, y era justo el caso que no
 * cubría: una promesa que no se resuelve ni se rechaza no entra en el `catch`.
 * No hay nada que capturar. La degradación estaba escrita y no llegaba a
 * ejecutarse.
 *
 * Es la MISMA forma que el «Guardando…» eterno de la unidad 37, y por eso este
 * golden existe aparte del que ya vigilaba este archivo: aquél comprueba que el
 * texto del módulo diga lo correcto; éste comprueba que, con Google mudo, la
 * función **vuelva**.
 *
 * ── A QUIÉN LE PASA ─────────────────────────────────────────────────────────
 *
 * A los tres caminos que agendan, y el peor es el público: un paciente mirando
 * la pantalla de reserva mientras la petición de disponibilidad no acaba. No ve
 * un error —vería otra cosa—, ve una pantalla que carga para siempre.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un `catch` protege de un fallo; no protege de un silencio. Cuando la espera
 * es a alguien de fuera hace falta además un techo de tiempo, y al agotarse se
 * toma **el mismo camino que el fallo** —`fallo: true`, sin bloqueos— que es el
 * que este archivo ya declaró correcto y justificó por escrito.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando `conTiempoLimite` de `ocupado-servidor.ts`, «Google mudo» no falla
 * con un mensaje: **se queda colgada** y vitest la mata por tiempo agotado del
 * caso. Que es exactamente lo que le pasaba al paciente.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No llama a Google. `intervalosOcupados` está sustituido; lo que se prueba
 *   es el control del flujo de ESTE módulo, no la librería de Google.
 * · `Promise.race` no cancela la llamada perdedora —no se puede, con una
 *   promesa ajena—, así que la petición sigue viva por dentro. Lo que se
 *   recupera es el control, no el socket.
 * · No juzga los 6 s: es un número de producto, no una invariante.
 * · El caso de `api/receta/diseno` de abajo es un escáner de fuente y sólo
 *   dice que no queda `fetch` crudo; no prueba que Storage aborte de verdad.
 * · Barrido: Stripe, Google Calendar y el proxy del membrete. **No** declara
 *   buenas las integraciones que no aparecen aquí.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

/** Lo que devuelve Google cuando sí contesta. Sustituido en cada caso. */
let respuestaDeGoogle: () => Promise<{ ok: boolean; intervalos: { start?: string | null; end?: string | null }[] }>

vi.mock('@/lib/google-calendar', () => ({
  intervalosOcupados: () => respuestaDeGoogle(),
}))

vi.mock('@/lib/firebase-admin', () => {
  // El médico tiene calendario vinculado y token: es el único caso en el que
  // este módulo llega siquiera a preguntarle a Google.
  const doc = (datos: unknown) => ({ get: async () => ({ data: () => datos }) })
  return {
    adminDb: {
      collection: (c: string) => ({
        doc: () => c === 'googleTokens'
          ? doc({ refreshToken: 'r-sintetico' })
          : { ...doc({ uid: 'uid-sintetico' }), collection: () => ({ doc: () => doc({ uid: 'uid-sintetico' }) }) },
      }),
    },
    default: {},
  }
})

const { ocupadoEnGoogle, ESPERA_GOOGLE_MS } = await import('@/lib/calendario/ocupado-servidor')

describe('un Google que no contesta no cuelga la agenda pública', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('con Google MUDO, la disponibilidad vuelve — y vuelve declarando el fallo', async () => {
    // Ni resuelve ni rechaza: el silencio, que es lo que el `catch` no ve.
    respuestaDeGoogle = () => new Promise(() => {})

    const promesa = ocupadoEnGoogle('c1', 'm1', '2026-08-30')
    await vi.advanceTimersByTimeAsync(ESPERA_GOOGLE_MS + 50)

    // Si esto se queda pendiente, el caso muere por tiempo agotado — y eso es
    // el defecto, no un fallo de la prueba.
    const r = await promesa

    expect(r.fallo).toBe(true)
    expect(r.consultado).toBe(false)
    // NO se esconde el día: cero bloqueos, no «ocupado todo el día».
    expect(r.bloqueos).toEqual([])
  })

  it('el techo no se come una respuesta que llega tarde pero llega', async () => {
    // Sin este caso, `return VACIO` a secas pasaría el anterior.
    respuestaDeGoogle = () => new Promise((ok) => {
      setTimeout(() => ok({
        ok: true,
        intervalos: [{ start: '2026-08-30T15:00:00.000Z', end: '2026-08-30T16:00:00.000Z' }],
      }), ESPERA_GOOGLE_MS - 1000)
    })

    const promesa = ocupadoEnGoogle('c1', 'm1', '2026-08-30')
    await vi.advanceTimersByTimeAsync(ESPERA_GOOGLE_MS + 50)
    const r = await promesa

    expect(r.fallo).toBe(false)
    expect(r.consultado).toBe(true)
    expect(r.bloqueos).toHaveLength(1)
    expect(r.bloqueos[0].motivo).toBe('Ocupado en Google Calendar')
  })

  it('un fallo declarado de Google sigue degradando como antes', async () => {
    // La conducta que este archivo ya tenía. Poner el techo no podía cambiarla.
    respuestaDeGoogle = async () => ({ ok: false, intervalos: [] })

    const r = await ocupadoEnGoogle('c1', 'm1', '2026-08-30')

    expect(r).toEqual({ bloqueos: [], consultado: false, fallo: true })
  })
})

describe('el proxy del membrete de la receta tampoco espera para siempre', () => {
  const RUTA = 'src/app/api/receta/diseno/route.ts'
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('el barrido mira código de verdad', () => {
    const s = readFileSync(RUTA, 'utf8')
    expect(s.length).toBeGreaterThan(500)
    // Es un proxy de Storage: si esto desaparece, el caso de abajo no dice nada.
    expect(s).toContain('firebasestorage')
  })

  it('no queda ninguna llamada de salida con `fetch` crudo', () => {
    const cuerpo = sinComentarios(readFileSync(RUTA, 'utf8'))
    expect([...cuerpo.matchAll(/(?<![A-Za-z])fetch\(/g)].length).toBe(0)
    expect(cuerpo).toContain('fetchConTimeout(')
  })
})
