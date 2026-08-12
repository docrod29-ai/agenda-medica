'use client'
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/** Muestra una franja cuando no hay conexión. Los datos siguen
 *  disponibles gracias a la persistencia offline de Firestore. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null
  return (
    /* `role="status"`: aparece en caliente al perder la red, así que además de
       sacar la franja de la violación `region` de axe (contenido fuera de todo
       landmark — V15-A11Y-001, 1ª rebanada), el lector de pantalla anuncia el
       cambio de conectividad sin robar el foco. */
    <div className="offline-banner" role="status">
      <WifiOff size={14} aria-hidden="true" /> Sin conexión — trabajando en modo offline. Los cambios se sincronizarán al reconectar.
    </div>
  )
}
