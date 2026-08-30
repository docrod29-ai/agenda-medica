import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REG-346 — UNA LLAMADA SIN TOPE INMOVILIZA LA FUNCIÓN ENTERA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Trece llamadas a proveedor salían **sin señal de aborto**. Un socket que no
 * cierra —el proveedor acepta la conexión y nunca contesta— deja la función de
 * Vercel corriendo hasta su `maxDuration` completo: facturada por GB-segundo, y
 * con el médico delante esperando una nota que ya no va a llegar.
 *
 * Lo peor estaba en `expediente/procesar`, que corre con **`maxDuration = 800`**:
 * el ensamble de OpenAI y el descubrimiento de modelos de Anthropic no tenían
 * ninguno. Y en `transcribir-diarizado`, donde el **sondeo se repite en bucle**:
 * una sola vuelta colgada basta.
 *
 * ── ESTO NO ES HIPOTÉTICO ────────────────────────────────────────────────────
 *
 * `docs/maintenance/sw-changelog.md` documenta un socket colgado que inmovilizó
 * una lambda de `maxDuration = 300` los 300 s enteros. `procesar` es casi el
 * triple de esa.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El helper correcto **ya existía** —`fetchConTimeout`, con `AbortController`,
 * `clearTimeout` en `finally` y presupuestos por destino— y se usa en tres
 * archivos. Las otras veintidós llamadas lo esquivan; el propio `gateway.ts`
 * declara esa dualidad como una parada intermedia deliberada. Trece de ellas se
 * quedaron además sin ningún tope propio: ni el helper, ni un `signal` a mano.
 *
 * Es la forma de fallo de «escrito y sin conectar» aplicada a una defensa: la
 * defensa existe, está probada, y no cubre el camino que más lo necesita.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Toda llamada a un proveedor externo desde una ruta de API lleva un tope: o
 * `fetchConTimeout`, o un `AbortSignal` propio. Sin excepciones silenciosas.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · Comprueba que EXISTA un tope, no que el número sea el correcto. Que el
 *   sondeo de AssemblyAI espere 20 s y no 15 es un juicio, no una verificación.
 * · No hay circuit breaker en ninguna parte, ni presupuesto de reintentos. Un
 *   proveedor caído se sigue reintentando por cada petición. Abierto en el
 *   tablero.
 * · No prueba el comportamiento real ante un socket colgado: eso necesitaría un
 *   servidor que acepte y calle, y no se levanta uno aquí.
 * · Sólo mira `src/app/api/`. Una llamada a proveedor desde `src/lib/` que no
 *   pase por el gateway se le escapa.
 */

const RAIZ = 'src/app/api'

/** Hosts de proveedor: si se llama a uno de éstos, hay que acotarlo. */
const PROVEEDORES = /https?:\/\/[^'"`\s]*(api\.anthropic\.com|api\.openai\.com|api\.assemblyai\.com|api\.daily\.co|\$\{AAI\})/

function rutas(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) rutas(p, acc)
    else if (n.endsWith('.ts')) acc.push(p)
  }
  return acc
}

/**
 * Un archivo está acotado si toda llamada a proveedor que contiene convive con
 * un tope. Se mide por ARCHIVO y no por llamada porque una cadena puede repartir
 * la señal entre un helper y su llamador — y porque exigirlo llamada a llamada
 * obligaría a analizar sintaxis, que es más frágil que el defecto que vigila.
 */
function sinTope(): string[] {
  const malos: string[] = []
  for (const archivo of rutas(RAIZ)) {
    const src = readFileSync(archivo, 'utf8')
    const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!PROVEEDORES.test(sinComentarios)) continue
    const acotado = /signal:/.test(sinComentarios) || /fetchConTimeout\(/.test(sinComentarios)
    if (!acotado) malos.push(archivo)
  }
  return malos
}

describe('REG-346 · ninguna llamada a proveedor puede colgar la función', () => {
  it('el cedazo mira de verdad: hay rutas que llaman a proveedores', () => {
    // Si esto llegara a cero, el guardián dejó de vigilar y no lo diría solo.
    const conProveedor = rutas(RAIZ).filter(a => PROVEEDORES.test(readFileSync(a, 'utf8')))
    expect(conProveedor.length).toBeGreaterThan(5)
  })

  it('toda ruta que llama a un proveedor lleva tope', () => {
    expect(sinTope().join('\n')).toBe('')
  })

  it('la ruta de 800 segundos, la que más duele, está acotada en sus tres llamadas', () => {
    const src = readFileSync('src/app/api/expediente/procesar/route.ts', 'utf8')
    expect(src).toMatch(/export const maxDuration = 800/)
    // Claude (con presupuesto), descubrimiento de modelos, y el ensamble de GPT.
    expect([...src.matchAll(/signal:\s*AbortSignal\.timeout/g)]).toHaveLength(3)
  })

  it('el sondeo en bucle de la diarización tiene tope por vuelta', () => {
    const src = readFileSync('src/app/api/expediente/transcribir-diarizado/route.ts', 'utf8')
    expect([...src.matchAll(/signal:\s*AbortSignal\.timeout/g)].length).toBeGreaterThanOrEqual(3)
  })

  it('el guardián sabe fallar: reconoce una llamada sin tope', () => {
    // Probado al revés sin tocar el árbol.
    const malo = `const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST' })`
    const bueno = `const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(60_000) })`
    expect(PROVEEDORES.test(malo) && !/signal:/.test(malo)).toBe(true)
    expect(PROVEEDORES.test(bueno) && !/signal:/.test(bueno)).toBe(false)
  })
})
