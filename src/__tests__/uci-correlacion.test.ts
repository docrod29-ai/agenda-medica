/**
 * Motor de cambio y correlación temporal: qué cambió entre lecturas + cronología
 * y asociaciones (corazón-pulmón). No implica causalidad.
 */
import { describe, it, expect } from 'vitest'
import { aplanarLectura, compararLecturas, correlacionTemporal, resumenCambios, type Lectura } from '@/lib/uci/correlacion'

describe('aplanarLectura', () => {
  it('toma crudos del panel + computados', () => {
    const m = aplanarLectura({ peep: '10', norepi: '0.2', fio2: '60' }, { pafi: 130, sofa: 11 })
    expect(m).toMatchObject({ peep: 10, norepi: 0.2, fio2: 60, pafi: 130, sofa: 11 })
  })
})

describe('compararLecturas', () => {
  it('marca dirección y relevancia por umbral', () => {
    const c = compararLecturas({ norepi: 0.05, pam: 74 }, { norepi: 0.15, pam: 59 })
    const nore = c.find(x => x.key === 'norepi')!
    expect(nore.direccion).toBe('sube')
    expect(nore.relevante).toBe(true)
    const pam = c.find(x => x.key === 'pam')!
    expect(pam.direccion).toBe('baja')
    expect(pam.relevante).toBe(true)
  })
  it('ignora cambios por debajo del umbral (ruido)', () => {
    const c = compararLecturas({ pam: 72 }, { pam: 74 }) // Δ2 < minDelta 5
    expect(c[0].relevante).toBe(false)
  })
})

describe('correlacionTemporal — asociación corazón-pulmón', () => {
  it('detecta ↑presión intratorácica junto con deterioro hemodinámico', () => {
    const lecturas: Lectura[] = [
      { t: 1000, m: { peep: 8, pam: 74, norepi: 0.05 } },
      { t: 2000, m: { peep: 14, pam: 59, norepi: 0.15 } },
    ]
    const r = correlacionTemporal(lecturas)
    expect(r.asociaciones.some(a => /corazón-pulmón|intratorácica/.test(a))).toBe(true)
    expect(r.cronologia.length).toBe(1)
  })
  it('sin secuencia relevante no inventa asociaciones', () => {
    const r = correlacionTemporal([{ t: 1, m: { pam: 80 } }, { t: 2, m: { pam: 81 } }])
    expect(r.asociaciones.length).toBe(0)
  })
})

describe('resumenCambios (para el Copilot)', () => {
  it('texto compacto con flechas', () => {
    const c = compararLecturas({ norepi: 0.2, lactato: 3.4 }, { norepi: 0.06, lactato: 1.5 })
    const txt = resumenCambios(c)
    expect(txt).toMatch(/Norepinefrina 0.2→0.06 ↓/)
    expect(txt).toMatch(/Lactato/)
  })
})
