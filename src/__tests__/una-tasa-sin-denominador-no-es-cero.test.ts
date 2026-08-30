/**
 * GOLDEN — un consultorio sin citas no tiene «0% de atención»: no tiene tasa.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/crm` calculaba sus cuatro indicadores como
 * `total > 0 ? (n / total) * 100 : 0`. El `: 0` es el defecto: cuando no hay
 * citas en el periodo, la tasa se **define** como cero y la pantalla enseña
 *
 *     Tasa de confirmación 0%   ·   Tasa de no-show 0%   ·   Tasa de atención 0%
 *
 * A un médico que acaba de abrir su consultorio —o que mira una semana sin
 * agenda— eso le lee como un boletín de notas pésimo sobre un trabajo que
 * todavía no ha hecho.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Yendo a por la columna de estados VACÍOS, que estaba NOT_PROVEN. Se creó un
 * médico en el emulador, se le dio de alta un consultorio de cero y se
 * recorrieron sus pantallas. **Trece de catorce decían que estaban vacías** —y
 * varias muy bien: «Hoy no hay citas. La agenda está libre. + Agendar cita»;
 * «Nada abierto — cuando firmes una consulta con estudios o receta, sus
 * pendientes aparecen aquí con fecha y dueño»—. La catorce era `/crm`, que no
 * decía estar vacía: decía ceros.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La que este repositorio ya tiene escrita para lo clínico, aplicada a los
 * indicadores del consultorio: **un cálculo al que le falta el dato dice que no
 * puede hacerse, no estima**. «No se puede calcular Kirby: falta PaO₂ y FiO₂».
 *
 * `null` es «no hay con qué» y se pinta con una raya. Un cero de verdad —cero
 * ausencias de ocho citas— sigue siendo `0%`, que es información.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `0` en vez de `null` sin denominador, cae el caso del consultorio
 * recién abierto. Y sobre el producto vivo: `npm run arnes:consultorio-vacio`
 * marcaba `/crm` como CALLADA y ahora no; con la cuenta sembrada, las tasas
 * siguen saliendo 63 %, 0 % y 13 % — es decir, el cero legítimo no se perdió.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo la aritmética y su escritura.** Que `/crm` las use, y que el resto de
 *   la pantalla no siga inventando ceros por su cuenta, no se prueba aquí.
 * · No mira los demás indicadores del producto. `/finanzas`, `/corte-caja` y el
 *   panel de comisiones tienen sus propios cocientes y **no se auditaron**:
 *   dicho aquí para que no se dé por hecho.
 * · No juzga si «—» es la mejor forma de escribirlo.
 */
import { describe, it, expect } from 'vitest'
import { tasa, porcentaje } from '@/lib/metricas/tasa'

describe('una tasa sin denominador no es cero', () => {
  it('EL CASO DEL DEFECTO: sin citas no hay tasa, y se dice con una raya', () => {
    expect(tasa(0, 0), 'un consultorio recién abierto no tiene 0% de atención').toBeNull()
    expect(porcentaje(tasa(0, 0))).toBe('—')
  })

  it('un cero DE VERDAD sigue siendo cero: cero ausencias de ocho citas', () => {
    expect(tasa(0, 8)).toBe(0)
    expect(porcentaje(tasa(0, 8))).toBe('0%')
  })

  it('las tasas normales se calculan y se redondean como antes', () => {
    expect(porcentaje(tasa(5, 8))).toBe('63%')
    expect(porcentaje(tasa(1, 8))).toBe('13%')
    expect(porcentaje(tasa(8, 8))).toBe('100%')
  })

  it('un denominador imposible tampoco inventa un número', () => {
    // NaN, infinito y negativo entran por la puerta de atrás cuando alguien
    // resta dos contadores; ninguno puede acabar en un porcentaje pintado.
    expect(tasa(1, Number.NaN)).toBeNull()
    expect(tasa(1, Number.POSITIVE_INFINITY)).toBeNull()
    expect(tasa(1, -3)).toBeNull()
  })

  it('«0%» y «—» no se confunden nunca: son dos hechos distintos', () => {
    // Sin este caso, una implementación que devolviera 0 para todo pasaría los
    // dos primeros a medias y nadie vería que el hueco y el cero se juntaron.
    expect(porcentaje(tasa(0, 0))).not.toBe(porcentaje(tasa(0, 8)))
  })
})
