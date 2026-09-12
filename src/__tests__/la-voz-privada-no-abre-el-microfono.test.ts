/**
 * GOLDEN — inferencia privada, orden del 12-sep-2026.
 * Causa: negar sólo la API permitía grabar una consulta imposible de transcribir.
 * Invoca los hooks reales con un ciclo mínimo de hooks y dispositivos simulados.
 * Comprueba arranque, recuperación, permiso tardío y reinicio; no mide audio,
 * permisos de un navegador físico ni el renderizado completo de React.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({
  efectos: [] as (() => void | (() => void))[], cierres: [] as (() => void)[],
  estados: [] as unknown[], start: vi.fn(), abort: vi.fn(), stop: vi.fn(),
  getUserMedia: vi.fn(async () => { throw new Error('dispositivo sintético sin audio') }),
  fetchAutenticado: vi.fn(),
}))
vi.mock('react', () => ({
  useState: (inicial: unknown) => [typeof inicial === 'function' ? inicial() : inicial, (v: unknown) => h.estados.push(v)],
  useRef: (v: unknown) => ({ current: v }),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => void | (() => void)) => { h.efectos.push(fn) },
}))
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null }, storage: null }))
vi.mock('@/lib/auth-client', () => ({ fetchAutenticado: h.fetchAutenticado }))
vi.mock('@/lib/asr/pipeline', () => ({ procesarTranscript: (texto: string) => ({ texto }) }))

import { useGrabacionAudio } from '@/hooks/useGrabacionAudio'
import { useGrabacionVoz } from '@/hooks/useGrabacionVoz'
import { useComandoVoz } from '@/hooks/useComandoVoz'
import { AVISO_VOZ_LIMITADA, CapacidadVozLimitada, verificarRespuestaDeVoz } from '@/lib/voz/permiso-de-procesamiento'

const reconocedores: Reconocedor[] = []
class Reconocedor {
  start = h.start; abort = h.abort; stop = h.stop
  onend: (() => void) | null = null
  constructor() { reconocedores.push(this) }
}
function montar<T>(fn: () => T): T {
  const resultado = fn()
  h.efectos.splice(0).forEach(f => { const cierre = f(); if (cierre) h.cierres.push(cierre) })
  return resultado
}
const capacidades = (permitir: boolean) => Response.json({
  reconocimientoNavegador: permitir, transcripcionAudio: permitir, lecturaNavegador: permitir,
})
beforeEach(() => {
  vi.clearAllMocks(); h.efectos.length = 0; h.cierres.length = 0; h.estados.length = 0; reconocedores.length = 0
  vi.stubGlobal('window', { SpeechRecognition: Reconocedor, dispatchEvent: vi.fn() })
  vi.stubGlobal('MediaRecorder', class {})
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: h.getUserMedia } })
  vi.stubGlobal('fetch', vi.fn(async () => capacidades(false)))
})
afterEach(() => { h.cierres.splice(0).forEach(f => f()); vi.unstubAllGlobals() })

describe('el permiso protege las funciones que usa la consulta', () => {
  it('el grabador principal informa antes de abrir el micrófono', async () => {
    const audio = montar(useGrabacionAudio)
    await audio.iniciar()
    expect(h.getUserMedia).not.toHaveBeenCalled()
    expect(h.fetchAutenticado).not.toHaveBeenCalled()
    expect(h.estados).toContain(AVISO_VOZ_LIMITADA)
  })
  it('recuperar audio no inicia una cascada ni borra el respaldo sin permiso', async () => {
    await montar(useGrabacionAudio).recuperarAudio('respaldo-inventado')
    expect(h.fetchAutenticado).not.toHaveBeenCalled()
    expect(h.estados).toContain(AVISO_VOZ_LIMITADA)
  })
  it('un permiso positivo sí permite solicitar el dispositivo', async () => {
    vi.mocked(fetch).mockResolvedValue(capacidades(true))
    await montar(useGrabacionAudio).iniciar()
    expect(h.getUserMedia).toHaveBeenCalledOnce()
  })
  it('el rechazo de un micrófono antiguo no cancela el intento nuevo', async () => {
    vi.mocked(fetch).mockImplementation(async () => capacidades(true))
    let rechazarA: ((e: Error) => void) | undefined
    let rechazarB: ((e: Error) => void) | undefined
    h.getUserMedia.mockImplementationOnce(() => new Promise<never>((_, r) => { rechazarA = r }))
      .mockImplementationOnce(() => new Promise<never>((_, r) => { rechazarB = r }))
    const audio = montar(useGrabacionAudio)
    const a = audio.iniciar()
    await vi.waitFor(() => expect(rechazarA).toBeTypeOf('function'))
    const b = audio.iniciar()
    await vi.waitFor(() => expect(rechazarB).toBeTypeOf('function'))
    const antes = h.estados.length
    rechazarA!(new Error('intento obsoleto'))
    await a
    expect(h.estados.length).toBe(antes)
    rechazarB!(new Error('fin de la prueba sintética'))
    await b
  })
  it('la Web Speech API no inicia sin permiso', async () => {
    await montar(useGrabacionVoz).iniciar()
    expect(h.start).not.toHaveBeenCalled()
  })
  it('detener mientras llega el permiso impide un inicio tardío', async () => {
    let resolver: ((r: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolver = r }))
    const voz = montar(useGrabacionVoz)
    const pendiente = voz.iniciar()
    await vi.waitFor(() => expect(resolver).toBeTypeOf('function'))
    voz.detener()
    resolver!(capacidades(true))
    await pendiente
    expect(h.start).not.toHaveBeenCalled()
  })
  it('un reinicio de Web Speech vuelve a comprobar la política', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(capacidades(true)).mockResolvedValueOnce(capacidades(false))
    await montar(useGrabacionVoz).iniciar()
    expect(h.start).toHaveBeenCalledOnce()
    reconocedores.at(-1)?.onend?.()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(h.start).toHaveBeenCalledOnce()
  })
  it('los comandos manos libres también obedecen el permiso', async () => {
    montar(() => useComandoVoz({ activo: true, onIniciar: vi.fn(), onCerrar: vi.fn() }))
    await vi.waitFor(() => expect(h.estados.some(x => typeof x === 'string' && x.includes('política de privacidad'))).toBe(true))
    expect(h.start).not.toHaveBeenCalled()
  })
  it('la prohibición del servidor es terminal, diferente de una caída temporal', () => {
    expect(() => verificarRespuestaDeVoz({ capacidadLimitada: true })).toThrow(CapacidadVozLimitada)
    expect(() => verificarRespuestaDeVoz(null)).not.toThrow()
  })
})
