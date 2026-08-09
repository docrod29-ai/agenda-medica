'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * ¿Hay pantalla anterior DENTRO de esta sesión de la aplicación?
 *
 * `window.history.state.idx` es el índice del App Router: 0 significa que ésta
 * es la primera entrada —se llegó por enlace directo, recarga o notificación— y
 * no hay nada a lo que volver.
 */
export function hayPantallaAnterior(): boolean {
  if (typeof window === 'undefined') return false
  return (((window.history.state as { idx?: number } | null)?.idx) ?? 0) > 0
}

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
    if (hayPantallaAnterior()) router.back()
    else router.push(fallback)
  }, [router, fallback])
}

/**
 * Igual que `useSmartBack`, pero además dice **cómo llamarse**.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
 *
 * La consulta tenía su vuelta FIJA al expediente y con `push`. Entrando desde la
 * agenda —que es como se entra a una consulta— el historial quedaba
 * `/citas → /consulta → /expediente`, y el médico oscilaba entre las dos últimas
 * sin poder volver a la agenda: **renavegar tras cada paciente**.
 *
 * Cambiarlo por `router.back()` a secas dejaría el rótulo mintiendo («Expediente»
 * en un botón que va a la agenda). Y quitarle el rótulo pierde información que
 * en hospital importa: volver al EPISODIO no es lo mismo que volver al
 * expediente.
 *
 * Así que el botón dice lo que va a hacer: «Atrás» cuando de verdad va a
 * retroceder, y el nombre del destino cuando no hay historial y va a empujar.
 *
 * ── POR QUÉ `useSyncExternalStore` Y NO UN EFECTO ───────────────────────────
 *
 * `window.history` no existe al renderizar en el servidor, así que el valor no
 * puede leerse durante el primer render. La forma obvia —un `useState(false)` y
 * un efecto que lo corrige al montar— es un `setState` síncrono dentro de un
 * efecto: provoca un render en cascada y el analizador de este repositorio lo
 * marca como error, con razón.
 *
 * El historial del navegador es exactamente lo que `useSyncExternalStore`
 * existe para leer: una fuente EXTERNA a React, con una foto para el cliente y
 * otra para el servidor. La suscripción no hace nada porque el índice sólo
 * cambia al navegar, y navegar remonta la pantalla.
 */
const NO_SUSCRIBIRSE = () => () => {}

export function useVolverConNombre(fallback: string, etiquetaDelDestino: string) {
  const volver = useSmartBack(fallback)
  const hayAnterior = useSyncExternalStore(
    NO_SUSCRIBIRSE,
    hayPantallaAnterior,
    () => false,   // en el servidor no hay historial: se rotula el destino
  )
  return { volver, etiqueta: hayAnterior ? 'Atrás' : etiquetaDelDestino }
}
