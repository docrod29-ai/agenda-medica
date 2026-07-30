import { describe, it, expect } from 'vitest'
import {
  unirLinea, porHora, entre, deOrigen, flecha,
  huecosDeDocumentacion, desdeTitulacion, desdeTomas,
  ORIGENES_EVENTO,
  type EventoLinea,
} from '@/lib/uci/linea-tiempo'

/**
 * Charter §33 — línea de tiempo ÚNICA.
 *
 * El ejemplo del Dr. mezcla fuentes que hoy viven en pantallas distintas:
 * laboratorio, gasometría, pase de visita, ventilador, hemodinamia, POCUS,
 * microbiología y órdenes. La secuencia «PEEP ↑ → MAP ↓ → NE ↑» sólo se ve
 * cuando las tres están en la misma línea.
 *
 * Datos 100 % sintéticos.
 */

const T = (hhmm: string) => `2026-07-30T${hhmm}:00Z`
/** Formato de hora de prueba: lo pasa quien llama, nunca lo elige el módulo. */
const hhmm = (iso: string) => iso.slice(11, 16)

const ev = (en: string, origen: EventoLinea['origen'], etiqueta: string, extra: Partial<EventoLinea> = {}): EventoLinea =>
  ({ en, origen, etiqueta, ...extra })

describe('§33 · el ejemplo del Dr — fuentes distintas, una sola línea', () => {
  const labs = [ev(T('07:00'), 'laboratorio', 'Laboratorios')]
  const gaso = [ev(T('07:20'), 'gasometria', 'Gasometría arterial')]
  const notas = [ev(T('08:00'), 'nota', 'Pase de visita')]
  const vent = [ev(T('08:15'), 'toma', 'PEEP', { direccion: 'sube', valor: 12, unidad: 'cmH2O' })]
  const hemo = [ev(T('08:20'), 'toma', 'MAP', { direccion: 'baja', valor: 62, unidad: 'mmHg' })]
  const titul = [ev(T('08:27'), 'titulacion', 'Norepinefrina', { direccion: 'sube', valor: 0.14 })]
  const pocus = [ev(T('09:10'), 'imagen', 'POCUS')]
  const micro = [ev(T('10:00'), 'microbiologia', 'Hemocultivo positivo')]
  const orden = [ev(T('10:15'), 'orden', 'Cambio de antibiótico')]

  const { linea, sinFecha } = unirLinea(labs, gaso, notas, vent, hemo, titul, pocus, micro, orden)

  it('todo queda en orden cronológico', () => {
    expect(linea.map(e => hhmm(e.en))).toEqual([
      '07:00', '07:20', '08:00', '08:15', '08:20', '08:27', '09:10', '10:00', '10:15',
    ])
  })

  it('la secuencia PEEP ↑ → MAP ↓ → NE ↑ queda contigua y visible', () => {
    // Es la razón de ser de la línea única: en pantallas separadas no se ve.
    const tres = linea.slice(3, 6)
    expect(tres.map(e => `${e.etiqueta} ${flecha(e.direccion)}`))
      .toEqual(['PEEP ↑', 'MAP ↓', 'Norepinefrina ↑'])
  })

  it('cada evento CONSERVA de dónde vino', () => {
    expect(linea.map(e => e.origen)).toContain('microbiologia')
    expect(linea.find(e => e.etiqueta === 'Hemocultivo positivo')?.origen).toBe('microbiologia')
  })

  it('no se pierde ni se inventa ningún evento', () => {
    expect(linea).toHaveLength(9)
    expect(sinFecha).toEqual([])
  })

  it('agrupa por hora como en el ejemplo', () => {
    const tramos = porHora(linea, hhmm)
    expect(tramos[0]).toEqual({ hora: '07:00', eventos: [labs[0]] })
    expect(tramos).toHaveLength(9)
  })

  it('eventos a la MISMA hora caen en un solo tramo', () => {
    const { linea: l } = unirLinea(
      [ev(T('08:00'), 'nota', 'Pase de visita')],
      [ev(T('08:00'), 'orden', 'Solicitud de labs')],
    )
    const tramos = porHora(l, hhmm)
    expect(tramos).toHaveLength(1)
    expect(tramos[0].eventos).toHaveLength(2)
  })
})

describe('§33 · un evento sin fecha NO se tira en silencio', () => {
  it('se devuelve aparte, no se descarta', () => {
    // Un evento que no se pudo ubicar sigue siendo un hecho clínico; esconderlo
    // sería peor que mostrarlo mal colocado.
    const { linea, sinFecha } = unirLinea([
      ev(T('08:00'), 'nota', 'buena'),
      ev('ayer por la tarde', 'nota', 'sin fecha'),
    ])
    expect(linea).toHaveLength(1)
    expect(sinFecha.map(e => e.etiqueta)).toEqual(['sin fecha'])
  })
})

describe('§33 · determinismo y forma', () => {
  it('dos eventos simultáneos se ordenan SIEMPRE igual', () => {
    // Sin desempate estable, dos corridas darían líneas distintas.
    const a = unirLinea([ev(T('08:00'), 'orden', 'x')], [ev(T('08:00'), 'toma', 'y')]).linea
    const b = unirLinea([ev(T('08:00'), 'toma', 'y')], [ev(T('08:00'), 'orden', 'x')]).linea
    expect(a.map(e => e.etiqueta)).toEqual(b.map(e => e.etiqueta))
  })

  it('la ZONA HORARIA la pone quien llama, no el módulo', () => {
    // REG-011 fue exactamente esto: el corte de caja usaba la zona equivocada
    // para el norte del país.
    const l = [ev(T('08:00'), 'nota', 'x')]
    expect(porHora(l, () => 'CUALQUIERA')[0].hora).toBe('CUALQUIERA')
  })

  it('los flechados son los del charter', () => {
    expect(flecha('sube')).toBe('↑')
    expect(flecha('baja')).toBe('↓')
    expect(flecha('estable')).toBe('')
    expect(flecha(undefined)).toBe('')
  })

  it('línea vacía no rompe nada', () => {
    expect(unirLinea().linea).toEqual([])
    expect(porHora([], hhmm)).toEqual([])
  })
})

describe('§30 · rango para el Morning Brief («últimas 12 horas»)', () => {
  const { linea } = unirLinea([
    ev(T('02:00'), 'nota', 'madrugada'),
    ev(T('08:00'), 'nota', 'mañana'),
    ev(T('11:00'), 'nota', 'ahora'),
  ])

  it('devuelve sólo lo del rango, incluidos los extremos', () => {
    expect(entre(linea, T('08:00'), T('11:00')).map(e => e.etiqueta))
      .toEqual(['mañana', 'ahora'])
  })

  it('un rango invertido LANZA en vez de devolver vacío', () => {
    // Vacío se confundiría con «no pasó nada», que es una afirmación clínica.
    expect(() => entre(linea, T('11:00'), T('08:00'))).toThrowError(/posterior/)
  })

  it('un rango con fecha inválida lanza', () => {
    expect(() => entre(linea, 'ayer', T('11:00'))).toThrowError(/rango inválido/)
  })

  it('filtra por origen para las vistas de una sola fuente', () => {
    const { linea: l } = unirLinea([
      ev(T('08:00'), 'laboratorio', 'labs'),
      ev(T('09:00'), 'microbiologia', 'cultivo'),
    ])
    expect(deOrigen(l, ['microbiologia']).map(e => e.etiqueta)).toEqual(['cultivo'])
  })
})

describe('§33 · huecos de documentación — se señalan, no se juzgan', () => {
  const { linea } = unirLinea([
    ev(T('08:00'), 'toma', 'a'),
    ev(T('09:00'), 'toma', 'b'),
    ev(T('16:00'), 'toma', 'c'),
  ])

  it('detecta el tramo sin registros', () => {
    const h = huecosDeDocumentacion(linea, 3)
    expect(h).toHaveLength(1)
    expect(h[0].horas).toBe(7)
  })

  it('NO dice que sea malo — la frecuencia es política del hospital', () => {
    // La decisión ICU-Q4.1 lo dice: el hospital define frecuencia de
    // adquisición. Un turno sin registros puede ser estabilidad o una omisión.
    const h = huecosDeDocumentacion(linea, 3)
    expect(Object.keys(h[0])).toEqual(['desde', 'hasta', 'horas'])
  })

  it('un umbral no positivo lanza en vez de devolver todo', () => {
    expect(() => huecosDeDocumentacion(linea, 0)).toThrowError(/positivo/)
  })
})

describe('§33 · adaptadores desde lo que ya existe', () => {
  it('la titulación entra con su DIRECCIÓN calculada del cambio previo', () => {
    const evs = desdeTitulacion('Norepinefrina', [
      { en: T('08:00'), velocidad: 14, dosisCalculada: 0.18, unidadDosis: 'µg/kg/min', por: 'enf' },
      { en: T('09:15'), velocidad: 11, dosisCalculada: 0.14, unidadDosis: 'µg/kg/min', por: 'enf' },
      { en: T('10:30'), velocidad: 16, dosisCalculada: 0.20, unidadDosis: 'µg/kg/min', por: 'enf' },
    ])
    expect(evs.map(e => e.direccion)).toEqual([undefined, 'baja', 'sube'])
    expect(evs[1].valor).toBe(0.14)
    expect(evs[1].unidad).toBe('µg/kg/min')
  })

  it('el PRIMER cambio no tiene dirección: no hay contra qué compararlo', () => {
    const evs = desdeTitulacion('x', [{ en: T('08:00'), velocidad: 10, por: 'y' }])
    expect(evs[0].direccion).toBeUndefined()
  })

  it('sin dosis calculada usa la velocidad, y lo dice en la unidad', () => {
    const evs = desdeTitulacion('x', [{ en: T('08:00'), velocidad: 12, por: 'y' }])
    expect(evs[0].valor).toBe(12)
    expect(evs[0].unidad).toBe('mL/h')
  })

  it('las tomas entran con su refId, para poder abrirlas desde la línea', () => {
    const evs = desdeTomas([{ id: 't1', medidoEn: T('08:00'), por: 'med' }])
    expect(evs[0].refId).toBe('t1')
    expect(evs[0].origen).toBe('toma')
  })

  it('los diez orígenes del módulo, sin duplicados', () => {
    expect(new Set(ORIGENES_EVENTO).size).toBe(ORIGENES_EVENTO.length)
    expect(ORIGENES_EVENTO).toHaveLength(10)
  })
})
