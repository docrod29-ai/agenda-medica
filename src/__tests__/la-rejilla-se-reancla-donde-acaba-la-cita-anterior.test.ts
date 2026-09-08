/**
 * GOLDEN — el hueco que deja una cita de duración distinta SÍ se ofrece.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los inicios de `getAvailableSlots` salían de un solo sitio —la hora de
 * apertura, a saltos fijos— y nada volvía a anclar la rejilla. En cuanto una
 * cita de duración distinta rompía el ritmo, el hueco que dejaba detrás no
 * existía para el producto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contado por el dueño el 7-sep-2026, con el caso de una dermatóloga que agenda
 * 45 min, luego 15, luego 30.
 *
 * ── SU RELACIÓN CON REG-653, QUE ATERRIZÓ ANTES ─────────────────────────────
 *
 * REG-653 llegó a `main` mientras esta rama estaba abierta y cambió el PASO de
 * la rejilla: de `Math.max(intervaloMinutos, duración)` a la duración del tipo
 * de cita. Eso arregló la perilla que mentía —«5 minutos» con la agenda yendo
 * de 30 en 30— y de paso cubrió el segundo tramo del caso de la dermatóloga: si
 * la siguiente cita dura 15, las 09:45 ya caen en la rejilla base.
 *
 * **Y no cerró este defecto.** El paso se sigue contando DESDE LA APERTURA, así
 * que un hueco que no cae en múltiplo de la duración desde la hora de abrir
 * sigue sin existir. El caso vivo hoy es el tercer tramo:
 *
 *     tras la de 45 (09:00-09:45), una de 30
 *     rejilla base       09:00  09:30  10:00  …      ← las 09:45 no están
 *
 * Por eso los casos de aquí abajo usan duraciones que NO dividen el hueco: con
 * duraciones que sí lo dividen, la rejilla base de REG-653 acierta sola y el
 * caso no probaría nada. Un caso que pasa sin el arreglo no es un caso.
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
 * Quitando las cuatro líneas del re-anclaje (`anclar` y sus dos bucles) y
 * dejando sólo la rejilla base, caen los cuatro casos del primer bloque.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El final de un BLOQUEO no ancla (ver el comentario del módulo): `TimeBlock`
 *   guarda instantes ISO y pasarlos a minutos del día pide la zona horaria del
 *   consultorio. Un bloqueo que acaba a las 11:20 sigue sin ofrecer las 11:20.
 * · No cubre el PASO de la rejilla base: eso es de REG-653 y lo vigila
 *   `el-intervalo-de-agenda-decia-cinco-y-la-agenda-iba-de-treinta.test.ts`.
 * · No prueba nada de la interfaz. Que el médico PUEDA teclear una hora libre
 *   cuando la lista no la trae lo cubre `la-hora-a-mano-siempre-esta.test.ts`.
 * · No dice si agendar en ese hueco es buena idea clínicamente. Sólo que el
 *   hueco existe y se ofrece.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAvailableSlots } from '@/lib/availability'
import type { ClinicConfig, Appointment } from '@/types'

// 2026-08-03 es lunes.
const LUNES = '2026-08-03'

const dia = { activo: true, inicio: '09:00', fin: '14:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
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

describe('La rejilla se recoloca donde acaba lo que ya hay', () => {
  it('tras una cita de 45 min, una de 30 se ofrece a las 09:45', () => {
    // Rejilla base (paso 30 desde las 09:00): 09:00, 09:30, 10:00 — las 09:45 NO.
    // Es el tercer tramo del caso de la dermatóloga, el que REG-653 no cubre.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '09:00', 45)], cfg())
    expect(slots).toContain('09:45')
    expect(slots[0]).toBe('09:45')   // y es el hueco más temprano que hay
  })

  it('y con 20 min, que tampoco divide el hueco', () => {
    // Rejilla base (paso 20): 09:00, 09:20, 09:40… — los tres primeros se
    // empalman con la cita de 45. Sin ancla, el primer libre serían las 10:00.
    const slots = getAvailableSlots(LUNES, 20, [cita('a', '09:00', 45)], cfg())
    expect(slots[0]).toBe('09:45')
  })

  it('el final de la comida también recoloca', () => {
    // Paso 25 desde las 09:00 nunca cae en las 12:00, que es cuando se vuelve a
    // atender. Sin ancla, la tarde empezaría a las 12:20.
    const k = cfg({
      horario: { ...cfg().horario, lunes: { ...dia, descansos: [{ inicio: '11:00', fin: '12:00' }] } },
    } as Partial<ClinicConfig>)
    const slots = getAvailableSlots(LUNES, 25, [], k)
    expect(slots).toContain('12:00')
  })

  it('dos citas seguidas recolocan dos veces', () => {
    // a 09:00-09:45 y b 09:45-10:15 (la propia agenda de la dermatóloga).
    // Para una de 30, el ancla útil es el final de b: las 10:15.
    const agenda = [cita('a', '09:00', 45), cita('b', '09:45', 30)]
    const slots = getAvailableSlots(LUNES, 30, agenda, cfg())
    expect(slots).toContain('10:15')
    expect(slots).not.toContain('09:45')   // ocupada por b
  })
})

describe('Un ancla no puede colar una hora que no cabe', () => {
  it('la cita que termina demasiado tarde NO ancla', () => {
    // Termina 13:40. Una de 30 ahí acabaría 14:10, después del cierre.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '13:00', 40)], cfg())
    expect(slots).not.toContain('13:40')
    expect(slots.every(s => s <= '13:30')).toBe(true)
  })

  it('un ancla que cae dentro de la comida no se ofrece', () => {
    const k = cfg({
      horario: { ...cfg().horario, lunes: { ...dia, descansos: [{ inicio: '11:00', fin: '12:00' }] } },
    } as Partial<ClinicConfig>)
    // Una cita 10:30-11:10 ancla en 11:10, que cae DENTRO de la comida.
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '10:30', 40)], k)
    expect(slots).not.toContain('11:10')
  })

  it('una cita cancelada no ancla nada: no ocupa, luego no deja hueco detrás', () => {
    // Duración 30 a propósito: las 09:45 no están en la rejilla base, así que si
    // aparecieran sólo podría ser porque una cita CANCELADA ancló.
    const cancelada = { ...cita('a', '09:00', 45), estado: 'cancelada' } as unknown as Appointment
    expect(getAvailableSlots(LUNES, 30, [cancelada], cfg())).not.toContain('09:45')
  })

  it('la cita de OTRO médico no ancla en la agenda de éste', () => {
    const deOtro = { ...cita('a', '09:00', 45), medicoId: 'dr-b' } as unknown as Appointment
    const slots = getAvailableSlots(LUNES, 30, [deOtro], cfg(), undefined, [], 'dr-a')
    expect(slots).not.toContain('09:45')
  })
})

describe('Lo aditivo es aditivo: no se pierde ningún hueco de los de antes', () => {
  it('en un día vacío la lista es EXACTAMENTE la rejilla base', () => {
    expect(getAvailableSlots(LUNES, 30, [], cfg()))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'])
  })

  it('con anclas, la lista sale ORDENADA y sin repetidos', () => {
    const agenda = [cita('a', '09:00', 45), cita('b', '11:00', 20)]
    const slots = getAvailableSlots(LUNES, 25, agenda, cfg())
    expect([...slots].sort()).toEqual(slots)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('una cita que acaba justo en un hueco de la rejilla no lo duplica', () => {
    const slots = getAvailableSlots(LUNES, 30, [cita('a', '09:00', 30)], cfg())
    expect(slots.filter(s => s === '09:30')).toHaveLength(1)
  })
})
