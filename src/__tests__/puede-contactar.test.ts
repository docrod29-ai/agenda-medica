/**
 * GOLDEN — un fallo de lectura ofrecía escribirle a quien pidió la baja.
 *
 * La pantalla de reactivación leía la lista de bajas con `.catch(() => null)` y
 * después hacía `new Set((optSnap?.docs ?? []).map(...))`: un fallo de red, de
 * permisos o de App Check producía EXACTAMENTE el mismo conjunto vacío que un
 * consultorio donde nadie se ha dado de baja — y con él la pantalla ofrecía
 * «WhatsApp» sobre toda la base, incluida la gente que pidió expresamente que no
 * se le escriba.
 */
import { describe, it, expect } from 'vitest'
import { puedeContactar, SIN_BAJAS, SIN_FUTURAS } from '@/lib/whatsapp/puede-contactar'

describe('puedeContactar', () => {
  it('con todo leído, se puede y no hay nada que avisar', () => {
    expect(puedeContactar({ bajasLeidas: true, futurasLeidas: true }))
      .toEqual({ sePuede: true, motivo: '' })
  })

  it('SIN la lista de bajas NO se contacta a nadie', () => {
    // El daño no es simétrico: el mensaje que no se mandó se manda mañana; el
    // que se mandó a quien pidió la baja no se puede devolver.
    const v = puedeContactar({ bajasLeidas: false, futurasLeidas: true })
    expect(v.sePuede).toBe(false)
    expect(v.motivo).toBe(SIN_BAJAS)
  })

  it('la baja manda aunque tampoco se hayan leído las futuras', () => {
    const v = puedeContactar({ bajasLeidas: false, futurasLeidas: false })
    expect(v.sePuede).toBe(false)
    expect(v.motivo).toBe(SIN_BAJAS)
  })

  it('sin las citas futuras SÍ se contacta, pero se avisa', () => {
    // No hay daño de privacidad en ello: sólo el riesgo de ofrecerle cita a
    // quien ya la tiene, que es molesto, no una violación de su voluntad.
    const v = puedeContactar({ bajasLeidas: true, futurasLeidas: false })
    expect(v.sePuede).toBe(true)
    expect(v.motivo).toBe(SIN_FUTURAS)
  })

  it('el aviso de bajas explica qué hacer, no sólo que falló', () => {
    expect(SIN_BAJAS).toMatch(/Recarga la pantalla/)
  })
})
