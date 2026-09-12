/**
 * Frontera para inferencia y recuperación bibliográfica. No sustituye fetch
 * global: autenticación, expediente y demás servicios conservan su contrato.
 * LOCAL_ONLY admite exclusivamente la operación de inferencia configurada.
 * La infraestructura debe reforzarlo con su propia política de salida.
 */
import { fetchConTimeout, TiempoAgotado } from '@/lib/fetch-con-timeout'
import { AVISO_IA_PRIVADA, configuracionPrivada, modoIA } from './configuracion-privada'

export class SalidaIABloqueada extends Error {
  constructor() { super(AVISO_IA_PRIVADA); this.name = 'SalidaIABloqueada' }
}

function opcionesPermitidas(input: string | URL | Request, init: RequestInit): RequestInit {
  const url = input instanceof Request ? input.url : String(input)
  const config = configuracionPrivada()
  const esPrivado = config.ok && url === config.valor.endpoint
  if (modoIA() === 'LOCAL_ONLY') {
    const metodo = init.method ?? (input instanceof Request ? input.method : 'GET')
    if (!esPrivado || metodo.toUpperCase() !== 'POST') throw new SalidaIABloqueada()
  }
  // Tampoco en HYBRID se sigue un redirect del servidor privado: un 307
  // podría reenviar el expediente y la credencial a otro host.
  return esPrivado ? { ...init, redirect: 'error', cache: 'no-store' } : init
}

export async function fetchIA(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  return fetch(input, opcionesPermitidas(input, init))
}

export async function fetchIAConTimeout(url: string, init: RequestInit = {}, ms = 60_000): Promise<Response> {
  const opciones = opcionesPermitidas(url, init)
  const config = configuracionPrivada()
  if (!config.ok || url !== config.valor.endpoint) return fetchConTimeout(url, opciones, ms)

  // El plazo privado incluye el cuerpo: recibir cabeceras no basta. Tamaño
  // máximo 2 MiB, muy por encima del texto de una nota; no es un límite clínico.
  const controller = new AbortController()
  const externa = init.signal
  const abortar = () => controller.abort(externa?.reason)
  let lector: ReadableStreamDefaultReader<Uint8Array> | undefined
  const cancelada = new Promise<never>((_, rechazar) => {
    controller.signal.addEventListener('abort', () => {
      void lector?.cancel().catch(() => {})
      rechazar(controller.signal.reason)
    }, { once: true })
  })
  if (externa?.aborted) abortar()
  else externa?.addEventListener('abort', abortar, { once: true })
  const timer = setTimeout(() => controller.abort(new TiempoAgotado(ms, 'IA propia')), ms)
  try {
    return await Promise.race([cancelada, (async () => {
      const res = await fetch(url, { ...opciones, signal: controller.signal })
      if (!res.body) return res
      lector = res.body.getReader()
      const trozos: Uint8Array[] = []
      let bytes = 0
      while (true) {
        const { done, value } = await lector.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 2 * 1024 * 1024) {
          void lector.cancel().catch(() => {})
          throw new Error('La respuesta de IA propia excedió el tamaño permitido.')
        }
        trozos.push(value)
      }
      const cuerpo = new Uint8Array(bytes)
      let offset = 0
      for (const trozo of trozos) { cuerpo.set(trozo, offset); offset += trozo.byteLength }
      return new Response(cuerpo, { status: res.status, statusText: res.statusText, headers: res.headers })
    })()])
  } finally {
    clearTimeout(timer)
    externa?.removeEventListener('abort', abortar)
  }
}
