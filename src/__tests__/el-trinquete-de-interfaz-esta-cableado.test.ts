/**
 * GOLDEN — el trinquete de interfaz existe, está declarado y sus techos son reales.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El §24 del encargo pide **protección** de regresión visual. Lo que había era
 * un álbum: capturas de antes y después a tres anchos, que documentan pero no
 * fallan solas. Nada impedía que la siguiente sesión volviera a apagar el riel
 * en `/citas` sin que nadie se enterara hasta abrirlo a mano.
 *
 * ── POR QUÉ NO ES COMPARACIÓN DE PÍXELES ────────────────────────────────────
 *
 * Porque daría rojo cada día por construcción: la rejilla dibuja la HORA
 * ACTUAL, la siembra fecha en el día en curso y el mes cambia la maqueta del
 * calendario. Una compuerta que se pone roja sola se desactiva en una semana, y
 * entonces no protege nada — pero sigue pareciendo que sí. Se fija lo estable.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Mismo contrato que el trinquete de lint y el de diseño: axe, errores de
 * consola y desbordamiento **sólo bajan**; `aria-current` **sólo sube**.
 *
 * ── PROBADO AL REVÉS, Y NO SÓLO AQUÍ ────────────────────────────────────────
 *
 * El guardián de verdad es el script, y se probó **contra el navegador**:
 * reintroduciendo el defecto de la unidad 17 (el riel apagado en la familia de
 * la agenda), reconstruyendo y volviendo a medir, el trinquete falló y nombró
 * las **doce** combinaciones ruta×ancho afectadas, una por una. Restaurado,
 * vuelve a verde.
 *
 * Esta prueba cubre lo que aquel ejercicio no puede cubrir en CI: que el
 * archivo de techos no se borre, no se afloje y no se quede sin rutas.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No corre el navegador. **No sabe si los números de hoy siguen siendo
 *   ciertos**; sabe que están declarados y que nadie los ha aflojado.
 * · El script necesita emuladores sembrados y un build de producción, así que
 *   **no vive en CI**: es compuerta local. Que dependa de que alguien se
 *   acuerde está declarado, no disimulado.
 * · Ninguno de los dos ve el ASPECTO. Una pantalla puede volverse fea con todos
 *   estos números intactos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const RUTA_TECHOS = 'docs/audit/carril-excelencia/techos-de-interfaz.json'
const RUTA_SCRIPT = 'scripts/carril-excelencia/trinquete-de-interfaz.mjs'

describe('el trinquete de interfaz está cableado', () => {
  it('el script existe y el package.json lo declara', () => {
    expect(existsSync(RUTA_SCRIPT), RUTA_SCRIPT).toBe(true)
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    // Escrito y sin conectar: un script que nadie puede invocar por su nombre
    // es un script que nadie invoca.
    expect(Object.values(pkg.scripts as Record<string, string>).join('\n'))
      .toContain('trinquete-de-interfaz.mjs')
  })

  it('cubre las seis pantallas del carril a los tres anchos', () => {
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    const claves = Object.keys(techos)
    for (const ruta of ['/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas', '/operaciones']) {
      for (const ancho of [390, 768, 1440]) {
        expect(claves, `${ruta}@${ancho}`).toContain(`${ruta}@${ancho}`)
      }
    }
    expect(claves.length).toBe(18)
  })

  it('los techos son números reales, no huecos', () => {
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    for (const [clave, t] of Object.entries(techos as Record<string, Record<string, unknown>>)) {
      expect(typeof t.axe, clave).toBe('number')
      expect(typeof t.ariaCurrent, clave).toBe('number')
      expect(typeof t.desborde, clave).toBe('boolean')
      expect(typeof t.erroresDeConsola, clave).toBe('number')
    }
  })

  it('ninguna pantalla admite desbordamiento ni errores de consola', () => {
    // Si mañana alguien «actualiza» los techos con una pantalla rota, esto lo
    // dice: son las dos cosas que nunca pueden estar bien.
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    for (const [clave, t] of Object.entries(techos as Record<string, { desborde: boolean; erroresDeConsola: number }>)) {
      expect(t.desborde, `${clave} desborda a lo ancho`).toBe(false)
      expect(t.erroresDeConsola, `${clave} tiene errores de consola`).toBe(0)
    }
  })

  it('la navegación resuelta está congelada en las seis pantallas', () => {
    // El arreglo de la unidad 17. Si alguien lo deshace y actualiza los techos,
    // este caso lo caza aunque el script no se haya corrido.
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    for (const [clave, t] of Object.entries(techos as Record<string, { ariaCurrent: number }>)) {
      expect(t.ariaCurrent, `${clave} no dice dónde estás`).toBeGreaterThanOrEqual(2)
    }
  })

  it('el archivo dice que los techos sólo pueden mejorar', () => {
    const j = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    expect(j.queEsEsto).toMatch(/SÓLO PUEDEN BAJAR/)
    expect(j.queEsEsto).toMatch(/SÓLO PUEDE SUBIR/)
  })
})
