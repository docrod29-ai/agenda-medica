/**
 * GOLDEN — límites de dosis cargados por el médico.
 *
 * El software no aporta ninguna cifra: aporta que la entrada sea coherente y que
 * ninguna pase sin fuente.
 */
import { describe, it, expect } from 'vitest'
import {
  revisar, limitesDe, utilizable, avance, CUALQUIER_INDICACION, TIPOS_MAXIMO,
  type LimiteCargado,
} from '@/lib/antimicrobianos/v4/limites'

const base = (p: Partial<LimiteCargado> = {}): LimiteCargado => ({
  farmaco: 'Ceftriaxone', indicacion: 'meningitis',
  limites: { usualMaxPorDosis: 2000, usualMaxPorDia: 4000, tipoMaximo: 'CONTEXTUAL', unidad: 'mg' },
  fuente: 'IDSA 2026, tabla 1', cargadoPor: 'dr@ejemplo.mx',
  cargadoEn: '2026-07-31T06:00:00.000Z', huellaDataset: 'abc', ...p,
})

describe('Ningún límite sin fuente', () => {
  it('una entrada completa pasa', () => {
    expect(revisar(base())).toEqual([])
  })

  it('sin fuente no se guarda, y se dice por qué', () => {
    // Un tope sin procedencia no se puede rebatir, y una alerta que no se puede
    // rebatir se acaba ignorando.
    const p = revisar(base({ fuente: '  ' }))
    expect(p.join(' ')).toMatch(/fuente/)
    expect(p.join(' ')).toMatch(/no se puede rebatir/)
  })

  it('sin unidad tampoco: una cifra sin unidad no se compara con nada', () => {
    expect(revisar(base({ limites: { usualMaxPorDosis: 2000, tipoMaximo: 'EXPLICIT' } })).join(' '))
      .toMatch(/unidad/)
  })
})

describe('Coherencia interna: los topes van en orden', () => {
  it('el habitual no puede ser mayor que el del contexto', () => {
    /**
     * Casi siempre es un dedazo, y un dedazo aquí INVIERTE el significado de la
     * alerta: lo que tenía que avisar bloquea y lo que tenía que bloquear pasa.
     */
    const p = revisar(base({ limites: {
      usualMaxPorDosis: 4000, contextualMaxPorDosis: 2000, tipoMaximo: 'CONTEXTUAL', unidad: 'mg',
    } }))
    expect(p.join(' ')).toMatch(/no puede ser mayor/)
  })

  it('el del contexto no puede ser mayor que el absoluto', () => {
    expect(revisar(base({ limites: {
      contextualMaxPorDia: 9000, absolutoMaxPorDia: 8000, tipoMaximo: 'EXPLICIT', unidad: 'mg',
    } })).join(' ')).toMatch(/no puede ser mayor/)
  })

  it('la dosis única no puede pasar del total del día', () => {
    expect(revisar(base({ limites: {
      usualMaxPorDosis: 5000, usualMaxPorDia: 4000, tipoMaximo: 'EXPLICIT', unidad: 'mg',
    } })).join(' ')).toMatch(/no puede ser mayor/)
  })

  it('cifras cero o negativas se rechazan', () => {
    expect(revisar(base({ limites: { usualMaxPorDia: 0, tipoMaximo: 'EXPLICIT', unidad: 'mg' } })).length)
      .toBeGreaterThan(0)
  })

  it('sin ninguna cifra hay que declararlo como NONE, no dejarlo vacío', () => {
    expect(revisar(base({ limites: { tipoMaximo: 'EXPLICIT' } })).join(' ')).toMatch(/NONE/)
    expect(revisar(base({ limites: { tipoMaximo: 'NONE' } }))).toEqual([])
  })
})

describe('Lo específico gana sobre el comodín', () => {
  const cargados = [
    base({ indicacion: CUALQUIER_INDICACION, limites: { usualMaxPorDia: 4000, tipoMaximo: 'EXPLICIT', unidad: 'mg' } }),
    base({ indicacion: 'meningitis', limites: { usualMaxPorDia: 4000, contextualMaxPorDia: 4000, tipoMaximo: 'CONTEXTUAL', unidad: 'mg' } }),
  ]

  it('con indicación específica se usa la específica', () => {
    const e = limitesDe(cargados, 'Ceftriaxone', 'Meningitis', 'abc')
    expect(e?.porComodin).toBe(false)
    expect(e?.limite.limites.tipoMaximo).toBe('CONTEXTUAL')
  })

  it('sin ella se usa el comodín Y SE DICE', () => {
    // «El tope general de ceftriaxona» y «el tope en meningitis» no son la misma
    // afirmación: el médico tiene que saber cuál está viendo.
    const e = limitesDe(cargados, 'Ceftriaxone', 'neumonía', 'abc')
    expect(e?.porComodin).toBe(true)
  })

  it('un fármaco sin límites devuelve null', () => {
    expect(limitesDe(cargados, 'Meropenem', 'sepsis', 'abc')).toBeNull()
  })
})

describe('Un límite caducado no decide nada', () => {
  it('si el dataset cambió, el tope se marca caducado', () => {
    const e = limitesDe([base()], 'Ceftriaxone', 'meningitis', 'OTRA-HUELLA')
    expect(e?.caducado).toBe(true)
  })

  it('y NO se usa: mejor «no lo sé» que un tope de otra versión de los datos', () => {
    const e = limitesDe([base()], 'Ceftriaxone', 'meningitis', 'OTRA-HUELLA')
    expect(utilizable(e)).toBeUndefined()
    // Con la huella correcta sí se usa.
    expect(utilizable(limitesDe([base()], 'Ceftriaxone', 'meningitis', 'abc'))).toBeDefined()
  })
})

describe('Avance de la carga', () => {
  it('cuenta fármacos distintos, no entradas', () => {
    // Tres indicaciones del mismo fármaco son UN fármaco cubierto.
    const cargados = [base({ indicacion: 'a' }), base({ indicacion: 'b' }), base({ farmaco: 'Meropenem' })]
    expect(avance(cargados, 49)).toEqual({ conLimite: 2, total: 49, porcentaje: 4 })
  })

  it('sin nada cargado el avance es cero, no indefinido', () => {
    expect(avance([], 49).porcentaje).toBe(0)
  })

  it('los cinco tipos de máximo tienen etiqueta y ayuda', () => {
    expect(TIPOS_MAXIMO).toHaveLength(5)
    for (const t of TIPOS_MAXIMO) expect(t.ayuda.length).toBeGreaterThan(10)
  })
})

describe('Lo que se escribe en Firestore no lleva undefined', () => {
  it('los máximos vacíos se quitan, no se guardan como undefined', async () => {
    /**
     * Éste es el bug que dejaba muertos TODOS los botones de confirmar.
     * Firestore rechaza `undefined` y la aplicación no está configurada para
     * ignorarlo, así que cada clic lanzaba «Unsupported field value: undefined»
     * — y como la llamada iba con `void`, el error se perdía y el botón parecía
     * no hacer nada.
     */
    const { sinIndefinidos } = await import('@/lib/antimicrobianos/v4/persistencia')
    const limpio = sinIndefinidos({
      farmaco: 'Ceftriaxone', indicacion: 'meningitis',
      limites: {
        usualMaxPorDosis: 2000, usualMaxPorDia: undefined,
        contextualMaxPorDia: 4000, absolutoMaxPorDosis: undefined,
        tipoMaximo: 'CONTEXTUAL', unidad: 'mg',
      },
      fuente: 'x', cargadoPor: 'y', cargadoEn: 'z', huellaDataset: 'h',
    })
    expect(JSON.stringify(limpio)).not.toMatch(/undefined/)
    expect(Object.keys(limpio.limites)).toEqual(['usualMaxPorDosis', 'contextualMaxPorDia', 'tipoMaximo', 'unidad'])
    // Y no se lleva por delante lo que sí tiene valor, incluido el cero.
    expect(limpio.limites.usualMaxPorDosis).toBe(2000)
    expect(sinIndefinidos({ a: 0, b: null, c: false }))
      .toEqual({ a: 0, b: null, c: false })
  })
})
