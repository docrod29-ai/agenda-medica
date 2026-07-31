import { describe, it, expect } from 'vitest'
import {
  normalizar, palabras, distanciaPalabras, wer,
  evaluarFrase, reporteVoz, muestraSuficiente, NO_CORRIGE,
} from '@/lib/uci/benchmark-voz'

/**
 * Charter §41 — benchmark de voz.
 *
 * Lo que estos casos protegen: que la métrica que manda sea la EXACTITUD POR
 * TÉRMINO CLÍNICO y no el WER. Perder «el» y perder «PEEP» no valen lo mismo en
 * un pase de visita, y una métrica que los trate igual da un número tranquilizador
 * mientras el dato clínico se pierde.
 *
 * Datos 100 % sintéticos.
 */

const TERMINOS = ['peep', 'norepinefrina', 'fio2', 'lactato', 'presión plateau']

describe('§41 · normalizar para comparar, sin perder el término', () => {
  it('acentos, mayúsculas y puntuación no cuentan como error', () => {
    expect(normalizar('FiO₂ al 40%, presión plateau.')).toBe(normalizar('fio₂ al 40 presion plateau'))
  })

  it('conserva los números y los decimales', () => {
    expect(palabras('PEEP de 8.5')).toEqual(['peep', 'de', '8.5'])
  })

  it('no colapsa dos términos distintos en uno', () => {
    expect(normalizar('peep')).not.toBe(normalizar('pip'))
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§41 · el WER se mide sobre PALABRAS, no caracteres', () => {
  it('«peep» por «pip» es UN error, no dos', () => {
    expect(distanciaPalabras(['peep'], ['pip'])).toBe(1)
  })

  it('una transcripción perfecta da 0', () => {
    expect(wer('peep de ocho', 'PEEP de ocho.')).toBe(0)
  })

  it('una palabra mal de tres da un tercio', () => {
    expect(wer('peep de ocho', 'pip de ocho')).toBeCloseTo(1 / 3, 5)
  })

  it('texto de más penaliza: se puede pasar de 1', () => {
    expect(wer('peep', 'peep peep peep')).toBeGreaterThan(1)
  })

  it('gold vacío no divide entre cero', () => {
    expect(wer('', '')).toBe(0)
    expect(wer('', 'algo')).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§41 · LA métrica que manda es el término clínico', () => {
  it('un WER bajo puede esconder la pérdida del dato que importa', () => {
    // Ésta es la razón de existir del módulo: 1 palabra mal de 9 «suena bien»,
    // pero la que se perdió es la única que lleva información clínica.
    const gold = 'el paciente sigue con peep de ocho por la mañana'
    const hip = 'el paciente sigue con pip de ocho por la mañana'
    const r = evaluarFrase('f1', gold, hip, TERMINOS)
    expect(r.wer).toBeLessThan(0.2)          // parece excelente
    expect(r.perdidos).toEqual(['peep'])     // y perdió lo único que importaba
  })

  it('un término que NO está en el gold no cuenta ni a favor ni en contra', () => {
    const r = evaluarFrase('f2', 'peep de ocho', 'peep de ocho', TERMINOS)
    expect(r.terminos.find(t => t.termino === 'ecmo')).toBeUndefined()
    expect(r.terminos.filter(t => t.enGold).map(t => t.termino)).toEqual(['peep'])
  })

  it('inventar el término en la transcripción no lo hace acertado si no estaba', () => {
    // Si el gold no lo dijo, no hay nada que acertar.
    const r = evaluarFrase('f3', 'el paciente está estable', 'el paciente está con norepinefrina', TERMINOS)
    expect(r.perdidos).toEqual([])
    expect(r.terminos.every(t => !t.enGold)).toBe(true)
  })

  it('un término de dos palabras se evalúa completo', () => {
    const r = evaluarFrase('f4', 'presión plateau de veinte', 'presión de veinte', TERMINOS)
    expect(r.perdidos).toEqual(['presión plateau'])
  })

  it('acertar el término con otra puntuación sigue siendo acierto', () => {
    const r = evaluarFrase('f5', 'FiO2 al cuarenta', 'fio2, al cuarenta.', TERMINOS)
    expect(r.perdidos).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§41 · el reporte señala QUÉ arreglar', () => {
  const rs = [
    evaluarFrase('1', 'peep de ocho', 'pip de ocho', TERMINOS),
    evaluarFrase('2', 'peep de diez', 'peep de diez', TERMINOS),
    evaluarFrase('3', 'norepinefrina a punto cero seis', 'nor epinefrina a punto cero seis', TERMINOS),
    evaluarFrase('4', 'el paciente amaneció mejor', 'el paciente amaneció mejor', TERMINOS),
  ]
  const rep = reporteVoz(rs)

  it('la exactitud clínica es aciertos sobre términos evaluados', () => {
    // peep 1/2, norepinefrina 0/1 ⇒ 1 de 3.
    expect(rep.terminosEvaluados).toBe(3)
    expect(rep.terminosAcertados).toBe(1)
    expect(rep.exactitudClinica).toBeCloseTo(1 / 3, 5)
  })

  it('el ranking pone PRIMERO lo que más se pierde', () => {
    expect(rep.ranking[0].termino).toBe('norepinefrina')
    expect(rep.ranking[0].exactitud).toBe(0)
  })

  it('las frases SIN términos clínicos se señalan aparte', () => {
    // No aportan a la métrica que manda; contarlas como éxito la inflaría.
    expect(rep.frasesSinTerminos).toEqual(['4'])
  })

  it('sin ningún término evaluado, la exactitud es null, no 100 %', () => {
    const vacio = reporteVoz([evaluarFrase('x', 'buenos días', 'buenos días', TERMINOS)])
    expect(vacio.exactitudClinica).toBeNull()
    expect(vacio.terminosEvaluados).toBe(0)
  })

  it('sin frases: todo en cero, sin inventar', () => {
    expect(reporteVoz([]).frases).toBe(0)
    expect(reporteVoz([]).exactitudClinica).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§41 · el módulo MIDE, no corrige — y lo dice', () => {
  it('lo declara', () => {
    expect(NO_CORRIGE).toMatch(/MIDE, no corrige/)
    expect(NO_CORRIGE).toMatch(/decisión revisada/)
  })

  it('no existe ninguna función que aplique correcciones', async () => {
    const mod = await import('@/lib/uci/benchmark-voz')
    expect(Object.keys(mod).filter(k => /corregir|aplicar|autofix|entrenar/i.test(k))).toEqual([])
  })

  it('avisa cuando la muestra es demasiado chica para creerse el número', () => {
    const r = reporteVoz([evaluarFrase('1', 'peep de ocho', 'peep de ocho', TERMINOS)])
    const m = muestraSuficiente(r)
    expect(m.basta).toBe(false)
    expect(m.motivo).toMatch(/se mueve demasiado/)
  })

  it('NO fija una nota de aprobado: sólo dice si la muestra alcanza', () => {
    // Qué exactitud es «suficiente» es una decisión operativa que nadie ha tomado.
    const rs = Array.from({ length: 50 }, (_, i) =>
      evaluarFrase(String(i), 'peep de ocho', 'peep de ocho', TERMINOS))
    const m = muestraSuficiente(reporteVoz(rs))
    expect(m.basta).toBe(true)
    expect(m.motivo).not.toMatch(/aprob|suficientemente bueno|meta/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§41 · la puntuación no inventa errores, el número sí se respeta', () => {
  it('un punto final NO es una palabra distinta', () => {
    // Sin esto, el WER salía inflado por comas y puntos que nadie pronuncia.
    expect(palabras('de ocho.')).toEqual(['de', 'ocho'])
  })

  it('pero el decimal SÍ se conserva', () => {
    expect(palabras('peep 8.5')).toEqual(['peep', '8.5'])
    expect(palabras('lactato 1,8')).toEqual(['lactato', '1.8'])
  })

  it('y el rango entre números también', () => {
    expect(palabras('cada 6-8 horas')).toEqual(['cada', '6-8', 'horas'])
  })

  it('un guion suelto no se pega a la palabra', () => {
    expect(palabras('peep — de ocho')).toEqual(['peep', 'de', 'ocho'])
  })
})
