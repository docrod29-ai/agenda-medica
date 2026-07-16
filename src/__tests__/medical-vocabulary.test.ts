import { describe, it, expect } from 'vitest'
import {
  fonetEs, levenshtein,
  corregirTranscripcion,
  ABREVIATURAS, ANTIBIOTICOS, LABORATORIO,
} from '@/lib/expediente/medical-vocabulary'

describe('Catálogos cubren los términos pedidos', () => {
  it('Carbapenémicos clave', () => {
    expect(ANTIBIOTICOS).toContain('ertapenem')
    expect(ANTIBIOTICOS).toContain('imipenem')
    expect(ANTIBIOTICOS).toContain('meropenem')
    expect(ANTIBIOTICOS).toContain('doripenem')
  })
  it('VDRL y serologías de sífilis', () => {
    expect(LABORATORIO).toContain('VDRL')
    expect(LABORATORIO).toContain('RPR')
    expect(LABORATORIO).toContain('FTA-ABS')
    expect(ABREVIATURAS.VDRL).toBeDefined()
  })
  it('Carga viral, CD4, BLEE, MRSA y otras siglas críticas', () => {
    expect(LABORATORIO).toContain('CD4')
    expect(LABORATORIO).toContain('carga viral del VIH')
    expect(ABREVIATURAS.BLEE).toBe('beta-lactamasa de espectro extendido')
    expect(ABREVIATURAS.MRSA).toBeDefined()
  })
})

describe('Fonética del español', () => {
  it('cefalexina ≡ sefaleksina (c→s ante e/i, x→ks)', () => {
    expect(fonetEs('cefalexina')).toBe(fonetEs('sefaleksina'))
  })
  it('losartán ≡ losartán (acento se ignora)', () => {
    expect(fonetEs('losartán')).toBe(fonetEs('losartan'))
  })
  it('v ≡ b (vancomicina ≡ bancomicina)', () => {
    expect(fonetEs('vancomicina')).toBe(fonetEs('bancomicina'))
  })
})

describe('Levenshtein', () => {
  it('palabras iguales = 0', () => {
    expect(levenshtein('ertapenem', 'ertapenem')).toBe(0)
  })
  it('un cambio = 1', () => {
    expect(levenshtein('ertapenem', 'ertapanem')).toBe(1)
  })
})

describe('Corrector aplica vocabulario médico al transcribir', () => {
  it('corrige typos de antibióticos (ertapanem → ertapenem)', () => {
    const r = corregirTranscripcion('Indicamos ertapanem 1 gramo cada 24 horas')
    expect(r.corregido).toMatch(/ertapenem/)
    expect(r.cambios.length).toBeGreaterThan(0)
  })
  it('corrige imipenem mal escrito (imipinem)', () => {
    const r = corregirTranscripcion('Iniciamos imipinem cilastatina')
    expect(r.corregido).toMatch(/imipenem/)
  })
  it('mantiene VDRL como sigla', () => {
    const r = corregirTranscripcion('Solicitamos VDRL para descartar sífilis')
    expect(r.corregido).toMatch(/VDRL/)
  })
  it('reconoce abreviatura DM2 como sigla literal', () => {
    const r = corregirTranscripcion('Paciente con DM2 e HAS')
    expect(r.corregido).toMatch(/DM2/)
    expect(r.corregido).toMatch(/HAS/)
  })
  it('NO toca palabras comunes (mejora, presenta, refiere)', () => {
    const r = corregirTranscripcion('La paciente mejora y refiere alivio')
    expect(r.corregido).toBe('La paciente mejora y refiere alivio')
    expect(r.cambios).toHaveLength(0)
  })
  it('corrige ceftriaxona mal pronunciada (sefriaxona)', () => {
    const r = corregirTranscripcion('Dosis de sefriaxona 1 gramo')
    expect(r.corregido).toMatch(/ceftriaxona/i)
  })
})

// ════════════════════════════════════════════════════════════════
// REGRESIÓN — bug 2026-07: el corrector fuzzy destrozaba español correcto.
// Estos términos JAMÁS deben cambiar (seguridad clínica).
// ════════════════════════════════════════════════════════════════
describe('Seguridad del corrector: NO corromper español correcto (bug 2026-07)', () => {
  const NO_TOCAR = [
    'hipertensión arterial',      // se volvía "hypotension bacterial" (¡opuesto!)
    'hipotensión arterial',
    'tabaquismo',                 // se volvía "Tabacism"
    'sexo masculino',             // "masculino" → "masculinize"
    'refiere servicios propios',  // "servicios"→"cervifix", "propios"~"Prolia"
    'antecedentes heredofamiliares negados',
    'exploración física normal',
    'dolor abdominal difuso',
    'paciente femenina de 45 años',
  ]
  for (const frase of NO_TOCAR) {
    it(`no toca: "${frase}"`, () => {
      const r = corregirTranscripcion(frase)
      expect(r.corregido).toBe(frase)
    })
  }

  it('NUNCA cambia "hipertensión" por "hipotensión" ni al inglés', () => {
    const r = corregirTranscripcion('diagnóstico de hipertensión arterial sistémica')
    expect(r.corregido).toContain('hipertensión')
    expect(r.corregido.toLowerCase()).not.toContain('hypotension')
    expect(r.corregido.toLowerCase()).not.toContain('hipotension')
  })

  it('sigue corrigiendo fármacos legítimos vía diccionario curado', () => {
    expect(corregirTranscripcion('dosis de sefriaxona').corregido).toContain('ceftriaxona')
    expect(corregirTranscripcion('toma em pagli flozina').corregido).toContain('empagliflozina')
  })
})
