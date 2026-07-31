/**
 * GOLDEN — léxico dinámico (etapas 2 y 3 del pipeline de dictado).
 *
 * Lo que se protege aquí es el **presupuesto**: el prompt del reconocedor admite
 * 224 tokens y lo que sobra se pierde en silencio. Un léxico que se pase de
 * largo no es un léxico más rico: es un léxico truncado por el sitio equivocado.
 */
import { describe, it, expect } from 'vitest'
import {
  construir, contextosActivos, criticosGlobales,
  CONTEXTOS_POR_MODULO, NOMBRES_ESPECIALIDAD, type ModuloDictado,
} from '@/lib/asr/lexicon'
import { LIMITE_TOKENS_PROMPT } from '@/lib/expediente/medical-vocabulary'
import crudo from '@/lib/asr/data/especialidades.json'

const ESPECIALIDADES_CRUDAS = (crudo as unknown as {
  specialties: Record<string, { critical_terms: string[]; high_priority_terms: string[]; normal_terms: string[] }>
}).specialties

const MODULOS: ModuloDictado[] = ['consulta', 'hospitalizacion', 'uci', 'urgencias', 'quirofano']

describe('El presupuesto de 224 tokens no se rebasa NUNCA', () => {
  it('en ningún módulo, sin contexto de paciente', () => {
    for (const m of MODULOS) {
      const l = construir({ modulo: m })
      expect(l.tokens, `${m}: ${l.tokens} tokens`).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
    }
  })

  it('ni con un paciente cargado de fármacos y problemas', () => {
    const l = construir({
      modulo: 'uci',
      medicamentos: Array.from({ length: 40 }, (_, i) => `farmaco-de-prueba-${i}`),
      problemas: Array.from({ length: 40 }, (_, i) => `problema-de-prueba-${i}`),
    })
    expect(l.tokens).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
  })

  it('lo que no cabe se cuenta: nunca se recorta en silencio', () => {
    const apretado = construir({ modulo: 'uci' }, 40)
    expect(apretado.descartados).toBeGreaterThan(0)
    expect(apretado.tokens).toBeLessThanOrEqual(40)
  })

  it('el presupuesto NO se queda a medias: siempre hay cola de espera', () => {
    /**
     * Este caso afirmaba antes `descartados === 0` en UCI con el presupuesto
     * completo, y ese cero era el SÍNTOMA, no la prueba de que todo cupiera:
     * significaba que se habían **acabado los candidatos** con 212 de 224
     * tokens. Las especialidades del núcleo de cuidados críticos son las más
     * flacas del CSV del Dr. (ventilación mecánica 3 términos, gasometría 2,
     * sedación 1) mientras imagenología tiene 59.
     *
     * Cada token sin usar es una palabra suya que el reconocedor no va a
     * esperar. Ahora el hueco se rellena con lo más crítico del resto y siempre
     * queda cola: si algún módulo vuelve a marcar cero, es que se quedó otra vez
     * sin vocabulario que ofrecer.
     */
    for (const m of ['consulta', 'hospitalizacion', 'uci', 'urgencias', 'quirofano'] as const) {
      const l = construir({ modulo: m })
      expect(l.descartados, `${m} agotó los candidatos`).toBeGreaterThan(0)
      expect(l.tokens, m).toBeGreaterThan(LIMITE_TOKENS_PROMPT - 12)
    }
  })

  it('el relleno va al FINAL: no le quita el sitio a este paciente', () => {
    const l = construir({ modulo: 'uci', medicamentos: ['tacrolimus'], problemas: ['nefropatia por BK'] })
    expect(l.terminos[0]).toBe('tacrolimus')
    expect(l.terminos[1]).toBe('nefropatia por BK')
  })

  it('con el tope de 4 contextos del Dr., una nota de UCI NO agota los 224 tokens', () => {
    /**
     * Dato para decidir, no un fallo: su `max_active_contexts: 4` es lo que
     * limita el vocabulario, no el presupuesto del reconocedor. Subir ese tope
     * es decisión suya, y este caso avisa el día que deje de ser cierto.
     */
    const l = construir({ modulo: 'uci' })
    expect(l.tokens).toBeLessThan(LIMITE_TOKENS_PROMPT)
    expect(l.terminos.length).toBeGreaterThan(50)
  })
})

describe('El orden del gasto', () => {
  it('los fármacos de ESTE paciente van primero', () => {
    const l = construir({ modulo: 'uci', medicamentos: ['meropenem', 'norepinefrina'] })
    expect(l.terminos.slice(0, 2)).toEqual(['meropenem', 'norepinefrina'])
  })

  it('después los problemas, después el vocabulario crítico', () => {
    const l = construir({ modulo: 'uci', medicamentos: ['meropenem'], problemas: ['choque séptico'] })
    expect(l.terminos[0]).toBe('meropenem')
    expect(l.terminos[1]).toBe('choque séptico')
    expect(l.terminos.length).toBeGreaterThan(2)
  })

  it('no se repite un término aunque venga por dos caminos', () => {
    const l = construir({ modulo: 'uci', medicamentos: ['PaO2'] })
    const veces = l.terminos.filter(t => t.toLowerCase() === 'pao2').length
    expect(veces).toBe(1)
  })
})

describe('Contextos activos', () => {
  it('como mucho los 4 que permite la estrategia del Dr.', () => {
    for (const m of MODULOS) {
      expect(contextosActivos({ modulo: m }).length, m).toBeLessThanOrEqual(4)
    }
  })

  it('lo que eligió el médico manda sobre lo que supone el módulo', () => {
    const c = contextosActivos({ modulo: 'consulta', especialidades: ['Nefrología'] })
    expect(c[0]).toBe('Nefrología')
  })

  it('una especialidad que no existe se ignora, no rompe', () => {
    const c = contextosActivos({ modulo: 'consulta', especialidades: ['Astrología'] })
    expect(c).not.toContain('Astrología')
    expect(c.length).toBeGreaterThan(0)
  })

  it('cada nombre de la tabla módulo→contexto existe en el mapa del Dr.', () => {
    // Un nombre mal escrito daría un léxico vacío sin avisar.
    for (const [modulo, nombres] of Object.entries(CONTEXTOS_POR_MODULO)) {
      for (const n of nombres) {
        expect(NOMBRES_ESPECIALIDAD, `${modulo} → «${n}»`).toContain(n)
      }
    }
  })
})

describe('El mapa del Dr. llegó entero', () => {
  it('79 especialidades', () => {
    expect(NOMBRES_ESPECIALIDAD).toHaveLength(79)
  })

  it('hay términos críticos globales y se incluyen', () => {
    const globales = criticosGlobales()
    expect(globales.length).toBeGreaterThan(0)
    const l = construir({ modulo: 'consulta' })
    expect(l.terminos).toContain(globales[0])
  })
})

describe('El léxico del Dr. está COMPLETO, no un esqueleto', () => {
  it('las 79 especialidades tienen términos', () => {
    /**
     * Regresión real: el archivo tenía la ESTRUCTURA del corpus —las 79
     * especialidades— pero sólo 35 términos, y **65 especialidades estaban
     * vacías**. El prompt es lo único que cambia lo que el reconocedor OYE, así
     * que dictar de nefrología, hematología o neonatología no sesgaba nada.
     * Su LEXICON_MEDICO.csv traía los 1 400 desde el principio.
     */
    const esp = ESPECIALIDADES_CRUDAS
    const vacias = Object.entries(esp)
      .filter(([, e]) => !e.critical_terms.length && !e.high_priority_terms.length && !e.normal_terms.length)
      .map(([k]) => k)
    expect(vacias, `especialidades sin un solo término: ${vacias.join(', ')}`).toEqual([])
    expect(Object.keys(esp)).toHaveLength(79)

    /**
     * 1 400 de su `LEXICON_MEDICO.csv` + 580 minados de las 6 000 FRASES del
     * corpus, que hasta entonces no habían aportado una sola palabra.
     *
     * Los minados salen literales de sus frases: siglas y unidades tal como él
     * las escribe (mcg/kg/min, ng/L, mOsm/kg, U/h, L/min/m2) y los términos
     * PROPIOS de cada especialidad —los que aparecen ahí y casi no aparecen en
     * las demás—, porque una palabra que sale en las 78 categorías no distingue
     * nada y gastaría presupuesto sin cambiar lo que el reconocedor espera.
     */
    const total = Object.values(esp).reduce(
      (n, e) => n + e.critical_terms.length + e.high_priority_terms.length + e.normal_terms.length, 0)
    expect(total).toBe(1980)
  })

  it('cada módulo produce un vocabulario DISTINTO', () => {
    // Si todos salieran iguales, el contexto no estaría haciendo nada.
    const prompts = (['consulta', 'hospitalizacion', 'uci', 'urgencias', 'quirofano'] as const)
      .map(m => construir({ modulo: m }).prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it('y ninguno se pasa del presupuesto que lee el reconocedor', () => {
    // Lo que se pasa de 224 tokens el modelo lo ignora EN SILENCIO: un prompt
    // más largo no es un prompt mejor, es uno truncado sin avisar.
    for (const m of ['consulta', 'hospitalizacion', 'uci', 'urgencias', 'quirofano'] as const) {
      const l = construir({ modulo: m })
      expect(l.tokens, m).toBeLessThanOrEqual(224)
      expect(l.terminos.length, m).toBeGreaterThan(30)
    }
  })

  it('lo del paciente entra ANTES que lo genérico', () => {
    const l = construir({ modulo: 'consulta', medicamentos: ['tacrolimus'], problemas: ['nefropatia por BK'] })
    expect(l.terminos[0]).toBe('tacrolimus')
    expect(l.terminos.slice(0, 2)).toContain('nefropatia por BK')
  })
})
