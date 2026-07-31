/**
 * NEXUS-QUALITY-014 — Signos vitales: umbrales de adulto aplicados a niños.
 * signosDeAlarma usaba FC ≥120 / TAS <90 / qSOFA / 140-90 sin importar la edad:
 * un niño con FC 130 (normal) recibía "Taquicardia" y TAS 85 (normal) "hipotensión".
 * Ahora en < 12 años no dispara umbrales de adulto (emite nota pediátrica); la
 * SpO₂ < 90 y la fiebre siguen alertando a cualquier edad.
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'

describe('umbrales pediátricos de signos vitales', () => {
  it('niño de 3 años con FC 130 y TA 85/50 → NO taquicardia ni hipotensión de adulto', () => {
    const s = copiloto({ edad: 3, signos: { fc: 130, ta: '85/50' } })
    expect(s.some(x => x.id === 'vital:taquicardia')).toBe(false)
    expect(s.some(x => x.id === 'vital:hipotension')).toBe(false)
    expect(s.some(x => x.id === 'vital:pediatrico')).toBe(true)
  })
  it('niño con SpO₂ 86 → SÍ alerta hipoxemia (independiente de la edad)', () => {
    const s = copiloto({ edad: 3, signos: { spo2: 86 } })
    expect(s.some(x => x.id === 'vital:hipoxemia')).toBe(true)
  })
  it('adulto con FC 130 y TA 85/50 → SÍ taquicardia e hipotensión (sin regresión)', () => {
    const s = copiloto({ edad: 40, signos: { fc: 130, ta: '85/50' } })
    expect(s.some(x => x.id === 'vital:taquicardia')).toBe(true)
    expect(s.some(x => x.id === 'vital:hipotension')).toBe(true)
    expect(s.some(x => x.id === 'vital:pediatrico')).toBe(false)
  })
})
