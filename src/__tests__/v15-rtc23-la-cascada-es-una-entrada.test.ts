/**
 * RTC-23 (mitad de `/citas`) — la cascada es una ENTRADA, no una respuesta al
 * clic.
 *
 * ── QUÉ FALLABA, Y QUÉ DIJO LA MEDICIÓN ─────────────────────────────────────
 *
 * ORT-18 + RT-17/18: «cascada de /citas re-armándose con cada filtro (fila 12
 * invisible 336ms)». La cuenta sale del código —`animationDelay: min(i,12) ×
 * 28ms` sobre una animación con `fill: both`, que mantiene el estado inicial
 * DURANTE el retraso—, pero de ahí no se deduce si vuelve a correr al
 * filtrar: eso depende de si React remonta las filas. Se midió
 * (`scripts/design/medir-rtc23-cascada-citas-v15.mjs`, muestreo de opacidad
 * cada 40ms tras pulsar):
 *
 *                                     antes        después
 *   filtro de estado (2 por confirmar)  0ms          0ms
 *   cambio de día (mañana: 1 cita)     ~320ms       0ms
 *   cascada al ENTRAR                   sí           sí
 *
 * O sea: **el hallazgo era cierto a medias**. Los filtros de estado no
 * re-animan —las filas que sobreviven conservan su nodo—; cambiar de día trae
 * citas distintas, se remontan, y la cascada vuelve a correr. Cuando corría,
 * dejaba una fila en opacidad 0 durante un tercio de segundo **después de que
 * el médico pulsara**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Entrar merece la cascada**; volver a la misma pantalla filtrada, no.
 *    Al entrar, el escalonado ordena la jerarquía de una lista que aparece de
 *    golpe (§20) — el propio equipo rojo declaró buena la del dashboard por
 *    esa razón. Al filtrar no ordena nada: retrasa la respuesta al clic.
 * 2. **Una fila que existe y no se ve no es una animación: es una espera.**
 *    Y filtrar es la acción más repetida de esta pantalla.
 * 3. `prefers-reduced-motion` sigue mandando por encima, en la hoja.
 *
 * Probado al revés: devolviendo la clase incondicional falla el caso 1;
 * quitando el apagado falla el 2.
 *
 * ── EL INSTRUMENTO SE ROMPIÓ CON EL ARREGLO, Y ESO SE ARREGLÓ PRIMERO ───────
 *
 * La primera versión del arnés contaba elementos `.nx-reveal`. En cuanto el
 * arreglo quitó esa clase después de la entrada, dejó de encontrar nada e
 * informó «0/0 filas · 0ms invisible»: **un aprobado vacío que parecía la
 * prueba del éxito**. Se cambió a contar `.riel-entrada` —la fila, exista o no
 * la animación— y sólo entonces el número significó algo. Mismo defecto que
 * RTC-20 encontró en la vara del riel, cometido aquí sobre el propio arreglo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide milisegundos**: eso es el arnés, con su acta fechada. Aquí se
 *   protege el mecanismo.
 * · **No toca las otras dos mitades de RTC-23**: la cascada de 520+120ms de
 *   Hoy y la luna que rota al hover siguen abiertas y declaradas.
 * · No juzga la duración de la entrada (520ms): sólo cuándo se corre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const CITAS = leer('src/app/(dashboard)/citas/page.tsx')
const CSS = leer('src/app/globals.css')

describe('RTC-23 — /citas: la cascada sólo al entrar', () => {
  it('1 · la clase de cascada está condicionada, no puesta siempre', () => {
    expect(CITAS).toMatch(/className=\{yaEntro \? undefined : 'nx-reveal'\}/)
    // El retraso viaja con ella: dejarlo suelto pintaría un delay sin animación.
    expect(CITAS).toMatch(/style=\{yaEntro \? undefined : \{ animationDelay/)
  })

  it('2 · y hay quien la apague cuando la entrada termina', () => {
    /**
     * Sin esto, la condición del caso 1 nunca cambiaría de valor y la cascada
     * seguiría corriendo en cada filtro: la prueba pasaría y el defecto
     * seguiría ahí.
     */
    expect(CITAS).toMatch(/const \[yaEntro, setYaEntro\] = useState\(false\)/)
    expect(CITAS).toMatch(/setYaEntro\(true\)/)
    // Después de que la animación termine (520ms), no antes.
    expect(CITAS).toMatch(/setTimeout\(\(\) => setYaEntro\(true\), 700\)/)
  })

  it('3 · la entrada NO se apaga: sigue existiendo la animación que ordena la lista', () => {
    // Apagar la cascada al filtrar sería un mal arreglo si de paso matara la
    // de entrar, que es la que sí ordena la jerarquía (§20).
    expect(CSS).toMatch(/\.nx-reveal \{ animation: nx-rise 520ms/)
  })

  it('4 · y quien no quiere movimiento sigue mandando', () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.nx-reveal \{ animation: none; \}/)
  })
})
