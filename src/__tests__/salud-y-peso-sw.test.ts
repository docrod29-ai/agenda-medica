/**
 * GOLDEN — un cuarto de megabyte por visita para leer tres dígitos, y la
 * pregunta «¿está arriba?» que no se podía contestar.
 *
 * ── FALLO 1: EL SERVICE WORKER PESABA 276 KB, Y ERA CULPA DE ESTA BITÁCORA ───
 *
 * Cada versión desplegada añadía su párrafo a un comentario del `const CACHE`,
 * en la línea 8 de `public/sw.js`. Esa línea sola llegó a **271 KB**.
 *
 * Y `ServiceWorkerRegister` descarga ese archivo **entero**, con
 * `cache: 'no-store'` —o sea sin caché—, **en cada carga de página**, sólo para
 * leer `nexusmed-v(\d+)` y comparar el número.
 *
 * Un cuarto de megabyte de egreso por visita, por usuario, para averiguar una
 * cifra de tres dígitos. Y creciendo con cada despliegue.
 *
 * El texto no sobraba: explica por qué se hizo cada cambio, que es lo que hace
 * falta dentro de seis meses. Lo que sobraba era **dónde estaba**.
 *
 * ── FALLO 2: NO HABÍA FORMA DE SABER SI EL SISTEMA ESTÁ ARRIBA ───────────────
 *
 * No existía ningún endpoint de salud. `api/calendar/status` es el estado del
 * Google Calendar **de un usuario**, no del sistema. Ni Firestore, ni Stripe, ni
 * los proveedores de IA, ni el bucket — y ningún monitor externo que lo mirara.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf8')

describe('el service worker vuelve a ser un service worker', () => {
  it('pesa lo que debe pesar, no un cuarto de megabyte', () => {
    /**
     * El tope es generoso a propósito: lo que se vigila no es el byte exacto,
     * es que nadie vuelva a usar este archivo como cuaderno.
     */
    const bytes = statSync(join(raiz, 'public', 'sw.js')).size
    expect(bytes, `public/sw.js pesa ${bytes} B; la bitácora va en docs/maintenance/sw-changelog.md`)
      .toBeLessThan(30_000)
  })

  it('ninguna línea suya es un párrafo', () => {
    // Es la forma que tenía el problema: UNA línea de 271 KB.
    const masLarga = Math.max(...leer('public', 'sw.js').split('\n').map(l => l.length))
    expect(masLarga, 'hay una línea larguísima en sw.js: ¿volvió la bitácora?').toBeLessThan(500)
  })

  it('la bitácora no se perdió: está entera en su sitio', () => {
    // Sacarla no era borrarla. Explica por qué se hizo cada cambio.
    const md = leer('docs', 'maintenance', 'sw-changelog.md')
    expect(md.length).toBeGreaterThan(100_000)
    expect(md).toContain('SIN CONECTAR')
  })

  it('y sigue declarando la versión, que es lo que el despliegue verifica', () => {
    expect(leer('public', 'sw.js')).toMatch(/const CACHE = 'nexusmed-v\d+'/)
  })
})

describe('la versión se sirve aparte, y se genera', () => {
  it('`public/version.txt` existe y es diminuto', () => {
    const p = join(raiz, 'public', 'version.txt')
    expect(existsSync(p), 'falta public/version.txt — corre `npm run version-sw`').toBe(true)
    expect(statSync(p).size).toBeLessThan(64)
  })

  it('dice exactamente lo mismo que `sw.js`', () => {
    /**
     * Dos sitios donde escribir la versión son dos sitios que se desincronizan,
     * y ésta gobierna la purga de caché: si dijeran cosas distintas, el
     * navegador purgaría en bucle o no purgaría nunca.
     */
    const enSw = leer('public', 'sw.js').match(/nexusmed-v\d+/)?.[0]
    expect(leer('public', 'version.txt').trim()).toBe(enSw)
  })

  it('el build la regenera, para que no se quede vieja', () => {
    const pkg = JSON.parse(leer('package.json'))
    expect(pkg.scripts.build).toContain('version-sw')
    expect(pkg.scripts['version-sw']).toContain('scripts/version-sw.mjs')
  })

  it('el generador FALLA si no encuentra la versión', () => {
    // Sin versión, la purga de caché deja de funcionar y los médicos se quedan
    // con la aplicación vieja sin que nadie se entere. Fallar es lo correcto.
    expect(leer('scripts', 'version-sw.mjs')).toContain('process.exit(1)')
  })

  it('el cliente pide `version.txt`, no `sw.js`', () => {
    const s = leer('src', 'components', 'ServiceWorkerRegister.tsx')
    expect(s).toContain("fetch('/version.txt', { cache: 'no-store' })")
    expect(s).not.toContain("fetch('/sw.js', { cache: 'no-store' })")
  })
})

describe('/api/health contesta «¿está arriba?»', () => {
  const s = leer('src', 'app', 'api', 'health', 'route.ts')

  it('sonda Firestore, los dos proveedores de IA y Stripe', () => {
    for (const dep of ['firestore', 'anthropic', 'openai', 'stripe']) {
      expect(s, dep).toContain(`sondear('${dep}'`)
    }
  })

  it('no consume tokens: pide la lista de modelos, no una respuesta', () => {
    /**
     * Un endpoint de salud que cuesta dinero cada minuto se acaba apagando, y
     * entonces no hay salud que valga.
     */
    expect(s).toContain('api.anthropic.com/v1/models')
    expect(s).toContain('api.openai.com/v1/models')
  })

  it('`ok: null` NO es `false`, y está explicado', () => {
    /**
     * `false` es «contesté y está mal»; `null` es «no lo pude comprobar»,
     * típicamente porque no hay credencial en este entorno. Confundirlos
     * pintaría de rojo un sistema sano, y una alarma que miente se ignora.
     */
    expect(s).toContain('`ok: null` NO es `false`')
    expect(s).toContain('sondas.every(s => s.ok !== false)')
  })

  it('mira también los trabajos automáticos', () => {
    // Un sistema con todo arriba y los crons parados no está sano, y desde
    // fuera se ve idéntico.
    expect(s).toContain('leerLatidos()')
    expect(s).toContain("t.estado !== 'tarde'")
  })

  it('NO devuelve claves ni mensajes del proveedor', () => {
    // El mensaje de un proveedor puede llevar dentro parte de la petición, y
    // esto es público.
    expect(s).toContain("nota: 'falló o se agotó el tiempo'")
    const i = s.indexOf('} catch {')
    expect(s.slice(i, i + 300)).not.toContain('e.message')
  })

  it('cada sonda tiene timeout, y el endpoint entero también', () => {
    expect(s).toContain('const SONDA_MS = 3000')
    expect(s).toContain('export const maxDuration = 15')
  })

  it('responde 503 cuando algo está caído, no 200 con mala cara', () => {
    // Un monitor externo mira el código de estado, no el cuerpo.
    expect(s).toContain('status: ok ? 200 : 503')
  })

  it('y no se cachea: un estado en caché es un estado mentiroso', () => {
    expect(s).toContain("'Cache-Control': 'no-store'")
  })

  it('expone la versión y el commit desplegado', () => {
    // Para poder contestar «¿qué está desplegado?» sin abrir Vercel.
    expect(s).toContain('version: version()')
    expect(s).toContain('VERCEL_GIT_COMMIT_SHA')
  })
})
