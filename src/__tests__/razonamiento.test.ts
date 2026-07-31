import { describe, it, expect } from 'vitest'
import { construirTraza, resumenTraza } from '@/lib/expediente/razonamiento'

describe('Clinical Reasoning Engine — traza', () => {
  it('siempre devuelve los 12 pasos, en orden', () => {
    const t = construirTraza({})
    expect(t).toHaveLength(12)
    expect(t.map(p => p.n)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12])
  })

  it('con caso vacío no inventa hallazgos (extracción faltante, sin alertas)', () => {
    const t = construirTraza({})
    expect(t[0].estado).toBe('faltante')          // paso 1: nada extraído
    expect(resumenTraza(t).alertas).toBe(0)       // no inventa alertas
  })

  it('marca ALERTA cuando hay conflicto alergia↔fármaco', () => {
    const t = construirTraza({
      alergias: 'penicilina',
      medicamentos: [{ nombre: 'Amoxicilina' }],
    })
    const contradic = t.find(p => p.n === 5)!
    expect(contradic.estado).toBe('alerta')
  })

  it('cada paso lleva fuente (provenance) y confianza (incertidumbre)', () => {
    const t = construirTraza({ diagnosticos: [{ descripcion: 'DM2' }] })
    for (const p of t) {
      expect(['determinista','modelo','evidencia','meta']).toContain(p.fuente)
      expect(['alta','media','baja','na']).toContain(p.confianza)
    }
  })

  it('la evidencia PubMed se marca PENDIENTE aquí (no se finge hecha)', () => {
    const t = construirTraza({ diagnosticos: [{ descripcion: 'sepsis' }] })
    expect(t.find(p => p.n === 8)!.estado).toBe('pendiente')
    expect(t.find(p => p.n === 9)!.estado).toBe('pendiente')
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P1): el paso 7 afirmaba «N fármacos revisados: sin
 * exceso de dosis...» en TODO adulto, aunque ninguno de sus chequeos (ped/renal/
 * gestacional) pudiera correr. Un panel que dice haber revisado lo que no revisó
 * destruye justo la confianza que este panel existe para dar.
 */
describe('Paso 7 «Comprueba dosis»: no afirma lo que no hizo', () => {
  const paso7 = (e: Parameters<typeof construirTraza>[0]) =>
    construirTraza(e).find(p => p.n === 7)!

  it('adulto SIN creatinina: no dice "revisados", declara que no se pudo evaluar', () => {
    const p = paso7({
      edad: 45, sexo: 'Masculino',
      diagnosticos: [{ descripcion: 'Faringitis' }],
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
    })
    expect(p.detalle).toMatch(/NO se pudo verificar/i)
    expect(p.detalle).toMatch(/creatinina/i)
    expect(p.estado).not.toBe('ok')          // ya no sale en verde
    expect(p.confianza).toBe('baja')
  })

  it('adulto CON creatinina: sí declara que evaluó el ajuste renal', () => {
    const p = paso7({
      edad: 45, sexo: 'Masculino',
      diagnosticos: [{ descripcion: 'Faringitis' }],
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
      labs: { creatinina: 1.0 },
    })
    expect(p.detalle).toMatch(/ajuste renal/i)
    expect(p.estado).toBe('ok')
  })

  it('pediátrico sin peso: lo dice en vez de callarlo', () => {
    const p = paso7({
      edad: 6, sexo: 'Femenino',
      diagnosticos: [{ descripcion: 'Otitis' }],
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '250 mg' }],
    })
    expect(p.detalle).toMatch(/falta el peso/i)
  })

  it('sin fármacos sigue siendo "sin nada que verificar"', () => {
    const p = paso7({ edad: 45, diagnosticos: [{ descripcion: 'Control' }], medicamentos: [] })
    expect(p.estado).toBe('na')
  })
})
