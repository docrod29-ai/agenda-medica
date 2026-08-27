import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PATIENT-PORTAL-001 — `/api/portal`, `/api/public/resena` y
 * `/api/payment/create-checkout` no tenían NINGÚN `limitar*`, a diferencia de
 * sus hermanas (`telesalud/sala`: 12/600s, `public/booking`: 8/h por IP).
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────
 *
 * Un enlace filtrado —reenviado por WhatsApp, capturado de una URL
 * compartida, o un token de reseña adivinado por fuerza bruta— podía usarse
 * sin ningún freno: enumerar citas, mover la agenda del consultorio,
 * generar sesiones de Checkout de Stripe sin límite, o probar tokens de
 * reseña al azar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────
 *
 * `grep -n "limitar" src/app/api/portal/route.ts` no devolvía nada, pese a
 * que la ruta hermana (`telesalud/sala`) sí lo usa desde REG-xxx. El
 * hallazgo estaba registrado en `agent-state/BACKLOG.json` (PATIENT-PORTAL-001,
 * origen: auditoría PATIENT-UX-TRUTH-001 del 8-ago-2026) y seguía `pendiente`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────
 *
 * Las tres rutas piden cupo ANTES de tocar Firestore o Stripe, y cada ventana
 * cubre un riesgo distinto:
 *
 *  · `portal:ip:{ip}` (120/600s, ESTRICTO) — antes incluso de verificar el
 *    token. Las demás claves salen del token, así que una ráfaga de tokens
 *    INVÁLIDOS no la contaba nadie: era la única forma de pegarle a esta ruta
 *    sin cupo ninguno.
 *  · `portal:{clinic}:{paciente}` (40/600s, laxo) — mirar lo propio.
 *  · `portal:mutacion:…` (10/600s, ESTRICTO) — lo que MUEVE la agenda:
 *    confirmar, cancelar, reagendar y —desde P1— el formulario previo, que
 *    escribe en el expediente y manda un WhatsApp por envío.
 *  · `portal:clinico:…` (15/600s, ESTRICTO) — `documentos` y `paquetes`, que
 *    devuelven secreto médico. Cuarenta lecturas de la agenda no son cuarenta
 *    descargas del recetario.
 *
 * ESTRICTO = `limitarEstricto`: mismo contador, y si el freno no puede contar
 * NO se pasa (503 retryable). Es el invariante de REG-331 en el otro eje —
 * durante una incidencia se puede seguir MIRANDO lo propio, pero no se gana la
 * capacidad de mover la agenda, cobrar, ni vaciar el expediente sin freno.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────
 *
 * No mide el comportamiento real de `limitar()` ni de `limitarEstricto()`
 * —eso ya lo cubre `nucleo/rate-limit.test.ts`—, sólo que estas tres rutas
 * los INVOCAN con la clave, la ventana y la POLÍTICA DE FALLO correctas, y
 * que un 429 corta el flujo antes de escribir nada. Tampoco cubre la
 * revocación del enlace: eso es `portal-revocacion-falla-cerrado.test.ts`.
 * Los umbrales (120, 40, 10, 15, 8, 10) son criterio, no una cifra clínica.
 */

const limitarOResponderMock = vi.fn(async (_clave: string, _max: number, _ventanaSeg: number, _mensaje?: string) => null as unknown)
const limitarEstrictoMock = vi.fn(async (_clave: string, _max: number, _ventanaSeg: number, _mensaje?: string) => null as unknown)

/**
 * Las claves EN EL ORDEN en que la ruta las pide. Los `mock.calls` de cada
 * doble sólo conservan el orden dentro de su propio doble, y aquí hace falta el
 * orden entre los dos: que `portal:ip:…` se pida ANTES de verificar el token es
 * la mitad del arreglo, y con las listas concatenadas eso no se puede ver.
 */
const ordenDeClaves: string[] = []

vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: (...args: [string, number, number, string?]) => {
    ordenDeClaves.push(args[0])
    return limitarOResponderMock(...args)
  },
  limitarEstricto: (...args: [string, number, number, string?]) => {
    ordenDeClaves.push(args[0])
    return limitarEstrictoMock(...args)
  },
}))

/** Todas las claves pedidas por la ruta, del freno que sea, en orden. */
function clavesPedidas(): string[] {
  return [...ordenDeClaves]
}
function llamadaEstricta(clave: string) {
  return limitarEstrictoMock.mock.calls.find(c => c[0] === clave)
}

// ── Dobles del Admin SDK — sólo lo que cada ruta necesita para llegar hasta
//    el punto donde se decide si hay cupo ──────────────────────────────────
const getPatient = vi.fn()
const getCitas = vi.fn()
const getConfig = vi.fn()
const getClinicDoc = vi.fn()
const updateCita = vi.fn()
const runTransactionMock = vi.fn()
const getResenaRequest = vi.fn()
const setFormulario = vi.fn()
const getNotas = vi.fn()
const getPaquetes = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: () => 'inc' } } },
  adminDb: {
    runTransaction: (fn: (tx: unknown) => unknown) => runTransactionMock(fn),
    collection: (top: string) => {
      if (top === 'clinic_review_requests') {
        return { doc: (id: string) => ({ __ref: 'resena', id }) }
      }
      return {
        doc: () => ({
          get: getClinicDoc,
          collection: (sub: string) => {
            if (sub === 'appointments') {
              return {
                where: () => ({ get: getCitas }),
                doc: () => ({ get: getCitas, update: updateCita }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: getConfig }) }
            if (sub === 'patients') {
              return {
                doc: () => ({
                  get: getPatient,
                  update: vi.fn(async () => undefined),
                  collection: (s2: string) => {
                    if (s2 === 'formularios_previos') return { doc: () => ({ set: setFormulario }) }
                    if (s2 === 'paquetes_visita') return { get: getPaquetes }
                    return { where: () => ({ get: getNotas }) }
                  },
                }),
              }
            }
            if (sub === 'reviews') return { doc: () => ({ __ref: 'review' }) }
            throw new Error(`subcolección inesperada en el test: ${sub}`)
          },
        }),
      }
    },
  },
}))

vi.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }))

import { POST as portalPOST } from '@/app/api/portal/route'
import { POST as pagoPOST } from '@/app/api/payment/create-checkout/route'
import { POST as resenaPOST } from '@/app/api/public/resena/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

function reqPortal(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof portalPOST>[0]
}
function reqPago(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof pagoPOST>[0]
}
function reqResena(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof resenaPOST>[0]
}

beforeEach(() => {
  limitarOResponderMock.mockReset()
  limitarOResponderMock.mockResolvedValue(null) // cupo disponible por defecto
  limitarEstrictoMock.mockReset()
  limitarEstrictoMock.mockResolvedValue(null)
  ordenDeClaves.length = 0
  getPatient.mockReset().mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 0 }) })
  getCitas.mockReset().mockResolvedValue({ docs: [] })
  getConfig.mockReset().mockResolvedValue({ exists: false })
  getClinicDoc.mockReset().mockResolvedValue({ exists: true, data: () => ({ nombreClinica: 'Clínica Ficticia' }) })
  updateCita.mockReset().mockResolvedValue(undefined)
  runTransactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    get: async () => ({ exists: true, data: () => ({ used: false, clinicId: CLINICA }) }),
    set: vi.fn(),
    update: vi.fn(),
  }))
  getResenaRequest.mockReset()
  setFormulario.mockReset().mockResolvedValue(undefined)
  getNotas.mockReset().mockResolvedValue({ docs: [] })
  getPaquetes.mockReset().mockResolvedValue({ docs: [] })
})

describe('PATIENT-PORTAL-001 · `/api/portal` llama al limitador antes de todo', () => {
  it('con cupo disponible, la sesión sigue funcionando (no rompe el flujo real)', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect(limitarOResponderMock).toHaveBeenCalledWith(
      `portal:${CLINICA}:${PACIENTE}`, 40, 600, expect.any(String),
    )
  })

  it('AL REVÉS: si el limitador dice que no hay cupo, la ruta devuelve 429 y no llega a leer citas', async () => {
    limitarOResponderMock.mockImplementation(async (clave: string) =>
      clave === `portal:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(429)
    expect(getCitas).not.toHaveBeenCalled()
  })

  it('confirmar/cancelar/reagendar pasan además por el límite ESTRECHO de mutación', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, estado: 'pendiente-confirmar' }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'confirmar', token, citaId: 'c1' }))
    expect(clavesPedidas()).toContain(`portal:${CLINICA}:${PACIENTE}`)
    const llamadaMutacion = llamadaEstricta(`portal:mutacion:${CLINICA}:${PACIENTE}`)
    expect(llamadaMutacion?.[1]).toBe(10)
    expect(llamadaMutacion?.[2]).toBe(600)
  })

  it('una lectura simple (`session`) NO consume el cupo estrecho de mutación', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'session', token }))
    expect(clavesPedidas()).not.toContain(`portal:mutacion:${CLINICA}:${PACIENTE}`)
    expect(clavesPedidas()).not.toContain(`portal:clinico:${CLINICA}:${PACIENTE}`)
  })

  it('AL REVÉS: si el límite de mutación se agota, cancelar NO escribe en Firestore', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, estado: 'pendiente-confirmar', fechaHora: '2099-01-01 10:00' }) })
    limitarEstrictoMock.mockImplementation(async (clave: string) =>
      clave === `portal:mutacion:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'cancelar', token, citaId: 'c1' }))
    expect(res.status).toBe(429)
    expect(updateCita).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 (P1) · el freno POR IP, antes de verificar el token', () => {
  it('se pide ANTES que ninguna otra ventana: es la primera clave de la ráfaga', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'session', token }, '198.51.100.7'))
    expect(clavesPedidas()[0]).toBe('portal:ip:198.51.100.7')
    const llamada = llamadaEstricta('portal:ip:198.51.100.7')
    expect(llamada?.[1]).toBe(120)
    expect(llamada?.[2]).toBe(600)
  })

  it('EL HUECO QUE CERRÓ: una ráfaga de tokens INVÁLIDOS también consume cupo', async () => {
    // Las demás claves salen del token; con un token que no verifica, ninguna
    // llegaba a pedirse. Ésta sí, porque va antes de la puerta.
    await portalPOST(reqPortal({ action: 'session', token: 'basura.inventada' }, '198.51.100.8'))
    expect(clavesPedidas()).toContain('portal:ip:198.51.100.8')
  })

  it('AL REVÉS: agotado el cupo por IP, la ruta corta ANTES de mirar el expediente', async () => {
    limitarEstrictoMock.mockImplementation(async (clave: string) =>
      clave.startsWith('portal:ip:')
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(429)
    expect(getPatient).not.toHaveBeenCalled()
    expect(getCitas).not.toHaveBeenCalled()
  })

  it('el cupo es por IP: dos pacientes distintos desde la misma conexión comparten ventana', async () => {
    await portalPOST(reqPortal({ action: 'session', token: crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda') }, '198.51.100.9'))
    await portalPOST(reqPortal({ action: 'session', token: crearTokenPaciente(CLINICA, 'pac-ficticio-002', 7, 'agenda') }, '198.51.100.9'))
    const porIp = clavesPedidas().filter(c => c.startsWith('portal:ip:'))
    expect(porIp).toEqual(['portal:ip:198.51.100.9', 'portal:ip:198.51.100.9'])
  })
})

describe('PATIENT-PORTAL-001 (P1) · el formulario previo cuenta como mutación', () => {
  it('`formulario` pide el cupo ESTRECHO: escribe en el expediente y manda un WhatsApp', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'formulario', token, respuestas: { motivo: 'texto ficticio' } }))
    expect(clavesPedidas()).toContain(`portal:mutacion:${CLINICA}:${PACIENTE}`)
  })

  it('AL REVÉS: sin cupo de mutación, el formulario no llega a escribirse', async () => {
    limitarEstrictoMock.mockImplementation(async (clave: string) =>
      clave === `portal:mutacion:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'formulario', token, respuestas: { motivo: 'texto ficticio' } }))
    expect(res.status).toBe(429)
    expect(setFormulario).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 (P1) · lo que devuelve secreto médico tiene su propia ventana', () => {
  it('`documentos` pide `portal:clinico:…` además del general', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    await portalPOST(reqPortal({ action: 'documentos', token }))
    const llamada = llamadaEstricta(`portal:clinico:${CLINICA}:${PACIENTE}`)
    expect(llamada?.[1]).toBe(15)
    expect(llamada?.[2]).toBe(600)
  })

  it('`paquetes` comparte esa misma ventana: son la misma clase de dato', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    await portalPOST(reqPortal({ action: 'paquetes', token }))
    expect(clavesPedidas()).toContain(`portal:clinico:${CLINICA}:${PACIENTE}`)
  })

  it('AL REVÉS: agotada la ventana clínica, no se lee ninguna nota firmada', async () => {
    limitarEstrictoMock.mockImplementation(async (clave: string) =>
      clave === `portal:clinico:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    const res = await portalPOST(reqPortal({ action: 'documentos', token }))
    expect(res.status).toBe(429)
    expect(getNotas).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 · `/api/payment/create-checkout` llama al limitador', () => {
  it('con cupo disponible sigue creando la sesión de pago', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, pagoMonto: 200 }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await pagoPOST(reqPago({ token, citaId: 'c1' }))
    expect(limitarEstrictoMock).toHaveBeenCalledWith(
      `pago:${CLINICA}:${PACIENTE}`, 8, 600, expect.any(String),
    )
  })

  it('AL REVÉS: sin cupo, no se llega a crear la cita en `pendiente-pago`', async () => {
    limitarEstrictoMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown)
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await pagoPOST(reqPago({ token, citaId: 'c1' }))
    expect(res.status).toBe(429)
    expect(getCitas).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 · `/api/public/resena` limita por IP (endpoint sin sesión)', () => {
  it('con cupo disponible, la reseña se sigue creando (no rompe el flujo real)', async () => {
    const res = await resenaPOST(reqResena({ token: 'tok-valido', rating: 5, texto: 'excelente' }))
    expect(res.status).toBe(200)
    expect(limitarEstrictoMock).toHaveBeenCalledWith(
      'resena:ip:203.0.113.9', 10, 3600, expect.any(String),
    )
  })

  it('AL REVÉS: sin cupo por IP, no se abre ninguna transacción de Firestore', async () => {
    limitarEstrictoMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown)
    const res = await resenaPOST(reqResena({ token: 'tok-valido', rating: 5, texto: 'excelente' }))
    expect(res.status).toBe(429)
    expect(runTransactionMock).not.toHaveBeenCalled()
  })

  it('la clave de límite es por IP, no por token: dos tokens desde la misma IP comparten cupo', async () => {
    await resenaPOST(reqResena({ token: 'tok-a', rating: 4, texto: '' }))
    await resenaPOST(reqResena({ token: 'tok-b', rating: 5, texto: '' }))
    expect(limitarEstrictoMock.mock.calls.map(c => c[0]))
      .toEqual(['resena:ip:203.0.113.9', 'resena:ip:203.0.113.9'])
  })
})
