/**
 * EL MES NO ALINEABA LAS FECHAS CON SU DÍA DE LA SEMANA — REG-443.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando `/calendario` a 390 px y **entrando en las tres vistas**. La de día
 * salía impecable. La de mes tenía cuatro bloques recortados por 3 px, que
 * parecía un detalle — hasta medir las rejillas:
 *
 *     cabecera de días    [49, 49, 49, 49, 49, 49, 49]   suma 343
 *     rejilla de semanas  [37, 37, 86, 86, 37, 85, 37]   suma 405   en 340
 *
 * Las dos están escritas **igual** en el código, `repeat(7, 1fr)`, y acababan
 * distintas.
 *
 * ── POR QUÉ NO ES UN DETALLE ────────────────────────────────────────────────
 *
 * Una rejilla de mes se lee **por columna**: se mira hacia abajo para saber en
 * qué día de la semana cae un número. Con las columnas del cuerpo sizadas al
 * contenido y las de la cabecera repartidas por igual, esa lectura era falsa —
 * el 9 no estaba bajo «Mié» aunque fuera miércoles.
 *
 * Y los 65 px que sobraban recortaban la última columna: **el domingo no
 * existía**. Los días 6, 13, 20 y 27 no se veían.
 *
 * ── LA CAUSA, QUE YA CONOCÍAMOS ─────────────────────────────────────────────
 *
 * Un track `1fr` lleva `min-width: auto` implícito y no baja del ancho mínimo de
 * su contenido. Las celdas con citas llevan chips («08:00 Rosalía») cuyo mínimo
 * ronda los 86 px; las de la cabecera llevan «Lun», que cabe de sobra en el
 * reparto equitativo. Misma raíz que REG-441 en la receta y la orden — tercera
 * aparición, y la primera encontrada **midiendo** en vez de por búsqueda de
 * patrón.
 *
 * ── EL PRECIO, DICHO ────────────────────────────────────────────────────────
 *
 * Con las columnas iguales los chips pasan de «08:00 Rosalía» a «08:00»: el
 * nombre ya no cabe. No es una mejora pura y no se presenta como tal. Se cambió
 * el nombre en tres celdas por que **exista el domingo** y por que un número
 * esté bajo su día. La celda conserva el conteo del día y el «+N más», y el
 * nombre vive en la vista de día, que es donde se lee una agenda.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de fuente.** Que las dos rejillas midan igual lo dice el
 *   navegador, y esa medición **no corre en CI**: necesita emuladores.
 * · **La vista de SEMANA no se tocó.** Sus celdas miden 41×48 —92 objetivos por
 *   debajo de 44— y se dejaron a propósito: el propio código explica que en el
 *   teléfono el calendario **abre en día**, y que semana existe porque el médico
 *   la pide «porque quiere ver el hueco del jueves». Para buscar un hueco, siete
 *   columnas estrechas con la ocupación es lo correcto; medir esa vista contra
 *   «se leen los nombres» sería medirla contra un trabajo que no hace.
 * · **Los chips del mes siguen a 24 px de alto** (35 objetivos). Un mes es una
 *   vista densa por definición: subirlos a 44 obligaría a una celda de 140 px y
 *   el mes dejaría de caber. Se declara, no se esconde.
 * · **No es un iPhone.** Chromium a 390 px.
 * · **No comprueba que la rejilla de SEMANA no tenga el mismo defecto.** Se
 *   midió y no lo tiene hoy (cero recortados), pero este guardián no lo sella.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CAL = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/calendario/page.tsx'),
  'utf8',
)
/** Sin comentarios: el arreglo se explica citando el `1fr` que retiró. */
const LIMPIO = CAL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('la rejilla del mes reparte sus siete columnas por igual', () => {
  it('EL CASO: el cuerpo del mes usa minmax(0, 1fr)', () => {
    /**
     * PROBADO AL REVÉS: devolviendo `repeat(7, 1fr)`, la sonda vuelve a medir
     * [37, 37, 86, 86, 37, 85, 37] con suma 405 en un contenedor de 340, y el
     * domingo desaparece. Medido: 405 → 343, igual que la cabecera.
     */
    const i = LIMPIO.indexOf("height: 'calc(100% - 37px)'")
    expect(i, 'ya no está la rejilla del cuerpo del mes').toBeGreaterThan(0)
    const bloque = LIMPIO.slice(Math.max(0, i - 260), i)
    expect(
      bloque,
      'el cuerpo del mes volvió a `repeat(7, 1fr)`: las columnas se sizan al ' +
      'contenido, las fechas dejan de caer bajo su día de la semana y el ' +
      'domingo se sale de la pantalla',
    ).toMatch(/gridTemplateColumns:\s*'repeat\(7, minmax\(0, 1fr\)\)'/)
  })

  it('y la cabecera de días sigue repartiendo igual — las dos, o ninguna', () => {
    /**
     * El defecto era que las dos rejillas, escritas igual, acababan distintas.
     * Si alguien "arregla" la cabecera para que se parezca al cuerpo roto, el
     * resultado vuelve a ser dos rejillas que no casan.
     */
    const i = LIMPIO.indexOf('DAY_HEADERS.map')
    expect(i).toBeGreaterThan(0)
    const bloque = LIMPIO.slice(Math.max(0, i - 320), i)
    expect(bloque).toMatch(/gridTemplateColumns:\s*'repeat\(7,\s*(minmax\(0,\s*)?1fr\)?\)'/)
  })
})
