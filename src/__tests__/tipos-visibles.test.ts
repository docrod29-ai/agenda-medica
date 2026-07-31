import { describe, it, expect } from 'vitest'
import { tiposVisibles } from '@/lib/expediente/tipos-visibles'

describe('tipos de nota según contexto', () => {
  it('en consultorio NO ofrece los hospitalarios', () => {
    const v = tiposVisibles(false, 'primera_vez')
    expect(v).not.toContain('ingreso')
    expect(v).not.toContain('evolucion')
    expect(v).not.toContain('egreso')
    expect(v).toContain('primera_vez')
    expect(v).toContain('valoracion_preoperatoria')
  })
  it('en hospital ofrece los hospitalarios', () => {
    const v = tiposVisibles(true, 'ingreso')
    expect(v).toContain('ingreso')
    expect(v).toContain('evolucion')
    expect(v).toContain('egreso')
  })
  it('el tipo activo nunca desaparece, aunque no sea del contexto', () => {
    // Un egreso abierto por enlace en contexto ambulatorio: sigue visible.
    const v = tiposVisibles(false, 'egreso')
    expect(v[0]).toBe('egreso')
    expect(v).toContain('primera_vez')
  })
  it('no duplica el activo si ya pertenece al contexto', () => {
    const v = tiposVisibles(false, 'seguimiento')
    expect(v.filter(t => t === 'seguimiento')).toHaveLength(1)
  })
})
