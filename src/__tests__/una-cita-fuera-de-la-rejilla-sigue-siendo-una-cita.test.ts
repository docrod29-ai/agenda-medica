/**
 * GOLDEN — una cita que no cabe en la rejilla no deja de existir.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La rejilla del calendario iba de 07:00 a 19:00, escrito a mano:
 *
 *     const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am–7pm
 *
 * y cada cita se pintaba metiéndola en la celda de su hora. Una cita a las
 * 20:30 **no encuentra celda**, así que no se pinta en ninguna parte: ni
 * atenuada, ni recogida en un «+2 más», ni con un aviso. Desaparece.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando una captura del calendario de un consultorio recién abierto, para
 * juzgar si su estado vacío estaba terminado. El estado vacío estaba bien —la
 * rejilla se explica sola y el botón de «Nueva cita» está donde tiene que
 * estar—, pero todas las filas de hora pesaban lo mismo, y al preguntar de
 * dónde salían resultó que no salían de ninguna parte: eran trece números
 * fijos que nunca habían consultado el horario del consultorio.
 *
 * Se sembraron dos citas confirmadas de hoy, a las 06:30 y a las 20:30. `/citas`
 * las lista las dos. El calendario **no enseñaba ninguna**, ni en semana ni en
 * día.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La rejilla abarca (1) el horario declarado por el consultorio —para poder
 * AGENDAR donde se atiende, no sólo ver lo agendado— y (2) las horas donde de
 * verdad hay citas. Lo segundo es lo que cierra el defecto: una cita puede caer
 * fuera del horario por sobreagenda, por una importación o porque el horario
 * cambió DESPUÉS de agendarla, y ninguna de las tres puede volverla invisible.
 *
 * El 07:00–19:00 se queda de suelo: un consultorio normal ve la misma rejilla
 * de siempre.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con el `HOURS` fijo, `npm run arnes:cita-fuera-de-hora` marca las dos citas
 * como invisibles en semana y en día. Aquí abajo, el caso de las 20:30 y el de
 * las 06:30 caen si se quita el ensanche.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide píxeles ni pinta nada**: comprueba qué horas se piden. Que la fila
 *   se dibuje es del arnés, con navegador.
 * · **El horario partido no se mira**: `DaySchedule` admite huecos dentro del
 *   día (comida) y esto sólo usa `inicio` y `fin`. La rejilla los enseñará como
 *   horas normales, igual que antes.
 * · No agrupa ni colapsa: un consultorio 24 h daría 24 filas, y está bien.
 * · No dice nada de la vista de MES, que no usa rejilla de horas.
 */
import { describe, it, expect } from 'vitest'
import { horasAEnsenar, PRIMERA_POR_DEFECTO, ULTIMA_POR_DEFECTO } from '@/lib/agenda/horas-a-ensenar'

const cita = (fechaHora: string) => ({ fechaHora })
const dia = (inicio: string, fin: string, activo = true) => ({ activo, inicio, fin })

describe('una cita fuera de la rejilla sigue siendo una cita', () => {
  it('sin nada que ensanchar, la rejilla es la de siempre', () => {
    const h = horasAEnsenar([], [])
    expect(h[0]).toBe(PRIMERA_POR_DEFECTO)
    expect(h[h.length - 1]).toBe(ULTIMA_POR_DEFECTO)
    expect(h).toHaveLength(13)
  })

  it('EL DEFECTO: una cita a las 20:30 tiene su fila', () => {
    const h = horasAEnsenar([cita('2026-08-30 20:30')], [])
    expect(h, 'la cita de las 20:30 se vuelve a quedar sin celda donde pintarse').toContain(20)
  })

  it('EL DEFECTO, por el otro lado: una cita a las 06:30 tiene su fila', () => {
    const h = horasAEnsenar([cita('2026-08-30 06:30')], [])
    expect(h, 'la cita de las 06:30 se vuelve a quedar sin celda donde pintarse').toContain(6)
    expect(h[0]).toBe(6)
  })

  it('el horario del consultorio ensancha aunque NO haya ninguna cita', () => {
    // Para poder agendar a las 20:00 hay que poder ver la fila de las 20:00.
    const h = horasAEnsenar([], [dia('08:00', '21:00')])
    expect(h).toContain(20)
    expect(h[h.length - 1], 'a las 21:00 ya cerró: esa fila no toca').toBe(20)
  })

  it('un día INACTIVO no ensancha nada', () => {
    const h = horasAEnsenar([], [dia('05:00', '23:00', false)])
    expect(h[0]).toBe(PRIMERA_POR_DEFECTO)
    expect(h[h.length - 1]).toBe(ULTIMA_POR_DEFECTO)
  })

  it('la rejilla es continua: sin huecos entre la primera y la última', () => {
    const h = horasAEnsenar([cita('2026-08-30 22:00')], [dia('06:00', '09:00')])
    expect(h[0]).toBe(6)
    expect(h[h.length - 1]).toBe(22)
    expect(h).toEqual(Array.from({ length: 17 }, (_, i) => 6 + i))
  })

  it('una hora ilegible NO mueve la rejilla — ni la ensancha ni la rompe', () => {
    // Un `fechaHora` a medio escribir no puede convertir la agenda en 24 filas
    // ni dejarla vacía. Ausencia de dato no es dato.
    const h = horasAEnsenar([cita(''), cita('2026-08-30'), cita('2026-08-30 xx:00')], [])
    expect(h[0]).toBe(PRIMERA_POR_DEFECTO)
    expect(h[h.length - 1]).toBe(ULTIMA_POR_DEFECTO)
  })
})
