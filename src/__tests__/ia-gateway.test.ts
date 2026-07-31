/**
 * GOLDEN — el gateway de IA (P1-1 · Master Loop V3 §P–T).
 *
 * Lo que se protege aquí no es que la llamada funcione: es que **el costo quede
 * registrado sin que nadie tenga que acordarse**, y que la contabilidad jamás se
 * meta en el camino de una nota clínica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// `vi.mock` se iza al principio del archivo, así que la fábrica no puede
// referirse a una constante de arriba: se usa `vi.hoisted`.
const { registrarCosto } = vi.hoisted(() => ({
  registrarCosto: vi.fn(async (_e: import('@/lib/finanzas/cost-ledger').EntradaLedger) => null),
}))
vi.mock('@/lib/finanzas/cost-ledger-server', () => ({ registrarCosto }))
vi.mock('@/lib/security/sanitize', () => ({ safeLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// La cartera toca Firestore; aquí interesa CUÁNDO se reserva, se confirma y se
// devuelve, no cómo se escribe.
const { reservarParaClinica, confirmarCreditos, devolverCreditos } = vi.hoisted(() => ({
  reservarParaClinica: vi.fn(async (_c: string | null, _f: string, n: number) =>
    ({ ok: true, apartados: n, clinicId: 'c1', mes: '2026-07' })),
  confirmarCreditos: vi.fn(async () => {}),
  devolverCreditos: vi.fn(async () => {}),
}))
vi.mock('@/lib/finanzas/cartera-server', () => ({ reservarParaClinica, confirmarCreditos, devolverCreditos }))

import { llamarIA } from '@/lib/ia/gateway'

const CTX = {
  feature: 'copilot-uci', requestId: 'req-1', clinicId: 'c1', uid: 'u1',
  creditos: 3, fuente: 'prueba' as const,
}
const OPTS = {
  proveedor: 'anthropic' as const, modelos: ['claude-sonnet-5'], clave: 'sk-x',
  system: 'S', user: 'U', maxTokens: 16000,
}

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
}) as unknown as Response

beforeEach(() => {
  registrarCosto.mockClear()
  confirmarCreditos.mockClear()
  devolverCreditos.mockClear()
  reservarParaClinica.mockClear()
  vi.stubGlobal('fetch', vi.fn())
})

const OK = {
  model: 'claude-sonnet-5',
  content: [{ type: 'text', text: 'listo' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 3200, output_tokens: 800, cache_read_input_tokens: 2000 },
}

describe('El asiento no es un paso que el llamador ejecuta', () => {
  it('una llamada exitosa queda registrada con sus tokens', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    const r = await llamarIA(OPTS, CTX)
    expect(r).toMatchObject({ ok: true, texto: 'listo' })
    expect(registrarCosto).toHaveBeenCalledTimes(1)
    expect(registrarCosto.mock.calls[0][0]).toMatchObject({
      feature: 'copilot-uci', proveedor: 'anthropic', modelo: 'claude-sonnet-5',
      uso: { entrada: 3200, salida: 800, entradaCache: 2000 },
      creditos: 3, fuente: 'prueba', clinicId: 'c1', uid: 'u1',
    })
  })

  it('una llamada FALLIDA también: un 500 tras generar tokens se cobra igual', async () => {
    // Si sólo se anotaran los éxitos, el costo real siempre saldría por debajo.
    vi.mocked(fetch).mockResolvedValue(respuesta({ error: 'boom' }, 500))
    const r = await llamarIA(OPTS, CTX)
    expect(r).toMatchObject({ ok: false, clase: 'proveedor' })
    expect(registrarCosto).toHaveBeenCalledTimes(1)
    expect(registrarCosto.mock.calls[0][0]).toMatchObject({ fallo: true })
  })

  it('pero un fallo NO le quema créditos al médico', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta({ error: 'boom' }, 500))
    await llamarIA(OPTS, CTX)
    expect(registrarCosto.mock.calls[0][0].creditos).toBe(0)
  })

  it('el asiento del fallo no pisa el del éxito: id distinto', async () => {
    // Mismo requestId, dos asientos: el id del libro es la clave del documento.
    vi.mocked(fetch)
      .mockResolvedValueOnce(respuesta({}, 404))
      .mockResolvedValueOnce(respuesta(OK))
    await llamarIA({ ...OPTS, modelos: ['no-existe', 'claude-sonnet-5'] }, CTX)
    const ids = registrarCosto.mock.calls.map(c => c[0].requestId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('en el asiento NO entra nada clínico', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    await llamarIA({ ...OPTS, user: 'Paciente Juan Pérez, sepsis abdominal' }, CTX)
    const asiento = JSON.stringify(registrarCosto.mock.calls[0][0])
    expect(asiento).not.toMatch(/Juan Pérez/)
    expect(asiento).not.toMatch(/sepsis/)
    expect(asiento).not.toMatch(/listo/)   // tampoco la respuesta
  })
})

describe('La cascada de modelos', () => {
  it('un 404 pasa al siguiente modelo de la lista', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(respuesta({}, 404))
      .mockResolvedValueOnce(respuesta(OK))
    const r = await llamarIA({ ...OPTS, modelos: ['claude-opus-4-8', 'claude-sonnet-5'] }, CTX)
    expect(r.ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('una llave revocada NO recorre la lista', async () => {
    // Recorrerla gasta el tiempo del médico para llegar al mismo 401.
    vi.mocked(fetch).mockResolvedValue(respuesta({}, 401))
    const r = await llamarIA({ ...OPTS, modelos: ['a', 'b', 'c'] }, CTX)
    expect(r).toMatchObject({ ok: false, clase: 'llave' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('un 429 tampoco: reintentar empeora el límite que acaba de saltar', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta({}, 429))
    await llamarIA({ ...OPTS, modelos: ['a', 'b', 'c'] }, CTX)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('un fallo de red corta: no dice nada del modelo', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    const r = await llamarIA({ ...OPTS, modelos: ['a', 'b'] }, CTX)
    expect(r).toMatchObject({ ok: false, clase: 'red' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sin llave ni siquiera se llama al proveedor', async () => {
    const r = await llamarIA({ ...OPTS, clave: '' }, CTX)
    expect(r).toMatchObject({ ok: false, clase: 'llave' })
    expect(fetch).not.toHaveBeenCalled()
    expect(registrarCosto).not.toHaveBeenCalled()
  })
})

describe('La contabilidad no se mete en el camino de la nota', () => {
  it('si el libro de costos revienta, la respuesta del modelo llega igual', async () => {
    // Perder un renglón de contabilidad es un problema; perder la nota que el
    // médico acaba de dictar es otro tamaño de problema.
    registrarCosto.mockRejectedValueOnce(new Error('Firestore caído') as never)
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    const r = await llamarIA(OPTS, CTX)
    expect(r).toMatchObject({ ok: true, texto: 'listo' })
  })

  it('el gateway no espera a que se escriba el asiento', async () => {
    let resuelto = false
    registrarCosto.mockImplementationOnce(
      () => new Promise(res => setTimeout(() => { resuelto = true; res(null) }, 50)) as never,
    )
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    const r = await llamarIA(OPTS, CTX)
    expect(r.ok).toBe(true)
    expect(resuelto).toBe(false)   // la nota ya volvió; el asiento sigue en vuelo
  })
})

describe('El gasto del fundador se marca como tal', () => {
  it('viaja hasta el libro para no contaminar el margen', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    await llamarIA(OPTS, { ...CTX, esFundador: true })
    expect(registrarCosto.mock.calls[0][0]).toMatchObject({ esFundador: true })
  })
})

describe('Los créditos se apartan ANTES de llamar', () => {
  it('se reserva el costo de la operación', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    await llamarIA(OPTS, CTX)
    expect(reservarParaClinica).toHaveBeenCalledWith('c1', 'prueba', 3)
  })

  it('si no alcanza, NO se llama al proveedor', async () => {
    // Aquí es donde la reserva gana a leer-y-luego-escribir: se corta antes de
    // gastar, no después.
    reservarParaClinica.mockResolvedValueOnce({ ok: false, apartados: 0, clinicId: 'c1', mes: '2026-07', motivo: 'Se acabaron tus créditos de IA del mes (quedan 2 y esta operación cuesta 3).' } as never)
    const r = await llamarIA(OPTS, CTX)
    expect(r).toMatchObject({ ok: false, clase: 'limite' })
    expect(r.ok === false && r.motivo).toMatch(/quedan 2/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('si la llamada sale bien, se confirma', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(OK))
    await llamarIA(OPTS, CTX)
    expect(confirmarCreditos).toHaveBeenCalledTimes(1)
    expect(devolverCreditos).not.toHaveBeenCalled()
  })

  it('si el proveedor falla, se DEVUELVEN', async () => {
    // Un médico al que se le cobra una nota que nunca salió pierde dos veces:
    // el crédito y la confianza en el contador.
    vi.mocked(fetch).mockResolvedValue(respuesta({ error: 'x' }, 500))
    await llamarIA(OPTS, CTX)
    expect(devolverCreditos).toHaveBeenCalledTimes(1)
    expect(confirmarCreditos).not.toHaveBeenCalled()
  })

  it('si contesta pero su salida no se puede leer, también se devuelven', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta({ content: [] }))
    await llamarIA(OPTS, CTX)
    expect(devolverCreditos).toHaveBeenCalledTimes(1)
    expect(confirmarCreditos).not.toHaveBeenCalled()
  })

  it('un fallo de red también los devuelve', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    await llamarIA(OPTS, CTX)
    expect(devolverCreditos).toHaveBeenCalledTimes(1)
  })

  it('sin llave no se reserva nada: no hubo gasto que apartar', async () => {
    await llamarIA({ ...OPTS, clave: '' }, CTX)
    expect(reservarParaClinica).not.toHaveBeenCalled()
  })
})
