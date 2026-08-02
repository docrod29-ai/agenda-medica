/**
 * GOLDEN — la dosis que se registraba y desaparecía del MAR.
 *
 * El servidor guardaba el objeto del cliente entero (`{ ...(p.adm ?? {}) }`).
 * El motor del MAR reparte las administraciones en `administrado` u `omitido`:
 * una dosis con cualquier otro estado no cae en ninguna cubeta y desaparece —
 * la enfermera la ve confirmada en pantalla y el pase de visita lee «sin
 * administraciones» y un atraso que no ocurrió.
 */
import { describe, it, expect } from 'vitest'
import {
  sanearAdministracionEntrante, MOTIVO_ESTADO_INVALIDO,
} from '@/lib/hospital/administracion-entrante'

describe('sanearAdministracionEntrante', () => {
  it('un estado desconocido se RECHAZA, no se corrige', () => {
    // Guardar «omitido» por defecto inventaría una decisión que nadie tomó.
    expect(() => sanearAdministracionEntrante({ estado: 'ok' })).toThrow(MOTIVO_ESTADO_INVALIDO)
    expect(() => sanearAdministracionEntrante({})).toThrow(MOTIVO_ESTADO_INVALIDO)
    expect(() => sanearAdministracionEntrante(null)).toThrow(MOTIVO_ESTADO_INVALIDO)
  })

  it('los dos estados válidos pasan', () => {
    expect(sanearAdministracionEntrante({ estado: 'administrado' }).estado).toBe('administrado')
    expect(sanearAdministracionEntrante({ estado: 'omitido' }).estado).toBe('omitido')
  })

  it('las verificaciones de enfermería exigen un true explícito', () => {
    // `"no"` es truthy: se leía después como una verificación hecha.
    const a = sanearAdministracionEntrante({ estado: 'administrado', cincoCorrectos: 'no', identidadVerificada: 1 })
    expect(a.cincoCorrectos).toBe(false)
    expect(a.identidadVerificada).toBe(false)

    const b = sanearAdministracionEntrante({ estado: 'administrado', cincoCorrectos: true, identidadVerificada: true })
    expect(b.cincoCorrectos).toBe(true)
    expect(b.identidadVerificada).toBe(true)
  })

  it('lo que el cliente no tiene derecho a decidir no entra', () => {
    const a = sanearAdministracionEntrante({
      estado: 'administrado',
      por: 'Dr. Otro', porUid: 'uid-ajeno', fecha: '1999-01-01T00:00:00.000Z',
      loQueSea: 'x',
    }) as Record<string, unknown>
    expect(a.por).toBeUndefined()
    expect(a.porUid).toBeUndefined()
    expect(a.fecha).toBeUndefined()
    expect(a.loQueSea).toBeUndefined()
  })

  it('la nota se conserva, y una vacía no ocupa lugar', () => {
    expect(sanearAdministracionEntrante({ estado: 'omitido', nota: '  paciente en TAC  ' }).nota).toBe('paciente en TAC')
    expect(sanearAdministracionEntrante({ estado: 'omitido', nota: '   ' }).nota).toBeUndefined()
  })
})
