/**
 * GOLDEN — orden del dueño: Ausculta con inferencia propia (12-sep-2026).
 * Causa: cambiar sólo el modelo dejaba salidas directas y dictado remoto.
 * Protege el transporte real y el permiso de voz con datos exclusivamente
 * sintéticos. Los dobles de red NO demuestran calidad médica, GPU ni firewall.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configuracionPrivada, modoIA } from '@/lib/ia/configuracion-privada'
import { fetchIA, fetchIAConTimeout, SalidaIABloqueada } from '@/lib/ia/salida-privada'
import { GET } from '@/app/api/ia/capacidades/route'
import { iniciarReconocimientoPermitido } from '@/lib/voz/permiso-de-procesamiento'
import { TiempoAgotado } from '@/lib/fetch-con-timeout'

beforeEach(() => {
  vi.stubEnv('AUSCULTA_AI_MODE', 'LOCAL_ONLY')
  vi.stubEnv('AUSCULTA_SELF_HOSTED_BASE_URL', 'https://inferencia.example.test/v1')
  vi.stubEnv('AUSCULTA_SELF_HOSTED_MODEL', 'modelo-sintetico')
  vi.stubEnv('AUSCULTA_SELF_HOSTED_API_KEY', 'credencial-sintetica')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('la política se decide en el servidor', () => {
  it.each(['local_only', '', 'HBYRID'])('una errata (%s) cierra las salidas', valor => {
    vi.stubEnv('AUSCULTA_AI_MODE', valor)
    expect(modoIA()).toBe('LOCAL_ONLY')
  })
  it('sin activar la función conserva el proveedor actual', async () => {
    vi.stubEnv('AUSCULTA_AI_MODE', undefined)
    expect(modoIA()).toBe('HYBRID')
    await fetchIA('https://api.anthropic.com/v1/messages', { method: 'POST' })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([
    'https://api.openai.com/v1', 'https://api.openai.com./v1',
    'https://api.anthropic.com./v1', 'https://api.assemblyai.com/v1',
    'https://usuario:clave@inferencia.example.test/v1',
    'https://inferencia.example.test/v1?token=secreto',
    'https://inferencia.example.test/v1#fragmento',
    'http://inferencia.example.test/v1', 'https://inferencia.example.test/otro',
  ])('rechaza una configuración ambigua o pública: %s', url => {
    vi.stubEnv('AUSCULTA_SELF_HOSTED_BASE_URL', url)
    expect(configuracionPrivada().ok).toBe(false)
  })
  it('HTTP de desarrollo no pasa en producción', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUSCULTA_SELF_HOSTED_BASE_URL', 'http://127.0.0.1:8000/v1')
    expect(configuracionPrivada().ok).toBe(false)
  })
  it.each([
    'https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/models',
    'https://api.assemblyai.com/v2/upload', 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
    'https://api.fda.gov/drug/label.json',
    'https://inferencia.example.test/v1/chat/completions?otro=1',
    'https://inferencia.example.test/v1/models',
  ])('bloquea antes de transmitir: %s', async url => {
    await expect(fetchIA(url, { method: 'POST', body: 'caso ficticio' })).rejects.toBeInstanceOf(SalidaIABloqueada)
    await expect(fetchIAConTimeout(url, { method: 'POST' })).rejects.toBeInstanceOf(SalidaIABloqueada)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('admite sólo POST al endpoint exacto y prohíbe redirecciones', async () => {
    const url = 'https://inferencia.example.test/v1/chat/completions'
    await expect(fetchIA(new Request(url))).rejects.toBeInstanceOf(SalidaIABloqueada)
    await fetchIA(url, { method: 'POST', redirect: 'follow', cache: 'force-cache' })
    expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error', cache: 'no-store' }))
  })
  it('tampoco sigue redirects del servidor propio en modo híbrido', async () => {
    vi.stubEnv('AUSCULTA_AI_MODE', 'HYBRID')
    await fetchIA('https://inferencia.example.test/v1/chat/completions', { method: 'POST' })
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ redirect: 'error' }))
  })
  it('la capacidad pública no revela configuración ni credenciales', async () => {
    const res = await GET()
    expect(await res.json()).toEqual({ reconocimientoNavegador: false, transcripcionAudio: false, lecturaNavegador: false })
    expect(res.headers.get('cache-control')).toContain('no-store')
  })
  it('un cuerpo que no termina también agota el plazo y se cancela', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('{')) }, cancel,
    })
    vi.mocked(fetch).mockResolvedValue(new Response(body))
    await expect(fetchIAConTimeout('https://inferencia.example.test/v1/chat/completions', { method: 'POST' }, 15)).rejects.toBeInstanceOf(TiempoAgotado)
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('no acumula un cuerpo ilimitado en memoria', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024 + 1)))
    await expect(fetchIAConTimeout('https://inferencia.example.test/v1/chat/completions', { method: 'POST' })).rejects.toThrow('tamaño permitido')
  })
})

describe('la voz pide un permiso vigente antes de arrancar', () => {
  it.each([false, undefined, 'true'])('no inicia con permiso %s', async permiso => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ reconocimientoNavegador: permiso }))
    const start = vi.fn()
    expect(await iniciarReconocimientoPermitido(start, () => true)).toBe(false)
    expect(start).not.toHaveBeenCalled()
  })
  it('no inicia si el usuario detuvo mientras llegaba el permiso', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ reconocimientoNavegador: true }))
    const start = vi.fn()
    expect(await iniciarReconocimientoPermitido(start, () => false)).toBe(false)
    expect(start).not.toHaveBeenCalled()
  })
  it('un reinicio vuelve a consultar y obedece el cambio de política', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ reconocimientoNavegador: true }))
      .mockResolvedValueOnce(Response.json({ reconocimientoNavegador: false }))
    const start = vi.fn()
    expect(await iniciarReconocimientoPermitido(start, () => true)).toBe(true)
    expect(await iniciarReconocimientoPermitido(start, () => true)).toBe(false)
    expect(start).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('sin conexión no supone que hay permiso', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('sin red'))
    const start = vi.fn()
    expect(await iniciarReconocimientoPermitido(start, () => true)).toBe(false)
    expect(start).not.toHaveBeenCalled()
  })
})
