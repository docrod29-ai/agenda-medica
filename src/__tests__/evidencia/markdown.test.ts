import { describe, it, expect } from 'vitest'
import { limpiarMarkdown } from '@/lib/markdown'

describe('limpiarMarkdown (para meter a la nota)', () => {
  it('quita # de los títulos', () => {
    expect(limpiarMarkdown('# Tratamiento\n## Consideraciones')).toBe('Tratamiento\nConsideraciones')
  })
  it('quita ** de negritas', () => {
    expect(limpiarMarkdown('la **resistencia** es rara')).toBe('la resistencia es rara')
  })
  it('convierte viñetas - en •', () => {
    expect(limpiarMarkdown('- Monoterapia\n- Combinación')).toBe('• Monoterapia\n• Combinación')
  })
  it('conserva las citas [1][2]', () => {
    expect(limpiarMarkdown('sensible [7] y **base** [2][4]')).toBe('sensible [7] y base [2][4]')
  })
})
