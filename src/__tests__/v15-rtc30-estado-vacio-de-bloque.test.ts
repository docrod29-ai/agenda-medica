/**
 * RTC-30 — cuánto espacio merece el vacío.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El estado vacío del producto era uno solo: icono centrado + título + frase +
 * botón primario, en 48px de aire. Es literalmente el estado vacío que genera
 * cualquier andamio, y la re-puntuación §29 lo encontró en 3 de las 6
 * superficies.
 *
 * ── CÓMO SE DESCUBRIÓ QUE ERA URGENTE ───────────────────────────────────────
 *
 * Al quitar la tarjeta contenedora de Hoy (RTC-31, 2ª rebanada). Dentro de la
 * caja, los 48px de aire del hero se leían como relleno de tarjeta. Sin la
 * caja, «Sin citas hoy» se convirtió en **250px de vacío ilustrado por encima
 * de los pendientes que sí requerían atención** — dos de ellos críticos y sin
 * dueño, empujados fuera del primer viewport por un bloque que no tenía nada
 * que decir.
 *
 * Es la segunda vez en la misma rebanada: **quitar un contenedor cambia el
 * peso de todo lo que había dentro.** Se mira después, no se supone.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Un bloque sin contenido **no puede pesar más que uno con trabajo dentro**.
 *    Cuando el vacío es de UN BLOQUE dentro de una pantalla que sigue teniendo
 *    trabajo debajo, se dice en una línea y se sigue (`variante="linea"`).
 * 2. El hero se conserva para cuando el vacío ES la pantalla: un consultorio
 *    sin ningún paciente todavía, donde lo único que hay que hacer es lo que
 *    ese botón hace.
 * 3. **El ERROR conserva su peso.** «Tu agenda de hoy está libre» con la red
 *    caída es la frase más peligrosa de esa pantalla: el médico la lee y se
 *    va. Distinguir «no hay» de «no se pudo leer» es la regla 4 de seguridad
 *    clínica, y aligerar el fallo la rompería.
 * 4. Es una VARIANTE del mismo componente, no un componente nuevo: la
 *    prohibición de implementaciones paralelas de `AGENTS.md` aplica también a
 *    los estados vacíos.
 *
 * Probado al revés: quitando la variante del componente falla el caso 1;
 * poniendo `variante="linea"` en el estado de ERROR de la agenda falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo se aplicó en Hoy.** El expediente («Sin notas todavía», con
 *   ilustración y «Crear primera nota») y el resto siguen con el hero: ahí el
 *   vacío puede ser legítimamente la pantalla y hay que mirarlo caso por caso.
 *   Declarado, no olvidado.
 * · No mide píxeles: el antes/después está en las capturas de
 *   `docs/design/capturas/v15-rtc31-hoy/`.
 * · No juzga el TEXTO del vacío, que es lo que de verdad lo hace útil.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const COMPONENTE = leer('src/components/ui/EmptyState.tsx')
const CSS = leer('src/app/globals.css')
const HOY = leer('src/app/(dashboard)/dashboard/page.tsx')

describe('RTC-30 — el vacío de un bloque no pesa como el de una pantalla', () => {
  it('1 · el estado vacío tiene variante de línea, y es del MISMO componente', () => {
    expect(COMPONENTE).toMatch(/variante\?: 'hero' \| 'linea'/)
    expect(COMPONENTE).toContain("variante = 'hero'")
    expect(COMPONENTE).toContain('empty-state empty-state--linea')
    expect(CSS).toContain('.empty-state--linea')
  })

  it('2 · la variante de línea no centra, no ilustra y no reserva 48px de aire', () => {
    const bloque = CSS.slice(CSS.indexOf('.empty-state--linea {'))
    const cuerpo = bloque.slice(0, bloque.indexOf('}'))
    expect(cuerpo).toContain('text-align: left')
    expect(cuerpo).toContain('flex-direction: row')
    expect(cuerpo).not.toContain('padding: 48px')
    // El icono/ilustración no se pintan en esta variante: el bloque vacío no
    // compite por atención con el que sí tiene trabajo.
    const jsx = COMPONENTE.slice(COMPONENTE.indexOf("if (variante === 'linea')"))
    expect(jsx.slice(0, jsx.indexOf('return (\n    <div className="empty-state">'))).not.toContain('empty-state-icon')
  })

  it('3 · Hoy dice su vacío en una línea', () => {
    expect(HOY).toContain('variante="linea"')
    expect(HOY).toContain('Hoy no hay citas.')
  })

  it('4 · pero el ERROR de la agenda conserva su peso (regla 4)', () => {
    /**
     * «No es que no tengas citas: no se pudieron leer». Si este estado se
     * aligerara a una línea, el fallo de red se leería como una agenda libre —
     * y el médico se iría. Ausencia de dato no es dato de ausencia.
     */
    const i = HOY.indexOf('No se pudo cargar la agenda')
    expect(i).toBeGreaterThan(0)
    /* EL ELEMENTO, NO UNA VENTANA DE CARACTERES. La primera versión miraba
       ±400 caracteres alrededor del título y se llevaba por delante el
       EmptyState VECINO —el de «Hoy no hay citas», que sí es de línea— y daba
       rojo con el producto correcto. Se acota al `<EmptyState … />` que
       contiene ese título: su apertura hacia atrás y su cierre hacia delante. */
    const apertura = HOY.lastIndexOf('<EmptyState', i)
    const cierre = HOY.indexOf('/>', i)
    expect(apertura).toBeGreaterThan(0)
    expect(cierre).toBeGreaterThan(i)
    const elemento = HOY.slice(apertura, cierre)
    expect(elemento, 'el estado de error se degradó a línea').not.toContain('variante="linea"')
    expect(elemento).toContain('no se pudieron leer')
  })
})
