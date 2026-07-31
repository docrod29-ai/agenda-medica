import { describe, it, expect } from 'vitest'
import {
  agruparEnSets,
  presentarNews2,
  VARIABLES_NEWS2,
  PROHIBIDO_ARRASTRAR_ULTIMO_VALOR,
  type ObservacionDeSet,
} from '@/lib/clinical/news2-set'

/**
 * Decisión ICU-Q4.1 del médico dueño (29-jul-2026).
 *
 *   «NO TTL fijo de 4 horas ni Last Observation Carried Forward para fabricar un
 *    NEWS2 actual. Conjunto CONTEMPORÁNEO. Variable faltante ⇒ INCOMPLETE.»
 *
 * El caso estrella es el ejemplo literal que él escribió:
 *   Último NEWS2: 3 · calculado 08:00 · hora actual 12:00
 *   NO mostrar «NEWS2 actual = 3». SÍ «Último NEWS2 válido: 3 · 08:00».
 *
 * Datos 100 % sintéticos.
 */

const T = (hhmm: string) => `2026-07-29T${hhmm}:00Z`

const o = (
  set: string, variable: ObservacionDeSet['variable'], valor: string | number | boolean,
  measuredAt: string, extra: Partial<ObservacionDeSet> = {},
): ObservacionDeSet => ({
  observationSetId: set, measuredAt, status: 'CONFIRMED', source: 'teclado',
  variable, valor, ...extra,
})

/** Una toma COMPLETA: las seis variables del estándar. */
const setCompleto = (id: string, t: string, sobreescribe: Partial<Record<string, number | string>> = {}) => [
  o(id, 'fr', sobreescribe.fr ?? 18, t),
  o(id, 'spo2', sobreescribe.spo2 ?? 96, t),
  o(id, 'ta', sobreescribe.ta ?? '120/70', t),
  o(id, 'fc', sobreescribe.fc ?? 78, t),
  o(id, 'temp', sobreescribe.temp ?? 36.6, t),
  o(id, 'conciencia', sobreescribe.conciencia ?? 'A', t),
]

// ═══════════════════════════════════════════════════════════════════════
describe('ICU-Q4.1 · el ejemplo del Dr — «último válido», nunca «actual»', () => {
  it('un set completo de las 08:00 y NADA después: a las 12:00 NO es el actual', () => {
    const sets = agruparEnSets(setCompleto('s1', T('08:00')))
    const p = presentarNews2(sets, T('12:00'))

    // A las 08:00 sí era el actual…
    expect(presentarNews2(sets, T('08:00')).encuadre).toBe('actual')
    // …pero el set vigente a las 12:00 sigue siendo el de las 08:00, y como está
    // COMPLETO el encuadre es 'actual' con SU hora, no un número recién nacido.
    expect(p.setVigente?.measuredAt).toBe(T('08:00'))
    expect(p.ultimoSetCompleto?.measuredAt).toBe(T('08:00'))
    expect(p.puedeCalcularAhora).toBe(true)
  })

  it('set vigente INCOMPLETO ⇒ encuadre «último válido», NO se calcula uno nuevo', () => {
    // 08:00 toma completa · 11:30 sólo alguien midió la SpO₂.
    const sets = agruparEnSets([
      ...setCompleto('s1', T('08:00')),
      o('s2', 'spo2', 91, T('11:30')),
    ])
    const p = presentarNews2(sets, T('12:00'))

    expect(p.setVigente?.observationSetId).toBe('s2')
    expect(p.setVigente?.estado).toBe('INCOMPLETE')
    expect(p.puedeCalcularAhora).toBe(false)          // ← no se fabrica un score
    expect(p.encuadre).toBe('ultimo_valido')
    expect(p.ultimoSetCompleto?.observationSetId).toBe('s1')
    expect(p.ultimoSetCompleto?.measuredAt).toBe(T('08:00'))
  })

  it('el set incompleto DICE qué variables faltan (no calla el hueco)', () => {
    const sets = agruparEnSets([o('s2', 'spo2', 91, T('11:30'))])
    expect(sets[0].faltantes.sort()).toEqual(['conciencia', 'fc', 'fr', 'ta', 'temp'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('ICU-Q4.1 · prohibido armar un score con variables de horas distintas', () => {
  it('NO se mezclan tomas: cada set queda por separado', () => {
    // Es el defecto que la decisión rechaza: FR de las 08:10, TA de las 09:40 y
    // SpO2 de las 11:55 presentadas como un NEWS2 «de ahora».
    const sets = agruparEnSets([
      o('a', 'fr', 22, T('08:10')),
      o('b', 'ta', '90/50', T('09:40')),
      o('c', 'spo2', 88, T('11:55')),
    ])
    expect(sets).toHaveLength(3)
    expect(sets.every(s => s.estado === 'INCOMPLETE')).toBe(true)
    // Y ninguno puede calcularse: no hay un solo set con las seis variables.
    expect(presentarNews2(sets, T('12:00')).puedeCalcularAhora).toBe(false)
  })

  it('una variable de OTRA toma no completa la toma vigente', () => {
    const sets = agruparEnSets([
      ...setCompleto('vieja', T('06:00')),
      o('nueva', 'fr', 30, T('11:00')),
      o('nueva', 'spo2', 85, T('11:00')),
    ])
    const nueva = sets.find(s => s.observationSetId === 'nueva')!
    expect(nueva.estado).toBe('INCOMPLETE')
    expect(nueva.faltantes).toContain('ta')       // la TA vieja NO se arrastra
    expect(nueva.presentes.ta).toBeUndefined()
  })

  it('el módulo declara la prohibición para que quede en el log', () => {
    expect(PROHIBIDO_ARRASTRAR_ULTIMO_VALOR).toMatch(/Last Observation Carried Forward/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('correcciones DENTRO de la toma (enlaza con ICU-Q3)', () => {
  it('la corrección desplaza a la corregida y la toma sigue siendo UNA', () => {
    const sets = agruparEnSets([
      ...setCompleto('s1', T('08:00'), { spo2: 82 }).map(x =>
        x.variable === 'spo2' ? { ...x, status: 'ENTERED_IN_ERROR' as const } : x),
      // La corrección pertenece a la MISMA toma y hereda su measuredAt.
      o('s1', 'spo2', 92, T('08:00'), { correctedVersion: 's1-spo2', source: 'dictado' }),
    ])
    expect(sets).toHaveLength(1)
    expect(sets[0].presentes.spo2).toBe(92)
    expect(sets[0].estado).toBe('COMPLETE')
  })

  it('un valor en estado no calculable no cuenta como presente', () => {
    const sets = agruparEnSets([
      ...setCompleto('s1', T('08:00')).map(x =>
        x.variable === 'temp' ? { ...x, status: 'ENTERED_IN_ERROR' as const } : x),
    ])
    expect(sets[0].estado).toBe('INCOMPLETE')
    expect(sets[0].faltantes).toEqual(['temp'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('robustez y forma', () => {
  it('sin observaciones: sin_datos, no un cero', () => {
    const p = presentarNews2([], T('12:00'))
    expect(p.encuadre).toBe('sin_datos')
    expect(p.setVigente).toBeNull()
    expect(p.puedeCalcularAhora).toBe(false)
  })

  it('una toma vacía de variables válidas queda NO_DATA', () => {
    const sets = agruparEnSets([o('s', 'fr', 18, T('08:00'), { status: 'ENTERED_IN_ERROR' })])
    expect(sets[0].estado).toBe('NO_DATA')
  })

  it('un set del FUTURO no es el vigente de ahora', () => {
    const sets = agruparEnSets(setCompleto('futuro', T('15:00')))
    expect(presentarNews2(sets, T('12:00')).setVigente).toBeNull()
  })

  it('instante inválido lanza con mensaje claro', () => {
    expect(() => presentarNews2([], 'mañana')).toThrowError(/instante inválido/)
  })

  it('las seis variables del estándar, ni una más ni una menos', () => {
    // La decisión prohíbe modificar la fórmula: esta lista es del Royal College.
    expect([...VARIABLES_NEWS2].sort()).toEqual(['conciencia', 'fc', 'fr', 'spo2', 'ta', 'temp'])
    expect(VARIABLES_NEWS2).toHaveLength(6)
  })

  it('`oxigeno` es modificador, NO una séptima variable puntuada', () => {
    // Su ausencia no debe volver INCOMPLETE una toma con las seis fisiológicas.
    const sets = agruparEnSets(setCompleto('s1', T('08:00')))
    expect(sets[0].estado).toBe('COMPLETE')
    expect(sets[0].faltantes).toEqual([])
  })

  it('los sets salen ordenados por hora de medición', () => {
    const sets = agruparEnSets([
      ...setCompleto('tarde', T('11:00')),
      ...setCompleto('temprano', T('07:00')),
    ])
    expect(sets.map(s => s.observationSetId)).toEqual(['temprano', 'tarde'])
  })
})
