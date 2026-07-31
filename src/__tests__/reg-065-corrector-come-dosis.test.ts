import { describe, it, expect } from 'vitest'
import { corregirTranscripcion, corregirNGramas } from '@/lib/expediente/medical-vocabulary'

/**
 * REG-065 — EL CORRECTOR SE COMÍA LA DOSIS.
 *
 * Medido en el corpus de 498 audios del Dr. (2026-07-30). Durante toda la
 * investigación se creyó un fallo del reconocedor: «Meropenem dos gramos» salía
 * como «Meropenem gramos», 6 de 6 veces, en las tres voces, incluso con la frase
 * palabra por palabra en el prompt.
 *
 * Al probar los TRES modelos por separado, los tres devolvían el «dos». El
 * reconocedor la oía perfectamente. **Nos la comíamos nosotros**, en el pase de
 * n-gramas, en cada dictado, en producción.
 *
 * El fusor existe para reunir fármacos que el reconocedor parte («em pagli
 * flozina» → empagliflozina). El fonético de «meropenemdos» casa con
 * «meropenem», así que fusionaba y la cifra desaparecía.
 */

describe('REG-065 · una CANTIDAD nunca se fusiona con lo de delante', () => {
  const dosis = [
    'Meropenem dos gramos cada ocho horas en infusión extendida.',
    'Ceftriaxona dos gramos al día.',
    'Vancomicina un gramo cada doce horas.',
    'Linezolid seiscientos miligramos.',
    'Amikacina quince miligramos por kilo.',
    'Propofol dos miligramos por kilo hora.',
    'Insulina diez unidades subcutáneas.',
    'Ceftazidima avibactam 2.5 gramos cada ocho horas.',
  ]

  it.each(dosis)('la dosis sobrevive intacta: %s', (frase) => {
    expect(corregirTranscripcion(frase).corregido).toBe(frase)
  })

  it('el caso exacto del corpus, con su control negativo', () => {
    // Sin la guarda, el pase 1 devolvía «Meropenem» y perdía el «dos».
    const r = corregirNGramas('Meropenem dos gramos cada ocho horas')
    expect(r.corregido).toContain('dos gramos')
    expect(r.cambios).toEqual([])
  })

  it('una cifra en dígitos tampoco se fusiona', () => {
    expect(corregirTranscripcion('Meropenem 2 gramos.').corregido).toBe('Meropenem 2 gramos.')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('REG-065 · pero el fusor SIGUE haciendo su trabajo', () => {
  // La guarda no puede desactivar la función: un fármaco partido tiene que
  // seguir reuniéndose, que es para lo que existe el pase.
  it.each([
    ['em pagli flozina', 'empagliflozina'],
    ['dapa gli flozina', 'dapagliflozina'],
    ['ator vastatina', 'atorvastatina'],
  ])('«%s» sigue uniéndose en «%s»', (partido, entero) => {
    expect(corregirTranscripcion(partido).corregido.toLowerCase()).toContain(entero)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('REG-065 · un término YA correcto no absorbe lo que sigue', () => {
  it('si la primera palabra ya es un término válido, no se fusiona', () => {
    // Un fármaco partido empieza por un FRAGMENTO («em», «pagli»), nunca por su
    // propio nombre completo. Si «Meropenem» ya está bien, unirlo a lo que sigue
    // sólo puede destruir información.
    expect(corregirNGramas('Meropenem extendida').cambios).toEqual([])
    expect(corregirNGramas('Vancomicina intravenosa').cambios).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('REG-065 · el daño NO era sólo del meropenem', () => {
  /**
   * Pregunta del Dr.: «¿eso pasa sólo con meropenem? porque TODOS los fármacos
   * se ajustan». Tenía razón.
   *
   * Barrido de 64 fármacos × 18 números = 1152 combinaciones: **131 se
   * destruían** antes de la guarda. Cualquier fármaco cuyo fonético absorbiera
   * el número perdía la dosis — vancomicina, ceftriaxona, linezolid…
   */
  const barrido = [
    'Vancomicina dos gramos.', 'Linezolid dos gramos.', 'Ceftriaxona ocho gramos.',
    'Daptomicina mil miligramos.', 'Cefepime dos gramos.', 'Ertapenem dos gramos.',
  ]
  it.each(barrido)('%s', (f) => {
    expect(corregirTranscripcion(f).corregido).toBe(f)
  })

  /** Y con terapia continua, que fue la otra pregunta. */
  const ckrt = [
    'PRISMA con dosis de treinta mililitros por kilo hora.',
    'CKRT dosis de efluente veinticinco mililitros por kilo hora.',
    'Citrato tres milimoles por litro.',
    'Reposición dos mil mililitros por hora.',
    'Meropenem dos gramos cada ocho horas con PRISMA.',
  ]
  it.each(ckrt)('%s', (f) => {
    expect(corregirTranscripcion(f).corregido).toBe(f)
  })
})

