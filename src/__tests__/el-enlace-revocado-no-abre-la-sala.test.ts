import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * EL ENLACE REVOCADO NO ABRE LA SALA DE VIDEO — REG-515.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `POST /api/telesalud/sala` acepta el MISMO magic-link HMAC que `/api/portal`
 * y que `/api/payment/create-checkout`. Los otros dos comprueban la revocación
 * (`patients/{id}.portalTokenVersion`, REG-331); éste no la comprobaba en
 * ningún caso: sólo la firma y la caducidad.
 *
 * Consecuencia medida antes del arreglo: el médico revoca los enlaces de un
 * paciente desde el expediente (`portalTokenVersion + 1`), el enlace deja de
 * abrir la agenda… y **sigue abriendo la sala de video de su consulta** hasta
 * que caduque, siete días después. Es la credencial que más importa revocar:
 * el cron de recordatorios la manda por WhatsApp para toda teleconsulta, y
 * WhatsApp se reenvía. Teléfono perdido, número reciclado, mensaje reenviado a
 * un grupo — los tres motivos por los que existe la revocación.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Equipo rojo read-only sobre las 99 rutas de `src/app/api`, 5-sep-2026, con
 * la consigna de refutar cada hallazgo antes de reportarlo. La hipótesis
 * principal (cross-tenant en escritura clínica) se refutó en las 99. Esto
 * sobrevivió: sólo hay TRES consumidores de `verificarTokenPaciente` en el
 * producto, y el tercero nunca entró a la unidad de revocación.
 *
 * Y el repositorio afirmaba lo contrario en dos sitios. El cron que emite el
 * enlace de la sala dice literalmente: «cuando alguien revoca los enlaces de
 * ese paciente, el contador sube y éste cae con los demás». La versión viajaba
 * dentro del token y del otro lado nadie la leía.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * «Dos rutas, un mismo contrato» — la misma forma que la regla de voz cuenta de
 * los dos motores. REG-331 cerró la revocación en las dos rutas que conocía,
 * y su guardián (`portal-revocacion-falla-cerrado.test.ts`) IMPORTA esas dos
 * rutas por nombre en vez de enumerar a quién le llega el token. La tercera
 * quedó fuera del fixture y, por tanto, fuera de la defensa. El guardián
 * estático de `authz-rutas-declaradas` sólo exige que una ruta `tokenPaciente`
 * MENCIONE `verificarTokenPaciente(`: la sala lo menciona, y pasa.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. La sala consume la MISMA decisión que sus hermanas (`bloquearSiNoVigente`,
 *    `lib/portal/vigencia-del-enlace.ts`): `revocado` → 401 definitivo;
 *    `indeterminado` → 503 con `Retry-After`, el enlace no se quema.
 * 2. Se comprueba SÓLO en la rama del paciente. El médico entra con su sesión
 *    de equipo y no tiene token que revocar: su camino no lee el expediente.
 * 3. El guardián de abajo enumera a todos los consumidores de
 *    `verificarTokenPaciente` en `src/app/api` —hoy tres— y exige que cada uno
 *    consuma también la decisión de vigencia (`bloquearSiNoVigente` o la pura
 *    `decidirVigencia`). Con los COMENTARIOS quitados antes de mirar: un
 *    comentario que nombre la función no cuenta (lección de REG-506 y del
 *    test-the-test del 5-sep).
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta como estaba (sin `bloquearSiNoVigente`), los casos 2, 3 y el
 * guardián de enumeración se ponen rojos; 1 y 4 verdes. Con el arreglo, todo
 * verde.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No cambia el ALCANCE: el cron emite a propósito alcance `agenda` para la
 *   sala («deja entrar a la sala y a la agenda del paciente»), y la sala sigue
 *   aceptándolo. Eso es diseño, no defecto.
 * - No mira la ventana horaria de Daily ni la creación real de la sala: sin
 *   `DAILY_API_KEY` la ruta devuelve una sala ficticia, que basta para medir
 *   la autorización sin salir a la red.
 * - El guardián de enumeración mira `src/app/api`. Un consumidor del token en
 *   `src/lib` que abriera una puerta propia no lo vería; hoy no existe ninguno.
 */

// ── Dobles ────────────────────────────────────────────────────────────────────
const getCita = vi.fn()
const getPaciente = vi.fn()
const verificarTokenPaciente = vi.fn()
const verificarMiembro = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (nombre: string) => {
      if (nombre !== 'clinics') throw new Error(`colección raíz inesperada: ${nombre}`)
      return {
        doc: () => ({
          collection: (sub: string) => {
            if (sub === 'appointments') return { doc: () => ({ get: getCita, update: vi.fn() }) }
            if (sub === 'patients') return { doc: () => ({ get: getPaciente }) }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }) }
            throw new Error(`subcolección inesperada: ${sub}`)
          },
        }),
      }
    },
  },
}))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: vi.fn(async () => null) }))
vi.mock('@/lib/patient-token', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/patient-token')>()
  return { ...real, verificarTokenPaciente: (...a: unknown[]) => verificarTokenPaciente(...a) }
})
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: (...a: unknown[]) => verificarMiembro(...a),
}))

import { POST } from '@/app/api/telesalud/sala/route'
import { REINTENTO_SEG } from '@/lib/portal/vigencia-del-enlace'

/** Datos FICTICIOS: nunca PHI real en pruebas. */
const CITA = { pacienteId: 'pac-777', fechaHora: '2030-01-01 10:00', estado: 'confirmada', tipo: 'teleconsulta' }

function peticion(body: Record<string, unknown>) {
  return new NextRequest('https://ejemplo.test/api/telesalud/sala', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

/** Un token del paciente de ESTA cita, acuñado con la versión que se pida. */
function tokenDelPaciente(version: number) {
  verificarTokenPaciente.mockReturnValue({ clinicId: 'c1', patientId: 'pac-777', alcance: 'agenda', version })
}

beforeEach(() => {
  getCita.mockReset()
  getPaciente.mockReset()
  verificarTokenPaciente.mockReset()
  verificarMiembro.mockReset()
  getCita.mockResolvedValue({ exists: true, data: () => CITA })
  getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 0 }) })
  verificarTokenPaciente.mockReturnValue(null)
  verificarMiembro.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) })
  delete process.env.DAILY_API_KEY
})

describe('REG-515 · el enlace revocado no abre la sala de video', () => {
  it('1 · token vigente (versión igual a la del expediente) → entra, como antes', async () => {
    tokenDelPaciente(0)
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(200)
    expect((await r.json()).ok).toBe(true)
  })

  it('2 · EL CASO: el expediente subió la versión → 401 y NO se devuelve ninguna sala', async () => {
    getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 3 }) })
    tokenDelPaciente(0)
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(401)
    const cuerpo = await r.json()
    expect(cuerpo).not.toHaveProperty('url')
    expect(cuerpo).not.toHaveProperty('name')
  })

  it('3 · no poder leer el expediente NO autoriza: 503 con Retry-After, el enlace no se quema', async () => {
    getPaciente.mockRejectedValue(new Error('UNAVAILABLE'))
    tokenDelPaciente(0)
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(503)
    expect(r.headers.get('Retry-After')).toBe(String(REINTENTO_SEG))
    expect(await r.json()).not.toHaveProperty('url')
  })

  it('3b · un expediente que ya no existe (baja ARCO) cuenta como revocado → 401', async () => {
    getPaciente.mockResolvedValue({ exists: false, data: () => undefined })
    tokenDelPaciente(0)
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(401)
  })

  it('4 · el médico entra con su sesión de equipo y su camino NO lee el expediente del paciente', async () => {
    verificarMiembro.mockResolvedValue({ ok: true, uid: 'u1', clinicId: 'c1', role: 'medico' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1' }))
    expect(r.status).toBe(200)
    expect(getPaciente).not.toHaveBeenCalled()
  })

  it('5 · un token de OTRO paciente sigue cayendo en 404 ANTES de mirar la vigencia (no confirma que la cita exista)', async () => {
    verificarTokenPaciente.mockReturnValue({ clinicId: 'c1', patientId: 'pac-OTRO', alcance: 'agenda', version: 0 })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(404)
    expect(getPaciente).not.toHaveBeenCalled()
  })
})

// ── El guardián: todo consumidor del token consume también la revocación ─────

function rutasDeApi(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) rutasDeApi(ruta, acc)
    else if (nombre === 'route.ts') acc.push(ruta)
  }
  return acc
}

/** Quita comentarios de bloque y de línea: un comentario que nombre la función no cuenta. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('REG-515 · guardián: quien acepta el token del paciente comprueba su revocación', () => {
  const consumidores = rutasDeApi(join(process.cwd(), 'src', 'app', 'api'))
    .filter(ruta => /\bverificarTokenPaciente\s*\(/.test(sinComentarios(readFileSync(ruta, 'utf8'))))

  it('la enumeración no está vacía (si el token dejara de usarse, este guardián quedaría vacuo)', () => {
    expect(consumidores.length).toBeGreaterThanOrEqual(3)
  })

  it('cada consumidor consume la decisión de vigencia (bloquearSiNoVigente o decidirVigencia) — con los comentarios quitados', () => {
    /**
     * Dos formas legítimas de la MISMA decisión: el atajo `bloquearSiNoVigente(`
     * (sala, checkout) y la función pura `decidirVigencia(` (el portal lee el
     * expediente una sola vez para dos invariantes y le pasa lo leído). Lo que
     * no vale es ninguna de las dos.
     */
    const sinRevocacion = consumidores
      .filter(ruta => !/\b(?:bloquearSiNoVigente|decidirVigencia)\s*\(/.test(sinComentarios(readFileSync(ruta, 'utf8'))))
      .map(ruta => ruta.slice(ruta.indexOf('src/app/api')))
    expect(sinRevocacion, 'aceptan el magic-link y no miran portalTokenVersion').toEqual([])
  })
})
