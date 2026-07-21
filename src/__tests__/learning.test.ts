import { describe, it, expect } from 'vitest'
import { categoriaDe, ordenarPorPreferencia, topCategorias } from '@/lib/learning'
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
