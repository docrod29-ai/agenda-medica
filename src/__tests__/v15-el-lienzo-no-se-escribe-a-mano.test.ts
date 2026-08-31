/**
 * El lienzo de página se declara UNA vez — nueve pantallas dejan de copiarlo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `RTC-31` (6ª rebanada) le dio al producto un lienzo compartido: `.nx-canvas`,
 * con `--nx-lienzo: 1100px`, y declaró la deuda que quedaba — «las 35 páginas
 * del dashboard que siguen con su ancho a mano», con el trinquete
 * `lienzosAMano` (techo 52) para que la cola sólo pudiera encoger.
 *
 * De esos 52, **once escribían exactamente 1100** — el mismo número que el
 * lienzo compartido, tecleado a mano. Y nueve de los once copiaban la
 * definición entera, byte por byte:
 *
 *     <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
 *     .nx-canvas { max-width: var(--nx-lienzo); margin: 0 auto; padding: 24px }
 *
 * No es sólo duplicación: la lección `nx-stat-grid` de este repositorio dice
 * que **un número en línea vence a la hoja en silencio**. Mientras estuvieran
 * escritos a mano, mover `--nx-lienzo` habría movido seis pantallas y dejado
 * nueve donde estaban, sin que nada se pusiera rojo.
 *
 * ── LO QUE SÍ CAMBIA, Y ES A PROPÓSITO ──────────────────────────────────────
 *
 * Ocho de las nueve no llevaban `.page-pad`, así que **no recibían el recorte
 * de ≤480px** y se quedaban en 24px de padding donde el resto del producto usa
 * 16. `.nx-canvas` lo trae («mismo recorte que `.page-pad`, un solo sitio que
 * lo diga»), así que al convertirlas lo reciben. Medido en navegador, no
 * supuesto — ver abajo.
 *
 * ── LO QUE NO SE CONVIERTE, CON SU RAZÓN ────────────────────────────────────
 *
 * Las otras dos de las once —`/hospitalizacion` y `/hospitalizacion/camas`—
 * llevan `padding: '8px 4px 40px'`, no 24. Pasarlas a `.nx-canvas` no sería
 * una limpieza: **cambiaría lo que se ve**, en un módulo que está detrás de
 * bandera y en ALPHA. Una decisión visual sobre Hospital no se toma de paso
 * mientras se retira deuda de otra cosa.
 *
 * Y los `maxWidth: 420` de `/cumplimiento`, `/finanzas` y `/pacientes` siguen
 * contados por el trinquete y **no son lienzos**: son la medida de un bloque
 * —un buscador, una caja— que es justo lo que el sistema pide. El detector usa
 * un umbral de 400 y no puede distinguirlos; el caso 4 lo deja escrito para
 * que la próxima pasada no los «arregle».
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el `style` en línea a cualquiera de las nueve cae el caso 1, y
 * el trinquete vuelve a contar ese lienzo (`lienzosAMano` 43 → 44), que es el
 * caso 3.
 *
 * ── VERIFICADO EN NAVEGADOR ─────────────────────────────────────────────────
 *
 * `scripts/design/medir-lienzo-compartido-v15.mjs`, 7 rutas × 2 anchos, 0
 * errores de consola:
 *
 *   escritorio 1440   maxWidth 1100px · padding 24px · borde de texto 306px
 *   móvil 390         maxWidth 1100px · padding 16px · borde de texto 16px
 *   salto lateral entre las 7 rutas: 0px en los dos anchos
 *
 * El escritorio quedó **idéntico** a como estaba —que era el objetivo— y el
 * móvil recortó a 16px, que es lo que se buscaba.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Las 26 páginas que siguen con un ancho a mano distinto de 1100** (800,
 *   900, 820, 880…). Cada una es una decisión: unificarlas es elegir un ancho
 *   para esa pantalla, no retirar una copia. El trinquete las sigue contando.
 * · No cubre `/orden` ni `/receta` en navegador: piden un `notaId` y el arnés
 *   no siembra uno. Se convirtieron por lectura, con la misma sustitución
 *   exacta que las otras siete, y el caso 1 las cubre.
 * · No dice cuál debe ser el ancho. `--nx-lienzo` ya lo decidió en RTC-31.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Las nueve que copiaban la definición entera. */
const CONVERTIDAS = [
  'src/app/(dashboard)/citas/page.tsx',
  'src/app/(dashboard)/configuracion/page.tsx',
  'src/app/(dashboard)/farmacia/page.tsx',
  'src/app/(dashboard)/finanzas/page.tsx',
  'src/app/(dashboard)/crm/page.tsx',
  'src/app/(dashboard)/cumplimiento/page.tsx',
  'src/app/(dashboard)/cumplimiento/retencion/page.tsx',
  'src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx',
  'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx',
]

describe('el lienzo de página se declara una vez', () => {
  it('1 · las nueve entran por `.nx-canvas` y ninguna vuelve a teclear 1100', () => {
    for (const p of CONVERTIDAS) {
      const s = leer(p)
      expect(s, `${p} dejó de usar el lienzo compartido`).toContain('className="nx-canvas"')
      expect(s, `${p} volvió a escribir el ancho a mano`).not.toMatch(/maxWidth:\s*1100/)
    }
  })

  it('2 · y el lienzo compartido sigue siendo UNO, con su número en la hoja', () => {
    /**
     * Si el valor se moviera al JSX, las nueve volverían a divergir sin que
     * este guardián lo notara: por eso se comprueba dónde VIVE.
     */
    const css = leer('src/app/globals.css')
    expect(css).toMatch(/\.nx-canvas\s*\{[^}]*--nx-lienzo:\s*1100px/)
    expect(css).toMatch(/\.nx-canvas\s*\{[^}]*max-width:\s*var\(--nx-lienzo\)/)
    // El recorte de teléfono pequeño es lo que ganan las ocho sin `.page-pad`.
    expect(css).toMatch(/@media \(max-width: 480px\) \{ \.nx-canvas \{ padding: 16px; \} \}/)
  })

  it('3 · el trinquete cuenta 43 lienzos a mano, y sólo puede bajar', () => {
    const { techos } = JSON.parse(leer('scripts/design/techos-de-diseno.json'))
    expect(techos.lienzosAMano, 'el techo de lienzos a mano subió').toBeLessThanOrEqual(43)
  })

  it('4 · las dos de hospitalización NO se convierten, y la razón está escrita', () => {
    /**
     * `padding: '8px 4px 40px'` no es `padding: 24`. Convertirlas cambiaría lo
     * que se ve, en un módulo detrás de bandera y en ALPHA — decisión visual,
     * no limpieza. Este caso las congela hasta que alguien la tome.
     */
    for (const p of ['src/app/(dashboard)/hospitalizacion/page.tsx', 'src/app/(dashboard)/hospitalizacion/camas/page.tsx']) {
      expect(leer(p), `${p} cambió de padding sin decidirlo`).toContain("padding: '8px 4px 40px'")
    }
  })

  it('5 · y los `maxWidth: 420` que quedan son BLOQUES, no lienzos', () => {
    /**
     * El detector usa un umbral de 400 y no puede distinguir la medida de un
     * buscador de la de una página. Quedan contados a propósito; que sigan
     * ahí no es deuda pendiente, y borrarlos rompería el ancho de una caja.
     */
    for (const p of ['src/app/(dashboard)/cumplimiento/page.tsx', 'src/app/(dashboard)/pacientes/page.tsx']) {
      expect(leer(p), `${p} perdió la medida de su bloque`).toMatch(/maxWidth:\s*420/)
    }

    /**
     * `/finanzas` SALIÓ de la lista, y en la buena dirección.
     *
     * Su `maxWidth: 420` era el ancho del diálogo de anular un cobro, escrito a
     * mano junto al resto del diálogo. Al pasarlo al `ui/Modal` canónico —que
     * es lo que este guardián pide para los lienzos, aplicado a una caja— la
     * medida dejó de estar en línea y pasó a declararla el sistema. El
     * trinquete lo confirma: `lienzosAMano` 43 → 42 y `radiosFueraDeEscala`
     * 618 → 617 en la misma corrida.
     *
     * No es que se borrara un número: es que dejó de escribirse a mano.
     */
    expect(leer('src/app/(dashboard)/finanzas/page.tsx'), 'el diálogo volvió a escribirse a mano').toMatch(/<Modal\s/)
  })
})
