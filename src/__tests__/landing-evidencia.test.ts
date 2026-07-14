import { describe, it, expect } from 'vitest'
import { EVIDENCIA_RECORDATORIOS, doiUrl, pubmedUrl } from '@/lib/landing-evidencia'

describe('landing-evidencia (fuentes públicas verificables)', () => {
  it('cada referencia tiene PMID numérico y DOI con prefijo 10.', () => {
    expect(EVIDENCIA_RECORDATORIOS.length).toBeGreaterThan(0)
    for (const r of EVIDENCIA_RECORDATORIOS) {
      expect(r.pmid).toMatch(/^\d+$/)
      expect(r.doi).toMatch(/^10\.\d{4,}\//)
      expect(r.autores.length).toBeGreaterThan(0)
      expect(r.titulo.length).toBeGreaterThan(0)
      expect(r.hallazgo.length).toBeGreaterThan(0)
    }
  })

  it('los PMID/DOI son exactamente los verificados en PubMed (no se alteran sin querer)', () => {
    const porPmid = Object.fromEntries(EVIDENCIA_RECORDATORIOS.map(r => [r.pmid, r.doi]))
    expect(porPmid['21933898']).toBe('10.1258/jtt.2011.110707')
    expect(porPmid['27798006']).toBe('10.1136/bmjopen-2016-012116')
    expect(porPmid['22475731']).toBe('10.1097/MAJ.0b013e31824997c6')
  })

  it('los helpers arman URLs canónicas de DOI y PubMed', () => {
    expect(doiUrl('10.1258/jtt.2011.110707')).toBe('https://doi.org/10.1258/jtt.2011.110707')
    expect(pubmedUrl('21933898')).toBe('https://pubmed.ncbi.nlm.nih.gov/21933898/')
  })
})
