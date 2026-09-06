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

  it('cubre la superficie medida, y la superficie sólo crece', () => {
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    const claves = Object.keys(techos)
    // Las seis de la familia de la agenda —las que arregló este carril— siguen
    // exigiéndose por nombre: son las que no pueden desaparecer del trinquete.
    for (const ruta of ['/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas', '/operaciones']) {
      for (const ancho of [390, 768, 1440]) {
        expect(claves, `${ruta}@${ancho}`).toContain(`${ruta}@${ancho}`)
      }
    }
    /**
     * El número era `toBe(18)` cuando el trinquete medía seis rutas. Eso
     * cazaba que alguien QUITARA una — que es lo que importa— pero también
     * impedía añadir, que es lo contrario de lo que queremos: la unidad 46
     * subió a 20 rutas × 3 anchos = 60, y con ello aparecieron cuatro
     * violaciones críticas de axe que llevaban ahí desde siempre.
     *
     * Así que la superficie medida es un trinquete más: SÓLO CRECE.
     */
    expect(claves.length, 'la superficie medida no puede encoger').toBeGreaterThanOrEqual(69)
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

  /**
   * Errores de consola que NO son un defecto, con su razón y su número exacto.
   *
   * El portal del paciente pide `documentos` y `paquetes` al cargar, y con un
   * token de alcance `agenda` el servidor los **rechaza correctamente** con un
   * 403 y un mensaje escrito para el paciente («Pide a tu médico el acceso a
   * tus recetas»). Comprobado con `curl` contra las tres acciones: `session`
   * 200, las otras dos 403 con su mensaje.
   *
   * O sea: es la autorización funcionando, no una pantalla rota. El cliente no
   * puede saber su alcance sin preguntar, así que pregunta y encaja la
   * negativa.
   *
   * Se congela en 2: si sube, hay una llamada nueva que falla y sí habría que
   * mirarla; si baja, alguien enseñó al cliente su alcance y hay que bajar el
   * número aquí.
   */
  const CONSOLA_ESPERADA: Record<string, number> = { '/mi/[token]': 2 }

  it('ninguna pantalla admite desbordamiento ni errores de consola sin explicar', () => {
    // Si mañana alguien «actualiza» los techos con una pantalla rota, esto lo
    // dice: son las dos cosas que nunca pueden estar bien.
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    for (const [clave, t] of Object.entries(techos as Record<string, { desborde: boolean; erroresDeConsola: number }>)) {
      expect(t.desborde, `${clave} desborda a lo ancho`).toBe(false)
      const esperado = CONSOLA_ESPERADA[clave.split('@')[0]] ?? 0
      expect(t.erroresDeConsola, `${clave} tiene errores de consola sin declarar`).toBe(esperado)
    }
  })

  /**
   * Rutas SIN contexto de navegación, a propósito y por escrito.
   *
   * `/consultor` salió de `GRUPOS` en RTC-09 y hoy se alcanza desde las
   * Herramientas del expediente; decidir su contexto es una decisión de
   * producto que este carril no toma (unidad 17). Lo que sí hizo la unidad 47
   * fue **medirlo**: cero en los tres anchos, escrito en el trinquete. Deja de
   * ser una suposición, y el día que alguien le dé contexto, el número sube y
   * hay que sacarlo de esta lista.
   */
  const SIN_CONTEXTO_A_PROPOSITO = ['/consultor']

  /**
   * Rutas con UN solo riel marcado, medido y explicado.
   *
   * `/consulta` marca «Encuentro» en el riel de escritorio y **no marca nada en
   * el de móvil**, y eso es correcto: los cuatro destinos de abajo son `hoy`,
   * `paciente`, `seguimiento` y `operaciones`; ninguno **es** el encuentro.
   * Marcar otro sería mentir —`aria-current="page"` señala el enlace a la
   * página en la que estás— y añadir un quinto destino chocaría con la regla de
   * diseño para móvil («4–5 destinos primarios como máximo. Ni seis»), porque
   * el hueco central ya lo ocupa la acción contextual.
   *
   * O sea: no es un defecto que este carril pueda arreglar marcando algo. Es
   * una decisión de producto —qué enseña el riel de móvil durante una
   * consulta— y lo que aporta aquí es **el número medido**, congelado en 1: si
   * baja a 0, el riel de escritorio también se apagó y eso sí es un defecto.
   */
  const UN_SOLO_RIEL: Record<string, number> = {
    '/consulta/pac-001': 1,
    // El portal del paciente tiene SU barra de cinco destinos y ninguno de los
    // rieles del consultorio: marca uno, el suyo. No comparte navegación con el
    // panel del médico, y no debe.
    '/mi/[token]': 1,
  }

  it('la navegación resuelta está congelada donde la hay', () => {
    // El arreglo de la unidad 17. Si alguien lo deshace y actualiza los techos,
    // este caso lo caza aunque el script no se haya corrido.
    const { techos } = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    for (const [clave, t] of Object.entries(techos as Record<string, { ariaCurrent: number }>)) {
      const ruta = clave.split('@')[0]
      const esperado = UN_SOLO_RIEL[ruta]
      if (esperado !== undefined) {
        expect(t.ariaCurrent, `${clave} cambió de rieles marcados`).toBe(esperado)
        continue
      }
      if (SIN_CONTEXTO_A_PROPOSITO.includes(ruta)) {
        // Congelado en su cero: si sube, es que alguien lo decidió y hay que
        // sacarlo de la lista en vez de dejar la excepción vencida.
        expect(t.ariaCurrent, `${clave} ya dice dónde estás: sácalo de la lista`).toBe(0)
        continue
      }
      expect(t.ariaCurrent, `${clave} no dice dónde estás`).toBeGreaterThanOrEqual(2)
    }
  })

  it('el archivo dice que los techos sólo pueden mejorar', () => {
    const j = JSON.parse(readFileSync(RUTA_TECHOS, 'utf8'))
    expect(j.queEsEsto).toMatch(/SÓLO PUEDEN BAJAR/)
    expect(j.queEsEsto).toMatch(/SÓLO PUEDE SUBIR/)
  })
})
