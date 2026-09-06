/**
 * EL ACENTO RETIRADO NO SIGUE PINTANDO — y la tarjeta social se puede pintar.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * No leyendo el código: **mirando la portada servida** en Chromium a 1440 px
 * (`docs/audit/ausculta-transformacion/antes/landing-1440-p01.png`,
 * `…-p03.png`). En la captura se ve que la píldora «14 días gratis · sin
 * tarjeta» del héroe lleva **relleno cian y borde índigo**, y que los seis
 * chips de icono de la sección de funciones y los tres numeradores 01/02/03
 * son **chips índigo con el icono cian dentro**.
 *
 * `globals.css` retiró el índigo-violeta `#6E84FE` como acento —y documenta en
 * 40 líneas por qué el cian-petróleo y no otro— pero quedaron **37 literales
 * `rgba(61,90,254,…)` en 14 archivos** ocupando el papel de acento: la portada,
 * el elemento activo del cajón (`Sidebar`), la consulta, la UCI, el consultor,
 * el calendario. El acento nuevo llegó a los tokens; a un tercio de las
 * superficies, no.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un **papel sin token**. El sistema tenía `--nexus` (texto), `--nexus-solido`
 * (relleno bajo texto blanco) y `--nexus-soft` (baño de fondo). No tenía el
 * cuarto papel, que es el que más veces aparece por pantalla: el **hilo de un
 * borde acentuado**. Sin token, 14 archivos lo escribieron a mano — y lo
 * escribieron copiando del vecino, que traía el acento anterior.
 *
 * La regla que lo hace seguro: mientras el papel tenga token
 * (`--nexus-borde` / `--nexus-borde2` / `--nexus-tenue`, derivados con
 * `color-mix` de `--nexus`), el próximo cambio de acento arrastra los cuatro
 * papeles a la vez. Que es exactamente lo que no pasó la vez anterior.
 *
 * ── EL SEGUNDO DEFECTO, DE LA MISMA FAMILIA ─────────────────────────────────
 *
 * `opengraph-image.tsx` pintaba la tarjeta social con `background: var(--nexus)`
 * y `borderRadius: 'var(--r-pill)'`. Esa imagen **no la pinta un navegador**:
 * la pinta `satori` en el runtime edge, sin hoja de estilo y sin `:root`. No
 * hay variables CSS: `satori` normaliza el valor a `background: initial`, no
 * sabe interpretarlo y **lanza**.
 *
 * Medido antes del arreglo: `curl /opengraph-image` → **HTTP 500**. Todo enlace
 * de Ausculta compartido por WhatsApp, LinkedIn, Slack o Twitter salía sin
 * previsualización. Después: **200 · image/png**.
 *
 * Es «el dato tiene que LLEGAR» aplicada a un píxel: leído, `var(--nexus)`
 * parecía lo correcto — hablaba el sistema de diseño—, y por eso sobrevivió.
 * Lo que lo encontró fue mirar del otro lado.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con el árbol anterior a esta unidad, `sinAcentoRetirado` falla en los 14
 * archivos y `laTarjetaSocialNoUsaVariablesCSS` falla en las dos líneas de
 * `opengraph-image.tsx`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide contraste renderizado.** Que `--nexus-borde` sea un borde no le
 *   exige AA (WCAG 1.4.11 aplica a bordes que SON el único indicador de un
 *   control, y estos acompañan a un relleno y a un texto). Los bordes que sí
 *   cargan significado los mide el arnés de navegador con axe.
 * · **No prohíbe el índigo como color.** `--badge-blue-b` es un badge azul y
 *   `avatar-color.ts` es una paleta multi-tono: ahí el índigo es un tono
 *   legítimo, no el acento de marca. Por eso el guardián mira ARCHIVOS de
 *   acento, no el repositorio entero.
 * · **No comprueba que `satori` pinte bien lo demás.** Sólo que no queden
 *   `var()` — que es lo que lanzaba. Que la tarjeta se VEA bien lo dice la
 *   captura, no esto.
 * · No vigila los comentarios: documentar el literal retirado es correcto y
 *   necesario, así que las líneas de comentario se saltan a propósito.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

/** El acento anterior, en las formas en que se escribió a mano. */
const ACENTO_RETIRADO = /rgba\(\s*61\s*,\s*90\s*,\s*254\s*,|#6[Ee]84[Ff][Ee]/

/**
 * Los archivos donde el índigo ocupaba el PAPEL DE ACENTO. Deliberadamente NO
 * están aquí `avatar-color.ts` (paleta multi-tono) ni `--badge-blue-b` de
 * `globals.css` (badge azul): ahí el índigo no es la marca.
 */
const SUPERFICIES_DE_ACENTO = [
  'src/app/page.tsx',
  'src/app/precios/page.tsx',
  'src/app/paquetes/page.tsx',
  'src/app/demo/razonamiento/page.tsx',
  'src/app/verificar/[token]/page.tsx',
  'src/app/opengraph-image.tsx',
  'src/components/Sidebar.tsx',
  'src/components/QueNotaEs.tsx',
  'src/components/NerPanel.tsx',
  'src/app/(dashboard)/calendario/page.tsx',
  'src/app/(dashboard)/uci/page.tsx',
  'src/app/(dashboard)/uci/benchmark/page.tsx',
  'src/app/(dashboard)/consultor/page.tsx',
  'src/app/(dashboard)/consulta/[patientId]/page.tsx',
  'src/app/(dashboard)/consulta/[patientId]/consulta-ui.tsx',
]

/** Una línea de comentario documenta; no pinta. */
const esComentario = (linea: string) => /^\s*(\*|\/\/|\/\*)/.test(linea)

describe('el acento retirado no sigue pintando', () => {
  it('ninguna superficie de acento escribe el índigo a mano', () => {
    const culpables: string[] = []
    for (const archivo of SUPERFICIES_DE_ACENTO) {
      leer(archivo).split('\n').forEach((linea, i) => {
        if (esComentario(linea)) return
        if (ACENTO_RETIRADO.test(linea)) culpables.push(`${archivo}:${i + 1}`)
      })
    }
    expect(culpables, `el acento retirado sigue pintando en:\n${culpables.join('\n')}`).toEqual([])
  })

  it('el cuarto papel del acento tiene token, en los TRES bloques de tema', () => {
    const css = leer('src/app/globals.css')
    // dark (:root) · light ([data-theme="light"]) · sistema (prefers-color-scheme)
    const veces = css.split('--nexus-borde:').length - 1
    expect(veces, 'un token de acento definido en un solo tema es el defecto de la vez anterior').toBe(3)
    expect(css.split('--nexus-tenue:').length - 1).toBe(3)
    // Derivado de --nexus, no fijado: es lo que hace que el próximo cambio
    // de acento arrastre los cuatro papeles.
    expect(css).toContain('--nexus-borde:  color-mix(in srgb, var(--nexus) 34%, transparent)')
  })
})

describe('la tarjeta social se puede pintar', () => {
  it('no usa variables CSS: satori no tiene :root y lanza', () => {
    const og = leer('src/app/opengraph-image.tsx')
    const culpables = og
      .split('\n')
      .map((linea, i) => ({ linea, n: i + 1 }))
      .filter(({ linea }) => !esComentario(linea) && /var\(--/.test(linea))
      .map(({ n }) => `src/app/opengraph-image.tsx:${n}`)
    expect(
      culpables,
      `satori normaliza var() a «initial» y lanza → /opengraph-image devuelve 500:\n${culpables.join('\n')}`,
    ).toEqual([])
  })

  it('sus literales siguen siendo los del tema oscuro del sistema', () => {
    const og = leer('src/app/opengraph-image.tsx')
    const css = leer('src/app/globals.css')
    // Si el acento cambia en globals.css y aquí no, la tarjeta social se queda
    // hablando el acento anterior — que es el defecto que este archivo arregla.
    expect(og).toContain("const COBALT = '#2AA5B5'")
    expect(css).toContain('--nexus:        #2AA5B5')
    expect(og).toContain("const INK = '#0B0C0E'")
    expect(css).toContain('--bg:        #0B0C0E')
  })
})
