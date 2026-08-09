import { describe, it, expect } from 'vitest'
import { accionContextual } from '@/components/BottomNav'

describe('BottomNav — acción central contextual', () => {
  it('en un expediente ofrece Consulta de ESE paciente (a un toque)', () => {
    const a = accionContextual('/expediente/pac_123')
    expect(a).toEqual({ label: 'Consulta', href: '/consulta/pac_123', kind: 'consulta' })
  })

  it('EN la consulta no ofrece un enlace a sí misma (REG-296)', () => {
    /**
     * Esta prueba afirmaba lo contrario, y afirmaba un defecto.
     *
     * Estando en `/consulta/pac_999`, la acción central apuntaba a
     * `/consulta/pac_999`. En el mejor caso no hacía nada visible; en el peor,
     * el App Router lo trata como navegación y `(dashboard)/template.tsx`
     * REMONTA la pantalla — y desde REG-287, desmontar la consulta con
     * grabación viva la cierra y la manda a transcribir. Un toque accidental en
     * el botón más grande y más central de la pantalla terminaba el dictado.
     *
     * La auditoría de navegación lo dejó abierto como pregunta para el
     * navegador («si remonta, sube a P0»). Se contesta por construcción: sin
     * enlace, da igual si habría remontado.
     *
     * El paciente no se pierde: ya estás en su consulta.
     */
    const a = accionContextual('/consulta/pac_999')
    expect(a.href).toBeNull()
    expect(a.kind).toBe('aqui')
  })

  it('desde el expediente sí lleva a la consulta de ESE paciente', () => {
    // La otra mitad del cambio: lo que se quita es el enlace a uno mismo, no el
    // atajo que ahorra dos toques.
    expect(accionContextual('/expediente/pac_7').href).toBe('/consulta/pac_7')
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
