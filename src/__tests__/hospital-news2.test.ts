import { describe, it, expect } from 'vitest'
import { calcularNews2 , puntosSpo2Escala2, nivelDeSigno } from '@/lib/hospital/news2'
import { buscarMed } from '@/lib/hospital/medicamentos-catalogo'

describe('NEWS2 — early warning score', () => {
  it('signos normales → riesgo bajo (0)', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 72 })!
    expect(r.total).toBe(0)
    expect(r.riesgo).toBe('bajo')
  })

  it('paciente deteriorado → riesgo alto', () => {
    const r = calcularNews2({ fr: 26, spo2: 90, temp: 39.2, ta: '88/50', fc: 132 })!
    expect(r.total).toBeGreaterThanOrEqual(7)
    expect(r.riesgo).toBe('alto')
  })

  it('un solo parámetro en 3 → al menos riesgo medio', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 135 })!
    expect(r.riesgo).not.toBe('bajo')
  })

  it('sin signos → null', () => {
    expect(calcularNews2({})).toBeNull()
  })
})

describe('Catálogo de medicamentos — búsqueda', () => {
  it('encuentra por genérico', () => {
    expect(buscarMed('ceftri').some(m => /ceftriaxona/i.test(m.nombre))).toBe(true)
  })
  it('encuentra por marca', () => {
    expect(buscarMed('tazocin').some(m => /piperacilina/i.test(m.nombre))).toBe(true)
  })
  it('query vacío → sin resultados', () => {
    expect(buscarMed('')).toHaveLength(0)
  })
})

/**
 * Escala 2 de SpO₂ (objetivo 88–92%) — validado por el Dr, auditoría 2026-07.
 * SOLO se usa por indicación explícita, no por diagnóstico de EPOC.
 */
describe('NEWS2 Escala 2 de SpO₂', () => {
  it('SpO₂ 90% en escala 2 = 0 puntos (era 3 en escala 1)', () => {
    expect(puntosSpo2Escala2(90, false)).toBe(0)
    // en la escala 1 ese 90% daba 2
    const e1 = calcularNews2({ spo2: 90 })!
    expect(e1.detalle.find(d => d.param.startsWith('SpO₂'))!.puntos).toBe(3)
    const e2 = calcularNews2({ spo2: 90, escalaSpo2: 2 })!
    expect(e2.detalle.find(d => d.param.startsWith('SpO₂'))!.puntos).toBe(0)
  })
  it('el hipercápnico SOBRE-oxigenado puntúa (≥97% con O₂ = 3)', () => {
    expect(puntosSpo2Escala2(98, true)).toBe(3)
  })
  it('≥93% en aire ambiente sigue siendo 0', () => {
    expect(puntosSpo2Escala2(95, false)).toBe(0)
  })
  it('93–94% con O₂ = 1; 95–96% con O₂ = 2', () => {
    expect(puntosSpo2Escala2(94, true)).toBe(1)
    expect(puntosSpo2Escala2(96, true)).toBe(2)
  })
  it('hipoxemia franca puntúa igual: ≤83 = 3', () => {
    expect(puntosSpo2Escala2(82, false)).toBe(3)
    expect(puntosSpo2Escala2(85, false)).toBe(2)
    expect(puntosSpo2Escala2(87, false)).toBe(1)
  })
})

describe('El color de la tabla y el score dicen LO MISMO', () => {
  /**
   * La tabla de signos del episodio pintaba con umbrales escritos a mano
   * —`spo2 < 92`, `temp >= 38`, `fc > 100 || fc < 50`— mientras el score usaba
   * los del Royal College. Decían cosas distintas del mismo número **en la misma
   * pantalla**, y la contradicción se resuelve siempre igual: se cree lo que se
   * ve, no lo que hay que ir a buscar.
   *
   * Lo peor no era la SpO₂: era la temperatura. Una de 35 °C salía en NEGRO en
   * la tabla y NEWS2 le da TRES puntos — una hipotermia invisible justo en la
   * lista que se mira para decidir si escalar.
   */
  it('una hipotermia de 35 °C es crítica, no normal', () => {
    expect(nivelDeSigno('temp', 35)).toBe('critico')
    expect(nivelDeSigno('temp', 37.5)).toBe('normal')
  })

  it('una SpO₂ de 92 avisa: no es normal aunque no llegue a crítica', () => {
    expect(nivelDeSigno('spo2', 92)).toBe('aviso')
    expect(nivelDeSigno('spo2', 91)).toBe('critico')
    expect(nivelDeSigno('spo2', 96)).toBe('normal')
  })

  it('una bradicardia de 45 avisa; una taquicardia de 135 es crítica', () => {
    // La tabla las pintaba iguales, en rojo las dos.
    expect(nivelDeSigno('fc', 45)).toBe('aviso')
    expect(nivelDeSigno('fc', 135)).toBe('critico')
    expect(nivelDeSigno('fc', 80)).toBe('normal')
  })

  it('una sistólica de 88 es crítica', () => {
    expect(nivelDeSigno('sys', 88)).toBe('critico')
    expect(nivelDeSigno('sys', 130)).toBe('normal')
  })

  it('crítico es EXACTAMENTE el 3 del score, no una escala aparte', () => {
    /**
     * Éste es el que impide que las dos fuentes se separen otra vez: se recorre
     * el rango y se comprueba que el color coincida con los puntos que da el
     * motor. Si alguien mete un umbral propio en la interfaz, aquí se ve.
     */
    for (const v of [30, 34, 35, 36, 37, 38, 38.5, 39, 40]) {
      const pts = calcularNews2({ temp: v })?.detalle[0]?.puntos ?? 0
      const esperado = pts >= 3 ? 'critico' : pts >= 1 ? 'aviso' : 'normal'
      expect(nivelDeSigno('temp', v), `temp ${v} (${pts} pts)`).toBe(esperado)
    }
    for (const v of [30, 40, 45, 60, 95, 115, 135]) {
      const pts = calcularNews2({ fc: v })?.detalle[0]?.puntos ?? 0
      const esperado = pts >= 3 ? 'critico' : pts >= 1 ? 'aviso' : 'normal'
      expect(nivelDeSigno('fc', v), `fc ${v} (${pts} pts)`).toBe(esperado)
    }
  })

  it('un campo vacío no se pinta de nada', () => {
    // «Vacío no es 0»: pintar un signo que nadie midió afirma algo del paciente.
    for (const v of [undefined, null, '', '  ', NaN]) {
      expect(nivelDeSigno('spo2', v)).toBe('normal')
    }
  })
})
