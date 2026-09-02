/**
 * LA RECETA SE RECORTABA SEIS PÍXELES EN EL TELÉFONO — REG-441.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando `/receta/pac-001/nota-demo-001` a 390 px contra el arnés de
 * emuladores. Medido en el navegador: **24 bloques de la columna del editor
 * terminaban en x = 396** con la ventana en 390.
 *
 * Y no había barra de desplazamiento que los rescatara: el documento **no**
 * desborda (`scrollWidth === innerWidth`). Los seis píxeles simplemente se
 * cortaban — en los dos avisos de COFEPRIS, en el de «este documento saldrá sin
 * firma ni sello», en el de la dosis que falta, y en todos los campos.
 *
 * ── LA CAUSA, Y LO QUE LA HACE ELEGANTE ─────────────────────────────────────
 *
 * La rejilla de escritorio es `minmax(0, 1fr) 420px`. El `minmax(0, …)` está
 * ahí exactamente para esto: un track `1fr` a secas lleva `min-width: auto`
 * implícito y **no baja del ancho mínimo de su contenido**.
 *
 * El override de móvil, doce líneas más abajo, la reescribía a una sola columna
 * y **perdía la protección**:
 *
 *     @media (max-width: 1000px) { .receta-gen-grid { grid-template-columns: 1fr } }
 *
 * La columna del editor pide 380 px de mínimo —la fila de un medicamento, con
 * sus campos de dosis— así que el track se quedaba en 380 dentro de un
 * contenedor de 358. La regla que protegía el caso ancho no protegía el
 * estrecho, que es donde hacía falta.
 *
 * ── LO QUE APARECIÓ EN LA MISMA MIRADA ──────────────────────────────────────
 *
 * · **Cinco campos a 42 px de alto**, dos por debajo del mínimo táctil — entre
 *   ellos los **dos de la dosis**. Se teclea de pie, con el paciente delante, en
 *   la pantalla donde una cifra equivocada sale impresa con cédula profesional.
 * · **«Quitar medicamento» a 30×44.** Es el único control **destructivo** de la
 *   fila, pegado a los campos de dosis, con catorce píxeles de ancho de menos.
 *
 * ── UNA REGLA QUE ESCRIBÍ Y NO SERVÍA ───────────────────────────────────────
 *
 * Al arreglar el track añadí también `.receta-gen-grid > * { min-width: 0 }`,
 * que es el acompañante clásico. **Lo probé quitándolo y el resultado no se
 * movió: cinco desbordamientos con y sin él.** Era código muerto, así que no se
 * envió. Una regla de CSS que no hace nada es la familia «escrito y sin
 * conectar» en su forma más barata de evitar: basta con medir.
 *
 * ── LA HERMANA TENÍA EL MISMO DEFECTO, Y ERA PEOR ───────────────────────────
 *
 * `/orden` es la tercera de la familia documental, y su código dice que las tres
 * «hablan el mismo idioma». También heredó el fallo, letra por letra: escritorio
 * `minmax(0, 1fr) 420px`, móvil `1fr !important`.
 *
 * Medido: **56 bloques** terminaban fuera de la ventana, más del doble que en la
 * receta, porque su columna de editor es más larga. Mismo arreglo, mismo
 * resultado: 56 → 5, y los 5 son la vista previa.
 *
 * ── Y EL RESTO DE LA FAMILIA **NO** LO TENÍA ────────────────────────────────
 *
 * Buscando el patrón en todo el repositorio aparecen tres sitios más con la
 * misma firma —escritorio con `minmax(0, …)`, móvil que lo pierde—:
 * `.recetas-grid` en configuración, `.nx-uci-grid` y `.nx-demo-receta`.
 *
 * **Arreglarlos «por patrón» habría sido un error, y la medición lo cazó.**
 * `.recetas-grid` se midió con la rejilla DE VERDAD en el DOM —358 px de
 * contenedor, track de 358, hijo más ancho 358— y **no desborda**: el contenido
 * de esa columna sí encoge. Un `1fr` sólo es defecto cuando el mínimo del
 * contenido no cabe.
 *
 * Antes de eso, la primera medición dio «cero recortados» en `/configuracion` y
 * `/demo/interactivo` — y era un FALSO LIMPIO: ninguna de las dos rejillas
 * estaba en el DOM, porque viven tras una pestaña. Una sonda que informa de una
 * pantalla que no llegó a montarse miente con números.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La vista previa del papel sigue saliéndose 6 px, y NO se arregló aquí.**
 *   Su causa es otra: `RecetaPreviewWrapper` calcula la escala contra un
 *   `maxWidth = 380` **constante en píxeles**, elegido para la columna de 420
 *   del escritorio. Merece su propia unidad, y no un parche al final de ésta,
 *   porque ese número lo COMPARTE la pantalla de configuración para convertir
 *   píxeles de arrastre en milímetros de papel — y la propia cabecera del
 *   componente cuenta que ya se desincronizó una vez y «la receta salía
 *   RECORTADA por la derecha». Hacerlo dependiente del contenedor sin tocar los
 *   dos lados repetiría ese defecto.
 * · **El guardián es de fuente.** Que nada se recorte lo mide el navegador, y
 *   esa medición **no corre en CI**: necesita emuladores.
 * · **No es un iPhone.** Chromium a 390 px.
 * · **No se recorrió con teclado** ni se auditó el resto de la pantalla: los
 *   avisos de COFEPRIS, el selector de plantilla y el modal de firma quedan sin
 *   mirar.
 * · **`.nx-uci-grid` y `.nx-demo-receta` NO se midieron.** Tienen la misma
 *   firma y sus rejillas no llegaron a montarse en la corrida (viven tras una
 *   pestaña o una bandera). No se tocaron: tocar sin medir es lo que este mismo
 *   caso acaba de demostrar que sale mal.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RECETA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'),
  'utf8',
)
const ORDEN = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx'),
  'utf8',
)

describe('la rejilla de la receta no se sale del teléfono', () => {
  it('EL CASO: el override de móvil conserva el minmax(0, …)', () => {
    /**
     * PROBADO AL REVÉS: devolviendo `grid-template-columns: 1fr !important`, la
     * sonda vuelve a contar 24 bloques terminando en x = 396. Medido: 24 → 5,
     * y los 5 que quedan son la vista previa, que es otra causa.
     */
    const i = RECETA.indexOf('@media (max-width: 1000px)')
    expect(i, 'ya no está el override de móvil de la rejilla').toBeGreaterThan(0)
    const bloque = RECETA.slice(i, i + 1400)
    expect(
      bloque,
      'el override volvió a `1fr` a secas: un track 1fr no baja del ancho mínimo ' +
      'de su contenido, y la columna del editor se sale recortando 6 px a la derecha',
    ).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/)
  })

  it('y la rejilla de escritorio conserva la suya, que es de donde salió la idea', () => {
    expect(RECETA).toMatch(/gridTemplateColumns:\s*'minmax\(0, 1fr\) 420px'/)
  })

  it('NO se coló la regla que no servía', () => {
    /**
     * `min-width: 0` en los hijos de la rejilla se probó y no cambió nada:
     * cinco desbordamientos con y sin ella. Si reaparece, o alguien la añadió
     * sin medir, o el defecto cambió y hay que volver a medir — las dos cosas
     * merecen que este caso se ponga rojo.
     */
    const i = RECETA.indexOf('@media (max-width: 1000px)')
    const bloque = RECETA.slice(i, i + 1400)
    expect(bloque).not.toMatch(/\.receta-gen-grid\s*>\s*\*/)
  })
})

describe('la hermana documental tiene el mismo arreglo', () => {
  it('EL CASO: /orden conserva el minmax(0, …) en su override de móvil', () => {
    /**
     * PROBADO AL REVÉS: devolviendo `1fr !important`, la sonda vuelve a contar
     * 56 bloques terminando fuera de la ventana. Medido: 56 → 5.
     */
    const i = ORDEN.indexOf('@media (max-width: 1000px)')
    expect(i, 'ya no está el override de móvil de la orden').toBeGreaterThan(0)
    const bloque = ORDEN.slice(i, i + 1400)
    expect(bloque).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/)
  })

  it('y sus campos también llegan a 44 px', () => {
    const i = ORDEN.indexOf('const inputStyle')
    expect(i).toBeGreaterThan(0)
    expect(ORDEN.slice(i, i + 300)).toMatch(/minHeight:\s*44/)
  })
})

describe('lo que se teclea en una receta se puede tocar', () => {
  it('EL CASO: los campos del editor llegan a 44 px de alto', () => {
    /**
     * PROBADO AL REVÉS: quitando el `minHeight`, la sonda vuelve a contar cinco
     * campos a 42 —incluidos los dos de la dosis—. Medido: 5 → 0.
     */
    const i = RECETA.indexOf('const inputStyle')
    expect(i).toBeGreaterThan(0)
    const bloque = RECETA.slice(i, i + 300)
    expect(bloque).toMatch(/minHeight:\s*44/)
  })

  it('sube el ALTO y no la letra: la escala tipográfica no se toca', () => {
    /**
     * El atajo era agrandar la fuente hasta que la caja creciera sola. La escala
     * está medida y el trinquete de diseño la vigila.
     */
    const bloque = RECETA.slice(RECETA.indexOf('const inputStyle'), RECETA.indexOf('const inputStyle') + 300)
    expect(bloque).toMatch(/fontSize:\s*13\b/)
  })

  it('EL CASO: el botón que QUITA un medicamento llega a 44×44', () => {
    /**
     * Medía 30×44 y es el único control destructivo de la fila. Un mal toque no
     * corrige un texto: borra un fármaco de una receta.
     */
    const i = RECETA.indexOf('aria-label="Quitar medicamento"')
    expect(i, 'ya no está el botón de quitar medicamento').toBeGreaterThan(0)
    const bloque = RECETA.slice(i, i + 400)
    expect(bloque).toMatch(/minWidth:\s*44/)
    expect(bloque).toMatch(/minHeight:\s*44/)
  })
})
