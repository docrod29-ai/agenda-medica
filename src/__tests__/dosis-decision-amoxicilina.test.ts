import { describe, it, expect } from 'vitest'
import { revisarDosis, buscarFarmaco } from '@/lib/seguridad/dosis'
import { calcularDosisPediatrica, FARMACOS_PED, tomasDiaDe } from '@/lib/expediente/pediatria'

/**
 * DECISIÓN CLÍNICA del médico dueño (2026-07-28) — REG-041 y REG-042.
 * Ver `docs/clinical-decisions/dosis-amoxicilina.md` para el razonamiento completo.
 *
 * No se eligió "1000" ni "1500": se cambió el MODELO. Un solo número no puede
 * distinguir "fuera del uso habitual" de "peligroso", y esa confusión es la que
 * hacía que una receta pediátrica correcta saliera marcada como sobredosis.
 *
 *   ≤ 1000 mg/toma          → verde, sin alerta
 *   1001–2000 mg/toma       → amarillo: "dosis alta, verifica indicación"
 *   > 2000 mg/toma          → rojo, hard stop
 *   ≤ 3000 mg/día habitual · > 4000 mg/día → hard stop
 */

const dosisDe = (nombre: string) => FARMACOS_PED.find(f => f.nombre === nombre)!

describe('Amoxicilina — tres niveles, no un solo techo', () => {
  it('1000 mg por toma (máximo habitual) no alerta', () => {
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 1000, tomasDia: 2 })
    expect(a.filter(x => x.severidad !== 'info')).toEqual([])
  })

  it('1575 mg c/12 h en un niño de 35 kg: AVISA, pero NO como sobredosis', () => {
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 1575, tomasDia: 2, pesoKg: 35 })
    // Era el caso que salía en rojo y no debía.
    expect(a.some(x => x.severidad === 'critica')).toBe(false)
    expect(a.some(x => x.codigo === 'dosis_alta_verificar')).toBe(true)
    // Y el aviso dice qué hacer, no solo que algo pasa.
    expect(a.find(x => x.codigo === 'dosis_alta_verificar')!.mensaje).toMatch(/indicaci[oó]n/i)
  })

  it('3150 mg/día (35 kg a 90 mg/kg/día) queda dentro del perfil de dosis alta', () => {
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 1575, tomasDia: 2, pesoKg: 35 })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario' && x.severidad === 'critica')).toBe(false)
  })

  it('2500 mg por toma SÍ es crítica (pasa del absoluto de 2000)', () => {
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 2500, tomasDia: 1 })
    expect(a.some(x => x.severidad === 'critica')).toBe(true)
  })

  it('4500 mg/día SÍ es crítica (pasa del absoluto de 4000)', () => {
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 1500, tomasDia: 3 })
    expect(a.some(x => x.severidad === 'critica')).toBe(true)
  })

  it('amoxicilina-clavulanato hereda los límites del componente amoxicilina', () => {
    for (const nombre of ['Amoxicilina-clavulanato', 'amoxicilina/clavulanato', 'Augmentin']) {
      expect(buscarFarmaco(nombre)?.nombre).toBe('Amoxicilina')
    }
    const a = revisarDosis({ farmaco: 'Amoxicilina-clavulanato', dosisMg: 1575, tomasDia: 2 })
    expect(a.some(x => x.severidad === 'critica')).toBe(false)
  })

  it('la nota del catálogo advierte de la formulación 14:1 (el clavulanato no se deduce)', () => {
    expect(buscarFarmaco('Amoxicilina')!.nota).toMatch(/14:1/)
  })

  it('el error de decimal se sigue cazando por encima del absoluto', () => {
    // 10 g: ~10× el habitual y muy por encima del absoluto.
    const a = revisarDosis({ farmaco: 'Amoxicilina', dosisMg: 10000, tomasDia: 1 })
    expect(a.some(x => x.severidad === 'critica')).toBe(true)
  })
})

describe('Redondeo: nunca por encima de un tope (REG-042)', () => {
  it('Metronidazol @66.7 kg ya no da 2000.1 contra un tope de 2000', () => {
    const f = dosisDe('Metronidazol')
    const d = calcularDosisPediatrica(f, 66.7, 60)!
    const tomas = tomasDiaDe(f)
    expect(d.porToma.max * tomas).toBeLessThanOrEqual(f.topeDia!)
    expect(d.porDia.max).toBeLessThanOrEqual(f.topeDia!)
  })

  it('Gentamicina neonatal @51.3 kg respeta el tope por kilo', () => {
    const f = dosisDe('Gentamicina neonatal (≤7 días)')
    const d = calcularDosisPediatrica(f, 51.3, 1)!
    expect(d.porDia.max).toBeLessThanOrEqual(f.topeMgKgDia! * 51.3)
  })

  it('el total del día es EXACTAMENTE la dosis por toma × las tomas', () => {
    // Si no, la receta dice una cosa y el total otra.
    for (const f of FARMACOS_PED) {
      for (const peso of [3.4, 12.7, 23.1, 35, 66.7]) {
        const d = calcularDosisPediatrica(f, peso, 60)
        if (!d || d.contraindicadoPorEdad || d.porToma.max <= 0) continue
        const tomas = tomasDiaDe(f)
        expect(Math.abs(d.porDia.max - d.porToma.max * tomas)).toBeLessThan(0.05)
      }
    }
  })

  it('no se redondea todo hacia abajo: lejos del tope se conserva el más cercano', () => {
    // Paracetamol 10-15 mg/kg, tope 1000: en un niño chico no hay techo cerca.
    const f = dosisDe('Paracetamol')
    const d = calcularDosisPediatrica(f, 12.34, 36)!
    expect(d.porToma.max).toBeCloseTo(Math.round(15 * 12.34 * 10) / 10, 5)
  })
})
