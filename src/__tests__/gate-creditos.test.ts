/**
 * L1 dinero (auditoría maestra 2026-07) — la decisión del gate de créditos:
 * corta SOLO cuando el consultorio corre con la llave del DUEÑO ('prueba') y
 * agotó sus créditos. Con llave propia ('clinica') o sin clinicId nunca corta.
 */
import { describe, it, expect } from 'vitest'
import { debeCortarCreditos } from '@/lib/ai-keys'

describe('debeCortarCreditos — política del tope', () => {
  it("'prueba' + agotado + clinicId → CORTA", () => {
    expect(debeCortarCreditos('prueba', 'c1', true)).toBe(true)
  })
  it("'prueba' + con créditos → no corta", () => {
    expect(debeCortarCreditos('prueba', 'c1', false)).toBe(false)
  })
  it("'clinica' (llave propia) aunque esté agotado → nunca corta (paga su API)", () => {
    expect(debeCortarCreditos('clinica', 'c1', true)).toBe(false)
  })
  it("'ninguna' → no corta", () => {
    expect(debeCortarCreditos('ninguna', 'c1', true)).toBe(false)
  })
  it('sin clinicId → no corta', () => {
    expect(debeCortarCreditos('prueba', null, true)).toBe(false)
  })
})
