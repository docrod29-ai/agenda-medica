import { describe, it, expect } from 'vitest'
import {
  ventanaAbierta, requierePlantilla, decidirCanalProactivo, VENTANA_SERVICIO_MS,
} from '@/lib/whatsapp/window'
import { resolverPlantillaClinica, PLANTILLAS_DEFAULT } from '@/lib/whatsapp/templates'

const AHORA = Date.parse('2026-07-14T12:00:00Z')

describe('Ventana de servicio 24 h (WA-1)', () => {
  it('cerrada si el contacto nunca escribió', () => {
    expect(ventanaAbierta(null, AHORA)).toBe(false)
    expect(ventanaAbierta(undefined, AHORA)).toBe(false)
    expect(requierePlantilla(null, AHORA)).toBe(true)
  })

  it('abierta dentro de 24 h, cerrada después', () => {
    const hace1h = new Date(AHORA - 1 * 3600_000).toISOString()
    const hace25h = new Date(AHORA - 25 * 3600_000).toISOString()
    const justoAlLimite = new Date(AHORA - VENTANA_SERVICIO_MS).toISOString()
    expect(ventanaAbierta(hace1h, AHORA)).toBe(true)
    expect(ventanaAbierta(hace25h, AHORA)).toBe(false)
    expect(ventanaAbierta(justoAlLimite, AHORA)).toBe(false) // exactamente 24 h ya no cuenta
    expect(requierePlantilla(hace1h, AHORA)).toBe(false)
  })

  it('ISO inválido → cerrada (conservador)', () => {
    expect(ventanaAbierta('no-es-fecha', AHORA)).toBe(false)
  })
})

describe('Decisión de canal proactivo (WA-1)', () => {
  it('ventana abierta → texto libre', () => {
    expect(decidirCanalProactivo({ ventanaAbierta: true, plantillaDisponible: false })).toBe('texto')
  })
  it('ventana cerrada + plantilla → plantilla', () => {
    expect(decidirCanalProactivo({ ventanaAbierta: false, plantillaDisponible: true })).toBe('plantilla')
  })
  it('ventana cerrada + sin plantilla → omitir (NO texto libre)', () => {
    expect(decidirCanalProactivo({ ventanaAbierta: false, plantillaDisponible: false })).toBe('omitir')
  })
})

describe('Resolución de plantilla por clínica (WA-1)', () => {
  it('sin nombre configurado → null (no se puede enviar fuera de ventana)', () => {
    expect(resolverPlantillaClinica(null, 'recordatorio24h')).toBe(null)
    expect(resolverPlantillaClinica({ plantillas: {} }, 'recordatorio24h')).toBe(null)
    expect(resolverPlantillaClinica({ plantillas: { recordatorio24h: { name: '  ' } } }, 'recordatorio24h')).toBe(null)
  })

  it('con nombre configurado → usa ese nombre + lang default + parámetros del catálogo', () => {
    const p = resolverPlantillaClinica({ plantillas: { recordatorio24h: { name: 'mi_recordatorio' } } }, 'recordatorio24h')
    expect(p?.name).toBe('mi_recordatorio')
    expect(p?.lang).toBe(PLANTILLAS_DEFAULT.recordatorio24h.lang)
    // orden {{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora · {{5}} clínica
    expect(p?.construirParametros({ paciente: 'Ana', medico: 'Dr. Luna', fecha: '15 jul', hora: '10:00', clinica: 'Nexus' }))
      .toEqual(['Ana', 'Dr. Luna', '15 jul', '10:00', 'Nexus'])
  })

  it('permite override de idioma', () => {
    const p = resolverPlantillaClinica({ plantillas: { listaEspera: { name: 't', lang: 'es' } } }, 'listaEspera')
    expect(p?.lang).toBe('es')
  })
})
