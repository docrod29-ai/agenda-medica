/**
 * GOLDEN — el calendario de Google, cuando quien mueve la cita es el paciente.
 *
 * El paciente reagenda de martes a jueves desde su enlace: Nexus decía jueves y
 * el calendario del médico —y el del paciente, si estaba invitado— seguía
 * diciendo martes. Cancelaba, y el evento se quedaba vivo: el médico veía
 * ocupada una hora libre, no se la ofrecía a nadie, y el paciente seguía
 * recibiendo el recordatorio de una cita que ya había cancelado.
 *
 * No se sincronizaba **a propósito**, y el motivo estaba escrito: el token vive
 * por `uid` y quien reagenda es el paciente, así que no se sabía de quién era el
 * calendario. Ese motivo dejó de ser cierto con el vínculo `doctors/{id}.uid`
 * (v875) rellenado para todos (v899) — el mismo que ya se usa para LEER el
 * freebusy desde el portal y el bot.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estadoDeSync, POR_QUE_NO_SE_ADIVINA_EL_CALENDARIO } from '@/lib/calendario/sincronizar-servidor'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('estadoDeSync', () => {
  it('lo que se sincronizó se marca sincronizado', () => {
    expect(estadoDeSync('sincronizado')).toBe('synced')
  })

  it('sin evento en Google no se marca NADA', () => {
    // Marcar «error» una cita que nunca tuvo evento inventaría un problema y
    // llenaría el panel del médico de avisos de algo que no está roto.
    expect(estadoDeSync('sin-evento')).toBeNull()
  })

  it('sin vínculo o con fallo se marca, que es la verdad', () => {
    expect(estadoDeSync('sin-vinculo')).toBe('error')
    expect(estadoDeSync('fallo')).toBe('error')
  })

  it('los estados son los que el tipo declara, no unos inventados', async () => {
    /**
     * El portal escribía `googleCalendarSyncStatus: 'desincronizado'`, y el tipo
     * declara `'pending' | 'synced' | 'error'`. El SDK de admin no está tipado
     * en `update()`, así que nadie se quejó — pero ningún lector que compare
     * contra la unión declarada podría reconocer ese valor nunca.
     */
    const tipos = leer('src', 'types', 'index.ts')
    const i = tipos.indexOf('googleCalendarSyncStatus')
    const decl = tipos.slice(i, i + 120)
    for (const v of ['synced', 'error']) expect(decl).toContain(v)
    expect(decl).not.toContain('desincronizado')

    const portal = leer('src', 'app', 'api', 'portal', 'route.ts')
    expect(portal).not.toContain("'desincronizado'")
  })
})

describe('nunca escribe en el calendario equivocado', () => {
  const s = leer('src', 'lib', 'calendario', 'sincronizar-servidor.ts')

  it('sin vínculo médico ↔ calendario no toca nada', () => {
    // Escribir en el del dueño de la clínica le metería una cita ajena en su
    // agenda a otro médico, y le borraría la suya.
    expect(s).toContain("if (!refreshToken) return 'sin-vinculo'")
    expect(s).toContain("if (!uid) return ''")
    expect(POR_QUE_NO_SE_ADIVINA_EL_CALENDARIO).toMatch(/calendario del médico equivocado/)
  })

  it('sin evento no inventa uno', () => {
    expect(s).toContain("if (!cita.googleCalendarEventId) return 'sin-evento'")
    // Y no crea eventos: el portal mueve y borra, nunca da de alta.
    expect(s).not.toContain('createCalendarEvent')
  })

  it('un fallo de Google NO tumba lo que el paciente ya hizo', () => {
    // La cita ya está reagendada o cancelada en Nexus, que es la fuente de
    // verdad; el calendario es la copia.
    expect(s).toContain("} catch {\n    return 'fallo'\n  }")
  })
})

describe('el portal lo usa en los dos caminos', () => {
  const s = leer('src', 'app', 'api', 'portal', 'route.ts')

  it('reagendar mueve el evento a la fecha NUEVA', () => {
    expect(s).toContain("{ ...cita, fechaHora: nuevaFechaHora },\n            'mover',")
  })

  it('cancelar lo borra', () => {
    expect(s).toContain("sincronizarCitaDelPortal(clinicId, cita, 'borrar', config)")
  })

  it('y el motivo viejo quedó corregido, no borrado', () => {
    // Quien lea esto dentro de un año tiene que entender por qué antes NO se
    // hacía, y por qué ahora sí.
    expect(s).toContain('Ese motivo dejó de ser cierto')
    expect(s).toContain('v875')
  })
})
