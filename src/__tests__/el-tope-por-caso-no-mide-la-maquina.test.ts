/**
 * GOLDEN — LA SUITE FALLABA POR LA CARGA DE LA MÁQUINA, NO POR EL CÓDIGO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `npx vitest run` entero fallaba de forma intermitente, en archivos distintos
 * cada vez, sin que nadie hubiera tocado nada. Tres vueltas seguidas el
 * 31-ago-2026, sobre el mismo árbol:
 *
 *     vuelta 1   la-agenda-es-un-riel.test.ts
 *     vuelta 2   (verde)
 *     vuelta 3   la-agenda-es-un-riel.test.ts  +  tope-creditos.test.ts
 *
 * ── CÓMO SE DESCUBRIÓ, Y EL DIAGNÓSTICO QUE ERA FALSO ───────────────────────
 *
 * Preparando el despliegue de v1175. La primera lectura fue **equivocada** y
 * conviene dejarla escrita: como el caso pasaba en aislamiento y pasaba en
 * `origin/main` sin tocar, se dio por hecho que era interferencia entre
 * archivos —estado de módulo que otra prueba deja sucio—. Se llegó a decir en
 * un PR.
 *
 * No lo era. Al capturar la salida completa en vez de la línea del `FAIL`, el
 * error no era una aserción:
 *
 *     Error: Test timed out in 5000ms.
 *       ❯ la-agenda-es-un-riel.test.ts:123
 *         await import('../app/(dashboard)/citas/page')
 *       ❯ tope-creditos.test.ts:60
 *         await import('@/lib/ai-keys')
 *
 * La lección, que es la de siempre en este repositorio: el resumen de un fallo
 * no es el fallo. `grep FAIL` decía «cae este caso»; el log decía «se acabó el
 * tiempo en un import». Son diagnósticos distintos y llevan a arreglos
 * distintos.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * 52 archivos hacen `await import(...)` DENTRO del `it()`. Ese import
 * transforma y carga un grafo entero —`citas/page.tsx` arrastra Next, Firebase
 * e iconos— y su coste cae dentro de la ventana de 5 s del caso. Con 841
 * archivos compitiendo por CPU, pasarse no es raro: es cuestión de qué
 * trabajador tuvo mala suerte. Por eso cambiaba de archivo cada vuelta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El tope por caso existe para que un caso COLGADO no cuelgue el lote. No
 * existe para medir velocidad: no hay una sola aserción sobre latencia en toda
 * la suite. A 20 s sigue atrapando un bucle infinito o una promesa que nunca
 * resuelve — lo único que deja de atrapar es una máquina ocupada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO demuestra que la intermitencia haya desaparecido. Eso no lo puede
 *   demostrar una prueba: se comprobó corriendo la suite entera varias veces
 *   después del cambio. Esto vigila la CONFIGURACIÓN, no la ausencia de flake.
 * · NO convierte a import estático los 29 archivos que no usan `vi.mock` y
 *   podrían prescindir del import dinámico. Queda declarado como trabajo
 *   posible, no necesario.
 * · NO toca `hookTimeout` (10 s por defecto). No se ha observado caer, y
 *   cambiar lo que no se ha visto romper es cómo se acumulan números que nadie
 *   sabe explicar.
 * · NO impide que alguien suba el tope a un minuto y esconda un cuelgue real.
 *   Por eso hay un techo, no sólo un suelo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import configDelGate from '../../vitest.config'

const RUTA = 'vitest.config.ts'
const fuente = readFileSync(resolve(process.cwd(), RUTA), 'utf8')

/** Lo que vitest usa por defecto, y que resultó demasiado corto aquí. */
const DEFECTO_DE_VITEST_MS = 5_000

describe('el tope por caso no mide la carga de la máquina', () => {
  it('está declarado: no se hereda el defecto', () => {
    expect(
      configDelGate.test?.testTimeout,
      `${RUTA} perdió testTimeout y volvió al defecto de vitest`,
    ).toBeTypeOf('number')
  })

  it('es holgadamente mayor que el defecto que provocaba el fallo', () => {
    const t = configDelGate.test?.testTimeout as number
    expect(t).toBeGreaterThan(DEFECTO_DE_VITEST_MS * 2)
  })

  /* AL REVÉS: sin un techo, «subir el tope» se convierte en el martillo con el
     que se esconde un cuelgue de verdad. Un caso que tarda más de un minuto no
     es una máquina ocupada: es un defecto. */
  it('tiene TECHO — un tope enorme esconde un cuelgue en vez de cazarlo', () => {
    const t = configDelGate.test?.testTimeout as number
    expect(t).toBeLessThanOrEqual(60_000)
  })

  it('el porqué viaja con el número, no en la memoria de quien lo puso', () => {
    // Un tope sin motivo escrito es un número que el siguiente baja «porque sí».
    const bloque = fuente.slice(0, fuente.indexOf('testTimeout'))
    expect(bloque).toContain('Test timed out in 5000ms')
    expect(bloque).toContain('await import')
    expect(fuente).toContain('el-tope-por-caso-no-mide-la-maquina.test.ts')
  })
})
