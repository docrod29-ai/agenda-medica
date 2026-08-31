/**
 * GOLDEN — el color de marca del recetario no carga con texto pequeño.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo por primera vez **los documentos del encuentro** —nota, receta y
 * orden—, que llevaban fuera del trinquete desde el principio porque sus rutas
 * necesitan un `notaId` y la siembra estándar no crea notas. Son lo que el
 * médico produce y lo que se imprime con su cédula profesional.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * A 1440, `/receta` y `/orden` daban **axe 2** cada una: `color-contrast` de
 * **2.48 : 1** sobre papel blanco, en dos sitios —el título del documento
 * («Receta Médica» / «Orden Médica», 11 px) y la **especialidad** del médico
 * (10.5 px)—, los dos pintados con el color de acento.
 *
 * ── POR QUÉ NO ES UNA DECISIÓN DE MARCA, Y SÍ UN DEFECTO ────────────────────
 *
 * El acento **lo elige el médico** en configuración (`colorAccento`), y este
 * carril no toca la identidad de nadie. Pero mirando dónde se usa, el acento es
 * casi siempre decorativo: filetes, la barra de 3 px del encabezado, el borde
 * inferior, los rellenos, el ℞ grande. Los **únicos** dos sitios donde cargaba
 * texto pequeño que hay que LEER son exactamente los dos que axe marcó.
 *
 * Así que no se cambia el color del médico: se deja de pedirle que haga de
 * tinta. Su acento sigue en todo lo demás —incluida la barra que va pegada a la
 * especialidad—, y el texto pasa al gris neutro que este documento ya usaba.
 *
 * ── POR QUÉ GRISES LITERALES Y NO TOKENS ────────────────────────────────────
 *
 * Porque un recetario **no sigue al tema de la aplicación**: se imprime en papel
 * blanco y tiene que verse igual en claro, en oscuro y en el PDF. Es la
 * excepción que el propio trinquete de diseño describe al explicar por qué
 * persigue el hex en línea.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `color: accent` a cualquiera de los dos, cae.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No juzga el acento que elija cada médico: uno claro sobre papel blanco
 *   seguirá dando mal contraste en lo decorativo, y **eso no se vigila**.
 * · No mide el PDF ni la impresión: se midió la pantalla, a 390 y 1440.
 * · El ℞ de 24 px sigue con el acento. axe no lo marca; no se toca lo que no
 *   se ha medido roto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const DOC = readFileSync('src/components/RecetaDocumento.tsx', 'utf8')

describe('el documento sigue teniendo su acento de marca', () => {
  it('el acento lo elige el médico y sigue existiendo', () => {
    expect(DOC).toMatch(/const accent = recetaConfig\.colorAccento/)
  })

  it('y sigue usándose en lo DECORATIVO, que es su sitio', () => {
    // Si un día alguien «arregla» el contraste quitando el acento de todas
    // partes, el médico pierde su identidad en el papel. Eso también es un
    // defecto, sólo que del otro lado.
    expect(DOC, 'el filete del encabezado').toMatch(/borderBottom: `2px solid \$\{accent\}`/)
    expect(DOC, 'la barra vertical de identidad').toMatch(/background: accent/)
  })
})

describe('pero no carga con el texto pequeño del papel', () => {
  it('el título del documento no va en el acento', () => {
    const i = DOC.indexOf("'Receta Médica' : 'Orden Médica'")
    expect(i, 'desapareció el título del documento').toBeGreaterThan(-1)
    const linea = DOC.slice(DOC.lastIndexOf('<div', i), i)
    expect(linea, 'el título volvió al color de marca (2.48:1 medido)').not.toMatch(/color: accent/)
  })

  it('la especialidad del médico tampoco', () => {
    /**
     * ANCLADO EN EL ELEMENTO, NO EN LA PRIMERA APARICIÓN DEL NOMBRE.
     *
     * La primera versión buscaba `{especialidad}` con `indexOf` y miraba los
     * 220 caracteres anteriores. Pero la primera aparición es la CONDICIÓN
     * —`{especialidad && <div …`— así que la ventana caía antes del estilo y
     * el caso **pasaba con el defecto puesto**. Lo cazó la prueba al revés,
     * que es exactamente para lo que está.
     *
     * Ahora se busca la línea entera del elemento por su tamaño, que es lo que
     * lo identifica sin ambigüedad.
     */
    // Dos subcadenas, sin regex: la línea lleva `}}>` en medio y un `[^}]*`
    // no puede cruzarlo — la segunda versión de este caso fallaba SIEMPRE por
    // eso, con el defecto puesto y sin él.
    const linea = DOC.split('\n').find(l => l.includes('fontSize: 10.5') && l.includes('{especialidad}'))
    expect(linea, 'desapareció la línea de la especialidad').toBeTruthy()
    expect(linea!, 'la especialidad volvió al color de marca (2.48:1 medido)').not.toMatch(/color: accent/)
    // Y sigue siendo el texto que se lee, no un adorno.
    expect(linea!).toMatch(/color: '#444'/)
  })
})
