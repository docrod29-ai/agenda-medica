/**
 * GOLDEN — SE REPRODUCÍA TEXTO COMPLETO DE PMC SIN LEER SU LICENCIA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `textoCompletoPMC` bajaba el XML de PMC y reproducía hasta 1 600 caracteres
 * del artículo **sin mirar bajo qué licencia está**. El comentario de la función
 * decía «solo artículos de ACCESO ABIERTO — legal».
 *
 * Es una media verdad, y es la peligrosa. El subconjunto Open Access de PMC
 * **mezcla licencias**: ahí conviven CC0 y CC-BY —que permiten reproducir— con
 * CC-BY-NC-ND y con «OA no comercial» a secas, que no. **«Acceso abierto» dice
 * que se puede LEER. No dice que se pueda COPIAR dentro de un producto de
 * pago**, que es exactamente lo que hace este código.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Estaba diagnosticado y sin arreglar **dentro del propio repositorio**:
 * `catalogo.ts` decía «RIESGO REAL: el subconjunto OA mezcla licencias. Hay que
 * leer la licencia POR ARTÍCULO antes de reproducir texto completo», con la
 * decisión marcada como pendiente. Es P1-10 del tablero de Ausculta.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Se confundió **disponibilidad** con **permiso**. Que el NIH te deje descargar
 * el XML no dice nada de lo que puedes hacer con él, y el nombre del conjunto
 * («Open Access») invita justo a esa confusión.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **Fallar cerrado.** Se reproduce sólo cuando la licencia lo autoriza por
 * escrito en el XML; ante una desconocida, ausente o ambigua, no se reproduce.
 *
 * Al revés no funciona: una lista de licencias PROHIBIDAS deja pasar todo lo que
 * nadie previó, y ese error se descubre cuando llega la carta.
 *
 * Y **no se pierde nada clínico**: sin texto completo se usa el resumen, que es
 * exactamente lo que ya pasaba con los artículos de pago. El médico sigue viendo
 * el artículo.
 *
 * ── LA DECISIÓN QUE ESTO **NO** TOMA ────────────────────────────────────────
 *
 * Qué subconjunto exacto es reproducible sigue siendo decisión del dueño
 * («Licencias de evidencia» en el tablero). Esto implementa la postura
 * defendible mientras no exista. Ampliarla —admitir CC-BY-SA, por ejemplo— es
 * suya, no un ajuste técnico.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No prueba la red.** Se ejercita el veredicto sobre XML sintético con las
 *   formas reales en que PMC declara la licencia; no se llama a NCBI.
 * · **No cubre otras fuentes.** Sólo PMC. openFDA, ClinicalTrials y el resto
 *   tienen sus propias condiciones y su propia fila en el catálogo.
 * · **No audita lo ya reproducido.** Si algún texto de un artículo restrictivo
 *   quedó dentro de una nota antes de esto, este cambio no lo retira: no hay
 *   registro de qué se reprodujo y de cuál artículo. Queda dicho.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { licenciaDePmc, claveDeLicencia } from '@/lib/evidencia/licencia-pmc'

/** Las formas reales en que PMC declara una licencia. */
const conRef = (url: string) =>
  `<article><front><article-meta><permissions>
     <license license-type="open-access">
       <ali:license_ref xmlns:ali="http://www.niso.org/schemas/ali/1.0/">${url}</ali:license_ref>
       <license-p>This is an open access article.</license-p>
     </license>
   </permissions></article-meta></front><body><p>Resultados: HR 0.72 (95% CI 0.60-0.86).</p></body></article>`

const soloProsa = (texto: string) =>
  `<article><front><article-meta><permissions>
     <license license-type="open-access"><license-p>${texto}</license-p></license>
   </permissions></article-meta></front></article>`

describe('LO QUE SÍ SE PUEDE REPRODUCIR', () => {
  it('CC0 sí', () => {
    const v = licenciaDePmc(conRef('https://creativecommons.org/publicdomain/zero/1.0/'))
    expect(v.puede).toBe(true)
  })

  it('CC-BY sí', () => {
    const v = licenciaDePmc(conRef('https://creativecommons.org/licenses/by/4.0/'))
    expect(v.puede).toBe(true)
    expect(v.licencia).toBe('cc-by')
  })
})

describe('LO QUE NO — y es la lista que importa', () => {
  it('EL CASO: CC-BY-NC NO, porque este producto se cobra', () => {
    const v = licenciaDePmc(conRef('https://creativecommons.org/licenses/by-nc/4.0/'))
    expect(v.puede).toBe(false)
    if (v.puede) return
    expect(v.porQue).toBe('restrictiva')
  })

  it('CC-BY-NC-ND NO — y no cuela por empezar con «cc-by»', () => {
    /**
     * Ésta es la trampa exacta: una comprobación por PREFIJO daría permiso a
     * `cc-by-nc-nd`. Por eso la lista permisiva es de identificadores exactos.
     */
    const v = licenciaDePmc(conRef('https://creativecommons.org/licenses/by-nc-nd/4.0/'))
    expect(v.puede).toBe(false)
  })

  it('CC-BY-ND NO: extraer párrafos sueltos es una obra derivada', () => {
    expect(licenciaDePmc(conRef('https://creativecommons.org/licenses/by-nd/4.0/')).puede).toBe(false)
  })

  it('«non-commercial» en PROSA cuenta como que no, aunque no haya identificador', () => {
    // Un artículo que dice «for non-commercial use» está diciendo que no; no
    // reconocer su forma de decirlo no lo convierte en permiso.
    const v = licenciaDePmc(soloProsa('This article is available for non-commercial use only.'))
    expect(v.puede).toBe(false)
    if (v.puede) return
    expect(v.porQue).toBe('restrictiva')
  })

  it('EL CORAZÓN DEL DEFECTO: `license-type="open-access"` a secas NO basta', () => {
    /**
     * Dice que se puede LEER, no que se pueda COPIAR. Era justo la confusión que
     * dejaba pasar todo lo demás.
     */
    const v = licenciaDePmc(soloProsa('This is an open access article distributed under the terms of the journal.'))
    expect(v.puede).toBe(false)
    if (v.puede) return
    expect(v.porQue).toBe('desconocida')
  })

  it('sin bloque de licencia tampoco: «no dice nada» no es permiso', () => {
    const v = licenciaDePmc('<article><body><p>Texto sin permisos declarados.</p></body></article>')
    expect(v.puede).toBe(false)
    if (v.puede) return
    expect(v.porQue).toBe('ausente')
  })

  it('y distingue «dice que no» de «no dice nada», aunque las dos cierren igual', () => {
    const restrictiva = licenciaDePmc(conRef('https://creativecommons.org/licenses/by-nc/4.0/'))
    const ausente = licenciaDePmc('<article/>')
    expect(restrictiva.puede).toBe(false)
    expect(ausente.puede).toBe(false)
    if (restrictiva.puede || ausente.puede) return
    expect(restrictiva.porQue).not.toBe(ausente.porQue)
  })
})

describe('LA NORMALIZACIÓN ENTIENDE LAS FORMAS REALES', () => {
  it('reconoce la URL de Creative Commons', () => {
    expect(claveDeLicencia('http://creativecommons.org/licenses/by/2.0')).toBe('cc-by')
  })

  it('y el identificador suelto en prosa', () => {
    expect(claveDeLicencia('Distributed under a CC BY license.')).toBe('cc-by')
    expect(claveDeLicencia('CC-BY-NC-SA 4.0')).toBe('cc-by-nc-sa')
  })

  it('CC0 en sus dos formas', () => {
    expect(claveDeLicencia('https://creativecommons.org/publicdomain/zero/1.0/')).toBe('cc0')
    expect(claveDeLicencia('Released under CC0.')).toBe('cc0')
  })

  it('y devuelve null cuando no hay nada que reconocer', () => {
    expect(claveDeLicencia('All rights reserved by the publisher.')).toBeNull()
  })
})

describe('LA PUERTA ESTÁ EN EL CAMINO, Y ANTES DE EXTRAER', () => {
  const src = readFileSync('src/lib/evidencia/pubmed.ts', 'utf8')

  it('`textoCompletoPMC` consulta la licencia', () => {
    expect(src).toContain('licenciaDePmc(xml)')
  })

  it('y lo hace ANTES de extraer un solo párrafo', () => {
    /**
     * Extraer y luego decidir dejaría el texto en memoria y a un `return` de
     * distancia de acabar en un prompt.
     */
    const bloque = src.slice(src.indexOf('const xml = await fx.text()'))
    expect(bloque.indexOf('licenciaDePmc(xml)')).toBeLessThan(bloque.indexOf('matchAll(/<p'))
  })

  it('el catálogo ya no promete lo que no hace', () => {
    const cat = readFileSync('src/lib/evidence-integrations/catalogo.ts', 'utf8')
    expect(cat).toContain('REG-357')
    expect(cat).toContain('sólo CC0 y CC-BY')
    // Y la decisión del dueño sigue declarada como suya, no dada por tomada.
    expect(cat).toContain('sigue siendo decisión del dueño')
  })
})
