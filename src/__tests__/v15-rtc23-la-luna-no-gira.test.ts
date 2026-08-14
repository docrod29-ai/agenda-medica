/**
 * RTC-23 (mitad de la luna) — el icono del tema deja de girar, y el control
 * sigue avisando de que existe.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `.theme-toggle:hover svg { transform: rotate(20deg); }`. Un icono que gira
 * 20° al pasar el ratón no informa de nada: ni de que el control se puede
 * pulsar —eso ya lo dicen el cursor y el resto del `:hover`—, ni de qué va a
 * pasar al pulsarlo. Es motion decorativo puntual, que es como ORT-18 y RT-17
 * lo listaron.
 *
 * ── DÓNDE SE VE, QUE ES LO QUE LO HACE PAGABLE ──────────────────────────────
 *
 * Podría parecer muerto: RTC-32 sacó del shell todo lo que flotaba, y el
 * conmutador de tema vive ahora en `/operaciones` (§11: es sistema). Pero el
 * botón flotante **sigue existiendo fuera del panel** —login, registro,
 * marketing—, donde no hay riel ni topbar donde alojarlo. O sea: la luna
 * giraba delante de quien todavía no es cliente.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * `scripts/design/medir-rtc23-luna-hover-v15.mjs` sobre `/login`, leyendo la
 * MATRIZ calculada (un `rotate(20deg)` llega como
 * `matrix(0.94, 0.34, -0.34, 0.94, 0, 0)`, no como el texto original):
 *
 *              antes                              después
 *   svg        matrix(0.94, 0.34, …)              none
 *   botón      matrix(1.05, 0, 0, 1.05, 0, 0)     igual
 *   color      168 → 242                          igual
 *
 * **Las dos señales útiles del `:hover` siguen**: el botón crece un 5 % y el
 * icono sube de contraste. Quitar la decoración sin comprobar eso habría sido
 * cambiar un defecto por otro peor — un control que ya no dice que se puede
 * pulsar.
 *
 * Probado al revés: devolviendo la regla de rotación falla el caso 1; quitando
 * el `:hover` que queda falla el 2.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide en navegador**: eso es el arnés, con su acta fechada. Aquí se
 *   protege la regla.
 * · **No cubre las otras dos partes de RTC-23**: `/citas` está pagada aparte y
 *   la cascada de Hoy la declaró el propio panel como NO defecto (2 elementos,
 *   120ms, ordena jerarquía).
 * · No juzga el `scale(1.05)`: es afordancia de hover estándar, no decoración.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('RTC-23 — la luna del tema no gira por girar', () => {
  it('1 · no queda ninguna rotación de hover en el conmutador', () => {
    expect(CSS).not.toMatch(/\.theme-toggle:hover svg \{\s*transform: rotate/)
    // Y su transición se fue con ella: era su único sujeto.
    expect(CSS).not.toMatch(/\.theme-toggle svg \{[^}]*transition: transform/)
  })

  it('2 · pero el control SIGUE diciendo que se puede pulsar', () => {
    /**
     * Quitar la decoración sin dejar afordancia sería cambiar un defecto por
     * otro peor. Quedan las dos señales que sí informan.
     */
    expect(CSS).toMatch(/\.theme-toggle:hover \{\s*\n\s*color: var\(--text\);\s*\n\s*transform: scale\(1\.05\);/)
    expect(CSS).toMatch(/\.theme-toggle:active \{ transform: scale\(0\.95\); \}/)
  })

  it('3 · y el botón sigue existiendo fuera del panel, que es donde se ve', () => {
    /**
     * Si algún día desaparece también de login/registro, este guardián estaría
     * protegiendo una regla sin sujeto — y habría que decirlo, no borrarlo en
     * silencio.
     */
    expect(CSS).toMatch(/body:has\(\.bottom-nav-wrap\) \.theme-toggle \{ display: none; \}/)
    expect(CSS).toMatch(/\.theme-toggle \{\s*\n\s*position: fixed;/)
  })
})
