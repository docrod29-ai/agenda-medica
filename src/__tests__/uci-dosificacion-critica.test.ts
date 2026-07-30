import { describe, it, expect } from 'vitest'
import {
  esquemaMeropenem, tieneAlgoritmo, ARC_UMBRAL_CRCL,
  FARMACOS_SIN_ALGORITMO, SIN_ALGORITMO, NO_ELIJO_COLUMNA,
  CRRT_NO_ES_FALLA_RENAL, RESISTENCIA_NO_SE_VENCE_CON_DOSIS,
  MODALIDADES_RENALES, CRITERIOS_ALTA_EXPOSICION,
} from '@/lib/uci/dosificacion-critica'

/**
 * Algoritmo de meropenem en el adulto crítico — entregado por el Dr. (2026-07-30).
 *
 * Su frase que organiza todo el motor:
 *   «Yo NO programaría meropenem simplemente como CrCl → dosis.»
 */

describe('la tabla renal del Dr., fila por fila', () => {
  const sinTrr = (crCl: number) => esquemaMeropenem({ crCl, modalidad: 'ninguna' })

  it('CrCl > 50 → 1 g c/8 h · alta exposición 2 g c/8 h', () => {
    const r = sinTrr(80)
    expect(r.esquema?.convencional).toBe('1 g IV c/8 h')
    expect(r.esquema?.altaExposicion).toBe('2 g IV c/8 h')
  })

  it('CrCl 26–50 → 1 g c/12 h', () => {
    expect(sinTrr(40).esquema?.convencional).toBe('1 g IV c/12 h')
  })

  it('CrCl 10–25 → 500 mg c/12 h', () => {
    expect(sinTrr(20).esquema?.convencional).toBe('500 mg IV c/12 h')
  })

  it('CrCl < 10 → 500 mg c/24 h', () => {
    expect(sinTrr(5).esquema?.convencional).toBe('500 mg IV c/24 h')
  })

  it('en UCI la infusión es de 3 h, no de 30 min', () => {
    expect(sinTrr(80).esquema?.infusion).toMatch(/3 h/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('CRRT NO es «falla renal» ← el error que este motor impide', () => {
  it('en CRRT NO se aplica la tabla renal', () => {
    // Un anúrico en CVVHD puede requerir VARIOS GRAMOS al día porque el filtro
    // elimina meropenem. Tratarlo como «CrCl < 10» lo infradosifica gravemente.
    const r = esquemaMeropenem({ crCl: 5, modalidad: 'crrt' })
    expect(r.esquema?.convencional).toBe('1 g IV c/8 h')
    expect(r.esquema?.convencional).not.toBe('500 mg IV c/24 h')
  })

  it('y lo dice en voz alta', () => {
    const r = esquemaMeropenem({ crCl: 5, modalidad: 'crrt' })
    expect(r.avisos.join(' ')).toContain('NO se aplica el ajuste de falla renal')
    expect(CRRT_NO_ES_FALLA_RENAL).toMatch(/infradosifica gravemente/)
  })

  it('declara que no hay dosis universal en CRRT', () => {
    const r = esquemaMeropenem({ crCl: 5, modalidad: 'crrt' })
    expect(r.avisos.join(' ')).toMatch(/flujo de efluente/)
  })

  it('PIRRT tampoco se maneja como CrCl < 10', () => {
    const r = esquemaMeropenem({ crCl: 5, modalidad: 'pirrt' })
    expect(r.esquema?.convencional).toMatch(/2–3 g\/día/)
    expect(r.avisos.join(' ')).toMatch(/tampoco se maneja como/)
  })

  it('hemodiálisis: después de la sesión', () => {
    const r = esquemaMeropenem({ crCl: 5, modalidad: 'ihd' })
    expect(r.esquema?.convencional).toMatch(/DESPUÉS de la sesión/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el motor NO elige la columna', () => {
  it('siempre devuelve LAS DOS y marca que elige el médico', () => {
    const r = esquemaMeropenem({ crCl: 80, modalidad: 'ninguna' })
    expect(r.esquema?.convencional).toBeTruthy()
    expect(r.esquema?.altaExposicion).toBeTruthy()
    expect(r.eligeElMedico).toBe(true)
  })

  it('lo declara con las palabras del Dr.', () => {
    expect(NO_ELIJO_COLUMNA).toMatch(/NO significa que todo paciente crítico deba recibir 6 g\/día/)
  })

  it('no existe ninguna función que recomiende una', async () => {
    const mod = await import('@/lib/uci/dosificacion-critica')
    expect(Object.keys(mod).filter(k => /recomendar|elegir|sugerir|mejor/i.test(k))).toEqual([])
  })

  it('lista los criterios de alta exposición presentes, sin decidir por ellos', () => {
    const r = esquemaMeropenem({
      crCl: 80, modalidad: 'ninguna', criterios: ['shock_septico', 'pseudomonas'],
    })
    expect(r.criteriosPresentes).toContain('shock_septico')
    expect(r.criteriosPresentes).toContain('pseudomonas')
    expect(r.eligeElMedico).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('sin el dato que decide la fila, NO se propone nada', () => {
  it('sin modalidad de reemplazo no hay esquema', () => {
    // Proponer una dosis sin saber si está en CRRT es el error grave.
    const r = esquemaMeropenem({ crCl: 5 })
    expect(r.esquema).toBeNull()
    expect(r.faltan.join(' ')).toMatch(/modalidad de reemplazo renal/)
  })

  it('sin CrCl y sin terapia de reemplazo, tampoco', () => {
    const r = esquemaMeropenem({ modalidad: 'ninguna' })
    expect(r.esquema).toBeNull()
    expect(r.faltan.join(' ')).toMatch(/CrCl/)
  })

  it('la MIC ausente se declara', () => {
    expect(esquemaMeropenem({ crCl: 80, modalidad: 'ninguna' }).avisos.join(' '))
      .toMatch(/No consta la MIC/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('ARC: se detecta del dato, no se pregunta dos veces', () => {
  it(`CrCl ≥ ${ARC_UMBRAL_CRCL} añade el criterio solo`, () => {
    expect(esquemaMeropenem({ crCl: 150, modalidad: 'ninguna' }).criteriosPresentes)
      .toContain('arc')
  })

  it('y avisa de que 1 g c/8 h en 30 min no basta', () => {
    expect(esquemaMeropenem({ crCl: 150, modalidad: 'ninguna' }).avisos.join(' '))
      .toMatch(/no confiar en 1 g c\/8 h en 30 min/)
  })

  it('por debajo del umbral no se inventa el criterio', () => {
    expect(esquemaMeropenem({ crCl: 100, modalidad: 'ninguna' }).criteriosPresentes)
      .not.toContain('arc')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('la resistencia no se vence con dosis, y los demás fármacos NO están', () => {
  it('el aviso del Dr. sale siempre', () => {
    expect(esquemaMeropenem({ crCl: 80, modalidad: 'ninguna' }).avisos)
      .toContain(RESISTENCIA_NO_SE_VENCE_CON_DOSIS)
  })

  it('SÓLO hay algoritmo de meropenem', () => {
    expect(tieneAlgoritmo('meropenem')).toBe(true)
    for (const f of FARMACOS_SIN_ALGORITMO) expect(tieneAlgoritmo(f)).toBe(false)
  })

  it('y la ausencia se DICE, no se calla', () => {
    // Copiar la lógica del meropenem a la vancomicina sería inventar una pauta.
    expect(SIN_ALGORITMO).toMatch(/NO se deduce de él/)
    expect(SIN_ALGORITMO).toMatch(/sería inventarla/)
  })

  it('los cuatro escenarios renales y los siete criterios, en su orden', () => {
    expect([...MODALIDADES_RENALES]).toEqual(['ninguna', 'ihd', 'crrt', 'pirrt'])
    expect(CRITERIOS_ALTA_EXPOSICION).toHaveLength(7)
  })
})
