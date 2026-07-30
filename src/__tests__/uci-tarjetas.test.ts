import { describe, it, expect } from 'vitest'
import {
  construirTarjeta,
  ordenarTarjetas,
  sinNingunaToma,
  SIN_TOMAS,
  SIN_SOPORTES,
  type EntradaTarjeta,
} from '@/lib/uci/tarjetas'

/**
 * Charter §3 — landing de UCI con tarjetas.
 *
 * Lo que estos casos protegen: que la tarjeta diga SÓLO hechos registrados, y
 * que el orden de la lista sea el de lo que hay que mirar primero. Ordenar por
 * número de cama escondería justo al paciente del que hace horas que nadie
 * anota nada, que es el que la pantalla existe para señalar.
 *
 * Datos 100 % sintéticos.
 */

const AHORA = '2026-07-30T12:00:00Z'
const TZ = 'America/Chihuahua'

const ent = (e: Partial<EntradaTarjeta> = {}): EntradaTarjeta => ({
  internamientoId: 'int-1',
  pacienteNombre: 'Paciente Ficticio',
  cama: 'UCI-04',
  servicio: 'UCI / Terapia Intensiva',
  dxIngreso: 'Diagnóstico ficticio',
  ingresoEn: '2026-07-27T12:00:00Z',
  unitTimezone: TZ,
  soportes: ['vm_invasiva', 'vasopresor'],
  ultimaTomaEn: '2026-07-30T10:00:00Z',
  ...e,
})

describe('§3 · la tarjeta dice hechos, no veredictos', () => {
  const t = construirTarjeta(ent(), AHORA)

  it('identifica sin adornos', () => {
    expect(t.pacienteNombre).toBe('Paciente Ficticio')
    expect(t.cama).toBe('UCI-04')
    expect(t.dxIngreso).toBe('Diagnóstico ficticio')
  })

  it('no emite ningún juicio de evolución', async () => {
    // «Mejoró/empeoró» exige una dirección de beneficio declarada, y eso vive en
    // el Morning Brief, no aquí.
    const mod = await import('@/lib/uci/tarjetas')
    expect(Object.keys(mod).filter(k => /mejor|peor|grave|riesgo|severidad|pronost/i.test(k)))
      .toEqual([])
    expect(Object.keys(t)).not.toContain('estado')
  })

  it('horas desde la última toma como hecho', () => {
    expect(t.horasDesdeUltimaToma).toBeCloseTo(2, 5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§3 · el día de UCI lo resuelve el motor de estancia', () => {
  it('la tarjeta muestra el día Y la duración, no uno de los dos', () => {
    // Decisión del Dr. (2026-07-30): no se elige entre día de calendario y
    // bloques de 24 h; se guardan los tres datos.
    const t = construirTarjeta(ent({ ingresoEn: '2026-07-27T23:50:00-06:00' }), '2026-07-28T08:00:00-06:00')
    expect(t.estancia!.calendarDayNumber).toBe(2)
    expect(t.estancia!.elapsedMinutes).toBe(490)
    expect(t.estancia!.completed24hPeriods).toBe(0)
    expect(t.estancia!.etiqueta).toBe('Día UCI 2 · 8 h de estancia')
  })

  it('el día se calcula en la zona de la UNIDAD, no en la del navegador', () => {
    const ing = '2026-07-27T20:00:00Z'
    const mx = construirTarjeta(ent({ ingresoEn: ing, unitTimezone: 'America/Chihuahua' }), '2026-07-28T05:00:00Z')
    const es = construirTarjeta(ent({ ingresoEn: ing, unitTimezone: 'Europe/Madrid' }), '2026-07-28T05:00:00Z')
    expect(mx.estancia!.calendarDayNumber).toBe(1)
    expect(es.estancia!.calendarDayNumber).toBe(2)
    expect(mx.estancia!.elapsedMinutes).toBe(es.estancia!.elapsedMinutes)
  })

  it('un ingreso en el futuro se declara y no produce día 0 ni negativo', () => {
    const t = construirTarjeta(ent({ ingresoEn: '2026-07-31T00:00:00Z' }), AHORA)
    expect(t.estancia!.calendarDayNumber).toBe(1)
    expect(t.estancia!.elapsedMinutes).toBe(0)
    expect(t.avisos.join(' ')).toMatch(/posterior al momento actual/)
  })

  it('sin fecha de ingreso no hay estancia, y se dice', () => {
    const t = construirTarjeta(ent({ ingresoEn: 'ayer' }), AHORA)
    expect(t.estancia).toBeNull()
    expect(t.avisos.join(' ')).toMatch(/No consta la fecha de ingreso/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§3 · soportes activos: documentados, NUNCA deducidos', () => {
  it('salen los que constan en la estancia', () => {
    expect(construirTarjeta(ent(), AHORA).soportes).toEqual(['vm_invasiva', 'vasopresor'])
  })

  it('si no consta ninguno, se dice — y se dice que NO se deducen', () => {
    // Que haya PEEP anotada no prueba que el paciente siga ventilado.
    const t = construirTarjeta(ent({ soportes: [] }), AHORA)
    expect(t.soportes).toEqual([])
    expect(t.avisos).toContain(SIN_SOPORTES)
    expect(SIN_SOPORTES).toMatch(/NO los deduce de las mediciones/)
  })

  it('no muta el arreglo que recibe', () => {
    const soportes = ['ecmo'] as const
    construirTarjeta(ent({ soportes }), AHORA).soportes.push('ckrt')
    expect(soportes).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§3 · los huecos nunca se callan', () => {
  it('sin ninguna toma se dice que la tarjeta no sabe nada del estado actual', () => {
    const t = construirTarjeta(ent({ ultimaTomaEn: null }), AHORA)
    expect(t.horasDesdeUltimaToma).toBeNull()
    expect(t.avisos).toContain(SIN_TOMAS)
    expect(SIN_TOMAS).toMatch(/no puede decir nada del estado actual/)
  })

  it('una fecha de toma inválida cuenta como sin toma, no como toma reciente', () => {
    const t = construirTarjeta(ent({ ultimaTomaEn: 'hace rato' }), AHORA)
    expect(t.horasDesdeUltimaToma).toBeNull()
  })

  it('sin cama se avisa: el tablero no puede ubicarlo', () => {
    expect(construirTarjeta(ent({ cama: '   ' }), AHORA).avisos.join(' '))
      .toMatch(/Sin cama registrada/)
    expect(construirTarjeta(ent({ cama: '   ' }), AHORA).cama).toBeNull()
  })

  it('una tarjeta completa no inventa avisos', () => {
    expect(construirTarjeta(ent(), AHORA).avisos).toEqual([])
  })

  it('los avisos son acumulativos: faltan tres cosas, se dicen las tres', () => {
    const t = construirTarjeta(ent({ cama: '', soportes: [], ultimaTomaEn: null }), AHORA)
    expect(t.avisos).toHaveLength(3)
  })

  it('un instante inválido LANZA', () => {
    expect(() => construirTarjeta(ent(), 'ahora')).toThrowError(/fecha inválida/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('§3 · el orden ES la función', () => {
  const lista = [
    construirTarjeta(ent({ internamientoId: 'reciente', cama: 'UCI-01', ultimaTomaEn: '2026-07-30T11:30:00Z' }), AHORA),
    construirTarjeta(ent({ internamientoId: 'viejo', cama: 'UCI-09', ultimaTomaEn: '2026-07-30T02:00:00Z' }), AHORA),
    construirTarjeta(ent({ internamientoId: 'sin-toma', cama: 'UCI-05', ultimaTomaEn: null }), AHORA),
  ]
  const ord = ordenarTarjetas(lista)

  it('el que no tiene ninguna toma va PRIMERO: de ese no se sabe nada', () => {
    expect(ord[0].internamientoId).toBe('sin-toma')
  })

  it('después, el de toma más antigua', () => {
    expect(ord[1].internamientoId).toBe('viejo')
    expect(ord[2].internamientoId).toBe('reciente')
  })

  it('NO se ordena por cama: eso escondería justo al que hay que mirar', () => {
    expect(ord.map(t => t.cama)).not.toEqual(['UCI-01', 'UCI-05', 'UCI-09'])
  })

  it('a igualdad de antigüedad, por cama y sin bailar entre recargas', () => {
    const iguales = [
      construirTarjeta(ent({ cama: 'UCI-10', ultimaTomaEn: '2026-07-30T10:00:00Z' }), AHORA),
      construirTarjeta(ent({ cama: 'UCI-02', ultimaTomaEn: '2026-07-30T10:00:00Z' }), AHORA),
    ]
    expect(ordenarTarjetas(iguales).map(t => t.cama)).toEqual(['UCI-02', 'UCI-10'])
  })

  it('no muta la lista que recibe', () => {
    const antes = lista.map(t => t.internamientoId)
    ordenarTarjetas(lista)
    expect(lista.map(t => t.internamientoId)).toEqual(antes)
  })

  it('los que no tienen ninguna toma se pueden listar aparte', () => {
    expect(sinNingunaToma(lista).map(t => t.internamientoId)).toEqual(['sin-toma'])
  })

  it('lista vacía: sin inventar nada', () => {
    expect(ordenarTarjetas([])).toEqual([])
    expect(sinNingunaToma([])).toEqual([])
  })
})
