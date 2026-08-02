/**
 * GOLDEN — un reingreso a terapia borraba la estancia anterior.
 *
 * `ICUStay` vivía en un documento de id fijo (`icu_stays/actual`) y reabrirlo lo
 * sobreescribía. El tipo promete lo contrario, con estas palabras: «un paciente
 * puede entrar y salir de UCI varias veces dentro del MISMO internamiento, y
 * cada estancia se conserva».
 *
 * Caso real: ingresa a UCI el 1, sale a piso el 4, reingresa el 6. Los tres días
 * de la primera estancia dejaban de existir — no se podían contar ni auditar, y
 * nadie sabía que hubo un reingreso.
 */
import { describe, it, expect } from 'vitest'
import { idDeEstanciaArchivada, hayQueArchivar } from '@/lib/hospital/estancias-uci'

describe('idDeEstanciaArchivada', () => {
  it('deriva el id de la fecha de ingreso, no al azar', () => {
    // Una transacción de Firestore se reintenta: dos escrituras del mismo hecho
    // tienen que caer en el MISMO documento, o el historial diría que hubo un
    // reingreso que nunca ocurrió.
    const a = idDeEstanciaArchivada('2026-08-01T08:00:00.000Z')
    const b = idDeEstanciaArchivada('2026-08-01T08:00:00.000Z')
    expect(a).toBe(b)
    expect(a).toMatch(/^estancia-/)
  })

  it('dos ingresos distintos son dos documentos distintos', () => {
    expect(idDeEstanciaArchivada('2026-08-01T08:00:00.000Z'))
      .not.toBe(idDeEstanciaArchivada('2026-08-06T09:30:00.000Z'))
  })

  it('sin fecha NO inventa un id', () => {
    // Un id inventado crearía un documento nuevo en cada reintento.
    expect(idDeEstanciaArchivada(undefined)).toBeNull()
    expect(idDeEstanciaArchivada('')).toBeNull()
    expect(idDeEstanciaArchivada('   ')).toBeNull()
  })

  it('el id no arrastra caracteres que Firestore no acepta en un doc', () => {
    const id = idDeEstanciaArchivada('2026-08-01T08:00:00.000Z')!
    expect(id).not.toMatch(/[/.#$[\]]/)
  })
})

describe('hayQueArchivar', () => {
  it('una estancia con fecha de ingreso sí se archiva', () => {
    expect(hayQueArchivar({ fechaIngresoUci: '2026-08-01T08:00:00.000Z', estado: 'egresada' })).toBe(true)
  })

  it('un documento vacío o a medio escribir NO es una estancia', () => {
    // Llenar el historial de ruido es la forma de que nadie lo mire.
    expect(hayQueArchivar(null)).toBe(false)
    expect(hayQueArchivar(undefined)).toBe(false)
    expect(hayQueArchivar({})).toBe(false)
    expect(hayQueArchivar({ fechaIngresoUci: '' })).toBe(false)
  })
})
