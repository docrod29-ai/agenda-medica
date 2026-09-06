import { describe, it, expect } from 'vitest'
import * as fechaLocal from '@/lib/fecha-local'
describe('REP-000 humo: la config de reproducciones resuelve @/ y corre', () => {
  it('importa un módulo del repo', () => { expect(Object.keys(fechaLocal).length).toBeGreaterThan(0) })
})
