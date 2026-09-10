import { describe, expect, it } from 'vitest'
import type { Diagnostico } from '@/types/expediente'
import {
  comoSugerenciaNoConfirmada,
  fusionarDiagnosticos,
} from '@/lib/expediente/fusionar-diagnosticos'

const dx = (
  descripcion: string,
  codigoCIE10?: string,
  tipo: Diagnostico['tipo'] = 'presuntivo',
): Diagnostico => ({ descripcion, codigoCIE10, tipo, estado: 'activo' })

describe('Consultorio GP6 — diagnóstico/CIE anti-inflación', () => {
  it('un diagnóstico automático no se vuelve definitivo, y su CIE entra como SUGERIDO (D-051)', () => {
    /**
     * Hasta el 10-sep-2026 el código se borraba aquí. El dueño pidió que la
     * sugerencia traiga el código y él sólo lo confirme: el código se queda,
     * marcado `codigoOrigen:'extraccion'`, y no se firma hasta confirmarse.
     * La certeza sigue igual: definitivo del modelo → presuntivo.
     */
    const out = fusionarDiagnosticos({
      previos: [],
      nuevos: [dx('Uretritis por Chlamydia trachomatis', 'A56.01', 'definitivo')],
    })

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      descripcion: 'Uretritis por Chlamydia trachomatis',
      tipo: 'presuntivo',
      codigoCIE10: 'A56.01',
      codigoOrigen: 'extraccion',
    })
  })

  it('sinónimos/variantes del mismo CIE se colapsan, y queda UN código sugerido', () => {
    const out = fusionarDiagnosticos({
      previos: [],
      nuevos: [
        dx('Infección rectal por Chlamydia trachomatis', 'A56.3'),
        dx('Proctitis por clamidia', 'A56.3'),
        dx('Proctitis por Chlamydia trachomatis confirmada', 'A56.3'),
      ],
    })

    expect(out).toHaveLength(1)
    expect(out[0].codigoCIE10).toBe('A56.3')
    expect(out[0].codigoOrigen).toBe('extraccion')
  })

  it('un diagnóstico capturado por el médico conserva su CIE y su certeza frente a una pasada IA equivalente', () => {
    const delMedico = dx('Proctitis por clamidia', 'A56.3', 'definitivo')
    const out = fusionarDiagnosticos({
      previos: [delMedico],
      nuevos: [dx('Infección rectal por Chlamydia trachomatis', 'A56.3', 'definitivo')],
      deLaIaAnterior: [dx('Uretritis no gonocócica', 'N34.1')],
    })

    expect(out).toEqual([delMedico])
  })

  it('cuarenta pasadas no inflan la lista ni acumulan CIE propuestos', () => {
    let lista: Diagnostico[] = []
    let previaDeLaIa: Diagnostico[] = []

    for (let i = 0; i < 40; i++) {
      const nuevos = [
        dx(i % 2 ? 'Proctitis por clamidia' : 'Infección rectal por Chlamydia trachomatis', 'A56.3'),
        dx(i % 3 ? 'Uretritis no gonocócica' : 'Uretritis no gonocócica persistente', 'N34.1'),
      ]
      lista = fusionarDiagnosticos({ previos: lista, nuevos, deLaIaAnterior: previaDeLaIa })
      previaDeLaIa = nuevos
    }

    expect(lista).toHaveLength(2)
    // Un código por diagnóstico, siempre como sugerido: cuarenta pasadas no lo confirman.
    expect(lista.map(d => d.codigoCIE10).sort()).toEqual(['A56.3', 'N34.1'])
    expect(lista.every(d => d.codigoOrigen === 'extraccion')).toBe(true)
  })

  it('la transformación de sugerencia conserva contenido clínico, pero no autoridad que nadie dio', () => {
    const sugerida = comoSugerenciaNoConfirmada(dx('Neumonía adquirida en comunidad', 'J18.9', 'definitivo'))
    expect(sugerida.descripcion).toBe('Neumonía adquirida en comunidad')
    expect(sugerida.estado).toBe('activo')
    expect(sugerida.tipo).toBe('presuntivo')
    // El código es contenido clínico: se conserva. La autoridad es el origen: sugerido.
    expect(sugerida.codigoCIE10).toBe('J18.9')
    expect(sugerida.codigoOrigen).toBe('extraccion')
  })
})
