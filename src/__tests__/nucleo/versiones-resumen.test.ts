import { describe, it, expect } from 'vitest'
import { resumirVersion } from '@/lib/expediente/versioning'

/**
 * El resumen es lo único que el médico ve de cada versión antes de restaurarla.
 * Si miente, restaura la equivocada y pierde el trabajo que quería recuperar.
 */
describe('resumirVersion', () => {
  it('distingue de un vistazo la versión completa de la que quedó a medias', () => {
    const completa = resumirVersion({
      secciones: [{ key: 'a', label: 'A', value: 'texto' }, { key: 'b', label: 'B', value: 'más' }],
      diagnosticos: [{ descripcion: 'Faringitis' }],
      medicamentos: [{ nombre: 'Amoxicilina' }],
    } as never)
    expect(completa).toBe('2 secciones · 1 diagnóstico · 1 medicamento')
  })

  it('no cuenta las secciones vacías o en blanco', () => {
    const r = resumirVersion({
      secciones: [{ key: 'a', label: 'A', value: '' }, { key: 'b', label: 'B', value: '   ' }, { key: 'c', label: 'C', value: 'x' }],
      diagnosticos: [], medicamentos: [],
    } as never)
    expect(r).toBe('1 sección')
  })

  it('singular y plural correctos: leer "1 diagnósticos" hace dudar del dato', () => {
    expect(resumirVersion({ secciones: [], diagnosticos: [{ descripcion: 'x' }], medicamentos: [] } as never))
      .toBe('1 diagnóstico')
    expect(resumirVersion({ secciones: [], diagnosticos: [{ descripcion: 'x' }, { descripcion: 'y' }], medicamentos: [] } as never))
      .toBe('2 diagnósticos')
  })

  it('una versión sin nada dice "vacía", no una cadena en blanco', () => {
    expect(resumirVersion({ secciones: [], diagnosticos: [], medicamentos: [] } as never)).toBe('vacía')
  })

  it('si solo había resumen, lo dice en vez de llamarla vacía', () => {
    expect(resumirVersion({ secciones: [], diagnosticos: [], medicamentos: [], resumenEjecutivo: 'algo' } as never))
      .toBe('solo resumen')
  })

  it('no revienta con campos ausentes (versiones viejas)', () => {
    expect(() => resumirVersion({} as never)).not.toThrow()
    expect(resumirVersion({} as never)).toBe('vacía')
  })
})
