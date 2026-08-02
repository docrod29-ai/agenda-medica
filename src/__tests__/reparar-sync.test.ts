/**
 * GOLDEN — la cita descuadrada con Google, que hasta ahora nadie veía.
 *
 * `Appointment.googleCalendarSyncStatus` se escribía en cinco sitios y **no lo
 * leía ninguna pantalla**. Un campo escrito y nunca leído no es una función a
 * medias: es una promesa. El comentario del portal decía literalmente que la
 * cita se marcaba «para que el panel pueda mostrarlo y el médico lo arregle con
 * un clic desde su sesión» — y ese panel no existía.
 *
 * O sea: cuando el paciente reagendaba y Google fallaba, o cuando el médico no
 * tenía su calendario ligado, la cita quedaba marcada… y él seguía con un evento
 * equivocado en su calendario sin ninguna forma de enterarse. Exactamente el
 * estado que la marca existía para evitar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  necesitaReparacion, accionDeReparacion, avisoDesincronizada,
  POR_QUE_NO_SE_REINTENTA_SOLO,
} from '@/lib/calendario/reparar-sync'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('necesitaReparacion', () => {
  it('marcada en error y con evento: hay algo que arreglar', () => {
    expect(necesitaReparacion({ googleCalendarEventId: 'ev1', googleCalendarSyncStatus: 'error' })).toBe(true)
  })

  it('sin evento no hay nada que arreglar', () => {
    // Nunca llegó a estar en el calendario: enseñar un aviso sería inventar un
    // problema, y el médico aprendería a ignorar el aviso.
    expect(necesitaReparacion({ googleCalendarSyncStatus: 'error' })).toBe(false)
    expect(necesitaReparacion({ googleCalendarEventId: '', googleCalendarSyncStatus: 'error' })).toBe(false)
  })

  it('`pending` NO se pinta en rojo: es una escritura en vuelo, no un fallo', () => {
    expect(necesitaReparacion({ googleCalendarEventId: 'ev1', googleCalendarSyncStatus: 'pending' })).toBe(false)
    expect(necesitaReparacion({ googleCalendarEventId: 'ev1', googleCalendarSyncStatus: 'synced' })).toBe(false)
    expect(necesitaReparacion({ googleCalendarEventId: 'ev1' })).toBe(false)
  })

  it('una cita basura no revienta la agenda', () => {
    expect(necesitaReparacion(null)).toBe(false)
    expect(necesitaReparacion(undefined)).toBe(false)
  })
})

describe('accionDeReparacion', () => {
  it('lo cancelado se BORRA del calendario, no se actualiza', () => {
    // En el calendario del médico —y en el del paciente, si estaba invitado— no
    // debe quedar nada de una cita que ya no existe.
    expect(accionDeReparacion('cancelada')).toBe('delete')
    expect(accionDeReparacion('reagendada')).toBe('delete')
  })

  it('todo lo demás se reescribe con los datos actuales de la cita', () => {
    for (const e of ['confirmada', 'pendiente-confirmar', 'en-sala', 'atendida', undefined]) {
      expect(accionDeReparacion(e)).toBe('update')
    }
  })
})

describe('avisoDesincronizada dice la CONSECUENCIA, no «hubo un error»', () => {
  it('la cancelada que sigue viva', () => {
    expect(avisoDesincronizada('cancelada')).toMatch(/sigue viva en Google Calendar/)
    expect(avisoDesincronizada('cancelada')).toMatch(/te ocupa la hora/)
  })

  it('la movida que quedó con la hora vieja', () => {
    expect(avisoDesincronizada('confirmada')).toMatch(/datos viejos/)
  })

  it('y se explica por qué no se reintenta solo', () => {
    expect(POR_QUE_NO_SE_REINTENTA_SOLO).toMatch(/calendario sin ligar/)
  })
})

describe('la pantalla existe de verdad', () => {
  const s = leer('src', 'app', '(dashboard)', 'citas', 'page.tsx')

  it('la agenda LEE el estado, no sólo lo escriben cinco rutas', () => {
    expect(s).toContain('necesitaReparacion(appt)')
    expect(s).toContain('Calendario descuadrado')
    expect(s).toContain('avisoDesincronizada(appt.estado)')
  })

  it('repara con la acción correcta y desde la sesión del médico', () => {
    // `/api/calendar/sync` escribe con el googleTokens/{uid} del que está en
    // sesión: es justo lo que al portal le falta cuando no hay vínculo.
    expect(s).toContain('accionDeReparacion(appt.estado)')
    expect(s).toContain("fetchAutenticado('/api/calendar/sync'")
  })

  it('y si vuelve a fallar, dice qué revisar en vez de un «error» a secas', () => {
    expect(s).toContain('Configuración → Integraciones')
  })
})
