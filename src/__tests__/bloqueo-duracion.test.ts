/**
 * GOLDEN — un bloqueo bloquea toda la cita, no sólo su minuto de inicio.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `estaBloqueado` recibe un instante y pregunta si ESE INSTANTE cae dentro del
 * bloque. Ningún llamador le pasaba la duración, así que una consulta de 60
 * minutos a las 10:00 contra un bloqueo de 10:30 a 13:00 **no estaba bloqueada**:
 * las 10:00 no caen dentro del bloque.
 *
 * La cita entraba ENTERA encima de la ausencia, el quirófano o las vacaciones —
 * y por los cuatro caminos que agendan: el cálculo de huecos, el chequeo de
 * conflicto, el alta del consultorio y la reserva pública.
 *
 * ── LO IRÓNICO ───────────────────────────────────────────────────────────────
 *
 * La aritmética correcta ya estaba escrita en este repositorio:
 * `pisaDescanso(inicio, fin, …)` comprueba el SOLAPE, con el comentario «basta
 * con que se solapen, no hace falta contenerlo». Los descansos de comida estaban
 * bien resueltos y las vacaciones no.
 *
 * Lo encontró la auditoría de lanzamiento (panel de 7 especialistas), y lo
 * verifiqué leyendo `time-blocks-core.ts` antes de tocar nada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pisaBloqueo, estaBloqueado, type TimeBlock } from '@/lib/time-blocks-core'

const TZ = 'America/Mexico_City'

/** Bloqueo de 10:30 a 13:00, hora de la clínica. */
const QUIROFANO: TimeBlock = {
  id: 'b1',
  desde: '2026-08-10T16:30:00.000Z',  // 10:30 en CDMX (UTC-6)
  hasta: '2026-08-10T19:00:00.000Z',  // 13:00
  tipo: 'evento',
  motivo: 'Quirófano',
} as TimeBlock

describe('EL CASO QUE SE COLABA', () => {
  it('una consulta de 60 min a las 10:00 SÍ pisa un bloqueo de 10:30', () => {
    expect(pisaBloqueo('2026-08-10 10:00', 60, [QUIROFANO], undefined, TZ)?.motivo).toBe('Quirófano')
  })

  it('y el chequeo puntual de antes la dejaba pasar — por eso hizo falta esto', () => {
    // Se conserva a propósito: documenta el fallo y sirve para preguntar por un
    // instante suelto.
    expect(estaBloqueado('2026-08-10 10:00', [QUIROFANO], undefined, TZ)).toBeNull()
  })
})

describe('los bordes', () => {
  it('una cita que TERMINA justo cuando empieza el bloqueo no lo pisa', () => {
    // 10:00 + 30 = 10:30, y el bloqueo empieza a las 10:30: no se solapan.
    expect(pisaBloqueo('2026-08-10 10:00', 30, [QUIROFANO], undefined, TZ)).toBeNull()
  })

  it('una cita que EMPIEZA justo cuando termina el bloqueo tampoco', () => {
    expect(pisaBloqueo('2026-08-10 13:00', 30, [QUIROFANO], undefined, TZ)).toBeNull()
  })

  it('una cita que empieza dentro del bloqueo sí, aunque termine fuera', () => {
    expect(pisaBloqueo('2026-08-10 12:30', 60, [QUIROFANO], undefined, TZ)).not.toBeNull()
  })

  it('una cita que CONTIENE al bloqueo entero también', () => {
    expect(pisaBloqueo('2026-08-10 09:00', 300, [QUIROFANO], undefined, TZ)).not.toBeNull()
  })

  it('duración 0 se comporta como el chequeo puntual', () => {
    expect(pisaBloqueo('2026-08-10 10:00', 0, [QUIROFANO], undefined, TZ)).toBeNull()
    expect(pisaBloqueo('2026-08-10 11:00', 0, [QUIROFANO], undefined, TZ)).not.toBeNull()
  })

  it('una duración basura NO se convierte en «no bloquea»', () => {
    // Se trata como 0, que es el chequeo más estricto posible sin inventarse
    // una duración: nunca al revés.
    expect(pisaBloqueo('2026-08-10 11:00', NaN, [QUIROFANO], undefined, TZ)).not.toBeNull()
    expect(pisaBloqueo('2026-08-10 11:00', -30, [QUIROFANO], undefined, TZ)).not.toBeNull()
  })

  it('un bloqueo con fechas corruptas se ignora, no revienta la agenda', () => {
    const malo = { ...QUIROFANO, desde: 'ayer', hasta: 'mañana' } as TimeBlock
    expect(pisaBloqueo('2026-08-10 11:00', 30, [malo], undefined, TZ)).toBeNull()
  })
})

describe('el bloqueo de UN médico no bloquea a los demás', () => {
  const soloDra: TimeBlock = { ...QUIROFANO, medicoId: 'dra-ruiz' } as TimeBlock

  it('bloquea al suyo', () => {
    expect(pisaBloqueo('2026-08-10 10:00', 60, [soloDra], 'dra-ruiz', TZ)).not.toBeNull()
  })

  it('y deja libre al otro', () => {
    expect(pisaBloqueo('2026-08-10 10:00', 60, [soloDra], 'dr-perez', TZ)).toBeNull()
  })
})

describe('los cuatro caminos que agendan lo usan', () => {
  const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

  it('el cálculo de huecos y el chequeo de conflicto', () => {
    const s = leer('src', 'lib', 'availability.ts')
    expect(s).toContain('pisaBloqueo(`${fecha} ${slot}`, duracionSegura')
    expect(s).toContain('pisaBloqueo(`${fecha} ${hora}`, endMin - startMin')
    // Y ya no queda el chequeo puntual en un camino de agendado.
    expect(s).not.toContain('estaBloqueado(')
  })

  it('el alta desde el consultorio', () => {
    const s = leer('src', 'app', 'api', 'appointments', 'route.ts')
    expect(s).toContain('pisaBloqueo(appointment.fechaHora, Number(appointment.duracion ?? 30)')
  })

  it('la reserva pública', () => {
    const s = leer('src', 'app', 'api', 'public', 'booking', 'route.ts')
    expect(s).toContain('pisaBloqueo(fechaHora, duracion,')
  })
})
