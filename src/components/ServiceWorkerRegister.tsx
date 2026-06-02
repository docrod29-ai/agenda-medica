'use client'
import { useEffect } from 'react'

/**
 * Registra el service worker con auto-update.
 *
 * Estrategia:
 * 1. Registra /sw.js
 * 2. Verifica si hay una nueva versión cada vez que la app gana foco
 * 3. Cuando detecta SW nuevo instalado, lo activa (skipWaiting) y RECARGA la página
 *    una sola vez (controlando un flag para evitar bucles)
 *
 * Esto evita el clásico problema "el SW viejo sigue sirviendo HTML cacheado
 * y el usuario no ve los cambios". Antes había que borrar caché a mano.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let refreshing = false

    const recargarSiCambia = () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        recargarSiCambia()

        // Si ya hay un SW esperando, actívalo ya
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          if (!sw) return
          sw.addEventListener('statechange', () => {
            // Nuevo SW instalado y hay uno controlando (= es una ACTUALIZACIÓN, no primera instalación)
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Chequear actualizaciones cuando la pestaña gana foco / al cargar
        const checkUpdate = () => { reg.update().catch(() => {}) }
        window.addEventListener('focus', checkUpdate)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkUpdate()
        })
      } catch {
        /* silencioso */
      }
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
