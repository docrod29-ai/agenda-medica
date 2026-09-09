/**
 * REG-659 — una caída del contador no debe abrir la reserva pública al abuso.
 * Descubierto al auditar la capacidad: limitarOResponder permitía continuar
 * cuando fallaba su transacción, incluso en esta ruta anónima con escrituras.
 * Ejecuta la ruta y el limitador reales; falla solo el contador sintético.
 * No demuestra protección DDoS en el perímetro ni concurrencia de Firestore.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const dobles = vi.hoisted(() => ({
  collection: vi.fn(), runTransaction: vi.fn(), avisar: vi.fn(), enviar: vi.fn(),
}))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: dobles }))
vi.mock('@/lib/calendario/ocupado-servidor', () => ({ ocupadoEnGoogle: vi.fn() }))
vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: dobles.avisar, telefonoDelConsultorio: () => '',
}))
vi.mock('@/lib/whatsapp-send', () => ({ sendWhatsApp: dobles.enviar }))

import { POST } from '@/app/api/public/booking/route'

const peticion = () => new NextRequest('http://localhost/api/public/booking', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.9' },
  body: JSON.stringify({
    clinicId: 'clinica-sintetica', tipo: 'seguimiento', fecha: '2026-10-01', hora: '12:00',
    paciente: { nombre: 'Paciente Sintético', telefono: '5550001111' },
    consentimientos: { avisoPrivacidad: true, informado: true },
  }),
})

beforeEach(() => {
  vi.resetAllMocks()
  const vacio = { exists: false, data: () => undefined }
  const coleccion = { doc: (_id: string) => ({
    get: async () => vacio, collection: (_nombre: string) => coleccion,
  }) }
  dobles.collection.mockReturnValue(coleccion)
  dobles.runTransaction.mockImplementation(async cb => cb({
    get: async () => vacio, set: vi.fn(),
  }))
})

describe('la reserva pública conserva el freno ante una caída', () => {
  for (const contador of ['IP', 'teléfono'] as const) {
    it(`si falla el contador de ${contador}, devuelve 503 sin acceder a expedientes ni enviar avisos`, async () => {
      if (contador === 'teléfono') dobles.runTransaction.mockImplementationOnce(async cb => cb({
        get: async () => ({ exists: false }), set: vi.fn(),
      }))
      dobles.runTransaction.mockRejectedValueOnce(new Error('contador no disponible'))
      const res = await POST(peticion())
      expect(res.status).toBe(503)
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
      expect((await res.json()).ok).toBe(false)
      expect(dobles.collection.mock.calls.every(([nombre]) => nombre === 'rate_limits')).toBe(true)
      expect(dobles.avisar).not.toHaveBeenCalled()
      expect(dobles.enviar).not.toHaveBeenCalled()
    })
  }

  it('un cupo agotado responde 429 con reintento, sin consultar la clínica', async () => {
    dobles.runTransaction.mockImplementationOnce(async cb => cb({
      get: async () => ({ exists: true, data: () => ({ inicio: Date.now(), conteo: 8 }) }), set: vi.fn(),
    }))
    const res = await POST(peticion())
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(dobles.collection).not.toHaveBeenCalledWith('clinics')
  })

  it('con ambos contadores disponibles continúa a la validación de la clínica', async () => {
    const res = await POST(peticion())
    expect(res.status).toBe(404)
    expect(dobles.runTransaction).toHaveBeenCalledTimes(2)
    expect(dobles.collection).toHaveBeenCalledWith('clinics')
  })
})
