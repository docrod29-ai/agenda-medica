/**
 * GOLDEN — las propuestas de topes.
 *
 * Aquí NO se comprueba que una dosis sea la correcta: eso lo firma el médico.
 * Se comprueba que la propuesta sea COHERENTE y que esté bien separada según de
 * dónde salió, que es lo que permite revisarla rápido.
 */
import { describe, it, expect } from 'vitest'
import { PROPUESTAS, SIN_CIFRA } from '@/lib/antimicrobianos/v4/propuesta-asistente'
import { PROPUESTOS, SIN_PROPONER } from '@/lib/antimicrobianos/v4/propuestos'
import { revisar } from '@/lib/antimicrobianos/v4/limites'
import { FARMACOS, buscarFarmaco } from '@/lib/antimicrobianos/v4/catalogo'

describe('Toda propuesta pasa la misma revisión que una carga a mano', () => {
  it('ninguna tiene los topes desordenados ni le falta unidad o fuente', () => {
    for (const p of PROPUESTAS) {
      const problemas = revisar({
        farmaco: p.farmaco, indicacion: p.indicacion, fuente: p.fuente,
        limites: {
          usualMaxPorDosis: p.usualMaxPorDosis, usualMaxPorDia: p.usualMaxPorDia,
          contextualMaxPorDosis: p.contextualMaxPorDosis, contextualMaxPorDia: p.contextualMaxPorDia,
          absolutoMaxPorDia: p.absolutoMaxPorDia,
          tipoMaximo: p.tipoMaximo, unidad: p.unidad,
        },
      })
      expect(problemas, `${p.farmaco}: ${problemas.join(' · ')}`).toEqual([])
    }
  })

  it('todas nombran su fuente y explican su aritmética', () => {
    // Sin la razón escrita, revisar una propuesta obliga a rehacer la cuenta.
    for (const p of PROPUESTAS) {
      expect(p.fuente.length, p.farmaco).toBeGreaterThan(10)
      expect(p.razon.length, p.farmaco).toBeGreaterThan(25)
    }
  })

  it('ninguna cita una tabla, una página o un PMID', () => {
    /**
     * Se nombra la FAMILIA de la fuente porque es lo que se puede afirmar sin
     * tener el documento delante. Una cita inventada es peor que ninguna: da por
     * comprobado lo que nadie comprobó.
     */
    for (const p of PROPUESTAS) {
      expect(p.fuente, p.farmaco).not.toMatch(/PMID|doi|\btabla\s*\d|\btable\s*\d|p\.\s*\d+/i)
    }
  })
})

describe('Cada fármaco propuesto existe en el catálogo verificado', () => {
  it('no se propone un tope para algo que el motor no conoce', () => {
    for (const p of PROPUESTAS) expect(buscarFarmaco(p.farmaco), p.farmaco).not.toBeNull()
    for (const s of SIN_CIFRA) expect(buscarFarmaco(s.farmaco), s.farmaco).not.toBeNull()
  })

  it('no hay fármacos repetidos entre las dos listas', () => {
    // Una propuesta con cifra Y en la lista de «sin cifra» sería contradictoria.
    const conCifra = new Set(PROPUESTAS.map(p => p.farmaco))
    for (const s of SIN_CIFRA) expect(conCifra.has(s.farmaco), s.farmaco).toBe(false)
  })
})

describe('Lo transcrito y lo propuesto van separados', () => {
  it('las dos listas no se pisan', () => {
    /**
     * Las transcritas salen de una frase escrita en el dataset; las propuestas
     * salen del etiquetado de uso corriente. No tienen el mismo respaldo, y
     * mezclarlas haría que las dos parecieran igual de firmes.
     */
    const transcritos = new Set(PROPUESTOS.map(p => p.farmaco))
    for (const p of PROPUESTAS) expect(transcritos.has(p.farmaco), p.farmaco).toBe(false)
  })

  it('entre las tres listas se cubre TODO el catálogo, sin huecos silenciosos', () => {
    // Un fármaco que no esté en ninguna lista sería uno del que nadie se acordó.
    const cubiertos = new Set([
      ...PROPUESTOS.map(p => p.farmaco),
      ...PROPUESTAS.map(p => p.farmaco),
      ...SIN_CIFRA.map(s => s.farmaco),
    ])
    const huerfanos = FARMACOS.map(f => f.drug).filter(d => !cubiertos.has(d))
    expect(huerfanos, `sin decidir: ${huerfanos.join(', ')}`).toEqual([])
  })
})

describe('Los que no llevan cifra dicen por qué', () => {
  it('cada uno trae su motivo, y es concreto', () => {
    for (const s of SIN_CIFRA) expect(s.porQue.length, s.farmaco).toBeGreaterThan(40)
  })

  it('los que van por kilo están todos', () => {
    // Poner un mg fijo a una amikacina es inventarle el peso al paciente.
    for (const f of ['Amikacin', 'Gentamicin', 'Tobramycin', 'Daptomycin', 'Plazomicin']) {
      expect(SIN_CIFRA.some(s => s.farmaco === f), f).toBe(true)
    }
  })

  it('los de unidad ambigua también', () => {
    for (const f of ['Colistimethate sodium (colistin)', 'Polymyxin B', 'Penicillin G potassium']) {
      expect(SIN_CIFRA.some(s => s.farmaco === f), f).toBe(true)
    }
  })

  it('daptomicina explica por qué un tope fijo la marcaría mal', () => {
    // Es el caso que motivó todo el motor: 10 mg/kg/día es dosis alta
    // respaldada, no sobredosis.
    expect(SIN_CIFRA.find(s => s.farmaco === 'Daptomycin')?.porQue).toMatch(/10 mg\/kg/)
  })

  it('y el extractor deja constancia de los que no pudo leer', () => {
    expect(SIN_PROPONER.length).toBeGreaterThan(0)
    for (const p of SIN_PROPONER) expect(p.porQue.length, p.farmaco).toBeGreaterThan(10)
  })
})
