'use client'
import { useEffect } from 'react'

/**
 * Registra el service worker y AUTO-ACTUALIZA en silencio cuando hay un despliegue
 * nuevo (sin banner que moleste). Cuando el SW nuevo toma control, recarga UNA vez
 * para que el usuario nunca se quede atorado en el JS viejo (causa de "los botones
 * no cambian / no sirve"). Además expone la versión viva en window.__AUSCULTA_VERSION
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

        /**
         * RED DE SEGURIDAD contra el "me quedé pegado en una versión vieja".
         *
         * Si tras pedir actualización el service worker sigue sirviendo una
         * versión distinta a la que el servidor entrega HOY, el navegador quedó
         * con JS viejo mezclado con HTML nuevo. Eso se siente exactamente como
         * "no me abre nada y va lentísimo": los clics no navegan porque el
         * router pide trozos que ya no existen.
         *
         * En ese caso se purga TODO y se recarga UNA sola vez. La marca en
         * sessionStorage impide que se repita en bucle si algo sale mal.
         */
        const purgarSiEstaDesfasado = async () => {
          try {
            if (sessionStorage.getItem('nx-purgado')) return
            /**
             * SE PIDE `version.txt`, NO `sw.js` ENTERO.
             *
             * Aquí se descargaba `/sw.js` completo —con `cache: 'no-store'`, o
             * sea sin caché— en CADA carga de página, sólo para leer el número
             * de versión. Ese archivo llegó a pesar **276 KB** porque la
             * bitácora de cada despliegue se acumulaba en un comentario suyo:
             * un cuarto de megabyte de egreso por visita, por usuario, para
             * averiguar una cifra de tres dígitos.
             *
             * `version.txt` son unas decenas de bytes y lo genera el build desde
             * el propio `sw.js`, así que no hay dos fuentes de verdad — dos
             * sitios donde escribir esto se desincronizan, y ésta gobierna la
             * purga de caché: purgaría en bucle o no purgaría nunca.
             */
            const res = await fetch('/version.txt', { cache: 'no-store' })
            const texto = await res.text()
            const m = texto.match(/ausculta-v(\d+)/)
            const servidor = m ? m[1] : null
            const vivo = (window as unknown as { __AUSCULTA_VERSION?: string }).__AUSCULTA_VERSION
            const local = vivo ? (vivo.match(/ausculta-v(\d+)/)?.[1] ?? null) : null
            if (!servidor || !local || servidor === local) return

            sessionStorage.setItem('nx-purgado', '1')
            // eslint-disable-next-line no-console
            console.warn(`[Ausculta] versión desfasada (local v${local} vs servidor v${servidor}). Limpiando y recargando.`)
            const claves = await caches.keys()
            await Promise.all(claves.map(k => caches.delete(k)))
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map(r => r.unregister()))
            window.location.reload()
          } catch { /* si falla, se queda como estaba */ }
        }
        // Se comprueba unos segundos después, cuando ya se pidió la versión viva.
        setTimeout(() => { purgarSiEstaDesfasado() }, 4000)

        // Pedir la versión al SW y exponerla (consola + window) para confirmar el deploy.
        const pedirVersion = () => {
          const sw = navigator.serviceWorker.controller
          if (!sw) return
          const canal = new MessageChannel()
          canal.port1.onmessage = (e) => {
            const v = e.data?.version
            if (v) {
              ;(window as unknown as { __AUSCULTA_VERSION?: string }).__AUSCULTA_VERSION = v
              // eslint-disable-next-line no-console
              console.info(`%cAusculta ${v}`, 'color:#14b8a6;font-weight:700')
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
