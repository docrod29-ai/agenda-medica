/**
 * GOLDEN — un socket colgado ya no inmoviliza el lambda, y la caída más grave
 * ya se reporta.
 *
 * ── FALLO 1: EL GATEWAY DE IA NO TENÍA TIMEOUT ───────────────────────────────
 *
 * `lib/ia/gateway.ts` centraliza **todas** las llamadas a Anthropic y OpenAI, y
 * su `fetch` no pasaba `signal`. Lo usan rutas con `maxDuration = 300`.
 *
 * Un socket colgado del proveedor **inmovilizaba el lambda los trescientos
 * segundos completos**, facturados por GB-segundo. Y el único módulo que existía
 * para centralizar las llamadas de proveedor era justo el que no tenía la
 * protección.
 *
 * Lo mismo en los cinco envíos de WhatsApp, dentro de un cron que recorre todos
 * los consultorios **en serie**.
 *
 * ── FALLO 2: LA CAÍDA MÁS GRAVE ERA LA ÚNICA QUE NO SE REPORTABA ─────────────
 *
 * `global-error.tsx` —el boundary que se activa cuando falla algo tan arriba que
 * ni el layout carga— sólo hacía `console.error`. Los boundaries de dashboard y
 * consulta sí reportaban.
 *
 * Y no era un olvido inocuo: `api/errores` exigía `verificarUsuario`, así que el
 * mini-Sentry **sólo aceptaba reportes de un usuario con sesión válida**. Un
 * fallo en el login —donde por definición no hay sesión— tampoco se podía
 * reportar.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchConTimeout, TiempoAgotado, TIMEOUT, POR_QUE_UN_HELPER } from '@/lib/fetch-con-timeout'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/**
 * ── POR QUÉ EL SERVIDOR QUE NO CONTESTA ES UN DOBLE Y NO UNA IP ─────────────
 *
 * Estos casos pedían `http://10.255.255.1/nunca` —una dirección que por
 * convención no contesta— y confiaban en que la conexión se quedara colgada más
 * de 30 ms. Eso depende de la RED de quien corre la prueba: detrás de un proxy
 * que rechaza al instante, el `fetch` falla por conexión antes de que salte el
 * temporizador, y la prueba se pone roja sin que el helper tenga nada que ver.
 * Pasó en un contenedor con proxy saliente, y el rojo no decía nada del código.
 *
 * Lo que se quiere probar es el HELPER: que arranque su temporizador, que aborte
 * él, y que lo cuente con los milisegundos y el host. Nada de eso necesita una
 * red. El doble se cuelga hasta que alguien lo aborta, que es exactamente la
 * situación que el helper existe para cortar — y ahora se cumple siempre, no
 * cuando la red acompaña.
 *
 * Lo que este doble NO cubre: que `fetch` de verdad respete `signal`. Eso es de
 * la plataforma, y ninguna versión de esta prueba lo comprobaba.
 */
function servidorQueNuncaContesta() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolver, rechazar) => {
      const s = init?.signal
      if (!s) return
      if (s.aborted) return rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' }))
      s.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' })), { once: true })
    }),
  )
}

afterEach(() => { vi.restoreAllMocks() })

describe('el helper de timeout', () => {
  it('aborta y lo dice con su propio error', async () => {
    servidorQueNuncaContesta()
    await expect(
      fetchConTimeout('http://10.255.255.1/nunca', {}, 40),
    ).rejects.toBeInstanceOf(TiempoAgotado)
  })

  it('el error dice cuánto esperó y a quién', async () => {
    /**
     * «Se agotó el tiempo» y «no se pudo conectar» no son lo mismo: decir lo
     * segundo por lo primero manda al médico a revisar su internet cuando el que
     * no contesta es el proveedor.
     */
    servidorQueNuncaContesta()
    try {
      await fetchConTimeout('http://10.255.255.1/nunca', {}, 30)
      throw new Error('debió agotarse')
    } catch (e) {
      expect(e).toBeInstanceOf(TiempoAgotado)
      expect((e as TiempoAgotado).ms).toBe(30)
      expect((e as TiempoAgotado).host).toBe('10.255.255.1')
    }
  })

  it('al revés: si el servidor SÍ contesta a tiempo, no hay TiempoAgotado', async () => {
    /**
     * Sin este caso, un helper que lanzara `TiempoAgotado` siempre pasaría los
     * dos de arriba. Es la prueba al revés que exige `testing-gates.md`.
     */
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    await expect(fetchConTimeout('http://ejemplo.invalido/si', {}, 30)).resolves.toBeInstanceOf(Response)
  })

  it('respeta una cancelación que ya venía de fuera', async () => {
    // Perderla sería romper una cancelación que alguien puso a propósito.
    servidorQueNuncaContesta()
    const c = new AbortController()
    c.abort()
    const e = await fetchConTimeout('http://10.255.255.1/x', { signal: c.signal }, 5000).catch(x => x)
    expect(e).toBeDefined()
    // Y NO se disfraza de «se agotó el tiempo»: fue un cierre deliberado.
    expect(e).not.toBeInstanceOf(TiempoAgotado)
  })

  it('limpia el temporizador SIEMPRE, también en el éxito', () => {
    /**
     * Es la trampa de `AbortController`: sin `finally`, queda un `setTimeout`
     * vivo por cada llamada con éxito.
     */
    const s = leer('src', 'lib', 'fetch-con-timeout.ts')
    expect(s).toContain('} finally {')
    expect(s).toContain('clearTimeout(t)')
    expect(POR_QUE_UN_HELPER).toMatch(/camino de ÉXITO/)
  })

  it('los tiempos son distintos según el destino, y por una razón', () => {
    // Un envío de WhatsApp que tarda diez segundos ya está roto; una nota con
    // razonamiento extendido tarda de verdad. El mismo número para los dos
    // corta respuestas buenas o deja colgado un cron.
    expect(TIMEOUT.ia).toBeGreaterThan(TIMEOUT.whatsapp)
    expect(TIMEOUT.whatsapp).toBeGreaterThan(TIMEOUT.ops)
  })
})

describe('el gateway de IA ya no se queda colgado', () => {
  const s = leer('src', 'lib', 'ia', 'gateway.ts')

  it('usa el helper, no `fetch` pelado', () => {
    expect(s).toContain('fetchConTimeout(URL[o.proveedor]')
    expect(s).toContain('TIMEOUT.ia)')
  })

  it('y distingue «tardó» de «no se pudo conectar»', () => {
    expect(s).toContain('e instanceof TiempoAgotado')
    expect(s).toContain('se cortó la espera')
  })
})

describe('los envíos de WhatsApp tampoco', () => {
  const s = leer('src', 'lib', 'whatsapp-send.ts')

  it('los cinco pasan por el helper', () => {
    // Estaban dentro de un cron que recorre todos los consultorios en serie.
    expect(s.match(/fetchConTimeout\(/g)?.length).toBe(5)
    expect(s.match(/TIMEOUT\.whatsapp\)/g)?.length).toBe(5)
  })

  it('ya no queda ningún `fetch(` suelto a un proveedor', () => {
    const codigo = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(codigo).not.toContain('await fetch(')
  })
})

describe('la caída más grave ya se reporta', () => {
  const global = leer('src', 'app', 'global-error.tsx')
  const reportar = leer('src', 'lib', 'reportar-error.ts')
  const ruta = leer('src', 'app', 'api', 'errores', 'route.ts')

  it('el boundary global llama a `reportarError`', () => {
    expect(global).toContain('reportarError(')
    expect(global).toContain("origen: 'global-error'")
  })

  it('y lo manda SIN sesión, porque puede no haberla', () => {
    /**
     * En una caída global —o en un fallo del login— no hay token. Mandarlo
     * autenticado habría dado 401 y el reporte se habría perdido igual: el
     * arreglo a medias que parece arreglo.
     */
    expect(global).toContain('sinSesion: true')
    expect(reportar).toContain('if (extra?.sinSesion)')
  })

  it('la ruta acepta el reporte anónimo', () => {
    expect(ruta).toContain('const anonimo = !acceso.ok')
    // Ya NO rechaza al que no tiene sesión.
    expect(ruta).not.toContain('if (!acceso.ok) return acceso.response')
  })

  it('pero con un freno MÁS estrecho, y marcado', () => {
    /**
     * Sin sesión no hay a quién cortarle el abuso, sólo una IP que se comparte.
     * Y un reporte sin dueño vale menos que uno con dueño: quien lo lea tiene
     * que poder distinguirlos.
     */
    expect(ruta).toContain('errores-anon:${ipDe(req)}`, 5, 3600')
    expect(ruta).toContain('anonimo,')
  })

  it('un reporte anónimo no finge tener uid', () => {
    expect(ruta).toContain("uid: acceso.ok ? acceso.uid : ''")
  })
})
