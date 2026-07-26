/**
 * NEXUS-QUALITY-011 — El motor de seguridad de UCI recibía `rass` y lo IGNORABA.
 * Un paciente agitado (auto-retiro de dispositivos) o en sedación profunda no
 * generaba ninguna alerta, y la aptitud de movilización asumía la conciencia.
 */
import { describe, it, expect } from 'vitest'
import { analizarSeguridadUCI, aptoMovilizacion } from '@/lib/uci/seguridad'

describe('alertas de sedación (RASS)', () => {
  it('RASS +3 (agitación) → alerta alta', () => {
    const a = analizarSeguridadUCI({ rass: 3 })
    expect(a.some(x => x.parametro === 'RASS' && x.nivel === 'alta')).toBe(true)
  })
  it('RASS −5 (sedación profunda) → alerta moderada', () => {
    const a = analizarSeguridadUCI({ rass: -5 })
    expect(a.some(x => x.parametro === 'RASS' && x.nivel === 'moderada')).toBe(true)
  })
  it('RASS −1 (dentro de meta) → sin alerta de RASS', () => {
    const a = analizarSeguridadUCI({ rass: -1 })
    expect(a.some(x => x.parametro === 'RASS')).toBe(false)
  })
})

describe('aptitud de movilización considera la conciencia', () => {
  const vitalesOk = { fc: 80, pas: 120, pam: 75, fr: 18, spo2: 96, fio2: 0.4, peep: 6 }
  it('RASS −5 con vitales OK → NO apto (conciencia)', () => {
    const r = aptoMovilizacion({ ...vitalesOk, rass: -5 })
    expect(r.apto).toBe(false)
    expect(r.faltan.some(f => /RASS/.test(f))).toBe(true)
  })
  it('RASS 0 con vitales OK → apto', () => {
    expect(aptoMovilizacion({ ...vitalesOk, rass: 0 }).apto).toBe(true)
  })
  it('sin RASS (despierto, sin sedación) NO se bloquea por conciencia', () => {
    expect(aptoMovilizacion({ ...vitalesOk }).apto).toBe(true)
  })
})
