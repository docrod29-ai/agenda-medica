'use client'
import { useEffect } from 'react'

/**
 * Registra el service worker y AUTO-ACTUALIZA en silencio cuando hay un despliegue
 * nuevo (sin banner que moleste). Cuando el SW nuevo toma control, recarga UNA vez
 * para que el usuario nunca se quede atorado en el JS viejo (causa de "los botones
 * no cambian / no sirve"). Además expone la versión viva en window.__NEXUSMED_VERSION
 * y en consola, para poder confirmar en qué versión estás realmente.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // AUTO-UPDATE: si la página YA estaba controlada por un SW, cualquier cambio
        // de controlador = un despliegue nuevo → recargar una sola vez (sin loop).
        if (navigator.serviceWorker.controller) {
          let recargando = false
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (recargando) return
            recargando = true
            window.location.reload()
          })
        }

        // Buscar actualización de inmediato y cada 30 min (para PWA que quedan abiertas).
        reg.update().catch(() => {})
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)

        // Pedir la versión al SW y exponerla (consola + window) para confirmar el deploy.
        const pedirVersion = () => {
          const sw = navigator.serviceWorker.controller
          if (!sw) return
          const canal = new MessageChannel()
          canal.port1.onmessage = (e) => {
            const v = e.data?.version
            if (v) {
              ;(window as unknown as { __NEXUSMED_VERSION?: string }).__NEXUSMED_VERSION = v
              // eslint-disable-next-line no-console
              console.info(`%cNexusMED ${v}`, 'color:#14b8a6;font-weight:700')
            }
          }
          sw.postMessage({ type: 'GET_VERSION' }, [canal.port2])
        }
        pedirVersion()
        navigator.serviceWorker.addEventListener('controllerchange', pedirVersion)
      } catch { /* silencioso */ }
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
