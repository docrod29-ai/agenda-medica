/**
 * GOLDEN — «Mis recetas» imprimía «Invalid Date» y el botón no descargaba.
 *
 * El portal parseaba TODO como hora de pared del consultorio. Con una cita
 * (`2026-07-24 10:00`) funciona; con la fecha de una receta —que viene de
 * `nota.fechaConsulta`, un ISO completo con Z— daba `Invalid Date`: la tarjeta
 * lo imprimía tal cual y al pulsar Descargar, `toISOString()` lanzaba
 * `RangeError` sin un solo mensaje para el paciente.
 */
import { describe, it, expect } from 'vitest'
import { fechaFlexible } from '@/lib/portal/fechas'

const TZ = 'America/Mexico_City'

describe('fechaFlexible', () => {
  it('un ISO con Z se respeta tal cual', () => {
    // Éste es el caso que rompía.
    const d = fechaFlexible('2026-07-24T10:00:00.000Z', TZ)
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-07-24T10:00:00.000Z')
  })

  it('la hora de pared de una cita se ancla a la zona del consultorio', () => {
    // 10:00 en México (UTC-6 en julio) = 16:00 UTC.
    const d = fechaFlexible('2026-07-24 10:00', TZ)
    expect(d!.toISOString()).toBe('2026-07-24T16:00:00.000Z')
  })

  it('sólo el día se ancla al MEDIODÍA, no a medianoche', () => {
    // A medianoche, un desfase de horas cambia el día que ve el paciente.
    const d = fechaFlexible('2026-07-24', TZ)
    expect(d!.toISOString().slice(0, 10)).toBe('2026-07-24')
  })

  it('lo que no se entiende devuelve null, NO una fecha inventada', () => {
    // Una fecha inventada en una receta se lee como la fecha real en que se
    // recetó. `null` deja que la pantalla diga «sin fecha», que es la verdad.
    expect(fechaFlexible('no es una fecha', TZ)).toBeNull()
    expect(fechaFlexible('', TZ)).toBeNull()
    expect(fechaFlexible(undefined, TZ)).toBeNull()
    expect(fechaFlexible(null, TZ)).toBeNull()
  })

  it('un ISO con offset explícito también se respeta', () => {
    const d = fechaFlexible('2026-07-24T10:00:00-06:00', TZ)
    expect(d!.toISOString()).toBe('2026-07-24T16:00:00.000Z')
  })
})
