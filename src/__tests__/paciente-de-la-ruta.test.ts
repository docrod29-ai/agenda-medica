/**
 * `patientIdDeLaRuta` — de qué paciente es esta pantalla, leído de la URL.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * V15-PATIENT-WORKSPACE-001 (continuación) usa esta función para que
 * `InstrumentStrip` sepa pintar «paciente actual» en consulta/receta/orden/
 * nota/referencia sin inventar un contexto de React nuevo ni tocar esas seis
 * páginas. Si la lista de segmentos se desincroniza del árbol real de rutas
 * (alguien renombra una carpeta, o el segundo segmento de alguna de ellas deja
 * de ser un `patientId`), la franja pintaría un nombre que no corresponde a la
 * pantalla — el mismo tipo de defecto que ya protege `csp-guard.test.ts` para
 * la lista de rutas privadas, aplicado aquí a navegación en vez de seguridad.
 *
 * Probado al revés: si se borra la comprobación `PRIMER_SEGMENTO_CON_PACIENTE`
 * y la función devolviera el segundo segmento de CUALQUIER ruta, el caso
 * "rutas sin paciente" de abajo fallaría (p. ej. `/pendientes/algo` no debe
 * confundirse con un paciente).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No lee Firestore ni resuelve el NOMBRE del paciente — sólo el id de la URL.
 */
import { describe, it, expect } from 'vitest'
import { patientIdDeLaRuta } from '@/lib/nav/paciente-de-la-ruta'

describe('patientIdDeLaRuta — reconoce las seis rutas que llevan un paciente', () => {
  it.each([
    ['/expediente/pac-123', 'pac-123'],
    ['/consulta/pac-123', 'pac-123'],
    ['/nota/pac-123', 'pac-123'],
    ['/nota/pac-123/nota-456', 'pac-123'],
    ['/receta/pac-123/nota-456', 'pac-123'],
    ['/orden/pac-123/nota-456', 'pac-123'],
    ['/referencia/pac-123', 'pac-123'],
  ])('%s → %s', (ruta, esperado) => {
    expect(patientIdDeLaRuta(ruta)).toBe(esperado)
  })
})

describe('patientIdDeLaRuta — no confunde otras rutas con un paciente', () => {
  it.each([
    null,
    undefined,
    '',
    '/',
    '/dashboard',
    '/pacientes',
    '/pendientes',
    '/operaciones',
    // El segundo segmento de hospitalización es un INTERNAMIENTO, no un paciente.
    '/hospitalizacion/int-789',
    // Rutas de un solo segmento de las seis anteriores (sin id todavía).
    '/expediente',
    '/consulta',
  ])('%s → null', (ruta) => {
    expect(patientIdDeLaRuta(ruta)).toBeNull()
  })
})

describe('patientIdDeLaRuta — datos sucios no la tumban', () => {
  it('un %-escape inválido en el segmento no lanza, devuelve null', () => {
    expect(() => patientIdDeLaRuta('/expediente/%')).not.toThrow()
    expect(patientIdDeLaRuta('/expediente/%')).toBeNull()
  })

  it('decodifica el id si viene URL-encoded', () => {
    expect(patientIdDeLaRuta('/expediente/pac%20123')).toBe('pac 123')
  })
})
