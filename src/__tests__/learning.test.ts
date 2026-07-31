import { describe, it, expect } from 'vitest'
import { categoriaDe, ordenarPorPreferencia, topCategorias, normalizarNombreMed, topRecetados, type MedRecetado } from '@/lib/learning'
import type { Sugerencia } from '@/lib/expediente/copiloto'

const s = (id: string, nivel: Sugerencia['nivel']): Sugerencia => ({ id, nivel, titulo: id, detalle: '' } as Sugerencia)

describe('Learning Engine', () => {
  it('categoriaDe toma el prefijo', () => {
    expect(categoriaDe('renal:metformina')).toBe('renal')
    expect(categoriaDe('calc:tfg')).toBe('calc')
    expect(categoriaDe('prevent')).toBe('prevent')
  })

  it('reordena NO críticas por preferencia, críticas siempre primero', () => {
    const sug = [s('calc:tfg', 'info'), s('meta:ldl', 'accion'), s('gesta:x', 'critico')]
    const r = ordenarPorPreferencia(sug, { meta: 5, calc: 1 })
    expect(r[0].nivel).toBe('critico')              // crítica pinneada
    expect(r[1].id).toBe('meta:ldl')                // la que más usa, arriba del resto
    expect(r[2].id).toBe('calc:tfg')
  })

  it('sin preferencias no cambia el orden del resto (estable)', () => {
    const sug = [s('a:1', 'info'), s('b:1', 'accion')]
    const r = ordenarPorPreferencia(sug, {})
    expect(r.map(x => x.id)).toEqual(['a:1', 'b:1'])
  })

  it('topCategorias descendente y sin ceros', () => {
    expect(topCategorias({ renal: 3, calc: 5, meta: 0 })).toEqual([{ categoria: 'calc', usos: 5 }, { categoria: 'renal', usos: 3 }])
  })
})

describe('Recetas frecuentes', () => {
  it('normalizarNombreMed agrupa variantes de escritura', () => {
    expect(normalizarNombreMed('Amoxicilina')).toBe('amoxicilina')
    expect(normalizarNombreMed('Amoxicilina/Clavulanato')).toBe('amoxicilina_clavulanato')
    expect(normalizarNombreMed('  Ácido  Fólico ')).toBe('acido_folico')
    expect(normalizarNombreMed('')).toBe('')
  })

  const m = (nombre: string, count: number, updatedAt: string): MedRecetado => ({
    nombre, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días', count, updatedAt,
  })

  it('topRecetados: desc por uso, luego más reciente, sin ceros', () => {
    const meds = {
      a: m('Paracetamol', 2, '2026-07-01'),
      b: m('Amoxicilina', 5, '2026-07-10'),
      c: m('Ibuprofeno', 0, '2026-07-11'),   // count 0 → fuera
      d: m('Loratadina', 2, '2026-07-20'),   // empata con Paracetamol → gana el más reciente
    }
    const top = topRecetados(meds, 8).map(x => x.nombre)
    expect(top).toEqual(['Amoxicilina', 'Loratadina', 'Paracetamol'])
  })

  it('topRecetados respeta el límite n', () => {
    const meds: Record<string, MedRecetado> = {}
    for (let i = 0; i < 12; i++) meds['k' + i] = m('Med ' + i, i + 1, '2026-07-01')
    expect(topRecetados(meds, 6)).toHaveLength(6)
  })

  it('topRecetados tolera vacío', () => {
    expect(topRecetados({}, 8)).toEqual([])
  })
})
