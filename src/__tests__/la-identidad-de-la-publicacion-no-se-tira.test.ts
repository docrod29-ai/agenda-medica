/**
 * GOLDEN — el DOI, el PMCID y la abreviatura llegan hasta donde se usan.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Cuatro datos de identidad se calculaban y se tiraban, cada uno en un sitio
 * distinto, y los cuatro son los que hacen que una cita sea **verificable** en
 * vez de sólo legible:
 *
 *  1. **La revista perdía una de sus dos formas.** `pubmed.ts` hacía
 *     `extraerTag('Title') || extraerTag('ISOAbbreviation')`: se quedaba con la
 *     que hubiera y tiraba la otra. Son datos distintos —una lista se lee con el
 *     nombre entero, una CITA se escribe con la abreviatura ISO— y el que se
 *     perdía no se recuperaba sin volver a preguntar.
 *  2. **El PMCID se resolvía y se descartaba.** `textoCompletoPMC` gastaba una
 *     petición en averiguarlo y devolvía sólo el texto.
 *  3. **La licencia se leía y se descartaba igual.** Con eso el sistema no podía
 *     distinguir «sólo hay resumen» de «hay texto completo y la licencia no deja
 *     reproducirlo» — que es justo la que hay que poder explicar.
 *  4. **El DOI no llegaba al `Source`.** `ArticuloPubMed` lo traía desde hacía
 *     tiempo y `desde-pubmed.ts` no lo pasaba. El `Source` es lo único sobre lo
 *     que se anclan pasajes, así que una afirmación respaldada nacía sin el
 *     identificador estable de su respaldo. El DOI sí llegaba a la pantalla, por
 *     otro camino: **el modelo y la vista sabían cosas distintas**.
 *
 * ── LA REGLA QUE ESTE GOLDEN PROTEGE ────────────────────────────────────────
 *
 * **Ausente significa «no se sabe», nunca «no tiene».** Por eso los campos son
 * opcionales y no se rellenan con `''` ni con `false`: una cadena vacía se lee
 * como «lo miré y no hay», y `accesoAbierto: false` afirma que está cerrado —
 * dos cosas que nadie comprobó.
 *
 * Y en particular: **tener PMCID no implica acceso abierto.** El subconjunto de
 * PMC mezcla licencias; suponerlo llevaría a reproducir texto que no se puede,
 * que es el defecto que `licencia-pmc.ts` ya existe para impedir.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No valida el DOI contra Crossref.** Se pasa el que PubMed dio, y
 *   `pubmed.ts` ya exige que empiece por `10.`; que resuelva es otra cosa.
 * · **No hay campo de «disponibilidad de texto completo» general**: hoy sólo se
 *   sabe de PMC. Para una revista de paga, ausente sigue queriendo decir «no se
 *   sabe», y eso es correcto.
 * · **No pinta nada.** Que la pantalla enseñe el DOI es otro trabajo; aquí se
 *   comprueba que el dato LLEGA y deja de morir en la función que lo calcula.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sourceDesdeArticuloPubMed } from '@/lib/evidencia/desde-pubmed'
import type { ArticuloPubMed } from '@/lib/evidencia/pubmed'

const ARTICULO: ArticuloPubMed = {
  pmid: '38412345',
  titulo: 'Short-course therapy for uncomplicated bacteraemia',
  revista: 'Clinical Infectious Diseases',
  revistaAbrev: 'Clin Infect Dis',
  anio: '2024',
  resumen: 'Randomised, open-label, non-inferiority trial comparing 7 vs 14 days.',
  tipo: 'ECA',
  doi: '10.1093/cid/ciae123',
  url: 'https://pubmed.ncbi.nlm.nih.gov/38412345/',
}

const AHORA = '2026-08-30T12:00:00.000Z'

describe('el `Source` nace con la identidad de su publicación', () => {
  it('el DOI llega — antes se quedaba en el artículo', () => {
    /**
     * AL REVÉS: sin pasarlo, `identidad` queda `undefined` y una cita anclada
     * no tiene identificador estable. El DOI llegaba a la pantalla por otro
     * camino, así que el modelo y la vista sabían cosas distintas.
     */
    const r = sourceDesdeArticuloPubMed(ARTICULO, AHORA)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.identidad?.doi).toBe('10.1093/cid/ciae123')
  })

  it('y la abreviatura ISO, que es lo que lleva una cita', () => {
    const r = sourceDesdeArticuloPubMed(ARTICULO, AHORA)
    if (!r.ok) throw new Error('debería construirse')
    expect(r.valor.identidad?.revistaAbrev).toBe('Clin Infect Dis')
    /* Y el nombre entero sigue en `contenedor`: son los dos, no uno. */
    expect(r.valor.contenedor).toBe('Clinical Infectious Diseases')
  })

  it('el PMCID entra cuando alguien fue a PMC, y no antes', () => {
    const sinIr = sourceDesdeArticuloPubMed(ARTICULO, AHORA)
    if (!sinIr.ok) throw new Error('debería construirse')
    expect(sinIr.valor.identidad?.pmcid, 'no se fue a PMC: no se sabe').toBeUndefined()

    const yendo = sourceDesdeArticuloPubMed(ARTICULO, AHORA, { pmcid: 'PMC10987654' })
    if (!yendo.ok) throw new Error('debería construirse')
    expect(yendo.valor.identidad?.pmcid).toBe('PMC10987654')
  })

  it('tener PMCID NO afirma acceso abierto', () => {
    /**
     * El caso que protege la licencia. El subconjunto de PMC mezcla CC0 y CC-BY
     * con CC-BY-NC-ND: suponer que estar en PMC es poder reproducir llevaría a
     * copiar texto que no se puede.
     */
    const r = sourceDesdeArticuloPubMed(ARTICULO, AHORA, { pmcid: 'PMC10987654' })
    if (!r.ok) throw new Error('debería construirse')
    expect(r.valor.identidad?.accesoAbierto).toBeUndefined()
  })

  it('y `accesoAbierto` nunca se escribe como `false`', () => {
    /* «No consta que sea abierto» y «consta que es cerrado» son dos cosas, y la
       segunda hay que haberla comprobado. */
    const r = sourceDesdeArticuloPubMed(ARTICULO, AHORA, { pmcid: 'PMC1', accesoAbierto: false })
    if (!r.ok) throw new Error('debería construirse')
    expect(r.valor.identidad?.accesoAbierto).toBeUndefined()
    expect('accesoAbierto' in (r.valor.identidad ?? {})).toBe(false)
  })

  it('un artículo sin nada de esto no lleva un bloque de identidad vacío', () => {
    /**
     * Un `identidad: {}` parecería que se miró y no había. Es la misma mentira
     * que una cadena vacía, con más forma de dato.
     */
    const pelado = { ...ARTICULO, doi: undefined, revistaAbrev: undefined }
    const r = sourceDesdeArticuloPubMed(pelado, AHORA)
    if (!r.ok) throw new Error('debería construirse')
    expect(r.valor.identidad).toBeUndefined()
  })
})

describe('lo que se averigua en PMC deja de morir ahí', () => {
  const PUBMED = readFileSync('src/lib/evidencia/pubmed.ts', 'utf8')
  const RUTA = readFileSync('src/app/api/consultor-evidencia/route.ts', 'utf8')

  it('la función devuelve el PMCID que resolvió', () => {
    expect(PUBMED).toMatch(/identidad\[pmid\] = \{ pmcid:/)
  })

  it('y el acceso abierto sólo cuando la licencia lo dice', () => {
    expect(PUBMED).toMatch(/if \(licencia\.puede\) identidad\[pmid\] = \{ \.\.\.identidad\[pmid\], accesoAbierto: true \}/)
    /* Y la decisión de extraer sigue yendo DESPUÉS de la licencia, no antes. */
    const iLic = PUBMED.indexOf('const licencia = licenciaDePmc(xml)')
    const iExtraer = PUBMED.indexOf('const parrafos = [...xml.matchAll')
    expect(iLic).toBeGreaterThan(0)
    expect(iExtraer).toBeGreaterThan(iLic)
  })

  it('la ruta que lo pide se lo queda', () => {
    /* «El dato tiene que LLEGAR»: devolverlo y no usarlo lo dejaría muerto una
       función más allá. */
    expect(RUTA).toContain('textoCompletoPMCConIdentidad(')
    expect(RUTA).toMatch(/pmcid: pmc\.identidad\[a\.pmid\]\?\.pmcid/)
    expect(RUTA).toMatch(/accesoAbierto: pmc\.identidad\[a\.pmid\]\?\.accesoAbierto/)
  })

  it('y la revista ya no pierde una de sus dos formas', () => {
    expect(PUBMED).toMatch(/const revistaAbrev = extraerTag\(b, 'ISOAbbreviation'\) \|\| undefined/)
    expect(RUTA).toMatch(/revistaAbrev: a\.revistaAbrev/)
  })
})
