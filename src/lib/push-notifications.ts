'use client'
/**
 * Notificaciones push del navegador para recordatorios de citas.
 *
 * Estrategia (sin servidor de push):
 *  - Usa Web Notifications API (nativo, sin Firebase Cloud Messaging)
 *  - Programa notificaciones LOCALES desde el cliente cuando la app está abierta
 *  - El Service Worker maneja la presentación cuando la app está minimizada
 *  - Para notificaciones reales en background con app cerrada se necesitaría
 *    FCM con VAPID keys — eso lo agrega después si quieres push 100% server-side
 *
 * Recordatorios típicos:
 *  - Cita en 30 min (al médico/asistente)
 *  - Cita en 5 min (sala lista para teleconsulta)
 *  - Nueva cita reservada por paciente (al equipo)
 *  - Cita confirmada por paciente
 */

export interface NotifPermission {
  granted: boolean
  denied: boolean
  default: boolean
}

/** Verifica el estado del permiso actual */
export function obtenerPermisoPush(): NotifPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, denied: false, default: false }
  }
  return {
    granted: Notification.permission === 'granted',
    denied: Notification.permission === 'denied',
    default: Notification.permission === 'default',
  }
}

/** Solicita permiso al usuario. Devuelve true si lo otorgó. */
export async function solicitarPermisoPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const r = await Notification.requestPermission()
  return r === 'granted'
}

/** Muestra una notificación AHORA */
export async function mostrarNotificacion(
  titulo: string,
  opts: {
    body?: string
    icon?: string
    tag?: string             // para reemplazar/agrupar
    url?: string             // a dónde ir al hacer click
    requireInteraction?: boolean  // no se cierra sola
    vibrate?: number[]
  } = {},
): Promise<void> {
  if (!obtenerPermisoPush().granted) return
  const reg = await navigator.serviceWorker.getRegistration()
  // Si tenemos SW, usar la API de SW (funciona en background); si no, fallback nativo
  if (reg) {
    await reg.showNotification(titulo, {
      body: opts.body,
      icon: opts.icon ?? '/icon.svg',
      tag: opts.tag,
      data: { url: opts.url ?? '/' },
      requireInteraction: opts.requireInteraction,
    } as NotificationOptions)
  } else {
    const n = new Notification(titulo, {
      body: opts.body,
      icon: opts.icon ?? '/icon.svg',
      tag: opts.tag,
    })
    if (opts.url) n.onclick = () => { window.focus(); window.location.href = opts.url! }
  }
}

/**
 * Programa una notificación para una fecha futura.
 * Como el cliente puede estar cerrado, esto solo funciona si la app está abierta
 * en al menos una pestaña. Para background real se necesita FCM.
 *
 * Devuelve el id del timeout (para cancelar con clearTimeout).
 */
export function programarNotificacion(
  cuando: Date,
  titulo: string,
  opts: Parameters<typeof mostrarNotificacion>[1] = {},
): number | null {
  if (typeof window === 'undefined') return null
  const ms = cuando.getTime() - Date.now()
  if (ms <= 0) return null
  // setTimeout max es ~24.8 días; si está más allá, no lo programamos (debería renovarse al cargar la app)
  if (ms > 2_000_000_000) return null
  return window.setTimeout(() => {
    mostrarNotificacion(titulo, opts).catch(() => {})
  }, ms)
}
