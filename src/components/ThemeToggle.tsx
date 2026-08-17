'use client'

/**
 * ThemeToggle — botón flotante para alternar dark/light mode (escritorio).
 *
 * La LÓGICA del tema (llave, ciclo, pintado sobre <html>) vive en
 * `@/hooks/useTema` — RTC-05: este botón es una VISTA; la fila de
 * Operaciones es la otra (y la única en móvil, donde este botón no flota:
 * ver `.theme-toggle` en globals.css).
 *
 * Estados visuales:
 *  - 🌙 Luna   → dark forzado
 *  - ☀️ Sol     → light forzado
 *  - 🖥️ Auto    → sigue al SO (sin atributo data-theme)
 *
 * §8.5 (RTC-05): mientras el micrófono está abierto el botón desaparece —
 * cromo de sistema flotando sobre el modo encuentro — y vuelve al detener,
 * por la misma compuerta compartida que el resto del shell.
 */

import { useTema } from '@/hooks/useTema'
import { useGrabando } from '@/hooks/useGrabando'

export function ThemeToggle() {
  const { modo, ciclar, montado, titulo } = useTema()
  const grabando = useGrabando()

  // Evita flicker SSR: hasta montar, no renderizamos el botón.
  if (!montado) return null
  if (grabando) return null

  return (
    <button
      type="button"
      onClick={ciclar}
      className="theme-toggle"
      title={titulo}
      aria-label={titulo}
    >
      {modo === 'dark' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {modo === 'light' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
      {modo === 'auto' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      )}
    </button>
  )
}
