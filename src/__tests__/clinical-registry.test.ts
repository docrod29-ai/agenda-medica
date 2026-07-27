/**
 * Integridad del CLINICAL ENGINE REGISTRY (charter §17).
 * No valida el cálculo (eso lo hacen los golden tests de cada motor); valida que el
 * registro esté completo y consistente para que sea una fuente auditable confiable.
 */
import { describe, it, expect } from 'vitest'
import { CLINICAL_ENGINE_REGISTRY, motorPorId } from '@/lib/clinical/registry'

describe('CLINICAL ENGINE REGISTRY · integridad', () => {
  it('hay motores registrados', () => {
    expect(CLINICAL_ENGINE_REGISTRY.length).toBeGreaterThanOrEqual(15)
  })
  it('ids únicos', () => {
    const ids = CLINICAL_ENGINE_REGISTRY.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('cada motor declara version, referencia, unidades, archivo y ≥1 golden test', () => {
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      expect(m.version, `${m.id}: version`).toBeTruthy()
      expect(m.referencia, `${m.id}: referencia`).toBeTruthy()
      expect(m.unidades, `${m.id}: unidades`).toBeTruthy()
      expect(m.file, `${m.id}: file`).toMatch(/^src\/lib\//)
      expect(m.goldenTests.length, `${m.id}: goldenTests`).toBeGreaterThanOrEqual(1)
      expect(['validado', 'pendiente_validacion', 'experimental']).toContain(m.estado)
    }
  })
  it('motorPorId funciona y es null-safe', () => {
    expect(motorPorId('fib-4')?.especialidad).toBe('Hepatología/MASLD')
    expect(motorPorId('no-existe')).toBeUndefined()
  })
})
