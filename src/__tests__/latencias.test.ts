/**
 * GOLDEN — el promedio esconde justo lo que duele.
 *
 * Cien notas de 4 s y cinco de 90 s dan un promedio de 8 s, que suena bien,
 * mientras cinco médicos miraron una pantalla parada minuto y medio delante de
 * su paciente. Lo que se protege aquí es que el p95 los vea.
 */
import { describe, it, expect } from 'vitest'
import { percentil, porFeature, porModelo, msLegible } from '@/lib/observabilidad/latencias'

describe('percentil', () => {
  it('sin datos NO devuelve cero: devuelve «no hay medición»', () => {
    // Cero y «no medido» son cosas distintas y tienen que distinguirse en la
    // pantalla: un cero se lee como «instantáneo».
    expect(percentil([], 0.5)).toBeNull()
  })

  it('con un solo dato, ese dato', () => {
    expect(percentil([1200], 0.95)).toBe(1200)
  })

  it('interpola entre los dos vecinos', () => {
    expect(percentil([0, 10], 0.5)).toBe(5)
    expect(percentil([0, 100, 200, 300], 0.5)).toBe(150)
  })

  it('los extremos son el mínimo y el máximo', () => {
    const v = [1, 2, 3, 4, 5]
    expect(percentil(v, 0)).toBe(1)
    expect(percentil(v, 1)).toBe(5)
  })
})

describe('porFeature', () => {
  const muestras = [
    ...Array.from({ length: 100 }, () => ({ feature: 'nota', latenciaMs: 4000 })),
    ...Array.from({ length: 5 }, () => ({ feature: 'nota', latenciaMs: 90_000 })),
  ]

  it('la cola larga la ven los percentiles altos, no el promedio', () => {
    const [r] = porFeature(muestras)
    const promedio = muestras.reduce((a, m) => a + m.latenciaMs, 0) / muestras.length
    expect(Math.round(promedio)).toBeLessThan(10_000)   // el promedio «suena bien»
    expect(r.p50).toBe(4000)
    // Con 5 lentas de 105 (4.8%) el p95 todavía cae en la zona rápida — es
    // exactamente por qué se muestran TRES percentiles y el máximo, y no uno:
    // un solo número siempre deja fuera una forma de ir mal.
    expect(r.p95).toBe(4000)
    expect(r.p99).toBeGreaterThan(60_000)
    expect(r.max).toBe(90_000)
  })

  it('cuando las lentas pasan del 5 %, el p95 las ve', () => {
    const r = porFeature([
      ...Array.from({ length: 90 }, () => ({ feature: 'nota', latenciaMs: 4000 })),
      ...Array.from({ length: 10 }, () => ({ feature: 'nota', latenciaMs: 90_000 })),
    ])[0]
    expect(r.p95).toBeGreaterThan(60_000)
  })

  it('cuenta los fallos y su fracción', () => {
    const r = porFeature([
      { feature: 'nota', latenciaMs: 1000 },
      { feature: 'nota', latenciaMs: 1000, fallo: true },
    ])[0]
    expect(r.fallos).toBe(1)
    expect(r.tasaFallo).toBe(0.5)
  })

  it('una latencia de 0 o negativa NO cuenta como instantánea', () => {
    // Es «no se midió». Meterla en la lista tira los percentiles hacia abajo y
    // el tablero diría que todo va rapidísimo.
    const r = porFeature([
      { feature: 'x', latenciaMs: 0 },
      { feature: 'x', latenciaMs: 2000 },
    ])[0]
    expect(r.n).toBe(1)
    expect(r.p50).toBe(2000)
  })

  it('arriba lo que peor se porta', () => {
    const r = porFeature([
      { feature: 'rapida', latenciaMs: 100 },
      { feature: 'lenta', latenciaMs: 30_000 },
    ])
    expect(r[0].clave).toBe('lenta')
  })

  it('separa por modelo, que es donde se ve un proveedor degradado', () => {
    const r = porModelo([
      { feature: 'nota', modelo: 'opus', latenciaMs: 20_000 },
      { feature: 'nota', modelo: 'haiku', latenciaMs: 800 },
    ])
    expect(r.map(x => x.clave)).toEqual(['opus', 'haiku'])
  })
})

describe('msLegible', () => {
  it('habla como habla la gente', () => {
    expect(msLegible(null)).toBe('—')
    expect(msLegible(340)).toBe('340 ms')
    expect(msLegible(4200)).toBe('4.2 s')
    expect(msLegible(95_000)).toBe('1 min 35 s')
  })
})
