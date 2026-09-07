/**
 * GOLDEN — el hueco que deja una cita de duración distinta SÍ se ofrece.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los inicios posibles de `getAvailableSlots` salían de un solo sitio —la hora
 * de apertura, a saltos fijos— y nada volvía a anclar la rejilla. En cuanto una
 * cita de duración distinta rompía el ritmo, el hueco que dejaba detrás no
 * existía para el producto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contado por el dueño el 7-sep-2026, con el caso de una dermatóloga que agenda
 * 45 min, luego 15, luego 30. Con `intervaloMinutos: 30` y jornada 09:00-14:00
 * la pantalla ofrecía:
 *
 *     45 min, día vacío   09:00  09:45  10:30  11:15  12:00
 *     luego una de 15     10:00  10:30  11:00  …          ← las 09:45 no salían
 *
 * La de 45 termina a las 09:45 y la de 15 cabe entera antes de las 10:00. Ese
 * cuarto de hora se perdía TODOS los días, y no se podía pedir a mano: el campo
 * de hora libre del modal sólo aparece cuando no queda ningún hueco.
 *
 * No hacía falta un intervalo raro para verlo. Con `intervaloMinutos: 10`, tras
 * esa misma cita de 45 min, una de 30 se ofrecía a las 10:00 y nunca a las
 * 09:45: la rejilla de 30 va 09:00, 09:30, 10:00 y jamás se recoloca.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * A los inicios del reloj se les suman los instantes donde TERMINA algo: cada
 * cita del día y cada descanso. Es aditivo (ningún hueco de antes desaparece) y
 * acotado (como mucho un ancla por cita, no una rejilla más fina). Las anclas
 * pasan por los MISMOS filtros que la rejilla —pasado, descanso, bloqueo,
 * empalme, cierre—, así que un ancla no puede colar una hora que no cabe.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con el bucle anterior (`for (let m = startMin; …; m += interval)`) los tres
 * primeros casos fallan: las 09:45 no aparecen en ninguno.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * - El final de un BLOQUEO no ancla (ver el comentario del módulo): `TimeBlock`
 *   guarda instantes ISO y pasarlos a minutos del día pide la zona horaria del
 *   consultorio. Un bloqueo que acaba a las 11:20 sigue sin ofrecer las 11:20.
 * - No cubre que el paso del reloj respete `intervaloMinutos` cuando la cita
 *   dura más: eso sigue siendo `Math.max(intervalo, duración)` a propósito, y lo
 *   vigila `availability.test.ts` («el paso nunca es menor que la duración»).
 * - No prueba nada de la interfaz. Que el médico PUEDA teclear una hora libre
 *   cuando la lista no la trae lo cubre `la-hora-a-mano-siempre-esta.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAvailableSlots } from '@/lib/availability'
import type { ClinicConfig, Appointment } from '@/types'

// 2026-08-03 es lunes.
const LUNES = '2026-08-03'

const dia = { activo: true, inicio: '09:00', fin: '14:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
  intervaloMinutos: 30,
  diasFestivos: [],
  zonaHoraria: 'America/Mexico_City',
  horario: {
    lunes: dia, martes: dia, miercoles: dia, jueves: dia, viernes: dia,
    sabado: { activo: false, inicio: '09:00', fin: '14:00' },
    domingo: { activo: false, inicio: '09:00', fin: '14:00' },
  },
  ...over,
} as unknown as ClinicConfig)

/** Una cita confirmada del lunes, con su duración real. */
const cita = (id: string, hora: string, duracion: number): Appointment =>
  ({ id, fechaHora: `${LUNES} ${hora}`, duracion, estado: 'confirmada' }) as unknown as Appointment

// El reloj se congela LEJOS del lunes de prueba: si no, «no ofrecer horas que ya
// pasaron» recortaría el día y la prueba mediría otra cosa.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-01T15:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('El caso de la dermatóloga: 45, luego 15, luego 30', () => {
  it('tras una cita de 45 min, la de 15 se ofrece a las 09:45 y no a las 10:00', () => {
    const k = cfg({ intervaloMinutos: 30 })
    const slots = getAvailableSlots(LUNES, 15, [cita('a', '09:00', 45)], k)
    expect(slots).toContain('09:45')
    // Y sigue siendo el PRIMERO: el hueco más temprano es el que se ofrece antes.
    expect(slots[0]).toBe('09:45')
  })

  it('y después, la de 30 min encaja a las 10:00', () => {
    const k = cfg({ intervaloMinutos: 30 })
    const agenda = [cita('a', '09:00', 45), cita('b', '09:45', 15)]
    expect(getAvailableSlots(LUNES, 30, agenda, k)[0]).toBe('10:00')
  })

  it('el intervalo fino tampoco salvaba el caso: con 10 min, una de 30 no veía las 09:45', () => {
    // El paso era max(10, 30) = 30 → 09:00, 09:30, 10:00. Las 09:45 nunca.
    const k = cfg({ intervaloMinutos: 10 })
    expect(getAvailableSlots(LUNES, 30, [cita('a', '09:00', 45)], k)).toContain('09:45')
  })
})

describe('Un ancla no puede colar una hora que no cabe', () => {
  it('la cita que termina demasiado tarde NO ancla: no cabría antes del cierre', () => {
    // Termina 13:40. Una cita de 30 min ahí acabaría 14:10, después del cierre.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '13:00', 40)], cfg())
    expect(slots).not.toContain('13:40')
    expect(slots.every(s => s <= '13:30')).toBe(true)
  })

  it('un ancla que cae dentro de la comida no se ofrece', () => {
    // Comida 14:00… no: la jornada acaba a las 14:00. Descanso 11:00-12:00.
    const k = cfg({
      horario: { ...cfg().horario, lunes: { ...dia, descansos: [{ inicio: '11:00', fin: '12:00' }] } },
    } as Partial<ClinicConfig>)
    // Una cita 10:30-11:10 ancla en 11:10, que cae DENTRO de la comida.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '10:30', 40)], k)
    expect(slots).not.toContain('11:10')
    // Y el final de la comida sí ancla: a las 12:00 se puede volver a atender.
    expect(slots).toContain('12:00')
  })

  it('un ancla que se empalma con OTRA cita no se ofrece', () => {
    // a: 09:00-09:45 ancla en 09:45. b ocupa 09:45-10:15 → el ancla está tomada.
    const agenda = [cita('a', '09:00', 45), cita('b', '09:45', 30)]
    const slots = getAvailableSlots(LUNES, 30, agenda, cfg())
    expect(slots).not.toContain('09:45')
    expect(slots).toContain('10:15')   // el ancla de b, que sí está libre
  })

  it('una cita cancelada no ancla nada: no ocupa, luego no deja hueco detrás', () => {
    const cancelada = { ...cita('a', '09:00', 45), estado: 'cancelada' } as unknown as Appointment
    expect(getAvailableSlots(LUNES, 15, [cancelada], cfg())).not.toContain('09:45')
  })
})

describe('Lo aditivo es aditivo: no se pierde ningún hueco de los de antes', () => {
  it('en un día vacío la lista es EXACTAMENTE la de siempre', () => {
    // Sin citas y sin descansos no hay anclas: la rejilla del reloj, intacta.
    expect(getAvailableSlots(LUNES, 30, [], cfg({ intervaloMinutos: 30 })))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'])
  })

  it('con anclas, la lista sale ORDENADA y sin repetidos', () => {
    const agenda = [cita('a', '09:00', 45), cita('b', '11:00', 20)]
    const slots = getAvailableSlots(LUNES, 15, agenda, cfg({ intervaloMinutos: 30 }))
    expect([...slots].sort()).toEqual(slots)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('una cita que acaba justo en un hueco del reloj no lo duplica', () => {
    // 09:00 + 30 = 09:30, que YA estaba en la rejilla. El Set lo absorbe.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '09:00', 30)], cfg())
    expect(slots.filter(s => s === '09:30')).toHaveLength(1)
  })
})
