import { describe, it, expect } from 'vitest'
import {
  enSilencio, enHorarioPermitido, resolverSilencio, SILENCIO_DEFAULT,
} from '@/lib/whatsapp/horario'

const H = (h: number, m = 0) => h * 60 + m

describe('Horas de silencio — ventana que cruza medianoche (Iter. 8)', () => {
  const v = SILENCIO_DEFAULT // 21:00 → 08:00
  it('silencio de noche y madrugada', () => {
    expect(enSilencio(H(21), v)).toBe(true)   // 21:00 exacto: empieza el silencio
    expect(enSilencio(H(23, 30), v)).toBe(true)
    expect(enSilencio(H(0), v)).toBe(true)     // medianoche
    expect(enSilencio(H(7, 59), v)).toBe(true)
  })
  it('permitido de día', () => {
    expect(enSilencio(H(8), v)).toBe(false)    // 08:00 exacto: termina el silencio
    expect(enSilencio(H(12), v)).toBe(false)
    expect(enSilencio(H(20, 59), v)).toBe(false)
    expect(enHorarioPermitido(H(12), v)).toBe(true)
    expect(enHorarioPermitido(H(3), v)).toBe(false)
  })
})

describe('Horas de silencio — ventana en el mismo día', () => {
  const v = { inicioMin: H(1), finMin: H(5) } // 01:00–05:00
  it('silencio dentro de [inicio, fin)', () => {
    expect(enSilencio(H(1), v)).toBe(true)
    expect(enSilencio(H(4, 59), v)).toBe(true)
    expect(enSilencio(H(5), v)).toBe(false)
    expect(enSilencio(H(0, 30), v)).toBe(false)
  })
  it('ventana vacía (inicio==fin) nunca silencia', () => {
    expect(enSilencio(H(3), { inicioMin: H(3), finMin: H(3) })).toBe(false)
  })
})

describe('Resolución de la ventana por clínica', () => {
  it('sin config → default 21:00–08:00', () => {
    expect(resolverSilencio(undefined)).toEqual(SILENCIO_DEFAULT)
    expect(resolverSilencio(null)).toEqual(SILENCIO_DEFAULT)
  })
  it('activo:false → null (sin restricción)', () => {
    expect(resolverSilencio({ silencio: { activo: false } })).toBe(null)
    expect(enHorarioPermitido(H(3), null)).toBe(true) // sin ventana, siempre permitido
  })
  it('config válida se respeta; inválida cae al default', () => {
    expect(resolverSilencio({ silencio: { inicio: '22:00', fin: '07:00' } })).toEqual({ inicioMin: H(22), finMin: H(7) })
    expect(resolverSilencio({ silencio: { inicio: '99:99', fin: 'x' } })).toEqual(SILENCIO_DEFAULT)
  })
})
