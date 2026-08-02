/**
 * GOLDEN — la suscripción ANUAL se leía como otro plan.
 *
 * El webhook deducía el plan comparando el importe cobrado contra una tabla de
 * centavos MENSUAL. Una anual cobra el año de una vez, así que la anual de un
 * plan barato cae en el rango del mensual de uno caro: Agenda al año (12 meses
 * al precio de 10 = 349 000 ¢) se leía como **hospital** — y desde que «manda el
 * precio, no el metadato», esa lectura pisa el metadato correcto y le da al
 * cliente módulos que no compró y la llave de IA cara del dueño.
 */
import { describe, it, expect } from 'vitest'
import {
  planDeSuscripcion, IMPORTE_MENSUAL, type ClavePlan,
} from '@/lib/finanzas/plan-de-suscripcion'

const PRECIOS: Record<string, ClavePlan> = {
  price_agenda_mes: 'agenda',
  price_agenda_anual: 'agenda',
  price_hospital_mes: 'hospital',
}

describe('planDeSuscripcion', () => {
  it('EL CASO QUE ROMPÍA: la anual de Agenda no se lee como Hospital', () => {
    // 12 meses al precio de 10: 349 000 ¢, que cae en el rango de 349 900 ¢.
    const r = planDeSuscripcion({
      priceId: 'price_desconocido', importe: 349_000,
      intervalo: 'year', intervalos: 1,
      metadatoPlan: 'agenda', preciosConocidos: PRECIOS,
    })
    expect(r.plan).toBe('agenda')
    expect(r.como).toBe('metadato')
  })

  it('el price id manda: es una igualdad, no una estimación', () => {
    const r = planDeSuscripcion({
      priceId: 'price_agenda_anual', importe: 349_000, intervalo: 'year',
      metadatoPlan: 'hospital', preciosConocidos: PRECIOS,
    })
    expect(r).toEqual({ plan: 'agenda', como: 'price-id' })
  })

  it('el importe MENSUAL sigue mandando sobre el metadato viejo', () => {
    // Éste es el caso que el cambio anterior resolvía: el cliente baja de plan
    // desde el portal de Stripe y nadie actualiza el metadato.
    const r = planDeSuscripcion({
      priceId: 'price_nuevo_no_configurado', importe: IMPORTE_MENSUAL.agenda,
      intervalo: 'month', intervalos: 1,
      metadatoPlan: 'premium', preciosConocidos: PRECIOS,
    })
    expect(r).toEqual({ plan: 'agenda', como: 'importe-mensual' })
  })

  it('sin intervalo se asume mensual: es lo que había y todas las de hoy lo son', () => {
    const r = planDeSuscripcion({
      importe: IMPORTE_MENSUAL.clinica, preciosConocidos: PRECIOS,
    })
    expect(r).toEqual({ plan: 'clinica', como: 'importe-mensual' })
  })

  it('un cobro bimestral tampoco se deduce por importe', () => {
    const r = planDeSuscripcion({
      importe: IMPORTE_MENSUAL.hospital, intervalo: 'month', intervalos: 2,
      preciosConocidos: PRECIOS,
    })
    expect(r).toEqual({ plan: null, como: 'sin-resolver' })
  })

  it('cuando nada resuelve, se dice — no se adivina', () => {
    // El webhook conserva el plan actual con este resultado.
    const r = planDeSuscripcion({
      priceId: 'x', importe: 12_345, intervalo: 'month',
      metadatoPlan: 'no-es-un-plan', preciosConocidos: PRECIOS,
    })
    expect(r).toEqual({ plan: null, como: 'sin-resolver' })
  })

  it('el margen del ±15 % para prorrateos sigue vivo', () => {
    const r = planDeSuscripcion({
      importe: Math.round(IMPORTE_MENSUAL.premium * 0.9), intervalo: 'month',
      preciosConocidos: PRECIOS,
    })
    expect(r.plan).toBe('premium')
  })
})
