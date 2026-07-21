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
