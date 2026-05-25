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
    <div className="offline-banner">
      <WifiOff size={14} /> Sin conexión — trabajando en modo offline. Los cambios se sincronizarán al reconectar.
    </div>
  )
}
