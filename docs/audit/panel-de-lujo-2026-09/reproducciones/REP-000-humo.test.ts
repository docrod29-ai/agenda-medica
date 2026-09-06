import { describe, it, expect } from 'vitest'
import { edadEnMeses } from '@/lib/fecha-local'
describe('REP-000 humo: la config de reproducciones resuelve @/ y corre', () => {
  it('importa un módulo del repo', () => { expect(typeof edadEnMeses).toBe('function') })
})
