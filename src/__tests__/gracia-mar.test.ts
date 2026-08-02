/**
 * GOLDEN — el margen del MAR estaba escrito dos veces.
 *
 * `const GRACIA_MIN = 30` vivía en el MAR del paciente y otra vez en el turno
 * de enfermería. Las dos pantallas leen el mismo motor y las dos le dicen a la
 * misma enfermera si una dosis va atrasada: dos copias de un número operativo
 * son la garantía de que un día dirán cosas distintas del mismo paciente.
 *
 * Y siendo un valor de la UNIDAD —depende de los turnos y de la ronda—, estaba
 * clavado donde el hospital no puede tocarlo.
 */
import { describe, it, expect } from 'vitest'
import { graciaMar, GRACIA_MAR_DEFECTO } from '@/lib/uci/gracia'

describe('graciaMar', () => {
  it('sin nada declarado, el de fábrica', () => {
    expect(graciaMar()).toBe(GRACIA_MAR_DEFECTO)
    expect(graciaMar(null)).toBe(GRACIA_MAR_DEFECTO)
    expect(graciaMar(undefined)).toBe(GRACIA_MAR_DEFECTO)
  })

  it('el valor de fábrica es el que ya veía la unidad', () => {
    // Cambiarlo en silencio movería el umbral de «atrasada» de todo el MAR.
    expect(GRACIA_MAR_DEFECTO).toBe(30)
  })

  it('manda lo que declare la unidad', () => {
    expect(graciaMar(15)).toBe(15)
    expect(graciaMar(60)).toBe(60)
    expect(graciaMar(0)).toBe(0)   // sin margen: válido, es su decisión
  })

  it('un valor imposible NO revienta el MAR ni inventa un margen', () => {
    // La pantalla del MAR no puede caerse por una configuración mal escrita, y
    // tampoco puede aplicar un margen que nadie eligió.
    expect(graciaMar(-5)).toBe(GRACIA_MAR_DEFECTO)
    expect(graciaMar(NaN)).toBe(GRACIA_MAR_DEFECTO)
    expect(graciaMar(99_999)).toBe(GRACIA_MAR_DEFECTO)
    expect(graciaMar('mucho' as unknown as number)).toBe(GRACIA_MAR_DEFECTO)
  })
})
