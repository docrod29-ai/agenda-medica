'use client'
/**
 * Botón "Atrás" global de la barra superior móvil. Aparece SOLO cuando hay una
 * pantalla anterior dentro de la app (history.idx > 0). Así el usuario siempre
 * puede regresar a donde estaba, sin depender del botón propio de cada página.
 */
import { ArrowLeft } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function MobileBackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const [canBack, setCanBack] = useState(false)

  useEffect(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    setCanBack(idx > 0)
  }, [pathname])

  if (!canBack) return null
  return (
    <button onClick={() => router.back()} className="mobile-topbar-btn" aria-label="Regresar">
      <ArrowLeft size={22} />
    </button>
  )
}
