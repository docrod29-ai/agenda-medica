/** Configuración de servidor. No importar desde componentes ni exponer secretos. */
export type ModoIA = 'HYBRID' | 'LOCAL_ONLY'

export function modoIA(): ModoIA {
  const modo = process.env.AUSCULTA_AI_MODE
  // Una errata nunca habilita una salida pública.
  return modo === undefined || modo === 'HYBRID' ? 'HYBRID' : 'LOCAL_ONLY'
}

export function notaConModeloPropio(): boolean {
  return modoIA() === 'LOCAL_ONLY' || process.env.AUSCULTA_NOTE_PROVIDER === 'selfhosted'
}

export const AVISO_IA_PRIVADA =
  'Esta función no está disponible en el modo privado. No se enviaron datos a un proveedor externo de IA. Puedes continuar escribiendo.'

export interface ConfiguracionPrivada {
  endpoint: string
  modelo: string
  clave: string
}

type Configuracion = { ok: true; valor: ConfiguracionPrivada } | { ok: false; motivo: string }

export function configuracionPrivada(): Configuracion {
  const base = process.env.AUSCULTA_SELF_HOSTED_BASE_URL?.trim()
  const modelo = process.env.AUSCULTA_SELF_HOSTED_MODEL?.trim()
  const clave = process.env.AUSCULTA_SELF_HOSTED_API_KEY?.trim()
  if (!base || !modelo || !clave) return { ok: false, motivo: 'La IA propia requiere servidor, modelo y credencial configurados.' }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/@:+-]{0,199}$/.test(modelo)) {
    return { ok: false, motivo: 'El identificador del modelo propio no es válido.' }
  }
  try {
    const url = new URL(base)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    const https = url.protocol === 'https:'
    if ((!https && !(local && url.protocol === 'http:' && process.env.NODE_ENV !== 'production'))
      || url.hostname.endsWith('.') || url.username || url.password || url.search || url.hash || !/^\/v1\/?$/.test(url.pathname)) {
      return { ok: false, motivo: 'El servidor propio requiere una URL HTTPS que termine en /v1, sin parámetros ni credenciales en la URL.' }
    }
    // Esta configuración no debe disfrazar una API pública como propia.
    if (['openai.com', 'anthropic.com', 'assemblyai.com'].some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      return { ok: false, motivo: 'Configura un servidor de inferencia propio, no un proveedor público de IA.' }
    }
    url.pathname = '/v1/chat/completions'
    return { ok: true, valor: { endpoint: url.href, modelo, clave } }
  } catch {
    return { ok: false, motivo: 'La dirección del servidor de IA propia no es válida.' }
  }
}

/** Las funciones todavía externas se limitan explícitamente, antes de gastar o enviar. */
export function limitarCapacidadExterna(): Response | null {
  return modoIA() === 'HYBRID' ? null : Response.json({
    ok: false, error: AVISO_IA_PRIVADA, capacidadLimitada: true, _modoIA: 'LOCAL_ONLY',
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
