/**
 * GOLDEN — desde qué estados puede el paciente tocar su cita.
 *
 * El portal sólo bloqueaba los estados TERMINALES, y eso deja fuera lo que de
 * verdad importa: una cita **pagada** podía pasar a «confirmada» con un toque
 * desde el enlace del portal. El estado que decía que el dinero ya entró
 * desaparecía, y con él la cita salía del control de cobro.
 *
 * Es lista BLANCA a propósito: con lista negra, cada estado nuevo del producto
 * nace tocable por el paciente y hay que acordarse de prohibirlo.
 */
import { describe, it, expect } from 'vitest'
import { DESDE_EL_PORTAL, puedeTocarDesdeElPortal } from '@/lib/portal/estados'

describe('DESDE_EL_PORTAL', () => {
  it('deja tocar lo que todavía es una cita por venir', () => {
    for (const e of ['solicitada', 'pendiente-datos', 'pendiente-confirmar', 'confirmada', 'recordatorio-enviado']) {
      expect(DESDE_EL_PORTAL.has(e)).toBe(true)
    }
  })

  it('NO deja tocar lo que ya movió dinero', () => {
    expect(DESDE_EL_PORTAL.has('pagada')).toBe(false)
    expect(DESDE_EL_PORTAL.has('pendiente-pago')).toBe(false)
  })

  it('NO deja tocar al paciente que ya está adentro', () => {
    // El tablero de recepción lo perdía de vista.
    expect(DESDE_EL_PORTAL.has('en-sala')).toBe(false)
    expect(DESDE_EL_PORTAL.has('en-consulta')).toBe(false)
  })

  it('NO deja tocar lo terminal', () => {
    for (const e of ['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada']) {
      expect(DESDE_EL_PORTAL.has(e)).toBe(false)
    }
  })

  it('un estado que nadie previó nace PROTEGIDO, no tocable', () => {
    expect(DESDE_EL_PORTAL.has('un-estado-que-alguien-invente-manana')).toBe(false)
  })
})

describe('puedeTocarDesdeElPortal', () => {
  it('una cita futura normal, sí', () => {
    expect(puedeTocarDesdeElPortal({ estado: 'confirmada' })).toBe(true)
  })

  it('una cita CON COBRO, no — aunque su estado esté en la lista', () => {
    // Cancelar o mover una cita ya cobrada deja dinero contra nada, y qué hacer
    // con ese dinero es del consultorio, no un botón del paciente.
    expect(puedeTocarDesdeElPortal({ estado: 'confirmada', cobroId: 'cob-1' })).toBe(false)
  })

  it('confirmar SÍ se permite con cobro: no mueve el hueco ni el dinero', () => {
    expect(puedeTocarDesdeElPortal({ estado: 'confirmada', cobroId: 'cob-1' }, { permiteCobrada: true })).toBe(true)
  })
})
