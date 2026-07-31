import { describe, it, expect } from 'vitest'
import {
  construirBrief,
  METRICAS_BRIEF,
  SISTEMAS_BRIEF,
  metricasSinDireccion,
  direccionesSinFuente,
  PENDIENTES_NO_DISPONIBLES,
} from '@/lib/uci/morning-brief'

/**
 * Charter §30 — Morning Brief.
 *
 * La regla que atraviesa todo el bloque:
 *   «**Todas las frases deben vincularse a datos reales.**»
 *
 * Por eso lo que estos casos protegen no es tanto lo que el brief dice, sino lo
 * que se NIEGA a decir: un veredicto sin dirección declarada y un «pendiente»
 * que nadie ordenó.
 *
 * Datos 100 % sintéticos.
 */

describe('§30 · el delta es un hecho y se muestra como en el ejemplo', () => {
  const b = construirBrief([{ clave: 'ne', de: 0.18, a: 0.06 }], 12)

  it('el texto tiene el formato del charter', () => {
    expect(b.cambios[0].texto).toBe('Norepinefrina 0.18 → 0.06 µg/kg/min')
  })

  it('conserva los dos extremos y el delta', () => {
    expect(b.cambios[0].de).toBe(0.18)
    expect(b.cambios[0].a).toBe(0.06)
    expect(b.cambios[0].delta).toBeCloseTo(-0.12, 5)
  })

  it('la ventana se declara', () => {
    expect(b.ventanaHoras).toBe(12)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · «mejoró/empeoró» SÓLO con dirección declarada', () => {
  it('bajar la norepinefrina MEJORA la hemodinamia (dirección declarada)', () => {
    const b = construirBrief([{ clave: 'ne', de: 0.18, a: 0.06 }], 12)
    expect(b.cambios[0].veredicto).toBe('mejoro')
    expect(b.mejoraron).toContain('hemodinamia')
  })

  it('subirla EMPEORA', () => {
    const b = construirBrief([{ clave: 'ne', de: 0.06, a: 0.18 }], 12)
    expect(b.cambios[0].veredicto).toBe('empeoro')
    expect(b.empeoraron).toContain('hemodinamia')
  })

  it('la creatinina que SUBE no recibe veredicto ← la frontera del módulo', () => {
    // Que suba es un hecho. Llamarlo «empeoró la función renal» ya es saber
    // medicina, y esa dirección NO está declarada.
    const b = construirBrief([{ clave: 'creatinina', de: 1.5, a: 2.4 }], 12)
    expect(b.cambios[0].veredicto).toBe('sin_veredicto')
    expect(b.empeoraron).not.toContain('funcion_renal')
    expect(b.sinVeredicto).toContain('funcion_renal')
  })

  it('el delta SÍ se muestra aunque no haya veredicto', () => {
    // No emitir juicio no es esconder el dato.
    const b = construirBrief([{ clave: 'creatinina', de: 1.5, a: 2.4 }], 12)
    expect(b.cambios[0].texto).toBe('Creatinina 1.5 → 2.4 mg/dL')
    expect(b.cambios[0].delta).toBeCloseTo(0.9, 5)
  })

  it('dice POR QUÉ no hay veredicto', () => {
    const b = construirBrief([{ clave: 'balance', de: 0.5, a: 2.3 }], 12)
    expect(b.cambios[0].motivoSinVeredicto).toMatch(/no está declarada/)
  })

  it('el balance positivo NO se marca como empeoramiento', () => {
    // En choque distributivo la reanimación ES el tratamiento. Depende de la
    // fase, y eso lo sabe el médico, no el módulo.
    const b = construirBrief([{ clave: 'balance', de: 0.5, a: 2.3 }], 12)
    expect(b.empeoraron).toEqual([])
  })

  it('sin cambio no es ni mejoría ni empeoramiento', () => {
    const b = construirBrief([{ clave: 'ne', de: 0.1, a: 0.1 }], 12)
    expect(b.cambios[0].veredicto).toBe('sin_cambio')
    expect(b.mejoraron).toEqual([])
    expect(b.empeoraron).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · toda dirección declarada CITA su razón', () => {
  it('ninguna dirección se afirma sin fuente', () => {
    // Sin esto, un «menor es mejor» entraría como opinión disfrazada de dato.
    expect(direccionesSinFuente()).toEqual([])
  })

  it('las métricas sin dirección están declaradas como tales', () => {
    const claves = metricasSinDireccion().map(m => m.clave).sort()
    expect(claves).toEqual(['balance', 'creatinina', 'diuresis', 'lactato', 'vexus'])
  })

  it('cada métrica pertenece a un sistema conocido', () => {
    for (const m of METRICAS_BRIEF) {
      expect(SISTEMAS_BRIEF).toContain(m.sistema)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · «PENDIENTE» no se inventa', () => {
  const b = construirBrief([{ clave: 'ne', de: 0.18, a: 0.06 }], 12)

  it('la lista va VACÍA y la ausencia se declara', () => {
    expect(b.pendientes).toEqual([])
    expect(b.pendientesNoDisponibles).toBe(true)
  })

  it('el mensaje explica por qué está vacía', () => {
    // Un espacio en blanco se lee como «no hay nada pendiente», que es una
    // afirmación clínica que nadie hizo.
    expect(PENDIENTES_NO_DISPONIBLES).toMatch(/metas diarias u órdenes abiertas/)
    expect(PENDIENTES_NO_DISPONIBLES).toMatch(/No se sugieren/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · varias métricas y varios sistemas', () => {
  const b = construirBrief([
    { clave: 'ne', de: 0.18, a: 0.06 },        // hemodinamia · mejoró
    { clave: 'fio2', de: 60, a: 40 },          // oxigenación · mejoró
    { clave: 'peep', de: 12, a: 8 },           // ventilación · mejoró
    { clave: 'creatinina', de: 1.5, a: 2.4 },  // sin veredicto
    { clave: 'vexus', de: 1, a: 3 },           // sin veredicto
  ], 12)

  it('agrupa por sistema sin repetir', () => {
    expect(b.mejoraron.sort()).toEqual(['hemodinamia', 'oxigenacion', 'ventilacion'])
    expect(new Set(b.mejoraron).size).toBe(b.mejoraron.length)
  })

  it('los sin veredicto se listan aparte, no se pierden', () => {
    expect(b.sinVeredicto.sort()).toEqual(['congestion', 'funcion_renal'])
  })

  it('los cinco cambios están todos presentes', () => {
    expect(b.cambios).toHaveLength(5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · robustez', () => {
  it('una métrica desconocida se ignora, no rompe el brief', () => {
    const b = construirBrief([{ clave: 'inventada', de: 1, a: 2 }, { clave: 'ne', de: 0.2, a: 0.1 }], 12)
    expect(b.cambios).toHaveLength(1)
    expect(b.cambios[0].clave).toBe('ne')
  })

  it('valores no finitos se descartan', () => {
    const b = construirBrief([{ clave: 'ne', de: NaN, a: 0.1 }], 12)
    expect(b.cambios).toEqual([])
  })

  it('sin datos: brief vacío, sin veredictos inventados', () => {
    const b = construirBrief([], 12)
    expect(b.cambios).toEqual([])
    expect(b.mejoraron).toEqual([])
    expect(b.empeoraron).toEqual([])
  })

  it('una ventana no positiva LANZA', () => {
    expect(() => construirBrief([], 0)).toThrowError(/positivo/)
    expect(() => construirBrief([], -12)).toThrowError(/positivo/)
  })

  it('no elige la ventana ni lee la serie: recibe los extremos', () => {
    // Elegir «el valor de hace 12 horas» es la regla de vigencia que ya resuelve
    // observacion-version.ts; duplicarla aquí las dejaría divergir.
    const b = construirBrief([{ clave: 'ne', de: 1, a: 2 }], 6)
    expect(b.ventanaHoras).toBe(6)
  })
})
