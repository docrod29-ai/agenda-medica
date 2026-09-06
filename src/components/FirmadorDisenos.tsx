'use client'
/**
 * Acuñador GLOBAL de las capacidades de las imágenes del diseño de receta
 * (R-06 / #350).
 *
 * El proxy /api/receta/diseno ya no acepta un `?path=` pelado, así que las <img>
 * del membrete/firma que la app renderiza con la URL guardada darían 403 en la
 * VISTA PREVIA (la impresión y el PDF acuñan por su cuenta). Este componente,
 * montado una vez en el layout del dashboard, acuña la capacidad de cualquier
 * imagen del proxy al aparecer: al montar y ante cambios del DOM (rutas nuevas,
 * previews que se abren).
 *
 * A prueba de fallos como todo el circuito: si el acuñador falla, la imagen se
 * queda con su URL original y saldrá rota, pero nada más del documento se cae.
 * Renderiza null; cero impacto visual.
 */
import { useEffect } from 'react'

export default function FirmadorDisenos() {
  useEffect(() => {
    let vivo = true
    let corriendo = false
    let pendiente = false

    const firmar = async () => {
      if (!vivo || corriendo) { pendiente = corriendo; return }
      corriendo = true
      try {
        const imgs = Array.from(document.images).filter(i => i.src.includes('/api/receta/diseno'))
        if (imgs.length) {
          const { firmarImagenesDiseno } = await import('@/lib/receta-diseno-client')
          await firmarImagenesDiseno(imgs, { esperarRecargaMs: 0 })
        }
      } catch { /* sin firma: la vista queda como estaba */ }
      corriendo = false
      if (pendiente) { pendiente = false; void firmar() }
    }

    void firmar()
    // Debounce de mutaciones: una pasada por lote de cambios del DOM.
    let timer: ReturnType<typeof setTimeout> | null = null
    const obs = new MutationObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void firmar() }, 400)
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => { vivo = false; obs.disconnect(); if (timer) clearTimeout(timer) }
  }, [])

  return null
}
