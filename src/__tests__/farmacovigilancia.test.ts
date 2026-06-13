import { describe, it, expect } from 'vitest'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'

const m = (...nombres: string[]) => nombres.map(nombre => ({ nombre }))

describe('detectarInteracciones', () => {
  it('warfarina + ibuprofeno → interacción mayor (sangrado)', () => {
    const r = detectarInteracciones(m('Warfarina 5 mg', 'Ibuprofeno 400 mg'))
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].severidad).toBe('mayor')
    expect(r[0].titulo).toContain('Anticoagulante')
  })
  it('linezolid + sertralina → riesgo serotoninérgico', () => {
    const r = detectarInteracciones(m('Linezolid 600 mg', 'Sertralina 50 mg'))
    expect(r.some(a => /serotonin/i.test(a.titulo))).toBe(true)
  })
  it('claritromicina + atorvastatina → rabdomiólisis', () => {
    const r = detectarInteracciones(m('Claritromicina 500 mg', 'Atorvastatina 40 mg'))
    expect(r.some(a => /estatina/i.test(a.titulo))).toBe(true)
  })
  it('clopidogrel + omeprazol → moderada', () => {
    const r = detectarInteracciones(m('Clopidogrel 75 mg', 'Omeprazol 20 mg'))
    expect(r.some(a => a.severidad === 'moderada')).toBe(true)
  })
  it('detecta por marca comercial (Sintrom + naproxeno)', () => {
    const r = detectarInteracciones(m('Sintrom', 'Naproxeno 250 mg'))
    expect(r.length).toBeGreaterThan(0)
  })
  it('NO marca interacción entre fármacos sin relación', () => {
    const r = detectarInteracciones(m('Paracetamol 500 mg', 'Loratadina 10 mg'))
    expect(r).toHaveLength(0)
  })
  it('un solo fármaco no genera interacciones', () => {
    expect(detectarInteracciones(m('Warfarina'))).toHaveLength(0)
  })
})

describe('detectarControlados', () => {
  it('fentanilo → Fracción I (estupefaciente)', () => {
    const r = detectarControlados(m('Fentanilo parche'))
    expect(r[0].fraccion).toBe('I')
    expect(r[0].requisito).toMatch(/código de barras|COFEPRIS/i)
  })
  it('clonazepam (Rivotril) → Fracción II', () => {
    const r = detectarControlados(m('Rivotril 2 mg'))
    expect(r[0].fraccion).toBe('II')
  })
  it('tramadol → Fracción II', () => {
    const r = detectarControlados(m('Tramadol 50 mg'))
    expect(r[0].fraccion).toBe('II')
  })
  it('alprazolam por marca Tafil → Fracción II', () => {
    const r = detectarControlados(m('Tafil 0.5 mg'))
    expect(r[0].fraccion).toBe('II')
  })
  it('amoxicilina NO es controlado', () => {
    expect(detectarControlados(m('Amoxicilina 500 mg'))).toHaveLength(0)
  })
  it('no duplica el mismo fármaco', () => {
    const r = detectarControlados(m('Tramadol 50 mg'))
    expect(r).toHaveLength(1)
  })
})
