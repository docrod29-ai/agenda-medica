import { describe, it, expect } from 'vitest'
import {
  DOMINIOS_META,
  evaluarMeta,
  evaluarMetas,
  pendientesDelBrief,
  sinMedicion,
  dominiosSinMeta,
  SIN_METAS_FIJADAS,
  type MetaDiaria,
} from '@/lib/uci/metas-diarias'

/**
 * Charter §35 — metas diarias.
 *
 * La regla que organiza todo:
 *   «El copiloto compara datos contra objetivos definidos. **No inventar
 *    objetivos.**»
 *
 * Datos 100 % sintéticos. Los objetivos de estos fixtures son números de prueba
 * fijados por un «médico» ficticio: NO pretenden ser recomendaciones clínicas.
 */

const meta = (extra: Partial<MetaDiaria> & Pick<MetaDiaria, 'dominio' | 'objetivo'>): MetaDiaria => ({
  id: 'm1',
  fijadaPor: 'med-ficticio',
  fijadaEn: '2026-07-30T08:00:00Z',
  ...extra,
})

describe('§35 · comparar contra el objetivo QUE FIJÓ EL MÉDICO', () => {
  const map = meta({
    dominio: 'map',
    objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 65, unidad: 'mmHg' },
  })

  it('dentro del objetivo: cumplida', () => {
    const e = evaluarMeta(map, 72)
    expect(e.estado).toBe('cumplida')
    expect(e.mensaje).toContain('medido 72 mmHg')
  })

  it('fuera del objetivo: no cumplida, y lo dice', () => {
    const e = evaluarMeta(map, 58)
    expect(e.estado).toBe('no_cumplida')
    expect(e.mensaje).toMatch(/fuera de objetivo/)
  })

  it('el rango se evalúa por los dos extremos, inclusive', () => {
    const rass = meta({ dominio: 'rass', objetivo: { tipo: 'rango', min: -2, max: 0 } })
    expect(evaluarMeta(rass, -2).estado).toBe('cumplida')
    expect(evaluarMeta(rass, 0).estado).toBe('cumplida')
    expect(evaluarMeta(rass, -3).estado).toBe('no_cumplida')
    expect(evaluarMeta(rass, 1).estado).toBe('no_cumplida')
  })

  it('«como mucho» funciona al revés', () => {
    const bal = meta({
      dominio: 'balance_hidrico',
      objetivo: { tipo: 'umbral', direccion: 'como_mucho', valor: 1, unidad: 'L' },
    })
    expect(evaluarMeta(bal, 0.4).estado).toBe('cumplida')
    expect(evaluarMeta(bal, 2.3).estado).toBe('no_cumplida')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§35 · SIN MEDICIÓN no es cumplida NI incumplida', () => {
  const map = meta({
    dominio: 'map',
    objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 65, unidad: 'mmHg' },
  })

  it('sin dato se declara como tal', () => {
    // Decir «cumplida» sería inventar; decir «no cumplida» acusaría de un fallo
    // de tratamiento a un hueco de documentación.
    const e = evaluarMeta(map, undefined)
    expect(e.estado).toBe('sin_dato')
    expect(e.mensaje).toMatch(/sin medición/)
  })

  it('un valor no finito tampoco cuenta como medición', () => {
    expect(evaluarMeta(map, NaN).estado).toBe('sin_dato')
    expect(evaluarMeta(map, Infinity).estado).toBe('sin_dato')
  })

  it('CERO sí es una medición válida', () => {
    const bal = meta({
      dominio: 'balance_hidrico',
      objetivo: { tipo: 'umbral', direccion: 'como_mucho', valor: 1, unidad: 'L' },
    })
    expect(evaluarMeta(bal, 0).estado).toBe('cumplida')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§35 · las tareas se marcan hechas, no se miden', () => {
  const cvc = meta({
    dominio: 'dispositivos',
    objetivo: { tipo: 'tarea', descripcion: 'Reevaluar necesidad del CVC' },
  })

  it('sin completar: pendiente', () => {
    expect(evaluarMeta(cvc).estado).toBe('pendiente')
    expect(evaluarMeta(cvc).mensaje).toMatch(/pendiente/)
  })

  it('completada: cumplida, con la descripción del médico', () => {
    const hecha = { ...cvc, completadaPor: 'med', completadaEn: '2026-07-30T11:00:00Z' }
    const e = evaluarMeta(hecha)
    expect(e.estado).toBe('cumplida')
    expect(e.mensaje).toContain('Reevaluar necesidad del CVC')
  })

  it('una tarea ignora el valor medido: no es comparable', () => {
    expect(evaluarMeta(cvc, 99).estado).toBe('pendiente')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§30 · esto es lo que llena «PENDIENTE» del Morning Brief', () => {
  const metas: MetaDiaria[] = [
    meta({ id: 'a', dominio: 'map', objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 65, unidad: 'mmHg' } }),
    meta({ id: 'b', dominio: 'rass', objetivo: { tipo: 'rango', min: -2, max: 0 } }),
    meta({ id: 'c', dominio: 'dispositivos', objetivo: { tipo: 'tarea', descripcion: 'Reevaluar necesidad del CVC' } }),
    meta({ id: 'd', dominio: 'nutricion', objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 20, unidad: 'kcal/kg' } }),
  ]
  const evs = evaluarMetas(metas, { map: 58, rass: -1, nutricion: undefined })

  it('los pendientes salen de metas REALES, no de sugerencias', () => {
    const p = pendientesDelBrief(evs)
    expect(p).toHaveLength(2)                       // MAP fuera + CVC sin hacer
    expect(p.join(' · ')).toMatch(/PAM objetivo/)
    expect(p.join(' · ')).toMatch(/CVC/)
  })

  it('lo CUMPLIDO no aparece como pendiente', () => {
    expect(pendientesDelBrief(evs).join(' ')).not.toMatch(/RASS/)
  })

  it('lo que NO tiene medición va a otra lista, no a pendientes', () => {
    // Un objetivo cumplido pero no registrado no debe verse como fallo del
    // tratamiento: es un hueco de documentación.
    expect(pendientesDelBrief(evs).join(' ')).not.toMatch(/nutricional/)
    expect(sinMedicion(evs).map(e => e.meta.dominio)).toEqual(['nutricion'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§35 · NO INVENTAR OBJETIVOS ← la regla del charter', () => {
  it('no existe ningún catálogo de objetivos por defecto', async () => {
    const mod = await import('@/lib/uci/metas-diarias')
    const sospechosos = Object.keys(mod).filter(k =>
      /DEFAULT|SUGERID|HABITUAL|RECOMEND|PROPUEST/i.test(k))
    expect(sospechosos).toEqual([])
  })

  it('una meta EXIGE autor y fecha: sin ellos no se puede construir', () => {
    // El tipo lo obliga. Este caso lo documenta para quien lea los tests.
    const m = meta({ dominio: 'map', objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 65 } })
    expect(m.fijadaPor).not.toBe('')
    expect(m.fijadaEn).not.toBe('')
  })

  it('sin metas, la pantalla DICE que nadie las fijó', () => {
    // Un blanco se lee como «todo en orden».
    expect(evaluarMetas([], {})).toEqual([])
    expect(SIN_METAS_FIJADAS).toMatch(/NO propone objetivos/)
    expect(SIN_METAS_FIJADAS).toMatch(/los fija el médico tratante/)
  })

  it('lista los dominios del §35 que hoy no tienen meta', () => {
    const sin = dominiosSinMeta([
      meta({ dominio: 'map', objetivo: { tipo: 'umbral', direccion: 'al_menos', valor: 65 } }),
    ])
    expect(sin).not.toContain('map')
    expect(sin).toHaveLength(DOMINIOS_META.length - 1)
  })

  it('los ocho dominios del charter, en su orden', () => {
    expect([...DOMINIOS_META]).toEqual([
      'map', 'rass', 'balance_hidrico', 'ventilacion',
      'nutricion', 'movilidad', 'antibioticos', 'dispositivos',
    ])
  })
})
