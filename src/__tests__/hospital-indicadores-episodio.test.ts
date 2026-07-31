import { describe, it, expect } from 'vitest'
import {
  tramosDeEpisodio,
  indicadoresEpisodio,
  reingresosACritica,
  enDias,
  FALTA_VENTANA_REINGRESO,
  type TramoUnidad,
} from '@/lib/hospital/indicadores-episodio'
import type { Unidad } from '@/lib/hospital/unidades'

/**
 * Indicadores del episodio: días-UCI vs días-piso, boarding y reingreso.
 *
 * Lo que hace posibles estas cuentas no es una fórmula nueva: es que la unidad
 * tenga TIPO. Con el servicio como texto libre, ninguna se podía hacer.
 *
 * Y no hay ningún umbral aquí: se devuelven las horas reales; qué cuenta como
 * bounce-back lo decide la unidad.
 *
 * Datos 100 % sintéticos.
 */

const U: Unidad[] = [
  { id: '1', nombre: 'Urgencias', tipo: 'urgencias', activa: true },
  { id: '2', nombre: '5º Norte', tipo: 'critica', activa: true },
  { id: '3', nombre: 'Torre B', tipo: 'piso', activa: true },
]

// Episodio: urgencias 12 h → terapia 48 h → piso 24 h (abierto)
const TRAMOS: TramoUnidad[] = [
  { servicio: 'Urgencias', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-25T12:00:00Z' },
  { servicio: '5º Norte', desde: '2026-07-25T12:00:00Z', hasta: '2026-07-27T12:00:00Z' },
  { servicio: 'Torre B', desde: '2026-07-27T12:00:00Z' },
]
const FIN = '2026-07-28T12:00:00Z'

describe('días por TIPO de unidad — el corazón del costeo por paquete', () => {
  const ind = indicadoresEpisodio(TRAMOS, U, FIN)

  it('separa terapia de piso dentro del MISMO episodio', () => {
    expect(ind.horasPorTipo.critica).toBe(48)
    expect(ind.horasPorTipo.piso).toBe(24)
  })

  it('el boarding en urgencias sale solo', () => {
    expect(ind.horasEnUrgencias).toBe(12)
  })

  it('el tramo abierto se cierra en el instante que se pide', () => {
    const otro = indicadoresEpisodio(TRAMOS, U, '2026-07-29T12:00:00Z')
    expect(otro.horasPorTipo.piso).toBe(48)
  })

  it('los nombres del hospital no aparecen en la cuenta: sólo los tipos', () => {
    // «5º Norte» cuenta como crítica porque su TIPO lo dice, no su nombre.
    expect(Object.keys(ind.horasPorTipo).sort()).toEqual(['critica', 'piso', 'urgencias'])
  })

  it('las horas suman el total del episodio', () => {
    expect(ind.horasTotales).toBe(84)
  })

  it('a días, para mostrar', () => {
    expect(enDias(48)).toBe(2)
    expect(enDias(12)).toBe(0.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el tiempo sin clasificar NO se reparte', () => {
  const conHueco: TramoUnidad[] = [
    { servicio: 'Pabellón 7', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-26T00:00:00Z' },
    { servicio: '5º Norte', desde: '2026-07-26T00:00:00Z', hasta: '2026-07-27T00:00:00Z' },
  ]
  const ind = indicadoresEpisodio(conHueco, U, '2026-07-27T00:00:00Z')

  it('va a su propio cajón y se declara', () => {
    // Repartirlo inflaría los días-UCI o los días-piso con tiempo que nadie sabe
    // dónde ocurrió — y en un costeo por paquete eso es dinero inventado.
    expect(ind.horasSinClasificar).toBe(24)
    expect(ind.serviciosSinTipo).toEqual(['Pabellón 7'])
  })

  it('NO se suma a ningún tipo', () => {
    expect(ind.horasPorTipo.critica).toBe(24)
    expect(ind.horasPorTipo.piso).toBeUndefined()
  })

  it('pero sí cuenta en el total: el tiempo existió', () => {
    expect(ind.horasTotales).toBe(48)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('reingreso a terapia: el HECHO, no el juicio', () => {
  // terapia → piso 30 h → terapia otra vez
  const conReingreso: TramoUnidad[] = [
    { servicio: '5º Norte', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-26T00:00:00Z' },
    { servicio: 'Torre B', desde: '2026-07-26T00:00:00Z', hasta: '2026-07-27T06:00:00Z' },
    { servicio: '5º Norte', desde: '2026-07-27T06:00:00Z' },
  ]

  it('devuelve las horas REALES fuera de terapia', () => {
    const r = reingresosACritica(conReingreso, U)
    expect(r).toHaveLength(1)
    expect(r[0].horasFuera).toBe(30)
  })

  it('sin ventana no emite juicio', () => {
    expect(reingresosACritica(conReingreso, U)[0].dentroDeVentana).toBeUndefined()
  })

  it('con la ventana que la unidad fije, marca cuál cae dentro', () => {
    expect(reingresosACritica(conReingreso, U, 48)[0].dentroDeVentana).toBe(true)
    expect(reingresosACritica(conReingreso, U, 24)[0].dentroDeVentana).toBe(false)
  })

  it('se declara que la ventana NO la fija el módulo', () => {
    expect(FALTA_VENTANA_REINGRESO).toMatch(/NEEDS_CLINICAL_REVIEW/)
    expect(FALTA_VENTANA_REINGRESO).toMatch(/lo define la unidad/)
  })

  it('un episodio que nunca sale de terapia no tiene reingresos', () => {
    expect(reingresosACritica(TRAMOS, U)).toEqual([])
  })

  it('dos tramos críticos SEGUIDOS no son un reingreso', () => {
    // Cambiar de cama dentro de terapia no es salir y volver.
    const dos: TramoUnidad[] = [
      { servicio: '5º Norte', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-26T00:00:00Z' },
      { servicio: '5º Norte', desde: '2026-07-26T00:00:00Z' },
    ]
    expect(reingresosACritica(dos, U)).toHaveLength(1)   // hay salida y reentrada registradas
    expect(indicadoresEpisodio(dos, U, '2026-07-27T00:00:00Z').entradasACritica).toHaveLength(1)
  })

  it('las ENTRADAS a terapia se listan en orden', () => {
    const ind = indicadoresEpisodio(conReingreso, U, '2026-07-28T00:00:00Z')
    expect(ind.entradasACritica).toEqual(['2026-07-25T00:00:00Z', '2026-07-27T06:00:00Z'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('los tramos salen de los movimientos ya registrados', () => {
  it('cada traslado cierra el tramo anterior y abre el siguiente', () => {
    const t = tramosDeEpisodio('2026-07-25T00:00:00Z', [
      { fecha: '2026-07-25T12:00:00Z', servicioDestino: '5º Norte' },
      { fecha: '2026-07-27T12:00:00Z', servicioDestino: 'Torre B' },
    ], 'Urgencias')
    expect(t).toEqual(TRAMOS)
  })

  it('los movimientos desordenados se ordenan por fecha', () => {
    const t = tramosDeEpisodio('2026-07-25T00:00:00Z', [
      { fecha: '2026-07-27T12:00:00Z', servicioDestino: 'Torre B' },
      { fecha: '2026-07-25T12:00:00Z', servicioDestino: '5º Norte' },
    ], 'Urgencias')
    expect(t.map(x => x.servicio)).toEqual(['Urgencias', '5º Norte', 'Torre B'])
  })

  it('un movimiento con fecha inválida se descarta sin romper', () => {
    const t = tramosDeEpisodio('2026-07-25T00:00:00Z',
      [{ fecha: 'ayer', servicioDestino: 'X' }], 'Urgencias')
    expect(t).toHaveLength(1)
  })

  it('sin traslados, un solo tramo abierto', () => {
    const t = tramosDeEpisodio('2026-07-25T00:00:00Z', [], 'Urgencias')
    expect(t).toEqual([{ servicio: 'Urgencias', desde: '2026-07-25T00:00:00Z' }])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('robustez', () => {
  it('un tramo invertido no RESTA tiempo', () => {
    const malo: TramoUnidad[] = [
      { servicio: '5º Norte', desde: '2026-07-27T00:00:00Z', hasta: '2026-07-25T00:00:00Z' },
      { servicio: 'Torre B', desde: '2026-07-25T00:00:00Z', hasta: '2026-07-26T00:00:00Z' },
    ]
    const ind = indicadoresEpisodio(malo, U, '2026-07-28T00:00:00Z')
    expect(ind.horasPorTipo.critica).toBeUndefined()
    expect(ind.horasTotales).toBe(24)
  })

  it('un instante de cierre inválido LANZA', () => {
    expect(() => indicadoresEpisodio(TRAMOS, U, 'ahora')).toThrowError(/instante inválido/)
  })

  it('sin tramos: todo en cero, sin inventar', () => {
    const ind = indicadoresEpisodio([], U, FIN)
    expect(ind.horasTotales).toBe(0)
    expect(ind.horasEnUrgencias).toBeNull()
    expect(ind.entradasACritica).toEqual([])
  })

  it('sin unidades configuradas, el catálogo de fábrica sigue contando', () => {
    const ind = indicadoresEpisodio(
      [{ servicio: 'UCI / Terapia Intensiva', desde: '2026-07-27T00:00:00Z', hasta: '2026-07-28T00:00:00Z' }],
      [], FIN)
    expect(ind.horasPorTipo.critica).toBe(24)
    expect(ind.horasSinClasificar).toBe(0)
  })
})
