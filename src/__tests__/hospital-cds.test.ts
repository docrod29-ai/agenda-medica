import { describe, it, expect } from 'vitest'
import { cdsMedicamento } from '@/lib/hospital/cds'

describe('hospital — CDS de medicamentos (alta especificidad, pocas alertas)', () => {
  it('alergia a sulfas + sulfametoxazol → alerta crítica', () => {
    const a = cdsMedicamento({ nombre: 'Sulfametoxazol/trimetoprima', alergias: 'sulfas' })
    expect(a.some(x => x.nivel === 'critica')).toBe(true)
  })

  it('vancomicina con TFG baja → alerta de ajuste renal (alta)', () => {
    const a = cdsMedicamento({ nombre: 'Vancomicina', tfg: 30 })
    expect(a.some(x => x.nivel === 'alta' && /renal/i.test(x.texto))).toBe(true)
  })

  it('vancomicina sin TFG → recordatorio renal informativo', () => {
    const a = cdsMedicamento({ nombre: 'Vancomicina' })
    expect(a.some(x => x.nivel === 'info' && /renal/i.test(x.texto))).toBe(true)
  })

  it('paracetamol sin alergias ni TFG → SIN alertas (no falsos positivos)', () => {
    expect(cdsMedicamento({ nombre: 'Paracetamol' })).toHaveLength(0)
  })

  it('sin nombre → vacío', () => {
    expect(cdsMedicamento({ nombre: '' })).toHaveLength(0)
  })
})
