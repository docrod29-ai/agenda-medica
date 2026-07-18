import { describe, it, expect } from 'vitest'
import { agruparPorRegion, parAntesDespues, diasEntre, REGIONES, type FotoClinica } from '@/lib/expediente/fotos-clinicas'

const f = (id: string, fecha: string, region: string): FotoClinica => ({ id, url: `u/${id}`, fecha, region })

describe('Fotografía clínica seriada — agrupación', () => {
  it('agrupa por región y ordena cada grupo de la más reciente a la más antigua', () => {
    const fotos = [
      f('1', '2026-01-10T10:00:00Z', 'Pie derecho'),
      f('2', '2026-03-10T10:00:00Z', 'Pie derecho'),
      f('3', '2026-02-01T10:00:00Z', 'Cara'),
    ]
    const g = agruparPorRegion(fotos)
    const pie = g.find(x => x.region === 'Pie derecho')!
    expect(pie.fotos.map(x => x.id)).toEqual(['2', '1'])   // reciente primero
    expect(g.map(x => x.region)).toContain('Cara')
  })
  it('las regiones vacías caen en "Otra"', () => {
    const g = agruparPorRegion([{ ...f('1', '2026-01-01T00:00:00Z', ''), region: '' }])
    expect(g[0].region).toBe('Otra')
  })
  it('ordena los grupos por la foto más reciente de cada región', () => {
    const g = agruparPorRegion([
      f('a', '2026-01-01T00:00:00Z', 'Cara'),
      f('b', '2026-06-01T00:00:00Z', 'Espalda'),
    ])
    expect(g[0].region).toBe('Espalda')
  })
})

describe('Comparación antes/después', () => {
  it('toma la MÁS ANTIGUA como antes y la MÁS RECIENTE como después', () => {
    const par = parAntesDespues([
      f('med', '2026-02-01T00:00:00Z', 'Úlcera'),
      f('vieja', '2026-01-01T00:00:00Z', 'Úlcera'),
      f('nueva', '2026-03-01T00:00:00Z', 'Úlcera'),
    ])
    expect(par?.antes.id).toBe('vieja')
    expect(par?.despues.id).toBe('nueva')
  })
  it('con una sola foto no hay comparación (necesita línea base + control)', () => {
    expect(parAntesDespues([f('1', '2026-01-01T00:00:00Z', 'Cara')])).toBeNull()
    expect(parAntesDespues([])).toBeNull()
  })
  it('calcula los días de evolución entre dos fotos', () => {
    const a = f('a', '2026-01-01T00:00:00Z', 'Herida quirúrgica')
    const b = f('b', '2026-01-31T00:00:00Z', 'Herida quirúrgica')
    expect(diasEntre(a, b)).toBe(30)
    expect(diasEntre(b, a)).toBe(30)   // simétrico
  })
})

describe('Catálogo de regiones anatómicas', () => {
  it('incluye las zonas clave de derm y de seguimiento de heridas', () => {
    expect(REGIONES).toContain('Cara')
    expect(REGIONES).toContain('Herida quirúrgica')
    expect(REGIONES).toContain('Úlcera')
    expect(REGIONES.length).toBeGreaterThan(20)
  })
})
