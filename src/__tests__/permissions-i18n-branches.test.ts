import { describe, it, expect } from 'vitest'
import { permisosPorRol, puede } from '@/lib/permissions'
import { t, setLocale } from '@/lib/i18n'
import { nombreAnonimizado } from '@/lib/reviews'

describe('Permisos por rol', () => {
  it('admin tiene todos los permisos', () => {
    const p = permisosPorRol('admin')
    expect(p.firmarNota).toBe(true)
    expect(p.configurarClinica).toBe(true)
    expect(p.manejarPagos).toBe(true)
  })
  it('secretaria NO puede firmar notas ni ver expediente', () => {
    const p = permisosPorRol('secretaria')
    expect(p.firmarNota).toBe(false)
    expect(p.verExpediente).toBe(false)
    expect(p.editarAgenda).toBe(true)
  })
  it('recepción solo ve y edita agenda', () => {
    const p = permisosPorRol('recepcion')
    expect(p.editarAgenda).toBe(true)
    expect(p.verCRM).toBe(false)
    expect(p.verFinanzas).toBe(false)
    expect(p.firmarNota).toBe(false)
  })
  it('puede() helper funciona', () => {
    expect(puede('medico', 'firmarNota')).toBe(true)
    expect(puede('secretaria', 'firmarNota')).toBe(false)
  })
  it('rol desconocido = permisos mínimos (recepcion-like)', () => {
    const p = permisosPorRol('hacker')
    expect(p.firmarNota).toBe(false)
    expect(p.editarExpediente).toBe(false)
  })
})

describe('i18n', () => {
  it('default es es-MX', () => {
    expect(t('cita.confirmar')).toBe('Confirmar cita')
  })
  it('cambia a pt-BR', () => {
    setLocale('pt-BR')
    expect(t('cita.confirmar')).toBe('Confirmar consulta')
    expect(t('paciente.nuevo')).toBe('Novo paciente')
    setLocale('es-MX')  // restore
  })
  it('clave no encontrada devuelve la clave (no rompe la UI)', () => {
    // @ts-expect-error — testeando key inválida
    expect(t('no.existe')).toBe('no.existe')
  })
})

describe('Reviews helpers', () => {
  it('anonimiza nombres compuestos', () => {
    expect(nombreAnonimizado('Juan García López')).toBe('Juan G.')
    expect(nombreAnonimizado('María')).toBe('María')
    expect(nombreAnonimizado('')).toBe('Anónimo')
  })
})
