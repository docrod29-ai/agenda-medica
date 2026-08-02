/**
 * GOLDEN — el calendario del médico también ocupa.
 *
 * La integración con Google era de UNA dirección: NexusMED empujaba sus citas y
 * nada volvía. El médico se ponía una cirugía el jueves de 8 a 12 en Google y la
 * agenda seguía ofreciendo esas horas; el choque se descubría el jueves.
 *
 * Se convierten a bloqueos porque el motor de huecos ya sabe descartarlos —lo
 * respetan el panel, el portal, el bot y el portal del paciente—: un origen
 * nuevo de ocupación no necesita un camino nuevo.
 */
import { describe, it, expect } from 'vitest'
import { comoBloqueos, esDeGoogle } from '@/lib/calendario/ocupado-externo'
import { estaBloqueado } from '@/lib/time-blocks-core'

const TZ = 'America/Mexico_City'

describe('comoBloqueos', () => {
  it('convierte un intervalo ocupado en algo que el motor ya entiende', () => {
    const [b] = comoBloqueos([{ start: '2026-08-06T14:00:00Z', end: '2026-08-06T18:00:00Z' }], 'med-1')
    expect(b.tipo).toBe('evento')
    expect(b.medicoId).toBe('med-1')
    expect(esDeGoogle(b)).toBe(true)
    // El motivo tiene que decir de dónde salió: el médico no lo creó en NexusMED
    // y, si no lo dice, en la pantalla de bloqueos parece un fantasma.
    expect(b.motivo).toMatch(/Google/i)
  })

  it('el hueco que cae dentro deja de ofrecerse', () => {
    // Cirugía de 8 a 12 hora del consultorio (UTC-6 en agosto).
    const bloqueos = comoBloqueos([{ start: '2026-08-06T14:00:00Z', end: '2026-08-06T18:00:00Z' }], 'med-1')
    expect(estaBloqueado('2026-08-06 09:00', bloqueos, 'med-1', TZ)).not.toBeNull()
    expect(estaBloqueado('2026-08-06 13:00', bloqueos, 'med-1', TZ)).toBeNull()
  })

  it('la agenda ajena de UNO no cierra la de los demás', () => {
    // El token de Google es personal: sin `medicoId` el bloqueo aplicaría a todo
    // el consultorio, que sería peor que no tenerlo.
    const bloqueos = comoBloqueos([{ start: '2026-08-06T14:00:00Z', end: '2026-08-06T18:00:00Z' }], 'med-1')
    expect(estaBloqueado('2026-08-06 09:00', bloqueos, 'med-2', TZ)).toBeNull()
  })

  it('un intervalo incompleto o al revés se DESCARTA, no rompe el día', () => {
    // Que Google devuelva una fila rara no puede dejar al médico sin agenda.
    expect(comoBloqueos([
      { start: '2026-08-06T14:00:00Z' },
      { end: '2026-08-06T18:00:00Z' },
      { start: 'no-es-fecha', end: '2026-08-06T18:00:00Z' },
      { start: '2026-08-06T18:00:00Z', end: '2026-08-06T14:00:00Z' },
      { start: '2026-08-06T14:00:00Z', end: '2026-08-06T14:00:00Z' },
    ], 'med-1')).toEqual([])
  })

  it('sin intervalos no hay bloqueos', () => {
    expect(comoBloqueos([], 'med-1')).toEqual([])
  })

  it('lo que NO viene de Google no se marca como suyo', () => {
    expect(esDeGoogle({ creadoPor: 'dr@ejemplo.mx' })).toBe(false)
  })
})
