/**
 * «Cuánto entró» tiene UNA respuesta.
 *
 * El webhook no manejaba reembolsos ni contracargos (P0-3), y la consola del
 * dueño sumaba `platform_payments` de dos formas incompatibles: el ingreso
 * total descartaba los negativos y el pagado-por-cliente los incluía. Escribir
 * los reembolsos sin arreglar eso los habría dejado invisibles justo en el
 * número grande.
 */
import { describe, it, expect } from 'vitest'
import {
  efectivoDe, esDineroReal, resumirMovimientos, tipoDeAsiento,
  type Movimiento,
} from '@/lib/finanzas/movimientos'

const cobro = (monto: number): Movimiento => ({ tipo: 'cobro', monto, livemode: true })

describe('efectivoDe', () => {
  it('un cobro suma y un reembolso resta', () => {
    expect(efectivoDe({ tipo: 'cobro', monto: 899 })).toBe(899)
    expect(efectivoDe({ tipo: 'reembolso', monto: 899 })).toBe(-899)
  })

  it('el SIGNO lo pone el tipo, no quien escribió el dato', () => {
    // Un reembolso guardado en positivo por descuido no puede sumar ingreso.
    expect(efectivoDe({ tipo: 'reembolso', monto: 899 })).toBe(-899)
    expect(efectivoDe({ tipo: 'reembolso', monto: -899 })).toBe(-899)
  })

  it('una disputa ABIERTA ya resta: Stripe retiene el dinero al abrirla', () => {
    // Contarla sólo al perderla mostraría un saldo que el banco no tiene.
    expect(efectivoDe({ tipo: 'contracargo', monto: 899, estadoDisputa: 'abierta' })).toBe(-899)
  })

  it('una disputa GANADA vuelve a cero: el dinero se devolvió', () => {
    expect(efectivoDe({ tipo: 'contracargo', monto: 899, estadoDisputa: 'ganada' })).toBe(0)
  })

  it('una disputa PERDIDA se queda fuera', () => {
    expect(efectivoDe({ tipo: 'contracargo', monto: 899, estadoDisputa: 'perdida' })).toBe(-899)
  })
})

describe('esDineroReal', () => {
  it('exige el true explícito: Stripe en modo prueba no es ingreso', () => {
    expect(esDineroReal({ livemode: true })).toBe(true)
    expect(esDineroReal({ livemode: false })).toBe(false)
    expect(esDineroReal({})).toBe(false)   // ausente NO es dinero real
  })
})

describe('resumirMovimientos', () => {
  it('el neto es cobros menos devoluciones', () => {
    const r = resumirMovimientos([cobro(899), cobro(899), { tipo: 'reembolso', monto: 899, livemode: true }])
    expect(r.cobrado).toBe(1798)
    expect(r.reembolsado).toBe(899)
    expect(r.neto).toBe(899)
  })

  it('un reembolso NO cuenta como un pago más', () => {
    // Si contara, «pagos del mes» subiría cada vez que se devuelve dinero.
    const r = resumirMovimientos([cobro(899), { tipo: 'reembolso', monto: 899, livemode: true }])
    expect(r.numCobros).toBe(1)
  })

  it('las disputas abiertas se cuentan aparte: es dinero en el aire', () => {
    const r = resumirMovimientos([
      cobro(1590),
      { tipo: 'contracargo', monto: 1590, estadoDisputa: 'abierta', livemode: true },
    ])
    expect(r.disputasAbiertas).toBe(1)
    expect(r.encontracargo).toBe(1590)
    expect(r.neto).toBe(0)
  })

  it('ganar la disputa devuelve el dinero al neto y la saca de las abiertas', () => {
    const r = resumirMovimientos([
      cobro(1590),
      { tipo: 'contracargo', monto: 1590, estadoDisputa: 'ganada', livemode: true },
    ])
    expect(r.neto).toBe(1590)
    expect(r.disputasAbiertas).toBe(0)
    expect(r.encontracargo).toBe(0)
  })

  it('el dinero de prueba no entra en ninguna cuenta', () => {
    const r = resumirMovimientos([
      { tipo: 'cobro', monto: 899, livemode: false },
      { tipo: 'cobro', monto: 899 },
    ])
    expect(r).toMatchObject({ neto: 0, cobrado: 0, numCobros: 0 })
  })
})

describe('tipoDeAsiento', () => {
  it('los asientos VIEJOS, sin campo `tipo`, se leen como cobros', () => {
    /**
     * Es la mitad que evita una regresión invisible: todos los pagos escritos
     * antes de este cambio carecen de `tipo`. Tratarlos como «desconocido» los
     * dejaría fuera del ingreso histórico y el dueño vería una caída de
     * ingresos que nunca ocurrió.
     */
    expect(tipoDeAsiento({})).toBe('cobro')
    expect(tipoDeAsiento({ tipo: undefined })).toBe('cobro')
    expect(tipoDeAsiento({ tipo: 'basura' })).toBe('cobro')
  })

  it('reconoce los dos nuevos', () => {
    expect(tipoDeAsiento({ tipo: 'reembolso' })).toBe('reembolso')
    expect(tipoDeAsiento({ tipo: 'contracargo' })).toBe('contracargo')
  })
})
