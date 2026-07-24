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

/**
 * REGRESIÓN auditoría 2026-07 (P1): la regla "Anticoagulante + AINE" sólo cubría
 * antagonistas de vitamina K. Los anticoagulantes orales directos —los más
 * prescritos hoy en fibrilación auricular— no disparaban ninguna alerta.
 */
describe('Anticoagulantes orales directos + AINE', () => {
  const conAine = (anticoag: string) =>
    detectarInteracciones([{ nombre: anticoag }, { nombre: 'Ibuprofeno' }])
      .some(i => /anticoagulante/i.test(i.titulo))

  it('apixabán + ibuprofeno alerta', () => expect(conAine('Apixabán')).toBe(true))
  it('rivaroxabán + ibuprofeno alerta', () => expect(conAine('Rivaroxaban')).toBe(true))
  it('dabigatrán + ibuprofeno alerta', () => expect(conAine('Dabigatrán')).toBe(true))
  it('edoxabán + ibuprofeno alerta', () => expect(conAine('Edoxaban')).toBe(true))
  it('por nombre comercial también (Eliquis, Xarelto)', () => {
    expect(conAine('Eliquis')).toBe(true)
    expect(conAine('Xarelto')).toBe(true)
  })
  it('warfarina sigue alertando (no se rompió lo que ya servía)', () => expect(conAine('Warfarina')).toBe(true))
  it('sin AINE no hay alerta (sin falsos positivos)', () => {
    expect(detectarInteracciones([{ nombre: 'Apixabán' }, { nombre: 'Paracetamol' }])
      .some(i => /anticoagulante/i.test(i.titulo))).toBe(false)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P2, hallado por TRES auditores): el término 'ara'
 * (ARA-II) casaba dentro de «par-ara-cetamol» → falsa alerta de hiperkalemia.
 */
describe('Términos cortos no casan dentro de otra palabra', () => {
  const hiperK = (meds: string[]) =>
    detectarInteracciones(meds.map(nombre => ({ nombre })))
      .some(i => /hiperkalemia|hiperpotasemia/i.test(i.detalle + i.titulo))

  it('paracetamol + espironolactona NO alerta de hiperkalemia (era el falso positivo)', () => {
    expect(hiperK(['Paracetamol 500 mg', 'Espironolactona 25 mg'])).toBe(false)
  })

  it('un ARA-II de verdad SÍ alerta', () => {
    expect(hiperK(['Losartán 50 mg', 'Espironolactona 25 mg'])).toBe(true)
  })

  it('la abreviatura como palabra completa sigue funcionando', () => {
    expect(hiperK(['ARA II', 'Espironolactona'])).toBe(true)
    expect(hiperK(['IECA', 'Espironolactona'])).toBe(true)
  })

  it('las raíces largas conservan su sensibilidad por subcadena', () => {
    // 'atorvastatina' está listada; el nombre viene con dosis pegada.
    expect(detectarInteracciones([{ nombre: 'Claritromicina 500 mg' }, { nombre: 'Atorvastatina 40 mg' }]).length)
      .toBeGreaterThan(0)
  })
})

/** REGRESIÓN (P2): la regla anticoagulante+AINE ahora cubre HBPM y antiagregantes. */
describe('Anticoagulante/antiagregante + AINE: HBPM y antiplaquetarios', () => {
  const alerta = (a: string) => detectarInteracciones([{ nombre: a }, { nombre: 'Ketorolaco' }])
    .some(i => /aine/i.test(i.titulo))
  it('enoxaparina + ketorolaco alerta', () => expect(alerta('Enoxaparina 40 mg')).toBe(true))
  it('clopidogrel + ketorolaco alerta', () => expect(alerta('Clopidogrel 75 mg')).toBe(true))
  it('heparina + ketorolaco alerta', () => expect(alerta('Heparina')).toBe(true))
})
