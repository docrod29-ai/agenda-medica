/**
 * GUARDIÁN — la calidad metodológica se dice como la dijo la fuente.
 *
 * ── LAS DOS MITADES DE ESTE REQUISITO ───────────────────────────────────────
 *
 * `WS-07.prestigio-no-es-calidad` pide que la marca de la revista no suba la
 * calidad metodológica de un artículo. Al mirarlo salieron dos cosas, y la
 * segunda no era la que se buscaba:
 *
 * **1. La revista NO ordena — y conviene que haya guardián justo ahora.**
 * Hoy nada puntúa por revista: `seleccion.ts` se prohíbe explícitamente puntuar
 * autoridad metodológica, y el orden de artículos sale sólo del tipo de estudio.
 * Pero REG-398 acaba de poner la identidad de la revista —nombre, abreviatura
 * ISO, DOI— dentro del `Source`, o sea **a mano**. Un guardián sobre una
 * propiedad que hoy se cumple es barato; escribirlo después del primer
 * `if (revista === 'NEJM')` es tarde.
 *
 * **2. La etiqueta del diseño decía de más.** Esto sí estaba roto:
 *
 *   · `meta-analysis` y `systematic review` salían los dos como «Meta-análisis».
 *     Una revisión sistemática sin metaanálisis resume los estudios; no combina
 *     sus resultados.
 *   · `randomized controlled trial` y `clinical trial` a secas salían los dos
 *     como «ECA». El tipo `Clinical Trial` de PubMed incluye ensayos **no
 *     aleatorizados** —fase I, un solo brazo—, y llamarlos ECA es afirmar un
 *     diseño que la fuente no afirmó. Que es subir la calidad metodológica, sólo
 *     que por la etiqueta en vez de por la revista.
 *
 * ── LO QUE HACE ESTE DEFECTO INSTRUCTIVO ────────────────────────────────────
 *
 * El repositorio **ya lo sabía**. `desde-pubmed.ts` se niega en redondo a
 * traducir esa etiqueta a `DisenoDeEstudio` —«traducir esas cubetas inventaría
 * un dato metodológico que la fuente no dio»— y tiene su caso en
 * `evidence-model.test.ts`.
 *
 * Pero la defensa vivía en el borde del MODELO, y la etiqueta se consume en dos
 * sitios que no pasan por ahí: el **prompt** del consultor, que la mete como
 * `[ECA]` delante del resumen, y `articulosMin`, que la manda a la **pantalla
 * del médico**. Se había decidido que el dato no era de fiar y se seguía
 * entregando a las dos personas que deciden con él.
 *
 * ── LO QUE NO SE TOCÓ, Y POR QUÉ ────────────────────────────────────────────
 *
 * **El orden.** Los diseños recién separados conservan el rango que tenían
 * cuando iban juntos. Cambiarlo sería inventar una jerarquía metodológica
 * nueva — lo mismo que `seleccion.ts` se prohíbe, y lo que la regla 1 llama
 * inventar una cifra clínica. Cambia lo que se DICE, no lo que se prefiere.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No juzga la calidad de un estudio.** Ni riesgo de sesgo, ni tamaño, ni
 *   registro previo. Sólo impide que la etiqueta y la revista digan más de lo
 *   que la fuente dijo.
 * · **No lee `PublicationType` completo**: un artículo puede traer diez tipos y
 *   aquí se responde con el más específico de los que se reconocen.
 * · **No cubre las guías**, que tienen su propio requisito abierto
 *   (`WS-07.guias`: organización, versión, fecha, jurisdicción y vigencia).
 * · **No prueba la pantalla.** Que el médico VEA la salvedad junto al tipo
 *   depende del componente; aquí se comprueba que el dato le llega.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  LO_QUE_LA_ETIQUETA_NO_DICE, POR_QUE_NO_CAMBIA_EL_ORDEN, LA_REVISTA_NO_ORDENA,
} from '@/lib/evidencia/pubmed'

const PUBMED = readFileSync('src/lib/evidencia/pubmed.ts', 'utf8')
const CONSULTOR = readFileSync('src/app/api/consultor-evidencia/route.ts', 'utf8')
const SELECCION = readFileSync('src/lib/evidence-integrations/seleccion.ts', 'utf8')

/** El cuerpo del clasificador y el del orden, acotados. */
const CLASIFICADOR = PUBMED.slice(PUBMED.indexOf('function tipoDeEstudio'), PUBMED.indexOf('function tipoDeEstudio') + 900)
const TABLA_DE_ORDEN = PUBMED.slice(PUBMED.indexOf('const RANK'), PUBMED.indexOf('const RANK') + 500)

describe('la etiqueta del diseño no dice más de lo que dijo PubMed', () => {
  it('una revisión sistemática ya no se llama metaanálisis', () => {
    /**
     * AL REVÉS: el clasificador anterior era
     * `t.includes('meta-analysis') || t.includes('systematic review')` en una
     * sola rama. Volver a juntarlas pone esto en rojo.
     */
    expect(CLASIFICADOR).toMatch(/includes\('meta-analysis'\)\)\) return 'Meta-análisis'/)
    expect(CLASIFICADOR).toMatch(/includes\('systematic review'\)\)\) return 'Revisión sistemática'/)
    expect(CLASIFICADOR).not.toMatch(/meta-analysis'\) \|\| t\.includes\('systematic review/)
  })

  it('un ensayo clínico sin aleatorización declarada ya no se llama ECA', () => {
    /**
     * El más caro de los dos. `Clinical Trial` de PubMed incluye fase I y un
     * solo brazo; llamarlos ECA afirma un diseño que la fuente no afirmó.
     */
    expect(CLASIFICADOR).toMatch(/includes\('randomized controlled trial'\)\)\) return 'ECA'/)
    expect(CLASIFICADOR).toMatch(/includes\('clinical trial'\)\)\) return 'Ensayo clínico'/)
    expect(CLASIFICADOR).not.toMatch(/randomized controlled trial'\) \|\| t\.includes\('clinical trial/)
  })

  it('y se responde con el diseño MÁS específico que declaró la fuente', () => {
    /* Un artículo puede traer varios `PublicationType`. Si la rama del ensayo
       fuera antes que la del ECA, un ECA saldría como ensayo a secas. */
    const orden = ['Meta-análisis', 'Revisión sistemática', 'Guía', 'ECA', 'Ensayo clínico', 'Revisión']
    const posiciones = orden.map(t => CLASIFICADOR.indexOf(`return '${t}'`))
    expect(posiciones.every(p => p > 0), 'falta alguna rama del clasificador').toBe(true)
    for (let i = 1; i < posiciones.length; i++) {
      expect(posiciones[i], `«${orden[i]}» debe evaluarse después de «${orden[i - 1]}»`).toBeGreaterThan(posiciones[i - 1])
    }
  })

  it('lo que la etiqueta NO dice está escrito, no sobreentendido', () => {
    expect(LO_QUE_LA_ETIQUETA_NO_DICE['Ensayo clínico']).toMatch(/no lo declaró aleatorizado/)
    expect(LO_QUE_LA_ETIQUETA_NO_DICE['Revisión sistemática']).toMatch(/no combina sus resultados/)
  })
})

describe('el ORDEN no cambió, que es lo que no se podía inventar', () => {
  it('los diseños recién separados conservan su rango', () => {
    /**
     * Es la mitad que impide que este arreglo se convierta en otro defecto:
     * separar las etiquetas es decir la verdad; reordenarlas sería inventar una
     * jerarquía metodológica que nadie con cédula fijó.
     */
    expect(TABLA_DE_ORDEN).toMatch(/'Meta-análisis': 0/)
    expect(TABLA_DE_ORDEN).toMatch(/'Revisión sistemática': 0/)
    expect(TABLA_DE_ORDEN).toMatch(/'ECA': 2/)
    expect(TABLA_DE_ORDEN).toMatch(/'Ensayo clínico': 2/)
    expect(POR_QUE_NO_CAMBIA_EL_ORDEN).toMatch(/lo que se DICE, no lo que se prefiere/)
  })

  it('y los rangos que ya existían siguen donde estaban', () => {
    expect(TABLA_DE_ORDEN).toMatch(/'Guía': 1/)
    expect(TABLA_DE_ORDEN).toMatch(/'Revisión': 3/)
    expect(TABLA_DE_ORDEN).toMatch(/'': 4/)
  })
})

describe('la identidad de la revista no entra en el orden', () => {
  it('el orden de artículos mira el TIPO, y nada más', () => {
    /**
     * El guardián que se escribe cuando la propiedad todavía se cumple. Desde
     * REG-398 la revista, su abreviatura y el DOI están dentro del `Source`, así
     * que ordenar por ellos es ahora una línea de distancia.
     */
    const orden = PUBMED.slice(PUBMED.indexOf('return arts.map((a, i)'), PUBMED.indexOf('return arts.map((a, i)') + 250)
    expect(orden, 'no se localizó el orden de artículos').not.toBe('')
    for (const señal of ['revista', 'revistaAbrev', 'doi', 'contenedor', 'identidad']) {
      expect(orden.includes(señal), `el orden mira «${señal}»: la revista no puede subir la calidad`).toBe(false)
    }
    expect(orden).toContain('RANK[')
  })

  it('la tabla de orden no nombra ninguna revista', () => {
    for (const revista of ['NEJM', 'Lancet', 'JAMA', 'BMJ', 'Nature', 'Cell']) {
      expect(TABLA_DE_ORDEN.includes(revista), `la tabla de orden nombra ${revista}`).toBe(false)
    }
  })

  it('y la selección de proveedores sigue prohibiéndose puntuar autoridad', () => {
    /* No es de este arreglo: es la propiedad hermana, ya establecida, y este
       caso existe para que no se pierda al tocar el módulo de al lado. */
    expect(SELECCION).toMatch(/NO puntúa AUTORIDAD METODOLÓGICA/)
  })

  it('la razón está escrita donde se pueda leer', () => {
    expect(LA_REVISTA_NO_ORDENA).toMatch(/no vale menos/)
  })
})

describe('la salvedad llega a quien decide con ella', () => {
  it('al PROMPT del consultor, que es donde se leía «[ECA]» a secas', () => {
    /**
     * «El dato tiene que LLEGAR». La defensa anterior vivía en el borde del
     * modelo de evidencia y estos dos caminos no pasan por ahí.
     */
    expect(CONSULTOR).toMatch(/const salvedad = a\.tipo \? LO_QUE_LA_ETIQUETA_NO_DICE\[a\.tipo\] : undefined/)
    expect(CONSULTOR).toMatch(/\$\{a\.tipo\}\$\{salvedad \? ` — \$\{salvedad\}` : ''\}/)
  })

  it('y a la pantalla del médico, junto al tipo', () => {
    expect(CONSULTOR).toMatch(/tipoSalvedad: a\.tipo \? LO_QUE_LA_ETIQUETA_NO_DICE\[a\.tipo\] : undefined/)
  })
})
