/**
 * RTC-28 — «el cromo se queda oscuro en tema claro»: MEDIDO, y en su mayor
 * parte REFUTADO.
 *
 * ── LA PREGUNTA, TAL COMO LLEGÓ ─────────────────────────────────────────────
 *
 * El equipo rojo (RT-21) no lo escribió como veredicto sino como pregunta:
 * «Tema claro: riel/topbar/FABs permanecen oscuros — **verificar si es
 * decisión o resto**». Un P3 así no se paga escribiendo código: se contesta
 * midiendo, y se cierra con lo que diga la medida.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * `scripts/design/medir-rtc28-tema-claro-v15.mjs`, tres rutas del médico, los
 * dos temas, **luminancia relativa del fondo realmente pintado** (subiendo por
 * los ancestros cuando el elemento es translúcido — un fondo transparente
 * enseña el de detrás, y leer `rgba(0,0,0,0)` habría dado un falso «negro»):
 *
 *                    tema claro          tema oscuro
 *   superficie       0.9541              0.0037
 *   riel             0.9541  ← igual     0.0037  ← igual
 *   topbar           0.9541  ← igual     0.0037  ← igual
 *   botón de tema    1                   0.0074
 *   botón de ayuda   0.0999              0.1534
 *
 * **Riel y topbar siguen al tema, exactamente.** La observación del panel no
 * se reproduce hoy: entre medias, RTC-05 sacó los FABs del arco del pulgar y
 * unificó el tema en `@/hooks/useTema`, y el cromo quedó atado a los tokens.
 *
 * ── LO QUE SÍ SE VE OSCURO, Y POR QUÉ ES UNA DECISIÓN ───────────────────────
 *
 * El botón de ayuda mide 0.0999 en tema claro: es **más oscuro que la
 * superficie**, y ahí el panel vio bien. Pero no es un resto del tema oscuro:
 * es `var(--nexus-solido)` (#177886), el token de **relleno** del acento, que
 * `globals.css` documenta con su contraste —5,16 : 1 con blanco encima— y que
 * usa también la corona del pulgar.
 *
 * Un botón de acción relleno **es** más oscuro que la página en tema claro:
 * eso es lo que lo hace legible. Llamarlo «resto del tema oscuro» sería
 * confundir un relleno de acento con un fondo sin migrar.
 *
 * Por eso RTC-28 se cierra **REFUTADO en riel y topbar, y DECISIÓN en el
 * FAB** — no «arreglado».
 *
 * ── NOTA POSTERIOR, EL MISMO DÍA (§39): EL FAB YA NO EXISTE ─────────────────
 *
 * Otra corrida concurrente (RTC-32) midió ese mismo relleno desde una pregunta
 * anterior —no cómo se pinta, sino si debe estar— y lo retiró: `--nexus-solido`
 * es el relleno de la acción PRIMARIA, así que el FAB ponía un SEGUNDO relleno
 * de marca en 6 de 6 superficies, y en `/operaciones` era el único de la
 * pantalla. La ayuda vive ahora en el pie del riel y en la topbar.
 *
 * Las dos mediciones son ciertas y no se contradicen: si ese botón existiera,
 * el token seguiría siendo la forma correcta de pintarlo. La fila «botón de
 * ayuda 0.0999» de la tabla de arriba queda como ACTA de lo que se midió ese
 * día, no como descripción del producto de hoy. El caso 3 lo dice dentro.
 *
 * ── QUÉ PROTEGE ESTE GUARDIÁN ───────────────────────────────────────────────
 *
 * Que nadie ancle el cromo a un color fijo. Un `background: '#0b0f14'` en el
 * riel o en la topbar volvería a producir el defecto que el panel creyó ver, y
 * la única prueba que lo cazaría es ésta.
 *
 * Probado al revés: poniendo un fondo literal oscuro en el riel falla el caso
 * 1; el 3 muerde de dos formas — anclando un color crudo en `BotonAyuda`, y
 * devolviendo el FAB (que es como volvería el defecto que midió RTC-32).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide luminancia**: eso lo hace el arnés, y su acta está fechada en
 *   `docs/design/capturas/v15-rtc28-tema-claro/`. Aquí se protege el
 *   MECANISMO —tokens, no literales—, que es lo que una prueba de fuente puede
 *   sostener sin mentir.
 * · **No cubre el modo Secretaria** ni las pantallas de negocio.
 * · No juzga el contraste del texto sobre esos fondos: los pares medidos viven
 *   en `globals.css` y tienen sus propias pruebas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: esta cabecera y las del código CITAN colores para explicarlos. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const RIEL = sinComentarios(leer('src/components/FlowRail.tsx'))
const AYUDA = sinComentarios(leer('src/components/BotonAyuda.tsx'))
const TEMA = sinComentarios(leer('src/components/ThemeToggle.tsx'))

/** Un color que no puede cambiar con el tema. */
const COLOR_ANCLADO = /background:\s*['"`]#[0-9a-f]{3,8}|background:\s*['"`]rgba?\(/i

describe('RTC-28 — el cromo sigue al tema, y lo que parece oscuro es un relleno de acento', () => {
  it('1 · el riel no ancla ningún fondo a un color fijo', () => {
    expect(RIEL).not.toMatch(COLOR_ANCLADO)
    // Y sí usa las superficies del sistema, que son las que cambian con el tema.
    expect(RIEL).toContain("background: 'var(--s2)'")
  })

  it('2 · el conmutador de tema tampoco', () => {
    expect(TEMA).not.toMatch(COLOR_ANCLADO)
  })

  it('3 · la ayuda no ancla ningún fondo a un color fijo — y ya no se rellena', () => {
    /**
     * ── DOS CORRIDAS CONCURRENTES, EL MISMO DÍA (§39) ─────────────────────
     *
     * Este caso nació exigiendo `background: 'var(--nexus-solido)'` en el FAB
     * de ayuda: la medición de RTC-28 lo encontró como lo único más oscuro que
     * la superficie en tema claro (0.0999 contra 0.9541) y concluyó, con
     * razón sobre lo que estaba mirando, que **un botón de acción relleno es
     * más oscuro que la página, y por eso se lee**.
     *
     * La otra corrida (RTC-32) midió ese mismo relleno desde otra pregunta y
     * encontró que era el defecto: `--nexus-solido` es el relleno de la acción
     * PRIMARIA, así que el FAB ponía un segundo relleno de marca en 6 de 6
     * superficies —y en `/operaciones` era el único de la pantalla—. El FAB se
     * retiró: la ayuda vive en el pie del riel y en la topbar.
     *
     * Las dos lecturas son ciertas y no se contradicen: si ese botón existiera,
     * el token sería la forma correcta de pintarlo. Gana RTC-32 porque su
     * pregunta era anterior — no cómo se pinta, sino si debe estar.
     *
     * Lo que este caso protege desde aquí es el invariante COMPARTIDO por los
     * tres casos de este bloque, que es el que RTC-28 vino a defender: ninguna
     * pieza del cromo ancla un fondo a un color que no puede seguir al tema.
     * Y de paso, que el relleno no vuelva por la puerta de atrás.
     */
    expect(AYUDA).not.toMatch(COLOR_ANCLADO)
    expect(AYUDA).not.toContain('boton-ayuda-fab')
  })

  it('4 · y ese token existe con su contraste escrito, no de oídas', () => {
    /**
     * `--nexus-solido` no es «el teal oscuro»: es el relleno del acento, con
     * su razón de ser documentada. Si alguien lo borra o lo deja sin su nota
     * de contraste, el caso 3 estaría protegiendo un nombre vacío.
     */
    const css = leer('src/app/globals.css')
    expect(css).toMatch(/--nexus-solido:\s*#177886/i)
    expect(css).toMatch(/5\.16 : 1/)
  })
})
