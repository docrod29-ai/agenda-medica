import { describe, it, expect } from 'vitest'
import {
  CONTEXTOS_UCI,
  VOCABULARIO_POR_CONTEXTO,
  contextoDicho,
  perteneceAlContexto,
  contextosDe,
  contextoConcuerda,
  terminosMultiContexto,
} from '@/lib/uci/contexto-vocabulario'

/**
 * Charter §8 — vocabulario POR CONTEXTO.
 *
 * Las cuatro listas son las del médico dueño, palabra por palabra. El §10
 * prohíbe expresamente crear aliases clínicamente incorrectos, así que estos
 * casos también congelan que NADIE añada términos por su cuenta.
 *
 * Datos 100 % sintéticos.
 */

describe('§8 · el médico nombra el contexto y cambia el diccionario', () => {
  it.each([
    ['Respiratorio', 'respiratorio'],
    ['vamos con lo hemodinámico', 'hemodinamico'],
    ['Prisma', 'prisma'],
    ['ECMO', 'ecmo'],
  ] as const)('«%s» activa el contexto %s', (frase, esperado) => {
    expect(contextoDicho(frase)).toBe(esperado)
  })

  it('acepta cómo se dice de verdad, no sólo el nombre técnico', () => {
    // «Prisma» es la marca que el médico usa en voz alta por CKRT.
    expect(contextoDicho('ponle prisma')).toBe('prisma')
    expect(contextoDicho('el ventilador')).toBe('respiratorio')
  })

  it('sin contexto nombrado devuelve null — NO se adivina del contenido', () => {
    // Inferirlo de las palabras sería circular: el contexto existe para
    // desempatar palabras ambiguas, así que deducirlo de ellas lo anula.
    expect(contextoDicho('PEEP ocho, PIP veintiséis')).toBeNull()
    expect(contextoDicho('el paciente está estable')).toBeNull()
  })

  it('no se activa dentro de otra palabra', () => {
    expect(contextoDicho('prismatico')).toBeNull()
  })
})

describe('§8 · las listas son LAS DEL CHARTER, sin añadidos', () => {
  it.each([
    ['respiratorio', ['PEEP', 'PIP', 'Pplat', 'VT', 'FiO2', 'driving pressure', 'compliance', 'auto-PEEP', 'flow', 'trigger', 'I:E', 'PS']],
    ['hemodinamico', ['MAP', 'PAM', 'norepi', 'noradrenalina', 'vasopresina', 'dobutamina', 'milrinona', 'VTI', 'SV', 'CI', 'CRT', 'ScvO2']],
    ['prisma', ['CVVH', 'CVVHD', 'CVVHDF', 'Qb', 'dialysate', 'replacement', 'prefilter', 'postfilter', 'effluent', 'UF', 'citrate', 'calcium', 'filter', 'TMP']],
    ['ecmo', ['VV', 'VA', 'flow', 'RPM', 'sweep', 'FdO2', 'pre-oxygenator', 'post-oxygenator', 'delta P', 'recirculation', 'differential hypoxemia']],
  ] as const)('%s coincide EXACTO con la lista del Dr.', (contexto, esperada) => {
    // Si alguien añade, quita o "mejora" un término, este caso lo caza.
    expect([...VOCABULARIO_POR_CONTEXTO[contexto]]).toEqual([...esperada])
  })

  it('los cuatro contextos del charter, ni uno más', () => {
    expect([...CONTEXTOS_UCI]).toEqual(['respiratorio', 'hemodinamico', 'prisma', 'ecmo'])
  })
})

describe('§8 · acotar el contexto reduce los candidatos confundibles', () => {
  it('PEEP y PIP conviven en respiratorio (ahí SÍ compiten)', () => {
    expect(perteneceAlContexto('PEEP', 'respiratorio')).toBe(true)
    expect(perteneceAlContexto('PIP', 'respiratorio')).toBe(true)
  })

  it('sweep es de ECMO, no de respiratorio ← el par peligroso del §42', () => {
    expect(perteneceAlContexto('sweep', 'ecmo')).toBe(true)
    expect(perteneceAlContexto('sweep', 'respiratorio')).toBe(false)
  })

  it('VT es respiratorio y VTI hemodinámico — no compiten si hay contexto', () => {
    // Es uno de los pares adversariales críticos de la decisión Q1, capa B.
    expect(contextosDe('VT')).toEqual(['respiratorio'])
    expect(contextosDe('VTI')).toEqual(['hemodinamico'])
  })

  it('la comparación ignora acentos, guiones y mayúsculas', () => {
    expect(perteneceAlContexto('auto peep', 'respiratorio')).toBe(true)
    expect(perteneceAlContexto('PRE OXYGENATOR', 'ecmo')).toBe(true)
  })
})

describe('§8 · señal `contextoConcuerda` para el clasificador de confirmación', () => {
  it('término del contexto activo: concuerda', () => {
    expect(contextoConcuerda('PEEP', 'respiratorio')).toBe(true)
  })

  it('término de OTRO contexto: NO concuerda → hará preguntar', () => {
    // Si el contexto es renal y aparece un término de ECMO, no es inocente.
    expect(contextoConcuerda('sweep', 'respiratorio')).toBe(false)
    expect(contextoConcuerda('CVVHDF', 'ecmo')).toBe(false)
  })

  it('SIN contexto activo no se contradice nada (fail-open deliberado)', () => {
    // Devolver false haría preguntar por todo desde el primer término, que es
    // la fatiga que la decisión Q4 prohíbe. La ambigüedad se sigue cazando por
    // confianza, candidato cercano y plausibilidad.
    expect(contextoConcuerda('sweep', null)).toBe(true)
  })

  it('un término que no está en NINGÚN vocabulario tampoco contradice', () => {
    // Puede ser narrativa perfectamente legítima.
    expect(contextoConcuerda('abdomen blando', 'respiratorio')).toBe(true)
  })
})

describe('§8 · términos que siguen siendo ambiguos aunque haya contexto', () => {
  it('`flow` está en respiratorio Y en ECMO — se detecta solo', () => {
    const multi = terminosMultiContexto()
    const flow = multi.find(m => m.termino === 'flow')
    expect(flow, '`flow` debería aparecer como multi-contexto').toBeDefined()
    expect(flow!.contextos.sort()).toEqual(['ecmo', 'respiratorio'])
  })

  it('la lista se DERIVA del vocabulario, no se escribe a mano', () => {
    // Si mañana un término entra en dos listas, aparece aquí sin que nadie lo
    // recuerde. Una lista a mano se queda vieja en silencio.
    for (const { termino, contextos } of terminosMultiContexto()) {
      expect(contextos.length).toBeGreaterThan(1)
      expect(contextosDe(termino).sort()).toEqual([...contextos].sort())
    }
  })
})
