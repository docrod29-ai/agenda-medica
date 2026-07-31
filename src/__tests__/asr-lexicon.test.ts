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
    // Con presupuesto de sobra no sobra nada que contar…
    expect(construir({ modulo: 'uci' }).descartados).toBe(0)
    // …pero en cuanto aprieta, el recorte se declara.
    const apretado = construir({ modulo: 'uci' }, 40)
    expect(apretado.descartados).toBeGreaterThan(0)
    expect(apretado.tokens).toBeLessThanOrEqual(40)
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
