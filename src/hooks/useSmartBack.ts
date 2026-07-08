'use client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * "Atrás" inteligente: si el usuario ya navegó DENTRO de la app, regresa a la
 * pantalla anterior real (router.back). Si llegó directo (deep link, recarga,
 * notificación push), va al destino lógico `fallback`.
 *
 * Usa el índice de historial del App Router (window.history.state.idx): 0 = es
 * la primera entrada de esta sesión SPA → no hay a dónde regresar.
 */
export function useSmartBack(fallback: string) {
  const router = useRouter()
  return useCallback(() => {
    const idx = (typeof window !== 'undefined'
      ? (window.history.state as { idx?: number } | null)?.idx
      : undefined) ?? 0
    if (idx > 0) router.back()
    else router.push(fallback)
  }, [router, fallback])
}
