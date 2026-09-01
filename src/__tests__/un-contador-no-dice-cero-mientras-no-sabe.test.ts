/**
 * GOLDEN — un contador no afirma «0» mientras los datos no han llegado.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En `/citas`, con la red lenta, la pantalla decía **«0 citas»** en el chip de
 * resumen y, dos centímetros más abajo, **«Cargando citas…»**. El producto
 * contradiciéndose a sí mismo en un solo golpe de vista.
 *
 * Y en el peor sentido: quien mira de reojo se queda con el número. Un médico
 * que abre la agenda del día, lee «0 citas» y cierra, se va con la idea de que
 * no tiene consulta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No se veía en este entorno: los emuladores son locales y todo llega en menos
 * de medio segundo. Hubo que **emular latencia** (2 s, por CDP) para que la
 * ventana de carga durara lo bastante como para mirarla.
 *
 * Dos instrumentos fallaron antes de conseguirlo, y las dos veces medí una
 * pantalla en blanco que era culpa mía: interceptar `**\/*` con `page.route`
 * retrasa también el JavaScript de la propia página, y aun acotando el patrón,
 * la intercepción choca con el service worker de la PWA. La emulación por CDP
 * va por debajo de las dos cosas.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La LISTA sí estaba resuelta —enseña «Cargando citas…» y distingue el fallo de
 * carga del día vacío; hay un comentario en el propio archivo explicándolo—.
 * **Alguien arregló la lista y no el contador que va encima.** El contador leía
 * `daySummary.total`, que es 0 hasta que llegan los datos.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Ausencia de dato no es dato de ausencia (`clinical-safety`, regla 4) dicha en
 * lenguaje de interfaz: mientras no se sabe, **se dice que no se sabe**. Y vale
 * igual para el fallo de carga, no sólo para la espera.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el contador a `{daySummary.total}` sin condición, cae. Quitando
 * `errorCitas` de la bandera, cae el caso del fallo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un escáner de fuente. La comprobación de que de verdad se ve «—» durante
 *   la espera se hizo en navegador con latencia emulada y vive en el acta.
 * · No audita los demás contadores de la aplicación. `/finanzas` y
 *   `/lista-espera` sí tienen estado de carga propio («Calculando…»,
 *   «Cargando lista de espera…»), pero no se ha barrido el resto.
 * · No cubre el caso de datos PARCIALES —una lista recortada que se presenta
 *   como completa—, que es un defecto distinto y tiene su propio guardián.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/app/(dashboard)/citas/page.tsx', 'utf8')
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

describe('un contador no dice cero mientras no sabe', () => {
  it('la bandera exige datos en la mano: ni cargando, ni con error', () => {
    expect(cuerpo).toMatch(/const hayConteo = !loading && !errorCitas/)
  })

  it('el chip del total no afirma un número sin esa bandera', () => {
    const i = cuerpo.indexOf('riel-filtros')
    const chip = cuerpo.slice(i, i + 1200)
    /**
     * La primera versión de este caso PROHIBÍA el literal
     * `{daySummary.total}` en el chip. Fallaba con el arreglo puesto, porque ese
     * literal sí aparece — dentro de la rama buena del ternario, que es
     * exactamente donde debe estar. Prohibir un texto que la solución usa mide
     * la forma, no la garantía.
     *
     * Lo que hay que exigir es el ORDEN: la bandera se pregunta ANTES de
     * cualquier lectura del total.
     */
    const iBandera = chip.indexOf('hayConteo ?')
    const iTotal = chip.indexOf('daySummary.total')
    expect(iBandera, 'el chip pregunta por la bandera').toBeGreaterThan(-1)
    expect(iTotal, 'el chip lee el total').toBeGreaterThan(-1)
    expect(iBandera, 'la bandera se pregunta ANTES de leer el total').toBeLessThan(iTotal)
  })

  it('mientras no sabe, lo DICE — y no sólo con un guion visual', () => {
    const i = cuerpo.indexOf('riel-filtros')
    const chip = cuerpo.slice(i, i + 1200)
    // El guion es para el ojo; el texto oculto es para quien no lo ve.
    expect(chip).toContain('aún cargando')
    expect(chip).toContain('nx-solo-lector')
  })

  it('los chips de «por confirmar» y «por cobrar» tampoco aparecen sin datos', () => {
    expect(cuerpo).toContain('hayConteo && daySummary.pend > 0')
    expect(cuerpo).toContain('hayConteo && daySummary.porCobrar > 0')
  })

  it('el chip queda inerte mientras no hay nada que filtrar', () => {
    const i = cuerpo.indexOf('riel-filtros')
    expect(cuerpo.slice(i, i + 1200)).toContain('disabled={!hayConteo}')
  })

  it('la LISTA sigue distinguiendo cargar, fallar y estar vacío', () => {
    // Lo que ya estaba bien no se rompe al arreglar lo de arriba.
    expect(cuerpo).toContain('Cargando citas…')
    expect(cuerpo).toContain('No se pudo cargar la agenda')
  })
})
