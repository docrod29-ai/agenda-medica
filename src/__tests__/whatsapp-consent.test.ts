import { describe, it, expect } from 'vitest'
import {
  esPalabraBaja, esPalabraAlta, conPieOptout, normalizarTelefonoWa, PIE_OPTOUT,
} from '@/lib/whatsapp/consent'

describe('WhatsApp opt-out — detección de baja (Iter. 5)', () => {
  it('detecta palabras y frases de baja', () => {
    for (const s of [
      'BAJA', 'baja', 'stop', 'STOP', 'unsubscribe',
      'dar de baja', 'darme de baja', 'cancelar suscripcion', 'cancelar la suscripción',
      'no quiero mensajes', 'no deseo recibir recordatorios', 'no molestar',
      'dejen de escribirme', 'deja de enviarme', 'quitenme de la lista', 'ya no me escriban',
    ]) {
      expect(esPalabraBaja(s), `debía ser baja: "${s}"`).toBe(true)
    }
  })

  it('NO confunde con el flujo del bot (cancelar cita / salir / opciones)', () => {
    for (const s of ['cancelar', 'cancelar cita', 'salir', '0', '1', 'quiero una cita', 'hola', '']) {
      expect(esPalabraBaja(s), `no debía ser baja: "${s}"`).toBe(false)
    }
  })
})

describe('WhatsApp opt-in — detección de alta (Iter. 5)', () => {
  it('detecta reactivación', () => {
    for (const s of ['ALTA', 'alta', 'reactivar', 'darme de alta', 'quiero recibir mensajes', 'si deseo recibir recordatorios']) {
      expect(esPalabraAlta(s), `debía ser alta: "${s}"`).toBe(true)
    }
  })
  it('no marca alta en mensajes normales', () => {
    for (const s of ['agendar', 'hola', 'cita', '']) {
      expect(esPalabraAlta(s)).toBe(false)
    }
  })
})

describe('Pie de opt-out y normalización', () => {
  it('conPieOptout agrega el pie una sola vez', () => {
    const base = 'Recordatorio de su cita mañana 10:00'
    const conPie = conPieOptout(base)
    expect(conPie).toContain('BAJA para dejar de recibir')
    expect(conPieOptout(conPie)).toBe(conPie) // idempotente
    expect(conPie.endsWith(PIE_OPTOUT)).toBe(true)
  })

  it('normalizarTelefonoWa produce una clave estable con lada 52', () => {
    // El "1" de móvil que antepone WhatsApp se elimina, para que el número como
    // lo manda WhatsApp y como lo captura recepción converjan en la MISMA clave
    // (si no, la baja se guardaba con una y el envío buscaba con la otra).
    expect(normalizarTelefonoWa('5215512345678')).toBe('525512345678')
    expect(normalizarTelefonoWa('+52 155 1234 5678')).toBe('525512345678')
    expect(normalizarTelefonoWa('5512345678')).toBe('525512345678')
  })
})
