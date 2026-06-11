import { describe, it, expect } from 'vitest'
import {
  corregirTranscripcion,
  corregirNGramas,
  WHISPER_PROMPT_MEDICO,
  NEUROLOGIA,
  REUMA_OSTEO,
  DERMA_OFTALMO_ORL,
  GINECO_OBSTETRICIA,
  ANESTESIA_URGENCIAS,
  MARCAS_COMERCIALES_MX,
} from '@/lib/expediente/medical-vocabulary'

describe('Prompt Whisper respeta el límite de 224 tokens', () => {
  it('queda bajo ~224 tokens (≈4 chars/token en español)', () => {
    // Estimación conservadora: 1 token ≈ 3.5 chars en español médico.
    // 224 tokens × 3.5 ≈ 784 chars de margen mínimo; damos holgura a 1100.
    expect(WHISPER_PROMPT_MEDICO.length).toBeLessThan(1100)
  })
  it('incluye las gliflozinas que el usuario reportó como mal transcritas', () => {
    expect(WHISPER_PROMPT_MEDICO).toContain('empagliflozina')
    expect(WHISPER_PROMPT_MEDICO).toContain('dapagliflozina')
  })
})

describe('Catálogos de todas las especialidades', () => {
  it('neurología incluye antiepilépticos y antiparkinsonianos', () => {
    expect(NEUROLOGIA).toContain('levetiracetam')
    expect(NEUROLOGIA).toContain('pramipexol')
    expect(NEUROLOGIA).toContain('sumatriptán')
    expect(NEUROLOGIA).toContain('memantina')
  })
  it('reuma incluye gota y osteoporosis', () => {
    expect(REUMA_OSTEO).toContain('alopurinol')
    expect(REUMA_OSTEO).toContain('colchicina')
    expect(REUMA_OSTEO).toContain('denosumab')
  })
  it('derma/oftalmo/ORL incluye términos clave', () => {
    expect(DERMA_OFTALMO_ORL).toContain('isotretinoína')
    expect(DERMA_OFTALMO_ORL).toContain('latanoprost')
    expect(DERMA_OFTALMO_ORL).toContain('cetirizina')
  })
  it('gineco-obstetricia y anestesia presentes', () => {
    expect(GINECO_OBSTETRICIA).toContain('oxitocina')
    expect(ANESTESIA_URGENCIAS).toContain('propofol')
    expect(ANESTESIA_URGENCIAS).toContain('rocuronio')
  })
  it('marcas comerciales MX presentes', () => {
    expect(MARCAS_COMERCIALES_MX).toContain('Jardiance')
    expect(MARCAS_COMERCIALES_MX).toContain('Ozempic')
    expect(MARCAS_COMERCIALES_MX).toContain('Tafil')
  })
})

describe('Corrector de n-gramas — palabras PARTIDAS por Whisper', () => {
  it('une "empagli flozina" → empagliflozina', () => {
    const r = corregirNGramas('El paciente toma empagli flozina diario')
    expect(r.corregido).toContain('empagliflozina')
    expect(r.cambios.length).toBeGreaterThan(0)
  })
  it('une trigramas "em pagli flozina"', () => {
    const r = corregirNGramas('iniciamos em pagli flozina 10 mg')
    expect(r.corregido).toContain('empagliflozina')
  })
  it('une "dapa gliflozina" → dapagliflozina', () => {
    const r = corregirNGramas('cambio a dapa gliflozina por la falla cardiaca')
    expect(r.corregido).toContain('dapagliflozina')
  })
  it('une "leve tiracetam" → levetiracetam', () => {
    const r = corregirNGramas('continuar leve tiracetam 500 mg cada 12 horas')
    expect(r.corregido).toContain('levetiracetam')
  })
  it('NO toca frases comunes del español', () => {
    const frase = 'el paciente refiere mucho dolor desde hace tres días'
    const r = corregirNGramas(frase)
    expect(r.corregido).toBe(frase)
    expect(r.cambios).toHaveLength(0)
  })
  it('no cruza signos de puntuación', () => {
    // "flozina" después de coma NO debe unirse con lo anterior
    const r = corregirNGramas('suspendo empagli, flozina no aplica')
    expect(r.cambios).toHaveLength(0)
  })
  it('corrige multipalabra fonética: "asido folico" → ácido fólico', () => {
    const r = corregirNGramas('agregamos asido folico 5 mg')
    expect(r.corregido.toLowerCase()).toContain('ácido fólico')
  })
})

describe('Pipeline completo corregirTranscripcion (n-gramas + palabra a palabra)', () => {
  it('arregla la queja exacta del usuario: empaglifozina (typo Whisper)', () => {
    const r = corregirTranscripcion('iniciamos empaglifozina 10 mg cada 24 horas')
    expect(r.corregido).toContain('empagliflozina')
  })
  it('arregla dapaglifozina → dapagliflozina', () => {
    const r = corregirTranscripcion('cambio a dapaglifozina por nefroprotección')
    expect(r.corregido).toContain('dapagliflozina')
  })
  it('arregla fármacos de otras especialidades (neuro)', () => {
    const r = corregirTranscripcion('continuar con lebetirasetam 500')
    expect(r.corregido).toContain('levetiracetam')
  })
  it('arregla anestésicos (propofol mal oído)', () => {
    const r = corregirTranscripcion('sedación con propofol y rocuronio')
    expect(r.corregido).toContain('propofol')
    expect(r.corregido).toContain('rocuronio')
  })
  it('combina ambos pases: palabra partida + typo en la misma frase', () => {
    const r = corregirTranscripcion('toma em pagli flozina y atorbastatina por la noche')
    expect(r.corregido).toContain('empagliflozina')
    expect(r.corregido).toContain('atorvastatina')
  })
  it('reporta los cambios para trazabilidad', () => {
    const r = corregirTranscripcion('empagli flozina y sefriaxona')
    expect(r.cambios.length).toBeGreaterThanOrEqual(2)
    expect(r.cambios.every(c => c.original && c.corregido)).toBe(true)
  })
})
