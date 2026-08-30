/**
 * GOLDEN — PubMed y openFDA bajo tiempo máximo e interruptor.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos del mismo tipo, en las dos fuentes de evidencia que el producto
 * sí consulta de verdad:
 *
 *  1. **`openfda.ts` llamaba con `fetch` pelado, sin tiempo máximo ninguno.**
 *     `dosisFDA` se dispara desde `consultor-evidencia` (`maxDuration = 300`) y
 *     por partida triple, en paralelo. Un socket colgado inmovilizaba la función
 *     los 300 segundos completos. Es exactamente el fallo para el que se
 *     escribió `fetch-con-timeout` (REG-346) — y este módulo se quedó fuera, que
 *     es la forma habitual de que una defensa buena no proteja.
 *
 *  2. **`expediente/evidencia` llama a PubMed sin `signal`.** `esearch` y
 *     `efetch` lo aceptan, pero en ese camino nadie se lo pasa, así que la
 *     protección existía y no llegaba.
 *
 *  3. Y ninguna de las dos tenía interruptor: con NCBI caído, cada búsqueda de
 *     cada médico volvía a pagar la espera entera para llegar a la misma
 *     conclusión.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Cerrando `WS-04.interruptor-otros`. Al buscar dónde poner la puerta hubo que
 * mirar las llamadas de verdad, y la de openFDA no tenía ni la protección
 * anterior.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un ayudante de protección que se aplica **por convención**: hay que acordarse
 * de usarlo. El arreglo pone la puerta en el **cuello de botella** de cada
 * módulo (`ncbiFetch`, `pedir`) en vez de en cada llamador, que es lo que hace
 * que la siguiente llamada nazca protegida sin que nadie se acuerde.
 *
 * ── LA REGLA CLÍNICA QUE ESTO PROTEGE ───────────────────────────────────────
 *
 * **Ausencia de dato no es dato de ausencia.** Cuando el circuito se abre,
 * PubMed **lanza** en vez de devolver una lista vacía, para que el `catch` de
 * quien llama marque `TestigoPubMed.fallo` — el testigo que separa «no hay
 * artículos» de «no se pudo preguntar». Devolver `[]` en silencio convertiría
 * una búsqueda que no se hizo en una búsqueda sin resultados.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide el timeout real.** Que la llamada pase por `fetchConTimeout` con
 *   `TIMEOUT.evidencia` se comprueba; esperar quince segundos de verdad en la
 *   suite no aporta nada que este camino no diga ya. El propio helper tiene su
 *   golden (REG-346).
 * · **No prueba la pantalla.** Que el médico LEA «no se consultó» depende de la
 *   ruta y del componente; aquí sólo se prueba que el testigo se marca.
 * · **No cubre las otras 27 fuentes del catálogo**, porque hoy no se consultan:
 *   ver `el-catalogo-de-fuentes-no-calla-ninguna`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  veredictoDeRespuestaEvidencia, veredictoDeExcepcionEvidencia,
  claveCircuitoEvidencia, FuenteNoConsultada,
  POR_QUE_UN_429_NO_ABRE, NO_CONSULTADO_NO_ES_SIN_RESULTADOS,
} from '@/lib/evidencia/fallo-del-proveedor'
import { olvidarCircuitos, circuitosAbiertos } from '@/lib/red/interruptor'
import { TiempoAgotado, TIMEOUT } from '@/lib/fetch-con-timeout'

describe('qué dice «la fuente no está» y qué no', () => {
  it('un 5xx y el tiempo agotado sí', () => {
    expect(veredictoDeRespuestaEvidencia(503)).toBe('el_proveedor_no_esta')
    expect(veredictoDeExcepcionEvidencia(new TiempoAgotado(15_000, 'eutils.ncbi.nlm.nih.gov')))
      .toBe('el_proveedor_no_esta')
  })

  it('un 429 de NCBI NO — se pidió de más, no está caído', () => {
    /* Ver POR_QUE_UN_429_NO_ABRE: el módulo ya tiene su propio regulador de
       velocidad, y apagar la evidencia entera por un 429 cambia un problema
       pequeño por uno grande. */
    expect(veredictoDeRespuestaEvidencia(429)).toBe('no_dice_nada_del_proveedor')
    expect(POR_QUE_UN_429_NO_ABRE).toMatch(/regulador de velocidad/)
  })

  it('NCBI y openFDA no comparten circuito', () => {
    /* Son dos servicios y dos máquinas: que uno esté caído no puede dejar de
       consultar al otro. */
    expect(claveCircuitoEvidencia('ncbi')).not.toBe(claveCircuitoEvidencia('openfda'))
  })
})

/* ── El cuello de botella, ejercitado ─────────────────────────────────────── */

const red = vi.hoisted(() => ({ n: 0, status: 503 }))

describe('PubMed: se deja de preguntar, y se DICE que no se preguntó', () => {
  beforeEach(() => {
    olvidarCircuitos()
    red.n = 0
    red.status = 503
    vi.stubGlobal('fetch', async () => { red.n += 1; return new Response('x', { status: red.status }) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('tras tres 503 el circuito se abre y la cuarta búsqueda no sale a la red', async () => {
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    for (let i = 0; i < 3; i += 1) await buscarEvidencia('sepsis', { max: 3 })
    expect(red.n, 'las tres primeras sí se intentan').toBe(3)

    await buscarEvidencia('sepsis', { max: 3 })
    expect(red.n, 'la cuarta debía fallar rápido').toBe(3)
    expect(circuitosAbiertos()).toContain(claveCircuitoEvidencia('ncbi'))
  })

  it('y el testigo dice «no se pudo preguntar», no «no hay artículos»', async () => {
    /**
     * El caso clínico de todo esto. Sin el testigo, una fuente caída se lee
     * igual que una búsqueda sin resultados — y ésa es la regla 4: ausencia de
     * dato no es dato de ausencia.
     */
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    for (let i = 0; i < 3; i += 1) await buscarEvidencia('sepsis', { max: 3 })

    const testigo = { fallo: false }
    const arts = await buscarEvidencia('sepsis', { max: 3, testigo })
    expect(arts).toEqual([])
    expect(testigo.fallo, 'una búsqueda que no se hizo no puede parecer una sin resultados').toBe(true)
  })

  it('un 429 repetido NO abre el circuito: se sigue preguntando', async () => {
    /**
     * Al revés del primero, y el que protege el aislamiento aquí: si un 429
     * abriera, el propio regulador de velocidad del módulo acabaría apagando la
     * evidencia del producto.
     *
     * Se mide por CRECIMIENTO y no con un número fijo: `buscarEvidencia` prueba
     * varios términos cuando el primero no devuelve nada, y atar la prueba a
     * cuántos son la haría fallar el día que se añada una variante — un rojo que
     * no diría nada de lo que aquí se protege.
     */
    red.status = 429
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    for (let i = 0; i < 3; i += 1) await buscarEvidencia('sepsis', { max: 3 })
    const trasLasTres = red.n
    expect(trasLasTres).toBeGreaterThan(0)
    await buscarEvidencia('sepsis', { max: 3 })
    expect(red.n, 'con un 503 aquí ya no se habría llamado; con un 429 sí')
      .toBeGreaterThan(trasLasTres)
    expect(circuitosAbiertos()).toEqual([])
  })

  it('el error de circuito abierto se distingue de un fallo cualquiera', () => {
    const e = new FuenteNoConsultada('PubMed')
    expect(e.name).toBe('FuenteNoConsultada')
    expect(e.fuente).toBe('PubMed')
    expect(NO_CONSULTADO_NO_ES_SIN_RESULTADOS).toMatch(/NO CONSULTADA/)
  })
})

describe('openFDA: el `fetch` pelado ya no existe', () => {
  beforeEach(() => {
    olvidarCircuitos()
    red.n = 0
    vi.stubGlobal('fetch', async () => { red.n += 1; return new Response('x', { status: 500 }) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('tras tres 500 deja de consultar la etiqueta', async () => {
    const { dosisFDA } = await import('@/lib/evidencia/openfda')
    /* Cada `dosisFDA` hace dos peticiones: exacta y amplia. */
    await dosisFDA('amoxicillin')
    await dosisFDA('ceftriaxone')
    expect(red.n).toBeGreaterThanOrEqual(3)
    const antes = red.n
    expect(await dosisFDA('meropenem')).toBeNull()
    expect(red.n, 'con el circuito abierto no debe salir nada').toBe(antes)
  })
})

describe('la protección está en el cuello de botella, no en cada llamador', () => {
  const pubmed = readFileSync('src/lib/evidencia/pubmed.ts', 'utf8')
  const openfda = readFileSync('src/lib/evidencia/openfda.ts', 'utf8')

  it('ninguno de los dos llama a `fetch` directamente', () => {
    /**
     * Ésta es la que evita la recaída. La protección anterior (REG-346) se
     * aplicaba por convención y openFDA se quedó fuera durante meses sin que
     * nada se pusiera rojo. Un `fetch(` suelto aquí vuelve a abrir el agujero.
     */
    for (const [nombre, src] of [['pubmed', pubmed], ['openfda', openfda]] as const) {
      const sueltos = [...src.matchAll(/(?<![.\w])fetch\(/g)]
        .filter(m => !src.slice(Math.max(0, m.index - 12), m.index).includes('ConTimeout'))
      expect(sueltos.length, `${nombre} llama a fetch sin tiempo máximo`).toBe(0)
    }
  })

  it('y los dos usan el presupuesto de evidencia', () => {
    expect(pubmed).toMatch(/TIMEOUT\.evidencia/)
    expect(openfda).toMatch(/TIMEOUT\.evidencia/)
    expect(TIMEOUT.evidencia).toBeLessThan(TIMEOUT.ia)
  })
})
