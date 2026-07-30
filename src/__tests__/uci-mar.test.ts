import { describe, it, expect } from 'vitest'
import {
  interpretarFrecuencia,
  lineaMar,
  vistaMar,
  ESTADOS_SIN_ATRASO,
  FALTA_GRACIA,
} from '@/lib/uci/mar'
import { extraerTomasDia } from '@/lib/seguridad/dosis'
import type { Indicacion, Administracion } from '@/types/hospital'

/**
 * Charter §37 — MAR de UCI sobre la farmacia existente, SIN duplicar inventario.
 *
 * Lo que estos casos protegen, por encima de todo, es que el rojo signifique
 * algo: una infusión continua, un PRN o un horario ilegible marcados como
 * «ATRASADO» convierten el MAR en ruido, y entonces la dosis que de verdad se
 * pasó no la ve nadie.
 *
 * Datos 100 % sintéticos.
 */

const AHORA = '2026-07-30T12:00:00Z'
const GRACIA = 30   // minutos; valor de PRUEBA, no una recomendación clínica

const adm = (fecha: string, estado: Administracion['estado'] = 'administrado'): Administracion =>
  ({ fecha, por: 'enf-ficticia', estado })

const ind = (e: Partial<Indicacion> = {}): Indicacion => ({
  id: 'i1',
  tipo: 'medicamento',
  descripcion: 'Fármaco ficticio 1 g IV',
  frecuencia: 'cada 8 h',
  activa: true,
  fecha: '2026-07-30T00:00:00Z',
  administraciones: [],
  ...e,
})

describe('§37 · leer la orden, nunca completarla', () => {
  it('«cada 8 h» y sus variantes dan el mismo intervalo', () => {
    for (const t of ['cada 8 h', 'cada 8 horas', 'c/8h', 'CADA 8 HRS', 'cada ocho horas']) {
      expect(interpretarFrecuencia(t)).toEqual({ tipo: 'intervalo', minHoras: 8, maxHoras: 8 })
    }
  })

  it('un RANGO se conserva como rango ← aquí se separa del motor de techos', () => {
    expect(interpretarFrecuencia('cada 4 a 6 horas'))
      .toEqual({ tipo: 'intervalo', minHoras: 4, maxHoras: 6 })
    expect(interpretarFrecuencia('cada 6-8 h'))
      .toEqual({ tipo: 'intervalo', minHoras: 6, maxHoras: 8 })
  })

  it('el motor de TECHOS colapsa ese rango al peor caso, y hace bien — pero aquí no vale', () => {
    // extraerTomasDia elige el intervalo MÁS CORTO porque para un techo diario el
    // peor caso es el que más veces se toma. Copiar ese sesgo al MAR marcaría
    // atrasada una dosis que va a tiempo.
    expect(extraerTomasDia('cada 4 a 6 horas')).toBe(6)          // = cada 4 h
    const f = interpretarFrecuencia('cada 4 a 6 horas')
    expect(f).toEqual({ tipo: 'intervalo', minHoras: 4, maxHoras: 6 })
  })

  it('«3 veces al día» sólo si divide exacto', () => {
    expect(interpretarFrecuencia('3 veces al día'))
      .toEqual({ tipo: 'intervalo', minHoras: 8, maxHoras: 8 })
    // 24/5 = 4.8 h no es un horario: es una pauta fija que el módulo no conoce.
    expect(interpretarFrecuencia('5 veces al día').tipo).toBe('no_interpretable')
  })

  it('lo que no se entiende NO se adivina', () => {
    for (const t of ['por la mañana', 'según esquema', 'con las comidas', '', undefined]) {
      expect(interpretarFrecuencia(t).tipo).toBe('no_interpretable')
    }
  })

  it('el texto original se conserva para poder mostrarlo', () => {
    const f = interpretarFrecuencia('según esquema')
    expect(f.tipo === 'no_interpretable' && f.texto).toBe('según esquema')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · lo que NUNCA se atrasa', () => {
  it('la infusión continua se titula, no se pasa', () => {
    const l = lineaMar(ind({ frecuencia: 'infusión continua a 5 mL/h' }), AHORA, GRACIA)
    expect(l.estado).toBe('infusion_continua')
    expect(l.atrasadaDesde).toBeNull()
  })

  it('«infusión continua a 5 mL/h» no se lee como un intervalo pese al número', () => {
    expect(interpretarFrecuencia('infusión continua a 5 mL/h')).toEqual({ tipo: 'continua' })
    expect(interpretarFrecuencia('norepinefrina en infusión')).toEqual({ tipo: 'continua' })
  })

  it('el PRN se da si hace falta: no tiene reloj', () => {
    const l = lineaMar(ind({ frecuencia: 'cada 6 h PRN' }), AHORA, GRACIA)
    expect(l.estado).toBe('prn')
    expect(l.atrasadaDesde).toBeNull()
  })

  it('la dosis única dada queda completada, no atrasada', () => {
    const l = lineaMar(ind({
      frecuencia: 'dosis única',
      administraciones: [adm('2026-07-29T00:00:00Z')],
    }), AHORA, GRACIA)
    expect(l.estado).toBe('completado')
  })

  it('la orden suspendida sale del reloj aunque lleve días', () => {
    const l = lineaMar(ind({ activa: false, fecha: '2026-07-01T00:00:00Z' }), AHORA, GRACIA)
    expect(l.estado).toBe('suspendido')
    expect(l.atrasadaDesde).toBeNull()
  })

  it('un horario ilegible NO produce un atraso inventado', () => {
    // Este es el fallo que hace que se ignore el color rojo.
    const l = lineaMar(ind({ frecuencia: 'según esquema', fecha: '2026-07-01T00:00:00Z' }), AHORA, GRACIA)
    expect(l.estado).toBe('horario_no_interpretable')
    expect(l.atrasadaDesde).toBeNull()
    expect(l.mensaje).toMatch(/un horario adivinado produce un atraso inventado/)
  })

  it('ninguno de esos estados admite atraso, por definición', () => {
    expect([...ESTADOS_SIN_ATRASO].sort()).toEqual(
      ['completado', 'horario_no_interpretable', 'infusion_continua', 'prn', 'suspendido'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · el reloj de una pauta fija', () => {
  const conUltima = (fecha: string, frecuencia = 'cada 8 h') =>
    lineaMar(ind({ frecuencia, administraciones: [adm(fecha)] }), AHORA, GRACIA)

  it('dentro del intervalo: al día', () => {
    expect(conUltima('2026-07-30T09:00:00Z').estado).toBe('al_dia')   // 3 h
  })

  it('cumplido el intervalo: TOCA, todavía no atrasada', () => {
    expect(conUltima('2026-07-30T03:40:00Z').estado).toBe('toca')     // 8 h 20 min, gracia 30
  })

  it('el borde de la gracia es INCLUSIVO: cumplida la gracia, ya es atraso', () => {
    // 03:30 + 8 h = 11:30 toca; + 30 min de gracia = 12:00 exactas. A las 12:00
    // está atrasada. Se elige el borde estricto: la gracia ya se consumió.
    expect(conUltima('2026-07-30T03:30:00Z').estado).toBe('atrasado')
  })

  it('pasada la gracia: atrasada', () => {
    expect(conUltima('2026-07-30T03:00:00Z').estado).toBe('atrasado') // 9 h > 8 h + 30 min
  })

  it('en un RANGO no se atrasa hasta el extremo LARGO', () => {
    const l = conUltima('2026-07-30T07:00:00Z', 'cada 4 a 6 h')       // 5 h
    expect(l.estado).toBe('toca')
    expect(conUltima('2026-07-30T05:00:00Z', 'cada 4 a 6 h').estado).toBe('atrasado') // 7 h
  })

  it('el mensaje muestra el rango tal cual, no un número elegido', () => {
    expect(conUltima('2026-07-30T07:00:00Z', 'cada 4 a 6 h').mensaje).toMatch(/cada 4–6 h/)
  })

  it('publica desde cuándo toca y desde cuándo se atrasa', () => {
    const l = conUltima('2026-07-30T04:00:00Z')
    expect(l.tocaDesde).toBe('2026-07-30T12:00:00.000Z')
    expect(l.atrasadaDesde).toBe('2026-07-30T12:30:00.000Z')
  })

  it('sin ninguna dosis dada nunca dice «al día»', () => {
    // No hay nada que lo esté.
    const l = lineaMar(ind({ fecha: '2026-07-30T11:00:00Z' }), AHORA, GRACIA)
    expect(l.estado).toBe('nunca_administrado')
  })

  it('sin dosis dadas cuenta desde la ORDEN, y lo dice', () => {
    const l = lineaMar(ind({ fecha: '2026-07-30T00:00:00Z' }), AHORA, GRACIA)
    expect(l.estado).toBe('atrasado')
    expect(l.horasDesde).toBeCloseTo(12, 5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · una omisión no es una dosis', () => {
  const conOmision = lineaMar(ind({
    administraciones: [adm('2026-07-30T02:00:00Z'), adm('2026-07-30T10:00:00Z', 'omitido')],
  }), AHORA, GRACIA)

  it('la omitida NO cuenta como administrada', () => {
    // Alguien decidió no pasarla; eso no equivale a que el fármaco entrara.
    expect(conOmision.ultima?.fecha).toBe('2026-07-30T02:00:00Z')
    expect(conOmision.estado).toBe('atrasado')
  })

  it('pero NO desaparece: queda registrada', () => {
    expect(conOmision.omisiones).toHaveLength(1)
    expect(conOmision.omisiones[0].estado).toBe('omitido')
  })

  it('la última es la más reciente aunque lleguen desordenadas', () => {
    const l = lineaMar(ind({
      administraciones: [adm('2026-07-30T10:00:00Z'), adm('2026-07-30T02:00:00Z')],
    }), AHORA, GRACIA)
    expect(l.ultima?.fecha).toBe('2026-07-30T10:00:00Z')
  })

  it('una administración con fecha inválida se descarta sin romper', () => {
    const l = lineaMar(ind({
      administraciones: [adm('ayer'), adm('2026-07-30T10:00:00Z')],
    }), AHORA, GRACIA)
    expect(l.ultima?.fecha).toBe('2026-07-30T10:00:00Z')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · la gracia NO se asume', () => {
  it('es obligatoria en la firma y se declara por qué', () => {
    expect(FALTA_GRACIA).toMatch(/NEEDS_CLINICAL_REVIEW/)
    expect(FALTA_GRACIA).toMatch(/decisión operativa de la unidad/)
    expect(FALTA_GRACIA).toMatch(/un MAR que grita deja de leerse/)
  })

  it('una gracia inválida LANZA en vez de caer a un valor por defecto', () => {
    expect(() => lineaMar(ind(), AHORA, -5)).toThrowError(/gracia inválida/)
    expect(() => lineaMar(ind(), AHORA, NaN)).toThrowError(/gracia inválida/)
  })

  it('gracia 0 es una elección válida, no un hueco', () => {
    expect(() => lineaMar(ind(), AHORA, 0)).not.toThrow()
  })

  it('no existe ningún default de gracia exportado', async () => {
    const mod = await import('@/lib/uci/mar')
    expect(Object.keys(mod).filter(k => /GRACIA_(DEFAULT|POR_DEFECTO)|DEFAULT_/i.test(k))).toEqual([])
  })

  it('una fecha inválida LANZA', () => {
    expect(() => lineaMar(ind(), 'ayer', GRACIA)).toThrowError(/fecha inválida/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · SIN duplicar inventario ← control negativo', () => {
  it('el módulo no define catálogo, existencias ni stock', async () => {
    // Si esto falla, el MAR se convirtió en una segunda farmacia y los dos
    // registros empezarán a divergir.
    const mod = await import('@/lib/uci/mar')
    const sospechosos = Object.keys(mod).filter(k =>
      /inventario|existencia|stock|almacen|lote|caduc|catalogo|surtir|dispens/i.test(k))
    expect(sospechosos).toEqual([])
  })

  it('lee la Indicacion que ya usa el piso, sin copiarla', () => {
    // La línea del MAR referencia la indicación por id: no la clona.
    const l = lineaMar(ind({ id: 'ind-42' }), AHORA, GRACIA)
    expect(l.indicacionId).toBe('ind-42')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§37 · la vista completa ordena por lo que exige acción', () => {
  const v = vistaMar([
    ind({ id: 'a', descripcion: 'Al día', administraciones: [adm('2026-07-30T11:00:00Z')] }),
    ind({ id: 'b', descripcion: 'Atrasada', administraciones: [adm('2026-07-30T01:00:00Z')] }),
    ind({ id: 'c', descripcion: 'Norepinefrina', frecuencia: 'infusión continua' }),
    ind({ id: 'd', descripcion: 'Ilegible', frecuencia: 'según esquema' }),
  ], AHORA, GRACIA)

  it('lo atrasado va primero: en UCI se atiende lo que se ve', () => {
    expect(v.lineas[0].indicacionId).toBe('b')
  })

  it('las atrasadas se listan aparte', () => {
    expect(v.atrasadas.map(l => l.indicacionId)).toEqual(['b'])
  })

  it('los horarios ilegibles se listan para ARREGLARLOS, no para ignorarlos', () => {
    expect(v.noInterpretables.map(l => l.indicacionId)).toEqual(['d'])
  })

  it('la infusión continua no entra en atrasadas', () => {
    expect(v.atrasadas.some(l => l.indicacionId === 'c')).toBe(false)
  })

  it('las omisiones de todas las órdenes se juntan con su descripción', () => {
    const v2 = vistaMar([
      ind({ id: 'x', descripcion: 'Fármaco X', administraciones: [adm('2026-07-30T10:00:00Z', 'omitido')] }),
    ], AHORA, GRACIA)
    expect(v2.omisiones).toHaveLength(1)
    expect(v2.omisiones[0].descripcion).toBe('Fármaco X')
  })

  it('sin indicaciones: vista vacía, sin inventar nada', () => {
    const v3 = vistaMar([], AHORA, GRACIA)
    expect(v3.lineas).toEqual([])
    expect(v3.atrasadas).toEqual([])
  })
})
