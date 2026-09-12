/**
 * GOLDEN — primera integración privada solicitada el 12-sep-2026.
 * Ejecuta el POST, prompts, protocolo, gateway, parser y esquema canónicos.
 * Sólo identidad, contabilidad y transporte son dobles; casos inventados.
 * Previene fugas en cascadas, doble cobro y éxito aparente ante formato inválido.
 * No valida hechos médicos ni sustituye una evaluación del modelo real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const doble = vi.hoisted(() => ({
  acceso: { ok: true, uid: 'medico-sintetico', email: 'medico@example.test', clinicId: 'clinica-sintetica', role: 'medico' },
  resolverClaveIA: vi.fn(async () => ({ key: 'clave-publica-sintetica', fuente: 'prueba', clinicId: 'clinica-sintetica' })),
  reservar: vi.fn(async (clinicId: string, _fuente: string, n: number) => ({ ok: true, clinicId, apartados: n, mes: '2026-09' })),
  confirmar: vi.fn(async (_reserva: unknown, _creditos: number) => {}), devolver: vi.fn(async (_reserva: unknown) => {}),
  registrarCosto: vi.fn(async () => null),
  nivel: 'premium',
  logs: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/auth-server', () => ({ verificarModuloIA: async () => doble.acceso }))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null }))
vi.mock('@/lib/ai-keys', () => ({
  resolverClaveIA: doble.resolverClaveIA, gateCreditos: async () => null,
  nivelIADe: async () => doble.nivel, registrarUso: async () => {}, registrarCreditos: async () => {},
  registrarConsultaEconomica: async () => {}, economicasDelMes: async () => 0,
  entitlementsDe: async () => ({ limiteCreditos: 100, topeEconomico: 100 }),
  creditosUsadosDelMes: async () => 0, creditosExtraDelMes: async () => 0,
}))
vi.mock('@/lib/finanzas/cartera-server', () => ({
  reservarParaClinica: doble.reservar, confirmarCreditos: doble.confirmar, devolverCreditos: doble.devolver,
}))
vi.mock('@/lib/finanzas/cost-ledger-server', () => ({ registrarCosto: doble.registrarCosto }))
vi.mock('@/lib/ia/incidentes-servidor', () => ({ reportarFalloIA: vi.fn() }))
vi.mock('@/lib/security/sanitize', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/security/sanitize')>(), safeLog: doble.logs,
}))

import { POST } from '@/app/api/expediente/procesar/route'
import { olvidarCircuitos } from '@/lib/red/interruptor'
import { reiniciarContrapresion } from '@/lib/ia/contrapresion'

const endpoint = 'https://inferencia.example.test/v1/chat/completions'
const nota = { resumenEjecutivo: 'Caso de prueba inventado.', secciones: { padecimiento_actual: 'Relato sintético para verificar integración.' } }
const respuesta = (texto = JSON.stringify(nota), finish = 'stop', modelo = 'modelo-sintetico') => Response.json({
  model: modelo, choices: [{ message: { role: 'assistant', content: texto }, finish_reason: finish }],
  usage: { prompt_tokens: 100, completion_tokens: 30 },
})
const request = (extra: Record<string, unknown> = {}) => new NextRequest('https://ausculta.example.test/api/expediente/procesar', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ transcripcion: 'Relato sintético. Sin decisiones terapéuticas.', tipo: 'evolucion',
    contexto: { nombre: 'Caso ficticio', edad: 40, sexo: 'masculino', especialidad: 'Medicina interna' },
    motor: 'maxima', ...extra }),
})

beforeEach(() => {
  vi.clearAllMocks(); olvidarCircuitos(); reiniciarContrapresion()
  doble.acceso.clinicId = 'clinica-sintetica'; doble.acceso.role = 'medico'
  doble.nivel = 'premium'
  vi.stubEnv('AUSCULTA_AI_MODE', 'LOCAL_ONLY')
  vi.stubEnv('AUSCULTA_NOTE_PROVIDER', undefined)
  vi.stubEnv('AUSCULTA_SELF_HOSTED_BASE_URL', 'https://inferencia.example.test/v1')
  vi.stubEnv('AUSCULTA_SELF_HOSTED_MODEL', 'modelo-sintetico')
  vi.stubEnv('AUSCULTA_SELF_HOSTED_API_KEY', 'credencial-sintetica')
  vi.stubGlobal('fetch', vi.fn(async () => respuesta()))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('una nota propia atraviesa la ruta que usa el médico', () => {
  it('no necesita llaves externas, no descubre modelos ni activa la segunda opinión premium', async () => {
    const res = await POST(request({ model: 'otro', baseURL: 'https://api.openai.com/v1', clinicId: 'clinica-ajena' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ ok: true, ...nota, _proveedorIA: 'selfhosted', _modelo: 'modelo-sintetico', _modoIA: 'LOCAL_ONLY', _plan: 'pro' })
    expect(data._avisoModelo).toContain('evaluación clínica')
    expect(doble.resolverClaveIA).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(endpoint)
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer credencial-sintetica' }) })
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({ model: 'modelo-sintetico', max_tokens: 16000, stream: false, response_format: { type: 'json_object' } })
    expect(body).not.toHaveProperty('max_completion_tokens')
    expect(body.messages[0].content).toContain('médico')
    expect(doble.registrarCosto).toHaveBeenCalledWith(expect.objectContaining({ proveedor: 'selfhosted', clinicId: 'clinica-sintetica', creditos: 0 }))
    expect(doble.reservar.mock.calls.filter(c => c[2] > 0)).toHaveLength(1)
    expect(doble.confirmar.mock.calls.filter(c => Number(c[1]) > 0)).toHaveLength(1)
  })
  it.each([
    ['texto sin JSON', 'stop'], ['{"secciones": {"plan": 123}}', 'stop'],
    ['{}', 'stop'], [JSON.stringify(nota), 'length'],
  ])('con respuesta inválida (%s, %s) preserva el fallback sin salir', async (texto, finish) => {
    vi.mocked(fetch).mockResolvedValue(respuesta(texto, finish))
    const data = await (await POST(request())).json()
    expect(data._modelo).toBe('parser-local')
    expect(data._aviso).toBeTruthy()
    expect(data._plan).not.toBe('premium')
    expect(fetch).toHaveBeenCalledOnce()
    expect(doble.devolver).toHaveBeenCalledWith(expect.objectContaining({ apartados: expect.any(Number) }))
    expect(doble.confirmar.mock.calls.filter(c => Number(c[1]) > 0)).toHaveLength(0)
    expect(doble.logs.warn).not.toHaveBeenCalled()
  })
  it.each([401, 404, 429, 503])('un HTTP %s no dispara rescate público', async status => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'contenido sensible inventado' }, { status }))
    const data = await (await POST(request())).json()
    expect(data._modelo).toBe('parser-local')
    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.stringify(doble.logs.error.mock.calls)).not.toContain('contenido sensible inventado')
  })
  it('un servidor que reporta otro modelo no consigue una nota con procedencia falsa', async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta(JSON.stringify(nota), 'stop', 'otro-modelo'))
    expect((await (await POST(request())).json())._modelo).toBe('parser-local')
  })
  it.each([null, [], [{ id: 'herramienta-ficticia', type: 'function' }]])('distingue herramientas vacías de una llamada real (%j)', async tool_calls => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ model: 'modelo-sintetico',
      choices: [{ message: { role: 'assistant', content: JSON.stringify(nota), tool_calls }, finish_reason: 'stop' }] }))
    const data = await (await POST(request())).json()
    expect(data._modelo).toBe(tool_calls?.length ? 'parser-local' : 'modelo-sintetico')
  })
  it('sin conexión no cambia de proveedor', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('conexión fallida'))
    expect((await (await POST(request())).json())._modelo).toBe('parser-local')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(['clinicId', 'role'] as const)('sin %s verificado no gasta ni transmite', async campo => {
    doble.acceso[campo] = ''
    expect((await POST(request())).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    expect(doble.reservar).not.toHaveBeenCalled()
  })
  it('sin configuración no usa las llaves públicas disponibles', async () => {
    vi.stubEnv('AUSCULTA_SELF_HOSTED_API_KEY', '')
    expect((await POST(request())).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
    expect(doble.resolverClaveIA).not.toHaveBeenCalled()
  })
  it('el modo híbrido permite seleccionar sólo la nota propia', async () => {
    vi.stubEnv('AUSCULTA_AI_MODE', 'HYBRID')
    vi.stubEnv('AUSCULTA_NOTE_PROVIDER', 'selfhosted')
    expect((await (await POST(request())).json())._proveedorIA).toBe('selfhosted')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('sin activar el proveedor propio conserva una nota externa exitosa', async () => {
    vi.stubEnv('AUSCULTA_AI_MODE', 'HYBRID')
    vi.mocked(fetch).mockImplementation(async url => String(url).endsWith('/models')
      ? Response.json({ data: [{ id: 'claude-haiku-4-5-20251001' }] })
      : Response.json({ model: 'claude-haiku-4-5-20251001', content: [{ type: 'text', text: JSON.stringify(nota) }], stop_reason: 'end_turn' }))
    const data = await (await POST(request({ rapido: true }))).json()
    expect(data).toMatchObject({ ok: true, ...nota, _proveedorIA: 'anthropic', _modoIA: 'HYBRID' })
    expect(doble.resolverClaveIA).toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith('https://api.anthropic.com/'))).toBe(true)
  })
  it('la nota propia no enciende la fusión pública aunque su bandera esté activa en modo híbrido', async () => {
    vi.stubEnv('AUSCULTA_AI_MODE', 'HYBRID')
    vi.stubEnv('AUSCULTA_NOTE_PROVIDER', 'selfhosted')
    vi.stubEnv('NOTA_ENSAMBLE_GPT', '1')
    vi.resetModules()
    const { POST: postConEnsamble } = await import('@/app/api/expediente/procesar/route')
    const data = await (await postConEnsamble(request())).json()
    expect(data).toMatchObject({ ok: true, _proveedorIA: 'selfhosted', _razonamientoExtendido: false, _sinRazonamiento: false, _avisoRazonamiento: '' })
    expect(data._modelosNota).toEqual(['modelo-sintetico'])
    expect(doble.resolverClaveIA).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(endpoint)
  })
  it('las señales de complejidad no cobran un escalado inexistente con un único modelo privado', async () => {
    doble.nivel = 'pro'
    const data = await (await POST(request({ motor: undefined,
      transcripcion: 'Escenario inventado: se mencionan 1 mg, 2 mg, 3 mg, 4 mg y 5 mg, sin prescribir.' }))).json()
    expect(data).toMatchObject({ ok: true, _motor: 'estandar', _escalado: null, _modelo: 'modelo-sintetico' })
    expect(doble.reservar.mock.calls.filter(c => c[2] > 0).map(c => c[2])).toEqual([3])
    expect(doble.confirmar.mock.calls.filter(c => Number(c[1]) > 0).map(c => c[1])).toEqual([3])
    expect(fetch).toHaveBeenCalledOnce()
  })
})
