'use client'
import { useEffect } from 'react'

/**
 * Registra el service worker (para offline/caché) SIN ningún aviso de
 * actualización. Las versiones nuevas se aplican SOLAS, en silencio, cuando el
 * usuario cierra y vuelve a abrir la app (ciclo de vida normal del SW) o al
 * hacer un refresh forzado. Ya NO se muestra la ventanita "hay una versión
 * nueva / Actualizar" — molestaba y reaparecía con cada despliegue.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* silencioso */ })
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // Sin UI: no hay banner de actualización.
  return null
}
