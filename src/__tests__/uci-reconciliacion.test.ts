import { describe, it, expect } from 'vitest'
import {
  reconciliar,
  soloDiscrepancias,
  resumenRevision,
  PARES_RECONCILIABLES,
} from '@/lib/uci/reconciliacion'

/**
 * Charter §24 — reconciliación dictado ↔ calculado.
 *
 * El caso estrella es el ejemplo literal del Dr., y es el criterio de
 * aceptación: dicta «driving pressure 20», el motor deriva 14 de Pplat 22 y
 * PEEP 8, y el sistema **no sobrescribe ninguno** — muestra los dos y pide
 * revisión.
 *
 * Datos 100 % sintéticos.
 */

describe('§24 · el ejemplo del Dr — driving pressure 20 vs 14 calculado', () => {
  const r = reconciliar('driving pressure', 20, 14, 'cmH2O')

  it('detecta la inconsistencia', () => {
    expect(r.veredicto).toBe('discrepan')
    expect(r.diferencia).toBe(6)
  })

  it('CONSERVA los dos valores con su origen — no elige ganador', () => {
    // Si el módulo eligiera, escondería la mitad de los casos: el dictado puede
    // venir mal transcrito, y el cálculo puede estar hecho con una Pplat vieja.
    expect(r.dictado).toBe(20)
    expect(r.calculado).toBe(14)
  })

  it('el mensaje dice los DOS números y pide revisión, sin sugerir cuál vale', () => {
    expect(r.mensaje).toContain('Inconsistencia detectada')
    expect(r.mensaje).toContain('20 cmH2O')
    expect(r.mensaje).toContain('14 cmH2O')
    expect(r.mensaje).toMatch(/no se sobrescribe/)
    // Ninguna palabra que insinúe cuál es correcto.
    expect(r.mensaje).not.toMatch(/correcto|erróneo|error del|debe ser/i)
  })

  it('NO devuelve un campo «valor bueno»', () => {
    // Congela el diseño: el tipo no tiene por dónde colar una elección.
    expect(Object.keys(r)).not.toContain('valor')
    expect(Object.keys(r)).not.toContain('ganador')
    expect(Object.keys(r)).not.toContain('correcto')
  })
})

describe('§24 · tolerancia — de redondeo, no clínica', () => {
  it('media unidad de diferencia CONCUERDA (el médico lee un entero)', () => {
    // 13.7 en el ventilador se dicta «catorce».
    expect(reconciliar('driving pressure', 14, 13.7, 'cmH2O').veredicto).toBe('concuerdan')
  })

  it('exactamente la tolerancia todavía concuerda', () => {
    expect(reconciliar('x', 14, 13.5, 'u').veredicto).toBe('concuerdan')
  })

  it('un pelo más ya discrepa', () => {
    expect(reconciliar('x', 14, 13.49, 'u').veredicto).toBe('discrepan')
  })

  it('la tolerancia por defecto es 0.5 — media unidad, no un umbral clínico', () => {
    expect(reconciliar('x', 1, 1, 'u').tolerancia).toBe(0.5)
  })

  it('una tolerancia MAYOR hay que pasarla explícita (sería decisión clínica)', () => {
    expect(reconciliar('x', 20, 14, 'u').veredicto).toBe('discrepan')
    expect(reconciliar('x', 20, 14, 'u', 10).veredicto).toBe('concuerdan')
  })
})

describe('§24 · nada que comparar ≠ todo bien', () => {
  it('sin dictado: incomparable, NO «concuerdan»', () => {
    // Decir que concuerdan cuando falta uno sería afirmar una verificación que
    // no ocurrió.
    const r = reconciliar('driving pressure', null, 14, 'cmH2O')
    expect(r.veredicto).toBe('incomparable')
    expect(r.motivoIncomparable).toBe('falta_dictado')
  })

  it('sin cálculo posible: incomparable, y lo DICE', () => {
    const r = reconciliar('driving pressure', 20, null, 'cmH2O')
    expect(r.veredicto).toBe('incomparable')
    expect(r.motivoIncomparable).toBe('falta_calculado')
    expect(r.mensaje).toMatch(/no se puede calcular/)
  })

  it('un valor no finito no se compara (NaN / Infinity)', () => {
    for (const malo of [NaN, Infinity, -Infinity]) {
      const r = reconciliar('x', malo, 14, 'u')
      expect(r.veredicto).toBe('incomparable')
      expect(r.motivoIncomparable).toBe('valor_no_finito')
    }
  })

  it('cero es un valor VÁLIDO, no un ausente', () => {
    // El error clásico: `if (!valor)` trata 0 como faltante. Un PEEP de 0 existe.
    const r = reconciliar('peep', 0, 0, 'cmH2O')
    expect(r.veredicto).toBe('concuerdan')
    expect(r.dictado).toBe(0)
  })

  it('los dos ausentes: incomparable, sin lanzar', () => {
    expect(reconciliar('x', null, null, 'u').veredicto).toBe('incomparable')
  })
})

describe('§24 · regla ANTIFATIGA (decisión ICU-Q4.4)', () => {
  const rs = [
    reconciliar('driving pressure', 20, 14, 'cmH2O'),   // discrepa
    reconciliar('presión arterial media', 70, 70, 'mmHg'),
    reconciliar('índice de Kirby (P/F)', 180, null, ''), // incomparable
  ]

  it('sólo se listan las DISCREPANCIAS, no todo lo revisado', () => {
    expect(soloDiscrepancias(rs)).toHaveLength(1)
    expect(soloDiscrepancias(rs)[0].campo).toBe('driving pressure')
  })

  it('el resumen es UNA línea al final, no una alerta por valor', () => {
    expect(resumenRevision(rs)).toBe('1 elemento requiere revisión.')
  })

  it('sin discrepancias NO hay aviso (nada de «0 elementos»)', () => {
    expect(resumenRevision([reconciliar('x', 5, 5, 'u')])).toBeNull()
  })

  it('el plural está bien escrito', () => {
    const dos = [reconciliar('a', 1, 9, 'u'), reconciliar('b', 2, 9, 'u')]
    expect(resumenRevision(dos)).toBe('2 elementos requieren revisión.')
  })
})

describe('§24 · el catálogo de pares no se inventa fórmulas', () => {
  it('cada par declara de qué se deriva, con qué fórmula y QUÉ MOTOR lo calcula', () => {
    // Reconciliar contra una fórmula improvisada aquí sería inventar el cálculo,
    // no verificarlo.
    for (const p of PARES_RECONCILIABLES) {
      expect(p.derivadoDe.length).toBeGreaterThan(0)
      expect(p.formula).not.toBe('')
      expect(p.motor).toMatch(/^src\/lib\/uci\/.+\.ts · \w+\(\)$/)
    }
  })

  it('incluye el driving pressure del ejemplo del charter', () => {
    const dp = PARES_RECONCILIABLES.find(p => p.campo === 'driving pressure')
    expect(dp?.formula).toBe('Pplat − PEEP')
    expect([...(dp?.derivadoDe ?? [])].sort()).toEqual(['peep', 'pplat'])
  })

  it('la lista es corta a propósito: sólo lo que un motor YA calcula', () => {
    expect(PARES_RECONCILIABLES.length).toBeLessThanOrEqual(5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§24 · el motor no puede AFIRMAR un dato que no existe', () => {
  it('sin dictado NI cálculo, dice que no hay nada que comparar', () => {
    // Encontrado mirando la PRIMERA pantalla real, con el paciente sin capturar
    // nada: el motor decía «no se dictó; sólo hay el valor calculado» cuando NO
    // HABÍA NINGUNO. Afirmaba la existencia de un dato inexistente.
    const r = reconciliar('driving pressure', null, null, 'cmH2O')
    expect(r.veredicto).toBe('incomparable')
    expect(r.motivoIncomparable).toBe('faltan_ambos')
    expect(r.mensaje).toBe('driving pressure: no se dictó ni se puede calcular todavía; no hay nada que comparar.')
    expect(r.mensaje).not.toMatch(/sólo hay/)
  })

  it('con cálculo pero sin dictado, sí hay un valor calculado y se dice', () => {
    const r = reconciliar('driving pressure', null, 14, 'cmH2O')
    expect(r.motivoIncomparable).toBe('falta_dictado')
    expect(r.mensaje).toMatch(/sólo hay el valor calculado/)
  })

  it('con dictado pero sin cálculo, al revés', () => {
    const r = reconciliar('driving pressure', 20, null, 'cmH2O')
    expect(r.motivoIncomparable).toBe('falta_calculado')
    expect(r.mensaje).toMatch(/sólo hay el dictado/)
  })

  it('undefined en ambos se trata igual que null', () => {
    expect(reconciliar('pam', undefined, undefined, 'mmHg').motivoIncomparable).toBe('faltan_ambos')
  })
})

