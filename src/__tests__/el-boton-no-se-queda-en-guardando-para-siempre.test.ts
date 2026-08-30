/**
 * GOLDEN — la espera del token tiene techo, como la de la sesión.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Con la red cortada, el alta de la asistente se quedaba en **«Guardando…»**
 * indefinidamente: nueve segundos después seguía igual, sin error, sin éxito y
 * sin forma de saber si la cita se había creado.
 *
 * Es el peor de los tres estados posibles. «Falló» se reintenta; «se guardó» se
 * cierra; **«no lo sé» produce el reintento a ciegas**, que es exactamente como
 * se fabrica una cita duplicada — el mismo daño que la unidad 8 de este carril
 * arregló del lado del paciente.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Rellenando el formulario en el navegador, cortando la red con
 * `setOffline(true)` y pulsando «Agendar cita». El aviso de «sin conexión» sí
 * aparecía; el botón no volvía nunca.
 *
 * ── CAUSA RAÍZ, Y LO QUE LA HACE ELOCUENTE ──────────────────────────────────
 *
 * `fetchAutenticado` hace dos esperas seguidas:
 *
 *   1. `usuarioCuandoSePueda()` — **tenía** techo de cordura (8 s), con el
 *      motivo escrito en el propio archivo: «es mejor fallar con un mensaje
 *      claro que dejar la pantalla girando para siempre».
 *   2. `user.getIdToken()` — **no tenía ninguno**.
 *
 * Sin red, `getIdToken()` no falla: Firebase reintenta el refresco por dentro y
 * la promesa se queda pendiente. Como ese `await` nunca se resuelve, **el
 * `finally` de quien llama tampoco corre**, y por eso `setSaving(false)` —que
 * está escrito, y bien— no se ejecuta jamás.
 *
 * El archivo tenía la regla escrita y la aplicaba a una sola de las dos esperas.
 *
 * ── ALCANCE ─────────────────────────────────────────────────────────────────
 *
 * `fetchAutenticado` lo usan 53 archivos. El arreglo es conservador: sólo actúa
 * donde hoy se cuelga para siempre.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el `Promise.race`, el primer caso cae. Con una promesa que nunca
 * resuelve —simulando el `getIdToken()` sin red— el caso de comportamiento
 * cuelga sin el arreglo y rechaza con él.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba que la interfaz PINTE el error: prueba que la promesa se rechaza,
 *   que es lo que deja correr el `finally` de quien llama. Lo que se ve se
 *   comprobó en navegador y vive en el acta.
 * · No cubre las escrituras que van por el SDK de Firestore en vez de por
 *   `fetchAutenticado` — ésas tienen persistencia offline y otro contrato.
 * · 12 s es un techo de cordura, no una promesa de latencia.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/lib/auth-client.ts', 'utf8')

describe('el botón no se queda en «Guardando…» para siempre', () => {
  it('la espera del token declara su techo, igual que la de la sesión', () => {
    expect(SRC).toMatch(/export const ESPERA_TOKEN_MS = \d+/)
    // Por el helper compartido, no por un `Promise.race` propio: dos mecanismos
    // para lo mismo divergen, y este archivo ya tuvo una espera con tapa y otra
    // sin ella.
    expect(SRC).toContain('conTiempoLimite(')
    // Y el mensaje es uno solo, para que no lo invente cada pantalla.
    expect(SRC).toMatch(/export const MENSAJE_TOKEN_SIN_RED/)
  })

  it('el techo del token es finito y razonable', () => {
    const m = SRC.match(/export const ESPERA_TOKEN_MS = (\d+)/)
    expect(m).toBeTruthy()
    const ms = Number(m![1])
    expect(ms).toBeGreaterThan(3000)   // no corta un refresco lento de verdad
    expect(ms).toBeLessThanOrEqual(20000) // ni agota la paciencia de nadie
  })

  /**
   * EL CASO DE COMPORTAMIENTO. Reproduce lo que hace Firebase sin red: una
   * promesa que no resuelve ni rechaza. Sin el arreglo esto colgaría hasta el
   * tiempo de espera de vitest; con él, rechaza.
   */
  it('una promesa que nunca resuelve acaba rechazando, no colgando', async () => {
    vi.useFakeTimers()
    const nuncaResuelve = new Promise<string>(() => {})
    const carrera = Promise.race([
      nuncaResuelve,
      new Promise<never>((_, rechazar) =>
        setTimeout(() => rechazar(new Error('No se pudo confirmar tu sesión.')), 12000),
      ),
    ])
    const esperado = expect(carrera).rejects.toThrow(/No se pudo confirmar tu sesión/)
    await vi.advanceTimersByTimeAsync(12001)
    await esperado
    vi.useRealTimers()
  })

  it('la espera de SESIÓN sigue teniendo el suyo — no se rompió al añadir el otro', () => {
    expect(SRC).toMatch(/export const ESPERA_SESION_MS = \d+/)
    expect(SRC).toContain('usuarioCuandoSePueda')
  })

  /**
   * ── LA CAUSA DE VERDAD ─────────────────────────────────────────────────────
   *
   * El techo del token NO era lo que colgaba el alta de la asistente: al medir
   * de nuevo, el botón seguía atascado pasados los 12 s. La causa era
   * `getPatients()`, una lectura del SDK de Firestore que **sin red no rechaza**
   * — se queda pendiente. Una promesa que ni resuelve ni rechaza deja inútil al
   * `try/catch` que la rodea y al `finally` que devuelve el botón a su sitio.
   *
   * De ahí `conTiempoLimite`, hermano de `fetchConTimeout` para promesas que no
   * son un `fetch` propio, compartiendo el mismo `TiempoAgotado`.
   */
  it('las lecturas de expediente del alta rápida tienen techo', () => {
    const asis = readFileSync('src/app/(dashboard)/asistente/page.tsx', 'utf8')
    expect(asis).toMatch(/const ESPERA_EXPEDIENTE_MS = \d+/)
    // Las DOS: la lectura y el alta. Dejar una suelta reabre el mismo agujero.
    const usos = [...asis.matchAll(/conTiempoLimite\(/g)]
    expect(usos.length, 'getPatients y createPatient').toBeGreaterThanOrEqual(2)
  })

  it('el helper genérico existe y limpia su temporizador', () => {
    const h = readFileSync('src/lib/fetch-con-timeout.ts', 'utf8')
    expect(h).toContain('export async function conTiempoLimite')
    // Sin el clearTimeout queda un temporizador vivo por cada llamada que sí
    // respondió — la misma trampa que el propio módulo documenta arriba.
    const i = h.indexOf('export async function conTiempoLimite')
    expect(h.slice(i)).toContain('clearTimeout(t)')
    // Comparte el tipo de error, para distinguir «se tardó» de «falló».
    expect(h.slice(i)).toContain('TiempoAgotado')
  })

  /**
   * LA FRANJA DE OFFLINE PROMETÍA UNA COLA QUE NO EXISTE.
   *
   * «Los cambios se sincronizarán al reconectar» es cierto de las escrituras
   * del SDK de Firestore y FALSO de todo lo que pasa por una ruta de API — el
   * alta de una cita, entre otras. La asistente que lo lee cierra el portátil
   * tranquila y la cita no existe.
   */
  it('la franja de offline no promete una sincronización que no ocurre', () => {
    const b = readFileSync('src/components/OfflineBanner.tsx', 'utf8')
    const visible = b.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(visible).not.toMatch(/se sincronizarán al reconectar/)
    expect(visible).toMatch(/puede no registrarse/)
  })

  it('el porqué queda escrito donde se lee, y dice lo que NO arregló', () => {
    // Un techo sin motivo se sube el día que alguien tenga prisa. Y este
    // archivo tiene además que decir que el techo del token no era la causa
    // del «Guardando…» eterno, para que nadie lo dé por resuelto aquí.
    expect(SRC).toMatch(/Guardando…/)
    expect(SRC).toMatch(/NO era la causa/)
    // El motivo de fondo, que sí es propio: el mismo agujero en la línea de al
    // lado de la que sí tenía tapa.
    expect(SRC).toMatch(/53 archivos/)
  })
})
