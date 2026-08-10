/**
 * LO QUE UN TELÉFONO NO PUEDE ENCOGER — REG-265.
 *
 * ── EL HUECO QUE EL OTRO GUARDIÁN DECLARABA ─────────────────────────────────
 *
 * `la-pantalla-cabe-en-un-telefono` cierra tres defectos medidos en un iPhone
 * de 390 px. Y su propio comentario dice lo que NO puede ver:
 *
 *   «Un desborde nuevo por otra causa —un `width` fijo, una tabla ancha, una
 *    imagen sin `max-width`— pasa por aquí sin despeinarse.»
 *
 * Esto cubre esas clases. **No sustituye al navegador: acota.**
 *
 * ── EL RESULTADO, Y ES LA PARTE INCÓMODA ────────────────────────────────────
 *
 * **Cero.** No hay ni un ancho fijo, ni una rejilla rígida, ni una imagen sin
 * tope en toda la aplicación.
 *
 * Pero la primera medición dijo **23 anchos fijos y 15 imágenes**. Ninguno era
 * real:
 *
 *   · `max-width: 540px` — la expresión casaba con la COLA de `max-width`, que
 *     es exactamente lo contrario del defecto: es la cura.
 *   · Recetas y órdenes a 1000 px — son **carta**. Ese documento no se lee en
 *     un teléfono, se imprime.
 *   · Un brazalete dentro de `document.write` — sale por la impresora.
 *   · Once imágenes con `width: 100%`, dos QR de 200 px que caben de sobra, un
 *     QR medido en **milímetros**, y **dos dentro de un comentario**.
 *
 * ── LA CUARTA VEZ ───────────────────────────────────────────────────────────
 *
 * Es el cuarto medidor mío en esta sesión que informa de más antes de decir la
 * verdad: 152 motores que eran 50 (REG-255), 42 que eran 8 (REG-260), el
 * guardián de pautas gritando en toda la UCI (REG-245), y ahora 23 anchos que
 * eran 0.
 *
 * **Un medidor que informa de más enseña a ignorarlo**, igual que un aviso
 * clínico. Por eso las exclusiones viven escritas en el script, con su motivo,
 * y no en la cabeza de quien lo escribió.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const RAIZ = process.cwd()

const medir = () => JSON.parse(execSync(
  'node scripts/calidad/cabe-en-un-telefono.mjs --json',
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)) as {
  total: number; anchosFijos: string[]; rejillasRigidas: string[]
  imagenesSinTope: string[]; columnasClavadas: string[]
}

describe('nada que no quepa en un teléfono de 360 px', () => {
  const m = medir()

  it('ningún ancho fijo por encima del ancho útil', () => {
    expect(m.anchosFijos, m.anchosFijos.join('\n  ')).toEqual([])
  })

  it('ninguna rejilla con suelo rígido', () => {
    /**
     * `minmax(300px, 1fr)` no baja de 300 px por mucho `auto-fit` que lleve.
     * La forma correcta —`minmax(min(300px, 100%), 1fr)`— es idéntica en
     * pantalla ancha.
     */
    expect(m.rejillasRigidas, m.rejillasRigidas.join('\n  ')).toEqual([])
  })

  it('ninguna imagen sin restricción de ancho', () => {
    expect(m.imagenesSinTope, m.imagenesSinTope.join('\n  ')).toEqual([])
  })

  it('ninguna columna de rejilla clavada en píxeles', () => {
    /**
     * CLASE 4 — la que faltaba, y por eso este medidor decía **0** el día que
     * la pantalla de inicio se salía visiblemente de un iPhone. REG-306.
     *
     * `gridTemplateColumns: '1fr 300px'` no es un `width:` ni un `minmax(`:
     * las tres clases anteriores pasaban por encima sin verlo. De los 328 px
     * útiles de un teléfono de 360, la columna derecha se llevaba 300.
     *
     * No cuenta la que **ya sabe apilarse**: una rejilla de dos columnas con
     * su consulta de medios en `1fr !important` es la forma correcta, y en
     * este repositorio hay cuatro —configuración, recetas, orden, receta— que
     * la usan bien. Ésas fueron los cuatro falsos positivos de la primera
     * medición, y están excluidas por lo que hacen, no por su nombre.
     */
    expect(m.columnasClavadas, m.columnasClavadas.join('\n  ')).toEqual([])
  })
}, 120_000)

describe('el medidor no confunde impresión con pantalla', () => {
  const s = readFileSync(join(RAIZ, 'scripts/calidad/cabe-en-un-telefono.mjs'), 'utf8')

  it('NO casa con la cola de `max-width`', () => {
    /** `max-width` es la cura, no el defecto. Fue el primer falso positivo. */
    expect(s).toContain('(?<![a-zA-Z-])width:')
  })

  it('excluye las superficies de impresión', () => {
    /** Una receta es carta: su ancho fijo es correcto. */
    expect(s).toMatch(/function esImpresion/)
    expect(s).toMatch(/document\\\.write|@media print/)
  })

  it('excluye lo medido en milímetros', () => {
    /**
     * El QR de la receta se dimensiona en `mm` para que el escáner lo lea en
     * papel. Un `mm` no desborda un teléfono porque no vive en un teléfono.
     */
    expect(s).toMatch(/mm\[`/)
  })

  it('quita los comentarios ANTES de mirar', () => {
    /**
     * Dos `<img>` vivían dentro de un comentario JSX explicando cómo se
     * captura el membrete en el PDF. Un ejemplo escrito no desborda nada.
     */
    expect(s).toMatch(/Los comentarios se QUITAN antes de mirar/)
  })

  it('excluye la rejilla que YA se apila en el teléfono', () => {
    /**
     * Cuatro falsos positivos en la primera medición de la clase 4, todos con
     * su consulta de medios correcta. El `!important` no es descuido: un
     * estilo en línea gana a una clase, y sin él la consulta no haría nada.
     */
    expect(s).toMatch(/function seApilaEnMovil/)
    expect(s).toMatch(/grid-template-columns:\[\^;\]\*!important/)
  })

  it('y deja escrito que esto NO sustituye al navegador', () => {
    /**
     * Creer que un barrido de código fuente cubre el desborde real sería el
     * peor resultado posible de este trabajo.
     */
    expect(s).toMatch(/No sustituye al navegador: \*\*acota\*\*/)
  })
})

describe('la lección, escrita donde se lee', () => {
  it('el script declara sus exclusiones con su motivo', () => {
    const s = readFileSync(join(RAIZ, 'scripts/calidad/cabe-en-un-telefono.mjs'), 'utf8')
    expect(s).toMatch(/LO QUE NO CUENTA, Y COSTÓ TRES INTENTOS AVERIGUARLO/)
    expect(s).toMatch(/Un medidor que informa de más enseña a\s*\n?\s*\*?\s*ignorarlo/)
  })
})
