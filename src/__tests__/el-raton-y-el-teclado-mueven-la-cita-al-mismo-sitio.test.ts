/**
 * GOLDEN — EL RATÓN Y EL TECLADO MUEVEN LA CITA AL MISMO SITIO.
 *
 * ── QUÉ RIESGO CIERRA ────────────────────────────────────────────────────────
 *
 * Arrastrar es un gesto de ratón. La tentación al construirlo es resolver el
 * ratón primero y «añadir teclado después», y ese después no llega: la regla de
 * diseño de este repositorio lo dice con todas las letras —control interactivo
 * que sólo funciona con ratón falla la compuerta— y ya pasó una vez en esta
 * misma pantalla, cuando la celda ocupada se quedó con un `onClick` suelto
 * «para no perder función».
 *
 * El peligro no es sólo que el teclado no funcione. Es que funcione DISTINTO:
 * si el ratón imanta a las 15:45 y las flechas sólo alcanzaran múltiplos de 15,
 * ese hueco sería inalcanzable para quien no usa ratón, y nadie lo notaría —
 * el que no puede llegar a un hueco no se queja de un hueco que no ve.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Los dos gestos comparten aritmética (`proponerMovimiento`), el mismo paso
 * menudo de 5 minutos y el MISMO guardián (`hasConflict`, con la cita excluida).
 * Lo único que los separa es el imán, y por una razón dicha: el teclado ya es
 * preciso, y un imán ahí saltaría posiciones que el usuario recorre a propósito,
 * una pulsación a la vez.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · Los eventos de puntero, el fantasma y el foco — eso es pantalla y se
 *   comprueba en el arnés visual, no aquí.
 * · La escritura: `POST /api/appointments` con `reagendarId` la re-valida en
 *   transacción y tiene sus propios goldens.
 * · Redimensionar (cambiar la duración): no se toca en esta unidad.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  proponerMovimiento, paredesDelDia, cuerpoDelMovimiento, PASO_DE_FLECHA,
} from '@/lib/agenda/mover-cita-en-la-rejilla'
import { PASO_AL_SOLTAR } from '@/lib/agenda/soltar-cita'
import type { Appointment, ClinicConfig } from '@/types'

const MARTES = '2026-09-15'
const tarde = { activo: true, inicio: '15:00', fin: '19:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
  intervaloMinutos: 30, diasFestivos: [], zonaHoraria: 'America/Mexico_City', duraciones: {},
  horario: {
    lunes: tarde, martes: tarde, miercoles: tarde, jueves: tarde, viernes: tarde,
    sabado: { activo: false, inicio: '15:00', fin: '19:00' },
    domingo: { activo: false, inicio: '15:00', fin: '19:00' },
  },
  ...over,
} as unknown as ClinicConfig)

const cita = (id: string, hora: string, duracion: number, over: Record<string, unknown> = {}): Appointment =>
  ({
    id, fechaHora: `${MARTES} ${hora}`, duracion, estado: 'confirmada',
    pacienteNombre: 'Paciente Sintético', pacienteTelefono: '5550000000',
    tipo: 'seguimiento', origen: 'Manual', consentimientoMensajes: true, ...over,
  }) as unknown as Appointment

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-01T15:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('Los dos gestos comparten el paso menudo', () => {
  it('arrastrar y las flechas usan los mismos cinco minutos', () => {
    // Si divergieran, un hueco alcanzable con ratón sería inalcanzable con teclado.
    expect(PASO_DE_FLECHA).toBe(PASO_AL_SOLTAR)
  })
})

describe('Arrastrar imanta; las flechas no', () => {
  const puestas = [cita('a', '15:00', 45), cita('b', '16:30', 30)]
  const laQueSeMueve = cita('x', '17:30', 15)

  it('soltar cerca de donde acaba la primera deja la cita pegada a ella', () => {
    const p = proponerMovimiento(laQueSeMueve, MARTES, 15 * 60 + 48, puestas, cfg())
    expect(p.fechaHora).toBe(`${MARTES} 15:45`)
    expect(p.etiqueta).toBe('15:45 – 16:00')
    expect(p.choca).toBe(false)
  })

  it('la misma posición con FLECHAS no imanta: respeta el minuto que el usuario alcanzó', () => {
    const p = proponerMovimiento(laQueSeMueve, MARTES, 15 * 60 + 50, puestas, cfg(), [], { imanta: false })
    expect(p.fechaHora).toBe(`${MARTES} 15:50`)
  })

  it('pero las flechas SÍ pueden llegar exactamente a la arista, paso a paso', () => {
    // 15:45 es múltiplo de 5, así que se alcanza pulsando. Ésa es la garantía:
    // ningún hueco queda reservado al ratón.
    const p = proponerMovimiento(laQueSeMueve, MARTES, 15 * 60 + 45, puestas, cfg(), [], { imanta: false })
    expect(p.fechaHora).toBe(`${MARTES} 15:45`)
    expect(p.choca).toBe(false)
  })
})

describe('El guardián es el mismo que el del modal', () => {
  const puestas = [cita('a', '15:00', 45), cita('b', '16:00', 30)]

  it('encima de otra cita CHOCA', () => {
    const p = proponerMovimiento(cita('x', '18:00', 30), MARTES, 16 * 60 + 10, puestas, cfg())
    expect(p.choca).toBe(true)
  })

  it('terminando justo cuando empieza la siguiente NO choca — adyacencia no es solape', () => {
    const p = proponerMovimiento(cita('x', '18:00', 15), MARTES, 15 * 60 + 45, puestas, cfg())
    expect(p.fechaHora).toBe(`${MARTES} 15:45`)
    expect(p.choca).toBe(false)
  })

  it('pasarse del cierre CHOCA, aunque no haya ninguna cita ahí', () => {
    const p = proponerMovimiento(cita('x', '15:00', 45), MARTES, 18 * 60 + 30, [], cfg(), [], { imanta: false })
    expect(p.fechaHora).toBe(`${MARTES} 18:30`)
    expect(p.choca).toBe(true)
  })

  it('y cruzar un descanso también', () => {
    const partido = cfg({
      horario: {
        ...cfg().horario,
        martes: { activo: true, inicio: '10:00', fin: '19:00', descansos: [{ inicio: '13:00', fin: '15:00' }] },
      },
    } as Partial<ClinicConfig>)
    const p = proponerMovimiento(cita('x', '11:00', 30), MARTES, 12 * 60 + 45, [], partido, [], { imanta: false })
    expect(p.choca).toBe(true)
  })
})

describe('La cita que se mueve no se estorba a sí misma', () => {
  it('no aparece entre sus propias paredes', () => {
    const laQueSeMueve = cita('x', '16:00', 30)
    const paredes = paredesDelDia(MARTES, laQueSeMueve, [laQueSeMueve, cita('a', '15:00', 45)], cfg())
    expect(paredes.some(p => p.desde === 16 * 60)).toBe(false)
    expect(paredes.some(p => p.desde === 15 * 60)).toBe(true)
  })

  it('y dejarla donde estaba no choca ni cuenta como cambio', () => {
    const laQueSeMueve = cita('x', '16:00', 30)
    const p = proponerMovimiento(laQueSeMueve, MARTES, 16 * 60, [laQueSeMueve], cfg(), [], { imanta: false })
    expect(p.choca).toBe(false)
    expect(p.sinCambio).toBe(true)
  })

  it('una cita CANCELADA no estorba: su hueco está libre', () => {
    const muerta = cita('a', '16:00', 30, { estado: 'cancelada' })
    const paredes = paredesDelDia(MARTES, cita('x', '18:00', 30), [muerta], cfg())
    expect(paredes).toEqual([])
  })

  it('y la de OTRO médico tampoco', () => {
    const ajena = cita('a', '16:00', 30, { medicoId: 'doc-2' })
    const mia = cita('x', '18:00', 30, { medicoId: 'doc-1' })
    expect(paredesDelDia(MARTES, mia, [ajena], cfg())).toEqual([])
  })
})

describe('Lo que viaja al servidor', () => {
  it('lleva los campos del modal, con la fecha nueva', () => {
    const c = cita('x', '16:00', 30, { motivo: 'control', medicoId: 'doc-1' })
    const cuerpo = cuerpoDelMovimiento(c, `${MARTES} 17:15`)
    expect(cuerpo.fechaHora).toBe(`${MARTES} 17:15`)
    expect(cuerpo.duracion).toBe(30)
    expect(cuerpo.estado).toBe('confirmada')
    expect(cuerpo.motivo).toBe('control')
    expect(cuerpo.medicoId).toBe('doc-1')
  })

  it('AL REVÉS — no manda banderas de recordatorio ni de cobro', () => {
    // Reenviarlas con el valor congelado del render las pisaría: es el defecto
    // que el modal ya tiene documentado (el recordatorio se mandaría dos veces).
    const cuerpo = cuerpoDelMovimiento(cita('x', '16:00', 30), `${MARTES} 17:00`) as Record<string, unknown>
    for (const prohibido of [
      'recordatorio24hEnviado', 'recordatorioMismoDiaEnviado', 'confirmadoPaciente',
      'cobroId', 'cobradoEn', 'cobroExento', 'googleCalendarSyncStatus',
    ]) {
      expect(cuerpo, prohibido).not.toHaveProperty(prohibido)
    }
  })

  it('sin médico, no inventa el campo', () => {
    const cuerpo = cuerpoDelMovimiento(cita('x', '16:00', 30), `${MARTES} 17:00`) as Record<string, unknown>
    expect(cuerpo).not.toHaveProperty('medicoId')
  })
})

describe('Sin configuración no se afirma que cabe', () => {
  it('sin config el choque queda en `false` y la decisión se la queda el servidor', () => {
    // No se inventa un horario por defecto: eso sería decidir con un dato que no
    // se tiene. El servidor re-valida en transacción y responde 409 con motivo.
    const p = proponerMovimiento(cita('x', '16:00', 30), MARTES, 20 * 60, [], null, [], { imanta: false })
    expect(p.choca).toBe(false)
    expect(p.fechaHora).toBe(`${MARTES} 20:00`)
  })
})
