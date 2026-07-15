import { describe, it, expect } from 'vitest'
import { notificacionCitaSegura } from '@/lib/mobile/notif-privacidad'

describe('notif-privacidad (§8.6 — sin PHI en pantalla bloqueada)', () => {
  const nombre = 'María Fernanda López'
  const motivo = 'control de diabetes'

  it('recordatorio de cita NO incluye nombre del paciente ni motivo', () => {
    const n = notificacionCitaSegura('cita_proxima', { minutos: 30 })
    const texto = `${n.titulo} ${n.body}`.toLowerCase()
    expect(texto).not.toContain(nombre.toLowerCase())
    expect(texto).not.toContain('maría')
    expect(texto).not.toContain(motivo)
    expect(texto).not.toContain('diabetes')
    expect(n.titulo).toBe('Cita próxima')
    expect(n.body).toMatch(/30 minutos/)
  })

  it('teleconsulta NO incluye nombre del paciente', () => {
    const n = notificacionCitaSegura('teleconsulta_pronto', { minutos: 5 })
    const texto = `${n.titulo} ${n.body}`.toLowerCase()
    expect(texto).not.toContain('maría')
    expect(n.titulo).toMatch(/Teleconsulta en 5 min/)
  })

  it('funciona sin minutos (texto genérico, igual sin PHI)', () => {
    const n = notificacionCitaSegura('cita_proxima')
    expect(n.body).toMatch(/próxima/i)
    expect(n.titulo.length).toBeGreaterThan(0)
  })
})
