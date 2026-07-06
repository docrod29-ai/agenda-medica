import { describe, it, expect } from 'vitest'
import { esCriticoLab } from '@/lib/hospital/lab-criticos'
import { calcularNews2 } from '@/lib/hospital/news2'
import { parsearLabsFhir } from '@/lib/hospital/fhir-import'

describe('Auditoría fix — valores críticos de laboratorio (motor determinista)', () => {
  it('potasio 7.0 → crítico aunque no se marque', () => {
    expect(esCriticoLab('Potasio', '7.0')).toBe(true)
  })
  it('glucosa 30 → crítico', () => {
    expect(esCriticoLab('Glucosa', 30)).toBe(true)
  })
  it('potasio 4.2 (normal) → NO crítico', () => {
    expect(esCriticoLab('Potasio', '4.2')).toBe(false)
  })
  it('estudio sin regla → NO crítico', () => {
    expect(esCriticoLab('Colesterol', '250')).toBe(false)
  })
})

describe('Auditoría fix — NEWS2 conciencia/O2 + parámetro rojo', () => {
  it('conciencia alterada suma +3 y marca parámetro rojo', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 72, conciencia: 'alterada' })!
    expect(r.total).toBeGreaterThanOrEqual(3)
    expect(r.parametroRojo).toBe(true)
  })
  it('O2 suplementario suma +2', () => {
    const sinO2 = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 72 })!
    const conO2 = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 72, oxigeno: true })!
    expect(conO2.total).toBe(sinO2.total + 2)
  })
  it('TA sistólica 85 aislada → parámetroRojo true (dispara alerta)', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '85/50', fc: 72 })!
    expect(r.parametroRojo).toBe(true)
  })
})

describe('Auditoría fix — FHIR import respaldo por rango', () => {
  it('marca crítico por rango aunque el LIS no lo etiquete', () => {
    const bundle = JSON.stringify({ resourceType: 'Bundle', entry: [
      { resource: { resourceType: 'Observation', code: { text: 'Potasio' }, valueQuantity: { value: 7.2, unit: 'mmol/L' } } },
    ] })
    expect(parsearLabsFhir(bundle)[0].critico).toBe(true)
  })
})
