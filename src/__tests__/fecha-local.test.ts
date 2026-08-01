/**
 * LA MISMA FAMILIA DE ERROR, EN DOS SITIOS QUE DECIDEN COSAS DISTINTAS.
 *
 * `new Date('2020-03-15')` no es el 15 de marzo: el estándar obliga a leerlo
 * como medianoche UTC, y al oeste de Greenwich eso cae el día anterior en hora
 * local. Como los getters y las restas contra `Date.now()` sí son locales, todo
 * lo derivado se corre un día.
 *
 *  · En la EDAD: un niño nacido el 15 cumplía años el 14 — dosis por bandas,
 *    contraindicaciones por edad, calendario de vacunación.
 *  · En los DÍAS POST-TRASPLANTE: las fases de riesgo están en 30, 100 y 180.
 *    Un paciente en el día 29 podía reportarse en el 30 y saltar de fase.
 *
 * Ninguno de los dos se ve raro en pantalla. Ése es el problema.
 */
import { describe, it, expect } from 'vitest'
import { fechaLocalDesdeISO, diasDesde } from '@/lib/fecha-local'

it('la suite corre al oeste de Greenwich — sin esto, nada de aquí prueba nada', () => {
  // El fallo no existe en UTC. La zona se fija en `vitest.config.ts`.
  expect(new Date(2020, 0, 15).getTimezoneOffset()).toBeGreaterThan(0)
})

describe('fechaLocalDesdeISO', () => {
  it('la fecha suelta conserva su día', () => {
    const d = fechaLocalDesdeISO('2020-03-15')
    expect(d.getDate()).toBe(15)
    expect(d.getMonth()).toBe(2)
  })

  it('la marca de tiempo completa NO se toca: ahí el instante es el dato', () => {
    const d = fechaLocalDesdeISO('2020-03-15T23:30:00-06:00')
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(23)
  })

  it('lo inválido sigue inválido — ni hoy, ni el epoch', () => {
    // Un «hoy» silencioso convertiría un dato ausente en un dato falso.
    expect(isNaN(fechaLocalDesdeISO('ayer').getTime())).toBe(true)
    expect(isNaN(fechaLocalDesdeISO(null).getTime())).toBe(true)
    expect(isNaN(fechaLocalDesdeISO('').getTime())).toBe(true)
  })
})

describe('diasDesde — las fases post-trasplante', () => {
  /** Mediodía local, para no rozar los bordes del día por accidente. */
  const alMediodia = (iso: string) => new Date(`${iso}T12:00:00`).getTime()

  it('EL DÍA 29 ES 29, NO 30', () => {
    // 30 es la frontera entre el primer mes y el periodo de 1 a 6 meses:
    // cruzarla un día antes cambia los patógenos esperados que se listan.
    expect(diasDesde('2026-01-01', alMediodia('2026-01-30'))).toBe(29)
  })

  it('y el día 30 sí es 30', () => {
    expect(diasDesde('2026-01-01', alMediodia('2026-01-31'))).toBe(30)
  })

  it('el mismo día son 0 días, no 1', () => {
    expect(diasDesde('2026-01-01', alMediodia('2026-01-01'))).toBe(0)
  })

  it('SIN FECHA devuelve null, no 0', () => {
    /**
     * Un cero significa «hoy», y en días post-trasplante eso colocaría al
     * paciente en la fase más aguda por no tener el dato — justo al revés de lo
     * que hay que hacer ante la ausencia de información.
     */
    expect(diasDesde(null, Date.now())).toBeNull()
    expect(diasDesde('', Date.now())).toBeNull()
    expect(diasDesde('no es fecha', Date.now())).toBeNull()
  })

  it('una fecha futura da negativo, y quien llama decide', () => {
    // Un trasplante «mañana» es un error de captura; devolver 0 lo escondería.
    expect(diasDesde('2030-01-01', alMediodia('2026-01-01'))).toBeLessThan(0)
  })
})
