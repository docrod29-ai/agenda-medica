'use client'

/**
 * ThemeToggle — botón flotante para alternar dark/light mode.
 *
 * Diseño:
 *  - Por defecto sigue al SO (prefers-color-scheme)
 *  - El usuario puede forzar dark o light, queda persistido en localStorage
 *  - Tercer click vuelve a "auto" (sigue al SO)
 *
 * Estados visuales:
 *  - 🌙 Luna   → dark forzado
 *  - ☀️ Sol     → light forzado
 *  - 🖥️ Auto    → sigue al SO (sin atributo data-theme)
 *
 * No depende de React Context — pinta directo sobre <html> para
 * evitar flicker en SSR y no obligar a wrappers globales.
 */

import { useEffect, useState } from 'react'

type Modo = 'dark' | 'light' | 'auto'

const KEY = 'nexusmed.theme'

function aplicar(modo: Modo) {
  const html = document.documentElement
  if (modo === 'auto') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', modo)
  }
}

export function ThemeToggle() {
  const [modo, setModo] = useState<Modo>('auto')
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    // Default = OSCURO (marca NexusMED). 'auto' solo si el usuario lo eligió antes.
    const guardado = (localStorage.getItem(KEY) as Modo | null) ?? 'dark'
    setModo(guardado)
    aplicar(guardado)
    setMontado(true)
  }, [])

  function ciclar() {
    const siguiente: Modo = modo === 'auto' ? 'dark' : modo === 'dark' ? 'light' : 'auto'
    setModo(siguiente)
    aplicar(siguiente)
    if (siguiente === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, siguiente)
  }

  // Evita flicker SSR: hasta montar, no renderizamos el botón.
  if (!montado) return null

  const titulo =
    modo === 'auto' ? 'Tema: automático (clic: oscuro)'
    : modo === 'dark' ? 'Tema: oscuro (clic: claro)'
    : 'Tema: claro (clic: automático)'

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
