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
// Guardamos QUÉ VERSIÓN se descartó (no un sí/no). Así el aviso solo reaparece
// cuando hay una versión REALMENTE distinta, no cada vez que entras o enfocas.
const DISMISSED_VERSION_KEY = 'nx.sw.dismissedVersion'

// Pregunta al SW su versión (el CACHE de sw.js) por un canal de mensajes.
function pedirVersion(sw: ServiceWorker): Promise<string> {
  return new Promise((resolve) => {
    try {
      const mc = new MessageChannel()
      mc.port1.onmessage = (e) => resolve(String(e.data?.version ?? ''))
      sw.postMessage({ type: 'GET_VERSION' }, [mc.port2])
      setTimeout(() => resolve(''), 800)  // si no responde, no bloquea
    } catch { resolve('') }
  })
}

export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)
  const versionRef = useRef<string>('')   // versión que está ofreciendo el aviso actual
  const wantsReload = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const versionDescartada = () => {
      try { return localStorage.getItem(DISMISSED_VERSION_KEY) ?? '' } catch { return '' }
    }

    // Recargar SOLO cuando el usuario pidió actualizar (no en la primera instalación)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wantsReload.current) window.location.reload()
    })

    // Ofrece el aviso SOLO si la versión del SW nuevo es distinta a la ya descartada.
    const ofrecerActualizacion = async (sw: ServiceWorker | null) => {
      if (!sw) return
      const version = await pedirVersion(sw)
      // Si ya descartaste ESTA misma versión, no molestar de nuevo.
      if (version && version === versionDescartada()) return
      waitingRef.current = sw
      versionRef.current = version
      setUpdateReady(true)
    }

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // Update pendiente de antes: ofrecer solo si esa versión no fue descartada
        if (reg.waiting && navigator.serviceWorker.controller) {
          ofrecerActualizacion(reg.waiting)
        }

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          if (!sw) return
          sw.addEventListener('statechange', () => {
            // Instalado + ya hay controlador = versión nueva instalada.
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              ofrecerActualizacion(sw)
            }
          })
        })

        // Chequeo ÚNICO al abrir/recargar la app (sin re-chequear al cambiar de
        // ventana). Así el aviso no reaparece cada que regresas el foco; solo
        // sale al abrir la app si de verdad hay una versión nueva. El navegador
        // igual detecta versiones nuevas al navegar dentro del scope del SW.
        reg.update().catch(() => {})
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
    try { localStorage.removeItem(DISMISSED_VERSION_KEY) } catch { /* */ }
    waitingRef.current?.postMessage({ type: 'SKIP_WAITING' })
    // Red de seguridad: si no llega controllerchange en 1.5s, recarga igual
    setTimeout(() => { if (wantsReload.current) window.location.reload() }, 1500)
  }

  // Al descartar: recuerda QUÉ versión descartaste → no reaparece por la misma,
  // pero SÍ saldrá si más adelante hay una versión diferente.
  const descartar = () => {
    try { if (versionRef.current) localStorage.setItem(DISMISSED_VERSION_KEY, versionRef.current) } catch { /* */ }
    setUpdateReady(false)
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
        onClick={descartar}
        aria-label="Descartar"
        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
