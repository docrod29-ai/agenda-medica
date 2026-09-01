/**
 * GOLDEN — «IA» y «Regla con código» se pintaban del MISMO color, en el panel
 * que existe para distinguirlas. Y el sello «PubMed real» seguía puesto cuando
 * PubMed no había contestado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando `/demo/razonamiento` servida y leyendo el color computado de cada
 * distintivo, uno por uno. A 390, tema oscuro:
 *
 *     «IA»                 rgb(42, 165, 181)
 *     «Regla con código»   rgb(42, 165, 181)   ← el mismo
 *     «PubMed»             rgb(163, 117, 242)
 *     «Sistema»            rgb(138, 143, 148)
 *
 * Cuatro clases de origen declaradas en el código, **tres colores en pantalla**.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 *     const FUENTE_COLOR = {
 *       determinista: 'var(--teal)', modelo: 'var(--nexus)', …
 *     }
 *
 * y en `globals.css`, en los tres temas:
 *
 *     --teal: var(--nexus);
 *
 * `--teal` fue un color propio; el día que se consolidó el acento se convirtió
 * en un alias de `--nexus`, y estas dos categorías se fundieron **en silencio**.
 * No lo cazó nadie porque ninguna prueba compara dos tokens buscando que sean
 * DISTINTOS: todas comprueban que un color sea el que toca, nunca que dos no
 * sean el mismo.
 *
 * ── POR QUÉ NO ES UN DEFECTO DE COLOR ───────────────────────────────────────
 *
 * `clinical-safety.md` §2: «el LLM redacta y extrae; **NO calcula**». Toda la
 * promesa del producto se apoya en que el médico pueda ver cuál de los dos hizo
 * cada paso. La página lo dice con todas las letras —«lo determinista corre con
 * código; la IA se marca»— y la marca era del mismo color que lo marcado.
 *
 * Y no es sólo la demo pública: `PanelRazonamiento` se monta **dentro de la
 * consulta** (`consulta/[patientId]`, dentro de «Cómo razoné este caso»).
 *
 * ── EL SEGUNDO DEFECTO, EN EL MISMO SITIO ───────────────────────────────────
 *
 * Con PubMed sin responder —comprobado: este entorno no lo alcanza, la salida
 * está cerrada—, el bloque de evidencia enseñaba su aviso de error y, encima,
 * seguía puesto el sello **«PubMed real»** (medido: presente, `rgb(42,165,181)`)
 * y el párrafo seguía prometiendo en presente que «cada PMID es real y
 * verificable». Y el título de la sección, en negrita justo arriba, decía
 * «Evidencia real, recuperada al momento».
 *
 * Un sello de garantía encima de una garantía que acababa de fallar delante de
 * quien lo lee. Arreglar sólo el sello habría movido el problema tres
 * centímetros, así que el título dice ahora la REGLA —cierta en los dos
 * estados— y el fallo pasa a demostrarla en vez de romperla.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `determinista: 'var(--teal)'`, falla el primer bloque. Sacando el
 * sello del `estado === 'ok'`, falla el segundo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No mide el color en pantalla.** Es un guardián de fuente: caza que dos
 *   orígenes vuelvan a compartir token, y que el token que se les dé no sea un
 *   alias de otro de la lista. El color computado se midió en el navegador —es
 *   lo único que encontró el defecto— y se re-mide al tocar la paleta.
 * · **No comprueba el contraste.** Lo mide axe sobre la página servida, en los
 *   dos temas: 0 graves en éxito y en fallo, antes y después. Como en la unidad
 *   del portal, axe estaba limpio CON el defecto puesto.
 * · **El panel dentro de la CONSULTA no se pudo renderizar.** Se monta sólo si
 *   hay diagnósticos, medicamentos, resumen o signos, y la consulta sembrada
 *   está en blanco: el arnés no encontró ni el desplegable. Lo verificado es el
 *   mismo componente en `/demo/razonamiento`, y los colores son constantes de
 *   módulo, no props — pero renderizado dentro de la consulta, no está visto.
 *   Sembrar una consulta con datos es trabajo con nombre, y queda dicho.
 * · **El estado de ÉXITO de PubMed se midió con la respuesta simulada**
 *   (`page.route`), porque este entorno no alcanza `eutils.ncbi.nlm.nih.gov`
 *   —el proxy de salida lo rechaza—. Lo que la red real devuelva no está visto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const PANEL = leer('src/components/PanelRazonamiento.tsx')
const EVID = leer('src/components/EvidenciaEnVivo.tsx')
const DEMO = leer('src/app/demo/razonamiento/page.tsx')
const CSS = leer('src/app/globals.css')

/**
 * Sin comentarios. Aquí se documenta lo RETIRADO —el literal viejo, el título
 * viejo— y documentarlo vale más que la comodidad de buscar en crudo: el
 * primer intento de este golden se puso rojo contra sus propios comentarios.
 */
const sinComentarios = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const EVID_CODIGO = sinComentarios(EVID)
const DEMO_CODIGO = sinComentarios(DEMO)

/** El valor final de un token, siguiendo los alias `--a: var(--b)`. */
function resolver(nombre: string, tema: 'oscuro' | 'claro'): string {
  // El bloque oscuro es `:root`; el claro, `:root[data-theme="light"]`.
  const inicio = tema === 'claro' ? CSS.indexOf(':root[data-theme="light"]') : 0
  const trozo = CSS.slice(inicio)
  for (let i = 0; i < 6; i++) {
    const m = trozo.match(new RegExp(`${nombre}:\\s*([^;]+);`))
    if (!m) return nombre
    const v = m[1].trim()
    const alias = v.match(/^var\((--[a-z0-9-]+)\)$/)
    if (!alias) return v
    nombre = alias[1]
  }
  return nombre
}

/** Los tokens que el panel le da a cada origen. */
function coloresDeOrigen(): Record<string, string> {
  const m = PANEL.match(/const FUENTE_COLOR: Record<FuenteRazon, string> = \{([\s\S]*?)\n\}/)
  if (!m) throw new Error('desapareció FUENTE_COLOR')
  const out: Record<string, string> = {}
  for (const par of m[1].matchAll(/(\w+):\s*'var\((--[a-z0-9-]+)\)'/g)) out[par[1]] = par[2]
  return out
}

describe('cada origen del razonamiento tiene su propio color', () => {
  it('los cuatro declaran un token, y son cuatro tokens distintos', () => {
    const c = coloresDeOrigen()
    expect(Object.keys(c).sort()).toEqual(['determinista', 'evidencia', 'meta', 'modelo'])
    expect(new Set(Object.values(c)).size, `dos orígenes comparten token: ${JSON.stringify(c)}`).toBe(4)
  })

  it('y no son cuatro nombres del MISMO color — que es como pasó', () => {
    /**
     * Aquí está el defecto entero. `--teal` y `--nexus` son dos nombres y un
     * solo valor, así que tener «cuatro tokens distintos» no bastaba: hay que
     * seguir los alias hasta el valor final. Es lo que ninguna prueba hacía.
     */
    for (const tema of ['oscuro', 'claro'] as const) {
      const finales = Object.entries(coloresDeOrigen())
        .map(([origen, tok]) => [origen, resolver(tok, tema)] as const)
      const vistos = new Map<string, string>()
      for (const [origen, valor] of finales) {
        const otro = vistos.get(valor)
        expect(
          otro,
          `en tema ${tema}, «${origen}» y «${otro}» acaban en el mismo color (${valor})`,
        ).toBeUndefined()
        vistos.set(valor, origen)
      }
    }
  })

  it('el alias que lo causó sigue siendo un alias — si dejara de serlo, esto lo diría', () => {
    // Probado al revés en la otra dirección: el guardián de arriba sólo tiene
    // sentido mientras `--teal` sea `--nexus`. Si algún día vuelve a ser un
    // color propio, este caso avisa de que la historia cambió.
    expect(CSS, '--teal dejó de ser alias de --nexus: revisa el golden').toMatch(/--teal:\s*var\(--nexus\)/)
  })

  it('y el color no es el único canal: cada origen lleva su propio tinte', () => {
    // Los cuatro compartían `rgba(127,127,127,.1)`. Con dos canales, perder el
    // color —pantalla mala, luz de mediodía, daltonismo— no funde dos clases.
    expect(PANEL).toContain('const FUENTE_FONDO: Record<FuenteRazon, string> = {')
    const m = PANEL.match(/const FUENTE_FONDO: Record<FuenteRazon, string> = \{([\s\S]*?)\n\}/)!
    const fondos = [...m[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(x => x[2])
    expect(fondos.length).toBe(4)
    expect(new Set(fondos).size, 'dos orígenes comparten fondo').toBe(4)
    expect(PANEL).toContain('background: FUENTE_FONDO[p.fuente]')
    expect(PANEL, 'volvió el gris único').not.toContain("background: 'rgba(127,127,127,.1)'")
  })
})

describe('el sello no sobrevive al fallo', () => {
  it('«PubMed real» sólo se pinta cuando de verdad llegaron artículos', () => {
    expect(EVID).toMatch(/\{estado === 'ok' && \(\s*\n\s*<span[^>]*>PubMed real<\/span>/)
  })

  it('y la promesa cambia de tiempo verbal en vez de seguir afirmando', () => {
    expect(EVID_CODIGO, 'volvió la promesa fija en presente').not.toMatch(/Cada PMID es\s*\n?\s*real y verificable: haz clic/)
    expect(EVID).toContain("{estado === 'ok' ? (")
    expect(EVID).toContain('sin rellenar el hueco')
  })

  it('el título de la sección también es cierto cuando PubMed no contesta', () => {
    expect(DEMO_CODIGO, 'volvió el título que afirma el resultado')
      .not.toContain('Evidencia real, recuperada al momento')
    expect(DEMO).toContain('La evidencia se recupera de PubMed — o no se enseña')
  })

  it('el aviso de fallo dice explícitamente que no se rellena con ejemplos', () => {
    // Es la regla del producto entero dicha donde se puede comprobar: «lo que
    // no se pudo recuperar, no se enseña».
    expect(EVID).toContain('lo que no se pudo recuperar, no se')
    expect(EVID).toContain('role="status"')
  })
})

describe('la pareja de color, en el archivo que el guardián no vigilaba', () => {
  it('el distintivo del tipo de estudio dejó el verde azulado viejo', () => {
    // `rgba(13,148,136,.12)` —el #0d9488 de antes— bajo un texto que ya salía
    // del token. Pasaba el contraste, así que axe callaba; lo que se veía era
    // un distintivo de otro tono que el resto de la página.
    expect(EVID_CODIGO, 'volvió el tinte viejo').not.toContain('rgba(13,148,136,.12)')
    expect(EVID).toMatch(/color: 'var\(--nexus\)', background: 'var\(--nexus-soft\)'/)
  })
})
