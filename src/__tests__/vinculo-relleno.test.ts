/**
 * GOLDEN — el vínculo que les FALTA a los que ya estaban conectados.
 *
 * v875 escribió el vínculo `médico ↔ uid` al conectar el calendario, y v876/v877
 * lo consumieron para que el portal y el bot descuenten los eventos de Google.
 * Pero eso sólo cubre a quien CONECTE a partir de entonces: el que ya estaba
 * conectado sigue sin vínculo, su pantalla dice «Conectado» con su palomita
 * verde, y la agenda pública sigue ofreciendo huecos encima de su quirófano.
 *
 * Es la misma forma de fallo de siempre —la pantalla promete algo que no está
 * pasando— y encima es invisible: nadie va a reconectar por su cuenta algo que
 * no sabe que le falta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estadoDelVinculo, AVISO_SIN_VINCULO } from '@/lib/calendario/vinculo-medico'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('estadoDelVinculo', () => {
  it('sin calendario conectado no hay nada que ligar', () => {
    expect(estadoDelVinculo(null)).toBe('sin-calendario')
    expect(estadoDelVinculo(undefined)).toBe('sin-calendario')
    expect(estadoDelVinculo({})).toBe('sin-calendario')
    // Un token a medias (sin refreshToken) NO cuenta como conectado: es el mismo
    // criterio que ya usaba `status`, y el que evita reportar conexiones falsas.
    expect(estadoDelVinculo({ medicoId: 'm1' })).toBe('sin-calendario')
    expect(estadoDelVinculo({ refreshToken: '   ' })).toBe('sin-calendario')
  })

  it('conectado y sin médico: hay que rellenarlo', () => {
    expect(estadoDelVinculo({ refreshToken: 'r' })).toBe('falta')
    expect(estadoDelVinculo({ refreshToken: 'r', medicoId: '' })).toBe('falta')
    expect(estadoDelVinculo({ refreshToken: 'r', medicoId: '  ' })).toBe('falta')
  })

  it('un vínculo YA HECHO no se recalcula', () => {
    // Recalcularlo podría moverlo si entretanto cambiaron los correos, y mover
    // un vínculo es reasignar las horas ocupadas de un médico a otro sin que
    // nadie lo haya pedido.
    expect(estadoDelVinculo({ refreshToken: 'r', medicoId: 'm1' })).toBe('ya-ligado')
  })
})

describe('el relleno vive con la sesión, no en un camino público', () => {
  const s = leer('src', 'app', 'api', 'calendar', 'status', 'route.ts')

  it('lo dispara la pantalla del propio médico, con su token verificado', () => {
    expect(s).toContain('verificarUsuario(req)')
    expect(s).toContain('rellenarVinculoSiFalta(acc.uid, acc.email)')
    // El uid y el correo salen del token; si salieran del cuerpo, cualquiera
    // podría ligar el calendario de otro a su propia ficha.
    expect(s).not.toMatch(/rellenarVinculoSiFalta\([^)]*body|req\.json/)
  })

  it('y NO se inventa una conexión que no existe', () => {
    expect(s).toContain("relleno.estado === 'sin-calendario'")
  })
})

describe('las dos vías usan las MISMAS reglas', () => {
  it('conectar y rellenar llaman al mismo resolvedor', () => {
    // Si cada una tuviera su copia, afinar una dejaría la otra atrás — y el
    // desacuerdo entre las dos sería justo ligar a un médico equivocado.
    const cb = leer('src', 'app', 'api', 'calendar', 'callback', 'route.ts')
    const srv = leer('src', 'lib', 'calendario', 'ligar-en-servidor.ts')
    expect(cb).toContain("from '@/lib/calendario/ligar-en-servidor'")
    expect(cb).toContain('resolverYLigar(')
    expect(srv).toContain('vincularMedico(uid, email, lista)')
    // Y sigue sin adivinar: sólo escribe cuando el correo fue inequívoco.
    expect(srv).toContain("vinculo.como === 'por-correo'")
  })

  it('el relleno NUNCA crea el token: si no hay calendario, no hay nada que ligar', () => {
    const srv = leer('src', 'lib', 'calendario', 'ligar-en-servidor.ts')
    const i = srv.indexOf('export async function rellenarVinculoSiFalta')
    const cuerpo = srv.slice(i)
    // El único `set` del cuerpo es el parche con merge, y llega DESPUÉS de haber
    // comprobado que el token existe y está conectado.
    expect(cuerpo).toContain("{ merge: true }")
    expect(cuerpo.indexOf('estadoDelVinculo(token)')).toBeLessThan(cuerpo.indexOf('ref.set('))
  })
})

describe('y el médico se entera', () => {
  it('la pantalla distingue «conectado» de «la agenda pública ya te ve»', () => {
    const s = leer('src', 'app', '(dashboard)', 'configuracion', 'page.tsx')
    expect(s).toContain('gcalAviso')
    expect(s).toContain('Conectado, pero sin ligar a tu ficha')
    // Sólo se enseña cuando de verdad falta, no en cada carga.
    expect(s).toContain('data?.vinculado === false')
  })

  it('el aviso dice la consecuencia, no sólo que falló', () => {
    expect(AVISO_SIN_VINCULO).toMatch(/reservar encima/)
    expect(AVISO_SIN_VINCULO).toMatch(/correo/)
  })
})
