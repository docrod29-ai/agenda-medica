/**
 * GOLDEN — el anticipo que saldaba una consulta que nadie había tasado.
 *
 * Cuando el consultorio no tiene tarifa para ese tipo de cita, el checkout
 * escribe el ANTICIPO en `pagoMonto`. El webhook comparaba lo pagado contra ese
 * mismo número, daba «cubre», y la cita quedaba PAGADA con `cobroId`: el botón
 * de cobrar desaparecía, las cuentas por cobrar la excluían, y el resto de la
 * consulta no se reclamaba en ninguna pantalla.
 *
 * Cifras de los ejemplos: inventadas.
 */
import { describe, it, expect } from 'vitest'
import { decidirCobroAnticipo } from '@/lib/finanzas/anticipo'

describe('decidirCobroAnticipo', () => {
  it('SIN tarifa conocida, un anticipo NO salda la consulta', () => {
    // Consulta de $800 sin tarifa capturada, anticipo de $200: el sistema no
    // sabe que faltan $600 — pero sabe que NO puede afirmar que esté pagada.
    const d = decidirCobroAnticipo({ esperado: 200, monto: 200, sinTarifaConocida: true })
    expect(d.cubre).toBe(false)
    expect(d.concepto).toBe('abono')
    expect(d.estadoCita).toBe('pendiente-pago')
  })

  it('y el saldo queda en «no se sabe», NO en cero', () => {
    // Un cero se lee como «no debe nada»: sería el mismo bug por otra vía.
    const d = decidirCobroAnticipo({ esperado: 200, monto: 200, sinTarifaConocida: true })
    expect(d.saldoPendiente).toBeNull()
    expect(d.descripcion).toMatch(/no se sabe cuánto falta/i)
  })

  it('CON tarifa, pagar el total sí salda', () => {
    const d = decidirCobroAnticipo({ esperado: 800, monto: 800, sinTarifaConocida: false })
    expect(d.cubre).toBe(true)
    expect(d.concepto).toBe('consulta')
    expect(d.estadoCita).toBe('pagada')
    expect(d.saldoPendiente).toBe(0)
  })

  it('CON tarifa, pagar de menos es abono y el saldo se calcula', () => {
    const d = decidirCobroAnticipo({ esperado: 800, monto: 200, sinTarifaConocida: false })
    expect(d.cubre).toBe(false)
    expect(d.saldoPendiente).toBe(600)
  })

  it('aguanta el redondeo de un centavo de Stripe', () => {
    const d = decidirCobroAnticipo({ esperado: 800, monto: 799.995, sinTarifaConocida: false })
    expect(d.cubre).toBe(true)
  })

  it('sin importe esperado (0) el pago salda: no había nada que comparar', () => {
    const d = decidirCobroAnticipo({ esperado: 0, monto: 500, sinTarifaConocida: false })
    expect(d.cubre).toBe(true)
  })
})
