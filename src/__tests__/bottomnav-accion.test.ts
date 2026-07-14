import { describe, it, expect } from 'vitest'
import { accionContextual } from '@/components/BottomNav'

describe('BottomNav — acción central contextual', () => {
  it('en un expediente ofrece Consulta de ESE paciente (a un toque)', () => {
    const a = accionContextual('/expediente/pac_123')
    expect(a).toEqual({ label: 'Consulta', href: '/consulta/pac_123', kind: 'consulta' })
  })

  it('en la consulta mantiene la acción hacia esa consulta (no pierde el paciente)', () => {
    const a = accionContextual('/consulta/pac_999')
    expect(a.href).toBe('/consulta/pac_999')
    expect(a.kind).toBe('consulta')
  })

  it('en el resto de la app ofrece Nueva cita (ruta que existe)', () => {
    for (const p of ['/dashboard', '/calendario', '/pacientes', '/crm', '/chat', '/finanzas']) {
      const a = accionContextual(p)
      expect(a).toEqual({ label: 'Nueva cita', href: '/asistente', kind: 'cita' })
    }
  })

  it('no confunde subrutas (ej. /expediente sin id → Nueva cita)', () => {
    expect(accionContextual('/expediente').kind).toBe('cita')
    expect(accionContextual('/pacientes/lista').kind).toBe('cita')
  })
})
