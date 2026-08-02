/**
 * GOLDEN — el bloqueo ARCO tenía que morder, y no mordía.
 *
 * Al ejecutar una cancelación por bloqueo se le dice al médico y al titular,
 * con estas palabras, que el paciente «no vuelve a recibir recordatorios, ni
 * reactivación, ni campañas». El campo `arcoBloqueo` se escribía y no lo miraba
 * NADIE: `estaBloqueadoArco` no tenía un solo llamador en producción.
 *
 * Va dentro de `pacientesParaReactivar` y no en el predicado del llamador porque
 * un derecho ejercido no puede depender de que cada pantalla se acuerde.
 */
import { describe, it, expect } from 'vitest'
import { pacientesParaReactivar } from '@/lib/reactivacion'
import { marcaDeBloqueo, estaBloqueadoArco } from '@/lib/arco/cancelacion'
import type { Patient } from '@/types'

const paciente = (id: string, over: Partial<Patient> = {}): Patient => ({
  ...({} as Patient),
  id, nombre: `Paciente ${id}`, telefono: '5550000000',
  ultimaCita: '2025-01-01',
  ...over,
} as Patient)

const HOY = '2026-08-01'

describe('pacientesParaReactivar', () => {
  it('propone a quien lleva tiempo sin volver', () => {
    const r = pacientesParaReactivar([paciente('a')], HOY, 90)
    expect(r.map(c => c.paciente.id)).toEqual(['a'])
  })

  it('NO propone a quien ejerció su cancelación ARCO', () => {
    const bloqueado = paciente('b', {
      arcoBloqueo: marcaDeBloqueo({ ahoraMs: Date.parse('2026-06-01T10:00:00Z'), uid: 'med-1', solicitudId: 'sol-1', motivo: 'solicitud del titular' }),
    } as Partial<Patient>)
    const r = pacientesParaReactivar([paciente('a'), bloqueado], HOY, 90)
    expect(r.map(c => c.paciente.id)).toEqual(['a'])
  })

  it('la marca se reconoce como bloqueo', () => {
    const m = marcaDeBloqueo({ ahoraMs: Date.parse('2026-06-01T10:00:00Z'), uid: 'med-1', solicitudId: 'sol-1', motivo: 'x' })
    expect(estaBloqueadoArco({ arcoBloqueo: m })).toBe(true)
    expect(estaBloqueadoArco({})).toBe(false)
    expect(estaBloqueadoArco(null)).toBe(false)
  })
})
