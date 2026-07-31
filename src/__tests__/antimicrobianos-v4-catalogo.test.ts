/**
 * GOLDEN — catálogo V4 (dataset verificado del Dr.).
 *
 * Lo que estos casos protegen no es el contenido clínico —eso lo verificó él—
 * sino que el contenido **no cambie sin que nadie se entere** y que el motor no
 * conteste por los fármacos que todavía no tiene.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  FARMACOS, REGLAS_MOTOR, PENDIENTES_V3_1, HUELLA_DATASET, METADATA, CONTRATO_LLM,
  buscarFarmaco, candidatos, estaPendiente, reglasDuras,
} from '@/lib/antimicrobianos/v4/catalogo'

describe('El dataset verificado no cambia en silencio', () => {
  it('la huella del archivo es la que se selló', () => {
    // Si alguien edita una dosis, este caso se pone rojo antes que nada.
    const bytes = readFileSync('src/lib/antimicrobianos/v4/data/dosing-v3-verificado.json')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(HUELLA_DATASET)
  })

  it('trae los 49 fármacos, 12 reglas y 20 pendientes declarados', () => {
    expect(FARMACOS).toHaveLength(49)
    expect(REGLAS_MOTOR).toHaveLength(12)
    expect(PENDIENTES_V3_1).toHaveLength(20)
  })

  it('cada fármaco viaja con su nivel de verificación', () => {
    for (const f of FARMACOS) expect(f.verification_tier, f.drug).toBeTruthy()
  })

  it('sólo DOS fármacos están sin fuente, y son los que ya se sabe', () => {
    /**
     * Hueco real del dataset, encontrado por este caso: «Vancomycin PO» y
     * «Metronidazole» no traen `source_ids`. Los dos son B1 / CONDITIONAL, o sea
     * que ya estaban marcados como no-automáticos — pero sin fuente no se puede
     * mostrar de dónde sale la pauta, y eso es lo que separa este motor de una
     * tabla copiada.
     *
     * La lista se deja EXPLÍCITA en vez de relajar la comprobación: si mañana
     * aparece un tercero sin fuente, este caso se pone rojo. Un `length > 0`
     * relajado a `>= 0` habría dejado el hueco invisible para siempre.
     */
    const sinFuente = FARMACOS.filter(f => !f.source_ids || f.source_ids.length === 0).map(f => f.drug)
    expect(sinFuente.sort()).toEqual(['Metronidazole', 'Vancomycin PO'])
    // Y ninguno de los dos dosifica solo.
    for (const d of sinFuente) expect(FARMACOS.find(f => f.drug === d)!.auto_dose_status).not.toBe('READY')
  })

  it('el descargo y la nota de Sanford siguen ahí', () => {
    // «No afirmar validación cruzada con Sanford sin integración licenciada».
    expect(METADATA.sanford_note).toMatch(/NOT used|no licensed/i)
    expect(METADATA.important_disclaimer).toMatch(/not autonomous prescribing/i)
  })
})

describe('Lo que la IA tiene prohibido, escrito en el propio dataset', () => {
  it('inventar dosis y fusionar ficha con guía están prohibidos', () => {
    const prohibido = JSON.stringify(CONTRATO_LLM.llm_prohibited)
    expect(prohibido).toMatch(/Invent dose/)
    expect(prohibido).toMatch(/Merge label and guideline/)
    expect(prohibido).toMatch(/ESRD dose as CRRT/)
    expect(prohibido).toMatch(/Hide uncertainty/)
  })

  it('las reglas duras incluyen las que sostienen todo el diseño', () => {
    const ids = reglasDuras().map(r => r.id)
    expect(ids).toContain('RULE_SOURCE_SEPARATION')   // ficha y guía no se fusionan
    expect(ids).toContain('RULE_CRRT_NO_GENERIC')     // CrCl <10 no es sustituto de CRRT
    expect(ids).toContain('RULE_WEIGHT')              // sin peso no hay mg/kg
    expect(ids).toContain('RULE_HUMAN_OVERSIGHT')     // sin regla verificada, no hay dosis
  })
})

describe('Buscar un fármaco no es adivinarlo', () => {
  it('encuentra por nombre exacto', () => {
    expect(buscarFarmaco('Meropenem')?.drug).toBe('Meropenem')
    expect(buscarFarmaco('  cefiderocol ')?.drug).toBe('Cefiderocol')
  })

  it('pedir «Ampicillin» NO devuelve «Ampicillin-sulbactam»', () => {
    /**
     * Éste era un bug de verdad, y de los que no se ven: la búsqueda por
     * inclusión devolvía la combinación —otro espectro, otra dosis— cuando el
     * médico pedía el fármaco solo, que además está PENDIENTE de verificar. El
     * médico habría recibido una dosis sin nada en pantalla que dijera que es de
     * otro fármaco.
     */
    expect(buscarFarmaco('Ampicillin')).toBeNull()
    expect(candidatos('Ampicillin').map(f => f.drug)).toContain('Ampicillin-sulbactam')
    expect(buscarFarmaco('Ampicillin-sulbactam')?.drug).toBe('Ampicillin-sulbactam')
  })

  it('con DOS candidatos no elige: «vancomicina» son dos fármacos', () => {
    /**
     * Vancomicina IV y VO tienen indicaciones distintas —una es sistémica y la
     * otra es para C. difficile— y elegir por orden alfabético sería elegir por
     * azar. Devolver null obliga a precisar, que es lo correcto.
     */
    expect(candidatos('vancomycin').length).toBeGreaterThan(1)
    expect(buscarFarmaco('vancomycin')).toBeNull()
    expect(buscarFarmaco('Vancomycin PO')?.drug).toBe('Vancomycin PO')
  })

  it('lo que no está, no está', () => {
    expect(buscarFarmaco('cefalexina')).toBeNull()
    expect(buscarFarmaco('')).toBeNull()
  })
})

describe('Los que faltan se declaran, no se rellenan', () => {
  it('ampicilina y amoxi/clav están marcados como pendientes', () => {
    // Un motor que responde a todo y acierta casi siempre es peor que uno que
    // responde a menos y no falla: no hay forma de saber cuáles son las buenas.
    expect(estaPendiente('Ampicillin')).toBe(true)
    expect(estaPendiente('Amoxicillin-clavulanate')).toBe(true)
  })

  it('y ninguno de los pendientes está en el catálogo con una dosis inventada', () => {
    for (const p of PENDIENTES_V3_1) {
      const f = buscarFarmaco(p)
      // Si apareciera, sería una dosis que nadie verificó con aspecto de verificada.
      expect(f, `«${p}» está declarado pendiente y sin embargo tiene entrada`).toBeNull()
    }
  })

  it('un fármaco del catálogo NO se marca como pendiente', () => {
    expect(estaPendiente('Meropenem')).toBe(false)
  })
})
