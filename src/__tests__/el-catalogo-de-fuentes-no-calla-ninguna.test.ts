/**
 * GUARDIÁN — una fuente que el alcance pide y el catálogo no tiene es invisible.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El alcance canónico nombra **29 fuentes** de evidencia. El catálogo del
 * producto tenía **12**. Las otras 17 no estaban «pendientes» ni «bloqueadas»:
 * **no estaban**.
 *
 * Y eso tiene una consecuencia concreta, no documental. El producto tiene una
 * regla buena —«un proveedor no operativo baja de posición pero no desaparece de
 * la lista»— que existe para que el médico pueda leer *«UpToDate: no se
 * consultó»*. Esa regla **no puede dispararse para una fuente que el catálogo no
 * conoce**: DynaMed no salía como no consultada porque DynaMed no existía para el
 * selector. El médico veía lo que sí se encontró y nada que le dijera dónde no se
 * miró.
 *
 * ── LA PARTE INCÓMODA: LAS EDITORIALES ──────────────────────────────────────
 *
 * NEJM, JAMA, Lancet, BMJ, CID, Nature Medicine y Annals **se descubren vía
 * PubMed**, con su resumen y sus metadatos públicos. Eso no es una integración
 * editorial, y llamarlo así sería falso: no hay contrato, ni API, ni texto
 * completo. Entran al catálogo con `REQUIRES_AGREEMENT` y con esa frase escrita,
 * para que nadie —ni un documento, ni una pantalla— pueda decir «integrado con
 * NEJM».
 *
 * ── POR QUÉ ENTRAN CON LA MATRIZ SIN VERIFICAR ──────────────────────────────
 *
 * Porque es lo único honesto. Declarar una vía oficial, un modelo de credencial o
 * una semántica de fallo que **nadie ha comprobado** sería inventar la ficha en
 * vez de construirla — y una ficha inventada es peor que una ausente, porque
 * parece trabajo hecho. Lo que sí se declara es **por qué** están así y **qué
 * decisión** falta.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Catalogar no es integrar.** Ninguna de las 17 nuevas puede producir un
 *   `Source` — y eso no lo impide este guardián sino el modelo de tipos: sin
 *   `proveedorCanonico` no hay `Source`, sin `Source` no hay `Passage` y sin
 *   `Passage` no hay afirmación respaldada.
 * · **No verifica la matriz de las nuevas.** Está sin verificar a propósito.
 * · **No dice si una fuente vale la pena.** Dice que el catálogo no puede
 *   callársela.
 */
import { describe, it, expect } from 'vitest'
import { CATALOGO_DE_EVIDENCIA, licenciaPermiteOperar } from '@/lib/evidence-integrations/catalogo'
import { FUENTES_CANONICAS } from '@/lib/programa/requisitos'

const entradas = Object.values(CATALOGO_DE_EVIDENCIA)

/** Cómo se nombra cada fuente canónica dentro del catálogo. */
const EN_EL_CATALOGO: Record<string, string> = {
  'PubMed/MEDLINE': 'pubmed', 'PMC': 'pmc', 'ClinicalTrials.gov': 'clinicaltrials',
  'CDC': 'cdc', 'WHO': 'who', 'FDA/DailyMed': 'fda_dailymed', 'Crossref': 'crossref',
  'NEJM': 'nejm', 'JAMA': 'jama', 'Lancet': 'lancet', 'BMJ': 'bmj',
  'Clinical Infectious Diseases': 'cid', 'Nature Medicine': 'nature_medicine',
  'Annals of Internal Medicine': 'annals',
  'Cochrane': 'cochrane', 'UpToDate': 'uptodate', 'DynaMed': 'dynamed',
  'OpenEvidence': 'openevidence', 'Scopus': 'scopus', 'Embase': 'embase',
  'IDSA': 'idsa', 'ESC': 'esc', 'AHA/ACC': 'aha_acc', 'ATS': 'ats',
  'EASL': 'easl', 'ECIL': 'ecil', 'NCCN': 'nccn',
  'Surviving Sepsis': 'surviving_sepsis', 'COFEPRIS': 'cofepris',
}

describe('ninguna fuente canónica se queda fuera del catálogo', () => {
  it('el catálogo tiene tamaño de catálogo (si no, pasaría vacío)', () => {
    expect(entradas.length).toBeGreaterThanOrEqual(29)
  })

  it('las 29 del alcance canónico están', () => {
    const faltan = FUENTES_CANONICAS.filter(f => {
      const id = EN_EL_CATALOGO[f]
      return !id || !(id in CATALOGO_DE_EVIDENCIA)
    })
    expect(
      faltan,
      'fuentes que el alcance pide y el catálogo no conoce: el médico no puede leer «no se consultó» de algo que no existe',
    ).toEqual([])
  })

  it('y el mapa no nombra fuentes que el alcance no pide', () => {
    /* Al revés: si alguien añade una entrada aquí sin añadirla al censo, el mapa
       y el alcance se separan en silencio. */
    const sobran = Object.keys(EN_EL_CATALOGO).filter(f => !FUENTES_CANONICAS.includes(f))
    expect(sobran).toEqual([])
  })
})

describe('cada entrada dice por qué está donde está', () => {
  it('todas traen `porQue`, y no de adorno', () => {
    const mudas = entradas.filter(e => {
      const p = Array.isArray(e.porQue) ? e.porQue.join(' ') : String(e.porQue ?? '')
      return p.trim().length < 40
    })
    expect(mudas.map(e => e.id), 'entradas sin explicación de su estado').toEqual([])
  })

  it('lo que no puede operar declara qué decisión falta', () => {
    /**
     * Una fuente bloqueada sin `decisionPendiente` es una fuente que nadie puede
     * desbloquear: no se sabe a quién hay que pedirle qué.
     */
    const sinSalida = entradas
      .filter(e => !licenciaPermiteOperar(e.licencia))
      .filter(e => !e.decisionPendiente || String(e.decisionPendiente).trim().length < 10)
    expect(sinSalida.map(e => e.id)).toEqual([])
  })
})

describe('descubrir por índice NO es integrar con la editorial', () => {
  const EDITORIALES = ['nejm', 'jama', 'lancet', 'bmj', 'cid', 'nature_medicine', 'annals']

  it('ninguna editorial puede producir un `Source` por su cuenta', () => {
    /**
     * Sin `proveedorCanonico` no hay `Source`, sin `Source` no hay `Passage` y sin
     * `Passage` no hay afirmación respaldada. Es el modelo de tipos el que lo
     * impide, no una regla escrita — pero si alguien le pusiera el campo «para
     * que funcione», esto se pone rojo.
     */
    for (const id of EDITORIALES) {
      const e = CATALOGO_DE_EVIDENCIA[id as keyof typeof CATALOGO_DE_EVIDENCIA]
      expect(e, `${id} desapareció del catálogo`).toBeDefined()
      expect((e as { proveedorCanonico?: string }).proveedorCanonico, `${id} podría respaldar una cita sin contrato`).toBeUndefined()
      expect(licenciaPermiteOperar(e.licencia), `${id} figura como operable`).toBe(false)
    }
  })

  it('y su ficha dice, con todas las letras, que hoy sólo se descubren vía índice', () => {
    for (const id of EDITORIALES) {
      const e = CATALOGO_DE_EVIDENCIA[id as keyof typeof CATALOGO_DE_EVIDENCIA]
      const p = Array.isArray(e.porQue) ? e.porQue.join(' ') : String(e.porQue)
      expect(p, `${id} no declara que es descubrimiento vía PubMed`).toMatch(/PubMed|editorial/i)
    }
  })
})

describe('catalogar no es integrar', () => {
  it('hoy ninguna fuente está en LICENSED_OK', () => {
    /**
     * El propio catálogo lo dice en su comentario: «HOY NINGÚN PROVEEDOR ESTÁ
     * AQUÍ». El día que alguien mueva una a `LICENSED_OK` sin contrato, este caso
     * lo obliga a mirarlo — y a cambiar esta prueba a conciencia.
     */
    expect(entradas.filter(e => e.licencia === 'LICENSED_OK').map(e => e.id)).toEqual([])
  })

  it('las que sí operan son las abiertas, y son pocas', () => {
    const operables = entradas.filter(e => licenciaPermiteOperar(e.licencia)).map(e => e.id)
    expect(operables.length).toBeGreaterThan(0)
    expect(operables.length).toBeLessThan(entradas.length / 2)
  })
})
