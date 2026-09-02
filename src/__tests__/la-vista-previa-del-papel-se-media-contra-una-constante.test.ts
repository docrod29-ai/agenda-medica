/**
 * LA VISTA PREVIA DEL PAPEL SE MEDÍA CONTRA UNA CONSTANTE — REG-444.
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────
 *
 * REG-441 arregló la columna del editor de `/receta` y `/orden` y dejó
 * declarado, con todas las letras, lo que NO arreglaba:
 *
 *     «La vista previa del papel sigue saliéndose 6 px, y NO se arregló aquí.
 *      Su causa es otra: RecetaPreviewWrapper calcula la escala contra un
 *      maxWidth = 380 constante en píxeles… Merece su propia unidad.»
 *
 * Ésta es esa unidad. Un hueco declarado que nadie cierra es peor que uno que
 * nadie nombró: queda por escrito que se sabía.
 *
 * ── EL DEFECTO ──────────────────────────────────────────────────────────────
 *
 * El componente existe, según su propia cabecera, «para que la receta se vea
 * proporcional **sin desbordar el layout**». Lo hacía para cualquier tamaño de
 * papel y para **un solo** tamaño de contenedor: `/receta` y `/orden` le pasaban
 * `maxWidth={380}` escrito a mano, elegido para la columna de 420 px del
 * escritorio.
 *
 * A 390 px esa columna mide 358. La hoja se pintaba a 380 y se salía 22 px de su
 * columna —6 más allá del borde de la pantalla— con `overflow: hidden` encima:
 * **recortada, y sin gesto que la trajera**. En la pantalla cuyo trabajo entero
 * es enseñar cómo va a salir impreso.
 *
 * ── POR QUÉ ERA DELICADO, Y POR QUÉ AL FINAL NO LO FUE ──────────────────────
 *
 * La cabecera del componente cuenta que este número ya se desincronizó una vez
 * entre dos sitios y «la receta salía RECORTADA por la derecha». De ahí su
 * regla: «un número que dos sitios tienen que compartir no se copia: se
 * pregunta».
 *
 * Al mirarlo, el riesgo se acotó solo: **los tres sitios que llaman pasan
 * `maxWidth` explícito**, así que el `= 380` por omisión no lo usaba nadie.
 * Configuración pasa su propio `TARGET_WIDTH` (340) y con ese mismo número
 * coloca su recuadro arrastrable. No hacía falta tocar `escalaDeVistaPrevia`
 * —sigue siendo una función pura de sus argumentos— ni la pantalla de
 * configuración.
 *
 * Lo que cambia es sólo qué pasa **cuando no se pasa nada**: en vez de suponer
 * 380, el componente MIDE su sitio. `/receta` y `/orden` dejan de pasarlo.
 *
 * ── MEDIDO ──────────────────────────────────────────────────────────────────
 *
 *                       disponible   hoja      ¿cabe?
 *     390 px (teléfono)     358       358        sí     (antes 380: se salía)
 *    1440 px (escritorio)   420       420        sí     (antes 380: sobraba)
 *     configuración 390     358       340        sí     (su número, intacto)
 *
 * En escritorio la vista previa **gana** tamaño: 380 → 420. Estaba pequeña por
 * la misma constante que la hacía salirse en el teléfono.
 *
 * Y `useLayoutEffect`, no `useEffect`: la medida llega antes de pintar, así que
 * no hay salto visible de 380 a 358. Un parpadeo ya se rechazó una vez en esta
 * rama por la misma razón (REG-438).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de fuente.** Que la hoja quepa lo mide el navegador, y
 *   esa medición **no corre en CI**: necesita emuladores.
 * · **No comprueba la pantalla de configuración**, que es la que tiene el
 *   acoplamiento delicado. Sólo se sella que sigue pasando su ancho explícito;
 *   que su recuadro arrastrable siga cuadrando con la hoja se mira a ojo.
 * · **No es un iPhone.** Chromium a 390 y 1440.
 * · **No mide el caso multi-hoja** (`numPages > 1`): la escala mira una hoja y
 *   las demás sólo alargan el contenedor, pero eso no se ha comprobado a 390.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const WRAPPER = sinComentarios(leer('src', 'components', 'RecetaPreviewWrapper.tsx'))
const RECETA = sinComentarios(leer('src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx'))
const ORDEN = sinComentarios(leer('src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx'))
const CONFIG = sinComentarios(leer('src', 'app', '(dashboard)', 'configuracion', 'secciones-recetas.tsx'))

describe('la vista previa mide su sitio en vez de suponerlo', () => {
  it('EL CASO: `maxWidth` ya no tiene un valor por omisión en píxeles', () => {
    /**
     * PROBADO AL REVÉS: devolviendo `maxWidth = 380` a la firma, la hoja vuelve
     * a pintarse a 380 en una columna de 358 y a salirse de la pantalla.
     * Medido: 380 → 358 a 390 px, y 380 → 420 en escritorio.
     */
    const i = WRAPPER.indexOf('export function RecetaPreviewWrapper')
    expect(i).toBeGreaterThan(0)
    const firma = WRAPPER.slice(i, i + 220)
    expect(
      firma,
      'volvió el ancho constante: la hoja se pinta igual en una columna de 358 ' +
      'que en una de 420, y en la estrecha se recorta',
    ).not.toMatch(/maxWidth\s*=\s*\d/)
  })

  it('y lo mide ANTES de pintar, para que no haya salto', () => {
    /**
     * Con `useEffect` la primera pintura saldría a 380 y la segunda a 358: un
     * parpadeo. En esta rama ya se descartó un arreglo por parpadear (REG-438).
     */
    expect(WRAPPER).toMatch(/useLayoutEffect/)
    expect(WRAPPER).toMatch(/ResizeObserver/)
  })

  it('quien pasa el ancho sigue mandando — configuración no se tocó', () => {
    /**
     * Es el acoplamiento que la cabecera del componente declara: configuración
     * convierte píxeles de arrastre en milímetros con `escalaDeVistaPrevia` y el
     * MISMO número. Si dejara de pasarlo y el componente midiera por su cuenta,
     * los dos volverían a hablar de anchos distintos — que es literalmente el
     * defecto que ya ocurrió una vez.
     */
    expect(WRAPPER).toMatch(/maxWidth !== undefined/)
    expect(CONFIG).toMatch(/maxWidth=\{TARGET_WIDTH\}/)
    expect(CONFIG).toMatch(/escalaDeVistaPrevia\(\{/)
  })

  it('y la receta y la orden ya NO lo pasan a mano', () => {
    for (const [nombre, src] of [['receta', RECETA], ['orden', ORDEN]] as const) {
      const i = src.indexOf('<RecetaPreviewWrapper')
      expect(i, `no se encontró la vista previa en ${nombre}`).toBeGreaterThan(0)
      expect(
        src.slice(i, i + 400),
        `${nombre} volvió a pasar un ancho a mano: se pinta contra una constante otra vez`,
      ).not.toMatch(/maxWidth=\{\d/)
    }
  })

  it('`escalaDeVistaPrevia` sigue siendo pura — no mide nada por su cuenta', () => {
    /**
     * La función la comparten dos sitios. Si empezara a medir el DOM, dejaría de
     * poder usarse para la aritmética del arrastre, que ocurre fuera del
     * componente.
     */
    const i = WRAPPER.indexOf('export function escalaDeVistaPrevia')
    const cuerpo = WRAPPER.slice(i, WRAPPER.indexOf('\n}', i))
    expect(cuerpo).not.toMatch(/document|window|ResizeObserver|useRef/)
  })
})
