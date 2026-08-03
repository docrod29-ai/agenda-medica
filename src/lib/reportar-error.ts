'use client'
/**
 * Rastreo de errores del lado del cliente. Envía errores no atrapados a
 * /api/errores (que los guarda para el dueño). Con dedup para no spamear el
 * mismo error, y sin bloquear nunca la UI. Ver /superadmin/errores.
 */
import { fetchAutenticado } from '@/lib/auth-client'

const enviados = new Set<string>()

export function reportarError(
  mensaje: string,
  extra?: { stack?: string; origen?: string; sinSesion?: boolean },
) {
  try {
    if (typeof window === 'undefined') return
    const clave = (mensaje + (extra?.origen ?? '')).slice(0, 120)
    if (enviados.has(clave)) return          // ya se envió este error en la sesión
    enviados.add(clave)
    if (enviados.size > 50) enviados.clear() // no crecer sin límite
    const cuerpo = JSON.stringify({
      mensaje: String(mensaje).slice(0, 300),
      stack: extra?.stack?.slice(0, 1500) ?? '',
      origen: extra?.origen ?? 'cliente',
      ruta: window.location.pathname,
      ua: navigator.userAgent,
    })
    /**
     * SIN SESIÓN TAMBIÉN SE REPORTA.
     *
     * `fetchAutenticado` adjunta el token del usuario, y la ruta lo exigía. Eso
     * dejaba ciegas justo las caídas que más importan: la del boundary GLOBAL
     * —cuando ni el layout carga— y cualquier fallo en el login, donde por
     * definición todavía no hay sesión.
     *
     * Se manda autenticado cuando se puede, y sin autenticar cuando no. La ruta
     * acepta las dos, y las anónimas con su propio freno.
     */
    if (extra?.sinSesion) {
      void fetch('/api/errores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo,
      }).catch(() => {})
    } else {
      void fetchAutenticado('/api/errores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo,
      }).catch(() => {})
    }  // el rastreo NUNCA debe romper nada
  } catch { /* no-op */ }
}

let inicializado = false
/** Engancha window.onerror + unhandledrejection una sola vez. */
export function iniciarRastreoErrores() {
  if (inicializado || typeof window === 'undefined') return
  inicializado = true
  window.addEventListener('error', (e) => {
    reportarError(e.message || 'error', { stack: e.error?.stack, origen: 'window.onerror' })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    reportarError(r?.message || String(r).slice(0, 200) || 'promesa rechazada', { stack: r?.stack, origen: 'unhandledrejection' })
  })
}
