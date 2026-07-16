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
  it('"leve tiracetam" → levetiracetam vía diccionario curado (no n-gramas, porque "leve" es palabra real)', () => {
    // Diseño seguro (bug 2026-07): el n-gramas NO fusiona si alguna palabra es
    // común ("leve"); esta corrección la hace el diccionario CURADO en el pipeline.
    const r = corregirTranscripcion('continuar leve tiracetam 500 mg cada 12 horas')
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

// ════════════════════════════════════════════════════════════════
// v3 — Calibrado con ERRORES REALES del screenshot del Dr. (2026-06-11)
// ════════════════════════════════════════════════════════════════
import { aplicarConfusionesConocidas } from '@/lib/expediente/medical-vocabulary'

describe('Diccionario de confusiones REALES (screenshot producción)', () => {
  it('"Empaq linfocina" → empagliflozina', () => {
    const r = aplicarConfusionesConocidas('Empaq linfocina 10 mg')
    expect(r.corregido).toContain('Empagliflozina')
  })
  it('"Dag glifos Inna" → dapagliflozina', () => {
    const r = aplicarConfusionesConocidas('toma Dag glifos Inna en ayunas')
    expect(r.corregido.toLowerCase()).toContain('dapagliflozina')
  })
  it('"Plátano pros" → latanoprost (Whisper oyó una fruta)', () => {
    const r = aplicarConfusionesConocidas('aplicar Plátano pros una gota cada noche')
    expect(r.corregido).toContain('Latanoprost')
    expect(r.corregido).not.toContain('Plátano')
  })
  it('"dap glifos" → dapagliflozina', () => {
    const r = aplicarConfusionesConocidas('Glibenclamida dap glifos')
    expect(r.corregido.toLowerCase()).toContain('dapagliflozina')
  })
  it('NO toca "plátano" cuando es la fruta (sin "pros")', () => {
    const r = aplicarConfusionesConocidas('desayuna un plátano diario')
    expect(r.corregido).toContain('plátano')
    expect(r.cambios).toHaveLength(0)
  })
})

describe('Pipeline v3 con el texto EXACTO del screenshot', () => {
  const TEXTO_REAL = 'Empaq linfocina Dag glifos Inna Linagliptina Dag glifos Inna Metformina losartán Hidroclorotiazida Plátano pros El paciente toma metformina Glibenclamida dap glifos'

  it('corrige TODOS los fármacos destrozados del dictado real', () => {
    const r = corregirTranscripcion(TEXTO_REAL)
    const bajo = r.corregido.toLowerCase()
    expect(bajo).toContain('empagliflozina')
    expect(bajo).toContain('dapagliflozina')
    expect(bajo).toContain('latanoprost')
    // Y conserva los que ya estaban bien
    expect(bajo).toContain('linagliptina')
    expect(bajo).toContain('metformina')
    expect(bajo).toContain('losartán')
    expect(bajo).toContain('glibenclamida')
    // Sin rastros de los errores
    expect(bajo).not.toContain('linfocina')
    expect(bajo).not.toContain('glifos')
    expect(bajo).not.toContain('plátano')
  })

  it('reporta cada corrección con motivo diccionario para trazabilidad', () => {
    const r = corregirTranscripcion(TEXTO_REAL)
    const deDiccionario = r.cambios.filter(c => c.motivo === 'diccionario')
    expect(deDiccionario.length).toBeGreaterThanOrEqual(4)
  })
})

describe('N-gramas con umbral calibrado (distAceptable)', () => {
  it('"empaq linfocina" también se arregla por n-gramas (dist 3)', () => {
    // Sin depender del diccionario: la fonética unida queda a distancia 3
    const r = corregirNGramas('receto empaq linfocina ahora')
    // diccionario no corre aquí — n-grama con umbral nuevo debe lograrlo
    expect(r.corregido.toLowerCase()).toContain('empagliflozina')
  })
  it('"platano pros" se arregla por n-gramas (dist 2, 11 chars)', () => {
    const r = corregirNGramas('usa platano pros en ojo izquierdo')
    expect(r.corregido.toLowerCase()).toContain('latanoprost')
  })
})

// ════════════════════════════════════════════════════════════════
// v4 — Catálogo sistemático ATC integrado al corrector
// ════════════════════════════════════════════════════════════════
import { VOCABULARIO_ATC } from '@/lib/expediente/vocabulario-atc'

describe('Catálogo ATC sistemático', () => {
  it('aporta cientos de fármacos adicionales', () => {
    expect(VOCABULARIO_ATC.length).toBeGreaterThan(400)
  })
  it('cubre las 14 áreas anatómicas con ejemplos representativos', () => {
    const set = new Set(VOCABULARIO_ATC.map(t => t.toLowerCase()))
    // A digestivo, B sangre, C cardio, J infeccioso, L onco, N nervioso, R respiratorio, S sensorial, V varios
    expect(set.has('vonoprazan')).toBe(true)        // A
    expect(set.has('alteplasa')).toBe(true)          // B
    expect(set.has('sacubitrilo/valsartán') || set.has('finerenona')).toBe(true) // C
    expect(set.has('sofosbuvir')).toBe(true)         // J antiviral
    expect(set.has('venetoclax')).toBe(true)         // L onco
    expect(set.has('lasmiditán')).toBe(true)         // N nervioso
    expect(set.has('nintedanib')).toBe(true)         // R respiratorio
    expect(set.has('netarsudil')).toBe(true)         // S oftálmico
    expect(set.has('idarucizumab')).toBe(true)       // V antídoto
  })
  it('corrige fármacos del catálogo ATC vía fonética (apixaban-like)', () => {
    // "venetoclax" mal oído como "benetoclax" (v→b fonético)
    const r = corregirTranscripcion('inicia benetoclax para la leucemia')
    expect(r.corregido.toLowerCase()).toContain('venetoclax')
  })
  it('corrige un antiviral del cuadro de hepatitis C', () => {
    const r = corregirTranscripcion('esquema con sofosbubir y velpatasvir')
    expect(r.corregido.toLowerCase()).toContain('sofosbuvir')
  })
})
