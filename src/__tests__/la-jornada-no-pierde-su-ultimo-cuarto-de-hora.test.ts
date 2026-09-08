/**
 * GOLDEN — LA JORNADA NO PIERDE SU ÚLTIMO CUARTO DE HORA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-654 enseñó al motor a recolocar la rejilla donde TERMINA algo, que cierra
 * el hueco que una cita deja detrás. Un hueco tiene dos extremos, y el otro se
 * quedó sin cubrir: **el que muere contra una pared**.
 *
 * Medido sobre una jornada VACÍA de 15:00 a 19:00 con una primera consulta de
 * 45 min. No hay ninguna cita, así que no hay ningún ancla de REG-654 que
 * poner, y la rejilla base va de 45 en 45 desde la apertura:
 *
 *     15:00  15:45  16:30  17:15  18:00        ← y ahí se acaba
 *
 * `18:00 + 45 = 18:45`. Los últimos quince minutos **no los podía usar nadie,
 * ningún día**, aunque `18:15-19:00` cabe exacto contra el cierre.
 *
 * Lo mismo contra cualquier otra pared: con una cita puesta a las 17:00 y el
 * hueco anterior de 16:00 a 17:00, una consulta de 45 sólo se ofrecía a las
 * 16:00 —termina a las 16:45— y el cuarto de hora de 16:45 a 17:00 se perdía,
 * cuando `16:15-17:00` habría dejado la agenda pegada.
 *
 * Y una asimetría aparte, de las que este repositorio ya tiene escritas dos
 * veces para los bloqueos: `hasConflict` **no miraba los descansos**. Un médico
 * de 10-13 y 15-19 lo declara con un descanso de 13:00 a 15:00, y una cita de
 * 12:45 a 13:15 cruzaba la comida entera: no se OFRECÍA, pero sí se ACEPTABA.
 * El camino para llegar ahí no es raro — el campo de hora manual permite pedir
 * cualquier hora, que es justo lo que abrió REG-654.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Corriendo los casos del acta del dueño (A…J) contra el motor de `main` uno
 * por uno, en vez de darlos por cubiertos porque la causa raíz ya se hubiera
 * tocado. Tres de ellos seguían rojos sobre v1189.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Las anclas van en las DOS direcciones: `pared.hasta` (donde nace un hueco) y
 * `pared.desde - duracion` (el último arranque que cabe entero antes de ella).
 * Y lo que una puerta no ofrece, ninguna puerta lo acepta.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El inicio ni el final de un BLOQUEO anclan — `TimeBlock` guarda instantes
 *   que pueden venir en absoluto o en hora de pared, y REG-654 ya declaró por
 *   qué se deja fuera. Esa hora se pide a mano.
 * · No prueba la escritura concurrente: eso es `gp9-alta-de-cita-no-duplica`.
 * · No opina sobre el PASO de la rejilla, que fija REG-653 (la duración del
 *   tipo de cita) y aquí se toma como está.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAvailableSlots, hasConflict, iniciosPosibles } from '@/lib/availability'
import type { ClinicConfig, Appointment } from '@/types'

// 2026-09-15 es MARTES — la tarde del ejemplo del dueño.
const MARTES = '2026-09-15'

const tarde = { activo: true, inicio: '15:00', fin: '19:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
  intervaloMinutos: 30,
  diasFestivos: [],
  zonaHoraria: 'America/Mexico_City',
  duraciones: {},
  horario: {
    lunes: tarde, martes: tarde, miercoles: tarde, jueves: tarde, viernes: tarde,
    sabado: { activo: false, inicio: '15:00', fin: '19:00' },
    domingo: { activo: false, inicio: '15:00', fin: '19:00' },
  },
  ...over,
} as unknown as ClinicConfig)

const citaEn = (hora: string, duracion: number, over: Record<string, unknown> = {}): Appointment =>
  ({ id: hora, fechaHora: `${MARTES} ${hora}`, duracion, estado: 'confirmada', ...over }) as unknown as Appointment

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-01T15:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('CASO D — la jornada termina cuando termina', () => {
  it('18:15–19:00 se OFRECE sobre una jornada vacía', () => {
    // Ésta es la que fallaba: sin ninguna cita no hay ancla de REG-654, y la
    // rejilla de 45 desde las 15:00 se para en las 18:00.
    expect(getAvailableSlots(MARTES, 45, [], cfg())).toContain('18:15')
  })

  it('y se acepta; 18:30–19:15 no', () => {
    expect(hasConflict(MARTES, '18:15', 45, [], undefined, [], undefined, cfg())).toBe(false)
    expect(getAvailableSlots(MARTES, 45, [], cfg())).not.toContain('18:30')
    expect(hasConflict(MARTES, '18:30', 45, [], undefined, [], undefined, cfg())).toBe(true)
  })

  it('el hueco que muere contra otra cita también se aprovecha por su final', () => {
    // Hueco de 16:00 a 17:00 (la cita de las 15:00 dura 60, y hay otra a las
    // 17:00). Una consulta de 45 cabe si arranca a las 16:15, no a las 16:00.
    const puestas = [citaEn('15:00', 60, { id: 'a' }), citaEn('17:00', 30, { id: 'b' })]
    const slots = getAvailableSlots(MARTES, 45, puestas, cfg())
    expect(slots).toContain('16:15')
    expect(hasConflict(MARTES, '16:15', 45, puestas, undefined, [], undefined, cfg())).toBe(false)
  })
})

describe('CASO E — el descanso se respeta al ACEPTAR, no sólo al ofrecer', () => {
  const partido = cfg({
    horario: {
      ...cfg().horario,
      martes: { activo: true, inicio: '10:00', fin: '19:00', descansos: [{ inicio: '13:00', fin: '15:00' }] },
    },
  } as Partial<ClinicConfig>)

  it('12:45–13:15 ni se ofrece ni se acepta', () => {
    expect(getAvailableSlots(MARTES, 30, [], partido)).not.toContain('12:45')
    // Esto es lo que faltaba: `hasConflict` no miraba los descansos.
    expect(hasConflict(MARTES, '12:45', 30, [], undefined, [], undefined, partido)).toBe(true)
  })

  it('12:30–13:00, que termina justo al empezar el descanso, sí', () => {
    expect(hasConflict(MARTES, '12:30', 30, [], undefined, [], undefined, partido)).toBe(false)
  })

  it('y el descanso también ancla por sus dos lados', () => {
    // 15:00 (donde acaba) y 12:30 (último arranque de 30 min antes de las 13:00).
    const slots = getAvailableSlots(MARTES, 30, [], partido)
    expect(slots).toContain('15:00')
    expect(slots).toContain('12:30')
  })
})

describe('La tarde del dueño, entera', () => {
  it('CASO C — seis citas consecutivas, sin un minuto muerto', () => {
    const agenda: [string, number][] = [
      ['15:00', 45], ['15:45', 15], ['16:00', 30],
      ['16:30', 45], ['17:15', 60], ['18:15', 45],
    ]
    const puestas: Appointment[] = []
    for (const [hora, dur] of agenda) {
      expect(getAvailableSlots(MARTES, dur, puestas, cfg())).toContain(hora)
      expect(hasConflict(MARTES, hora, dur, puestas, undefined, [], undefined, cfg())).toBe(false)
      puestas.push(citaEn(hora, dur))
    }
    // 240 minutos de jornada, 240 agendados: no queda ni un hueco de 15.
    expect(getAvailableSlots(MARTES, 15, puestas, cfg())).toEqual([])
  })

  it('CASO B — 15:44 sobre una cita de 15:00–15:45 se rechaza (un minuto de solape)', () => {
    const puestas = [citaEn('15:00', 45)]
    expect(hasConflict(MARTES, '15:44', 31, puestas, undefined, [], undefined, cfg())).toBe(true)
    // Y las 15:45, que empiezan justo cuando la otra termina, se aceptan.
    expect(hasConflict(MARTES, '15:45', 15, puestas, undefined, [], undefined, cfg())).toBe(false)
  })

  it('CASO F — una hora escrita a mano (16:17 + 45 min) se acepta si está libre', () => {
    expect(hasConflict(MARTES, '16:17', 45, [], undefined, [], undefined, cfg())).toBe(false)
    expect(hasConflict(MARTES, '16:17', 45, [citaEn('17:00', 30)], undefined, [], undefined, cfg())).toBe(true)
  })
})

describe('`iniciosPosibles` — la aritmética que comparten las tres pantallas', () => {
  it('ancla por los dos lados de cada pared', () => {
    // Jornada 0–100, cita de 30 a 40, consulta de 20.
    const r = iniciosPosibles(0, 100, 20, 20, [{ desde: 40, hasta: 70 }])
    expect(r).toContain(70)   // enseguida de la pared
    expect(r).toContain(20)   // último arranque que cabe antes de ella (40−20)
    expect(r).toContain(80)   // último arranque antes del cierre (100−20)
  })

  it('AL REVÉS — nunca ofrece un inicio que no cabe entero', () => {
    const r = iniciosPosibles(0, 100, 20, 20, [{ desde: 40, hasta: 70 }])
    expect(r.every(m => m >= 0 && m + 20 <= 100)).toBe(true)
    expect(r).not.toContain(90)
  })

  it('es ADITIVO: la rejilla base nunca pierde un inicio', () => {
    const base = iniciosPosibles(0, 100, 20, 20, [])
    const conParedes = iniciosPosibles(0, 100, 20, 20, [{ desde: 40, hasta: 70 }])
    for (const m of base) expect(conParedes).toContain(m)
  })

  it('una pared corrupta se ignora en vez de romper el día', () => {
    const r = iniciosPosibles(0, 100, 20, 20, [{ desde: NaN, hasta: NaN }])
    expect(r.length).toBeGreaterThan(0)
  })

  it('un paso corrupto no cuelga el bucle ni deja el día en una sola hora', () => {
    expect(iniciosPosibles(0, 100, 20, 0, []).length).toBeGreaterThan(1)
    expect(iniciosPosibles(0, 100, 20, NaN, []).length).toBeGreaterThan(1)
  })
})
