/**
 * EL PACIENTE QUE PAGA DOS VECES.
 *
 * El abono en el mostrador ya funcionaba a medias: se registra y —a propósito— no
 * marca la cita como saldada, así que sigue apareciendo «por cobrar». Correcto.
 *
 * Lo que faltaba es el resto de la frase: **nadie calculaba cuánto falta**. Un
 * paciente deja $300 de una consulta de $800 y vuelve el jueves; la asistente ve
 * «por cobrar» —lo mismo que ve en una consulta donde nadie pagó nada— y cobra
 * los $800. El paciente pagó $1,100 por una consulta de $800.
 *
 * `saldoPendiente` existía, pero sólo dentro del webhook de Stripe, para los
 * anticipos en línea. El dinero que entra por la puerta del consultorio, que es
 * casi todo, no tenía ese número por ninguna parte.
 */
import { describe, it, expect } from 'vitest'
import { situacionDeCobro, faltaCobrar, pideAtencion } from '@/lib/finanzas/estado-cobro'

const pago = (monto: number, extra: Record<string, unknown> = {}) => ({ monto, concepto: 'consulta', tipo: 'PAYMENT', ...extra })
const abono = (monto: number) => ({ monto, concepto: 'abono', tipo: 'PAYMENT' })

describe('el estado que no existía: PARCIAL', () => {
  it('EL CASO DE LOS $300 SOBRE $800', () => {
    const s = situacionDeCobro(800, [abono(300)])
    expect(s.estado).toBe('parcial')
    expect(s.pagado).toBe(300)
    expect(s.saldo).toBe(500)
  })

  it('el resumen dice las DOS cifras, no una', () => {
    // «Por cobrar» a secas es indistinguible de no haber pagado nada. Ése es el
    // renglón que hacía que se cobrara dos veces.
    const s = situacionDeCobro(800, [abono(300)])
    expect(s.resumen).toMatch(/300/)
    expect(s.resumen).toMatch(/500/)
  })

  it('varios abonos se suman', () => {
    const s = situacionDeCobro(800, [abono(300), abono(200), abono(100)])
    expect(s.pagado).toBe(600)
    expect(s.saldo).toBe(200)
    expect(s.estado).toBe('parcial')
  })

  it('el abono que completa el precio deja la consulta PAGADA', () => {
    const s = situacionDeCobro(800, [abono(300), abono(500)])
    expect(s.estado).toBe('pagado')
    expect(s.saldo).toBe(0)
  })

  it('los centavos no dejan restos de coma flotante', () => {
    // 0.1 + 0.2 en binario no es 0.3; un saldo de «0.00000001» saldría como
    // parcial para siempre y la consulta no se cerraría nunca.
    const s = situacionDeCobro(0.3, [abono(0.1), abono(0.2)])
    expect(s.saldo).toBe(0)
    expect(s.estado).toBe('pagado')
  })
})

describe('los demás estados', () => {
  it('sin nada pagado → pendiente, con el importe', () => {
    const s = situacionDeCobro(800, [])
    expect(s.estado).toBe('pendiente')
    expect(s.saldo).toBe(800)
    expect(s.resumen).toMatch(/800/)
  })

  it('sin precio → borrador: no se puede deber lo que nadie ha puesto', () => {
    expect(situacionDeCobro(null, []).estado).toBe('borrador')
    expect(situacionDeCobro(0, []).estado).toBe('borrador')
  })

  it('un cobro anulado NO cuenta como dinero', () => {
    const s = situacionDeCobro(800, [pago(800, { cancelado: true })])
    expect(s.pagado).toBe(0)
    expect(s.saldo).toBe(800)
  })

  it('«anulado» se distingue de «nadie ha pagado»', () => {
    /**
     * Las dos dejan la consulta sin cobrar, pero el motivo importa: una pide
     * cobrar y la otra pide averiguar qué pasó.
     */
    expect(situacionDeCobro(800, [pago(800, { cancelado: true })]).estado).toBe('anulado')
    expect(situacionDeCobro(800, []).estado).toBe('pendiente')
  })

  it('la devolución total deja la consulta REEMBOLSADA', () => {
    const s = situacionDeCobro(800, [pago(800), { monto: 800, tipo: 'REFUND' }])
    expect(s.estado).toBe('reembolsado')
    expect(s.pagado).toBe(0)
  })

  it('una devolución PARCIAL vuelve a dejar saldo', () => {
    const s = situacionDeCobro(800, [pago(800), { monto: 300, tipo: 'REFUND' }])
    expect(s.estado).toBe('parcial')
    expect(s.pagado).toBe(500)
    expect(s.saldo).toBe(300)
  })

  it('EL CONTRACARGO MANDA SOBRE TODO', () => {
    // El banco ya retiró el dinero: no lo compensa ningún otro cobro, y es el
    // único estado que pide mirar hoy.
    const s = situacionDeCobro(800, [pago(800), { monto: 800, tipo: 'CHARGEBACK' }])
    expect(s.estado).toBe('contracargo')
    expect(pideAtencion(s)).toBe(true)
  })
})

describe('la cortesía', () => {
  it('no es «pendiente» ni «anulada»: es su propio estado', () => {
    // Meterla en cualquiera de los dos ensucia el corte de caja, que es
    // exactamente lo que la exención existe para evitar.
    const s = situacionDeCobro(800, [], { exento: true })
    expect(s.estado).toBe('exento')
    expect(faltaCobrar(s)).toBe(false)
  })

  it('PERO NO ESCONDE UN DINERO QUE SÍ ENTRÓ', () => {
    /**
     * `exentarCobro` impide marcar cortesía sobre una consulta ya cobrada, pero
     * los datos viejos existen. Si los dos estados compiten, manda lo que
     * ocurrió: enseñar «cortesía» sobre un pago real lo haría desaparecer del
     * corte.
     */
    const s = situacionDeCobro(800, [pago(800)], { exento: true })
    expect(s.estado).toBe('pagado')
    expect(s.pagado).toBe(800)
  })
})

describe('pagado de más', () => {
  it('el excedente se declara en vez de esconderse', () => {
    // Un saldo negativo se pintaría como «faltan -$200», que no significa nada.
    const s = situacionDeCobro(800, [pago(1000)])
    expect(s.estado).toBe('pagado')
    expect(s.saldo).toBe(0)
    expect(s.excedente).toBe(200)
    expect(s.resumen).toMatch(/de más/)
    expect(pideAtencion(s)).toBe(true)
  })
})

describe('qué sale en el worklist de «por cobrar»', () => {
  it('pendiente y parcial sí; el resto no', () => {
    expect(faltaCobrar(situacionDeCobro(800, []))).toBe(true)
    expect(faltaCobrar(situacionDeCobro(800, [abono(300)]))).toBe(true)
    expect(faltaCobrar(situacionDeCobro(800, [pago(800)]))).toBe(false)
    expect(faltaCobrar(situacionDeCobro(800, [], { exento: true }))).toBe(false)
    expect(faltaCobrar(situacionDeCobro(null, []))).toBe(false)
  })
})

describe('entradas raras no rompen la cuenta', () => {
  it('montos ausentes, textos y nulos cuentan como cero', () => {
    const s = situacionDeCobro(800, [
      { monto: undefined, tipo: 'PAYMENT' },
      { monto: null, tipo: 'PAYMENT' },
      { monto: 'doscientos' as unknown as number, tipo: 'PAYMENT' },
      abono(300),
    ])
    expect(s.pagado).toBe(300)
  })

  it('un cobro sin `tipo` se trata como pago: son los históricos', () => {
    // El campo se añadió después; los cobros anteriores no lo llevan y son pagos.
    const s = situacionDeCobro(800, [{ monto: 800, concepto: 'consulta' }])
    expect(s.estado).toBe('pagado')
  })

  it('un monto negativo colado se cuenta por su valor absoluto', () => {
    // `registrarCobro` ya los rechaza, pero los datos viejos mandan.
    const s = situacionDeCobro(800, [{ monto: -300, tipo: 'PAYMENT' }])
    expect(s.pagado).toBe(300)
  })
})
