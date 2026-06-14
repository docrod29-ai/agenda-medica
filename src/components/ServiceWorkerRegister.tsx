'use client'
import { useEffect, useState, useRef } from 'react'
import { RefreshCw, X } from 'lucide-react'

/**
 * Registra el service worker con actualización NO disruptiva.
 *
 * En vez de recargar la pestaña sola (riesgoso si el médico está a media nota),
 * cuando detecta una versión nueva muestra un aviso discreto con botón
 * "Actualizar". La recarga ocurre SOLO cuando el usuario lo pide.
 *
 * Flujo:
 * 1. Registra /sw.js y chequea actualizaciones al ganar foco / cada 60s.
 * 2. Si instala un SW nuevo (y ya había uno controlando = es actualización),
 *    muestra el aviso (no aplica nada todavía).
 * 3. Al tocar "Actualizar": skipWaiting → controllerchange → recarga una vez.
 */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)
  const wantsReload = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Recargar SOLO cuando el usuario pidió actualizar (no en la primera instalación)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wantsReload.current) window.location.reload()
    })

    const ofrecerActualizacion = (sw: ServiceWorker | null) => {
      if (!sw) return
      waitingRef.current = sw
      setUpdateReady(true)
    }

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // ¿Ya había un SW esperando de una sesión anterior? Ofrecer (no auto-aplicar)
        if (reg.waiting && navigator.serviceWorker.controller) ofrecerActualizacion(reg.waiting)

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          if (!sw) return
          sw.addEventListener('statechange', () => {
            // Instalado + ya hay controlador = es ACTUALIZACIÓN (no primera carga)
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              ofrecerActualizacion(sw)
            }
          })
        })

        const checkUpdate = () => { reg.update().catch(() => {}) }
        window.addEventListener('focus', checkUpdate)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkUpdate()
        })
        const intervalo = setInterval(checkUpdate, 60_000)
        window.addEventListener('beforeunload', () => clearInterval(intervalo))
      } catch {
        /* silencioso */
      }
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  const actualizar = () => {
    wantsReload.current = true
    waitingRef.current?.postMessage({ type: 'SKIP_WAITING' })
    // Red de seguridad: si no llega controllerchange en 1.5s, recarga igual
    setTimeout(() => { if (wantsReload.current) window.location.reload() }, 1500)
  }

  if (!updateReady) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)',
        zIndex: 300, maxWidth: 'calc(100vw - 32px)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--s1)', border: '1px solid var(--border2, var(--border))',
        borderRadius: 12, padding: '10px 12px 10px 14px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        animation: 'nx-overlay-in 220ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <RefreshCw size={15} style={{ color: 'var(--nexus)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--text)' }}>
        Hay una versión nueva de NexusMED.
      </span>
      <button
        onClick={actualizar}
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0 }}
      >
        Actualizar
      </button>
      <button
        onClick={() => setUpdateReady(false)}
        aria-label="Descartar"
        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
