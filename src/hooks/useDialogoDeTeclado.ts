'use client'
import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * EL TECLADO DE UN DIÁLOGO, EN UN SOLO SITIO.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * De `ui/Modal.tsx`, tal cual. No es una implementación nueva: es la que ya
 * estaba bien, sacada a donde puedan usarla los diálogos que **no** pueden ser
 * un `Modal`.
 *
 * Porque los hay, y por razones legítimas: el aviso de cierre de sesión no debe
 * cerrarse con Escape —sería desactivar sin querer un control de seguridad—, el
 * cajón de navegación entra deslizándose desde el borde, y la paleta de
 * búsqueda tiene su propio gobierno del teclado (flechas y Enter). Los tres son
 * diálogos y los tres necesitan lo mismo del foco.
 *
 * La alternativa era escribir cinco veces la trampa de foco. Este repositorio
 * ya sabe cómo acaba eso: «cinco implementaciones del cálculo de huecos, cuatro
 * de ellas desactualizadas».
 *
 * ── LAS CINCO COSAS ─────────────────────────────────────────────────────────
 *
 * Las mismas que `Modal` documentó al aprenderlas, y por los mismos motivos:
 *
 *  · **Escape** cierra — salvo que se diga que no (`cierraConEscape: false`).
 *  · **Trampa de foco**: el ciclo se cierra sobre sí mismo en los dos sentidos.
 *    Sin ella, un Tab de más navega la página de detrás sin que se vea. Medido
 *    en `/finanzas` el 30-ago: **25 de 25 tabulaciones se iban fuera**, a 15
 *    elementos de la pantalla de debajo.
 *  · **Foco inicial**: sin él, quien usa lector de pantalla se queda donde
 *    estaba y el diálogo no existe para él.
 *  · **Scroll del cuerpo bloqueado**: en móvil el fondo se desplazaba bajo el
 *    diálogo al arrastrar.
 *  · **Foco devuelto** al cerrar, a quien lo abrió, en vez de al principio de
 *    la página.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No pinta nada, no decide si el diálogo está abierto y no toca `aria`: el rol
 * y el `aria-modal` los pone quien dibuja, porque van en su elemento.
 */
export interface OpcionesDeDialogo {
  /**
   * `false` para un diálogo que NO debe poder descartarse con Escape.
   * Hoy sólo el aviso de cierre de sesión: cerrarlo por accidente desactiva un
   * control de seguridad. No se pone a `false` «por si acaso» — atrapar a
   * alguien dentro de un diálogo es el defecto contrario.
   */
  cierraConEscape?: boolean
  /**
   * `false` cuando el diálogo enfoca su propio elemento (la paleta enfoca su
   * campo de búsqueda con su propio efecto, y pelearse por el foco parpadea).
   */
  enfocaAlAbrir?: boolean
}

const ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])'

export function useDialogoDeTeclado(
  abierto: boolean,
  cajaRef: RefObject<HTMLElement | null>,
  alCerrar: () => void,
  opciones: OpcionesDeDialogo = {},
): void {
  const { cierraConEscape = true, enfocaAlAbrir = true } = opciones

  useEffect(() => {
    if (!abierto) return
    const disparador = document.activeElement as HTMLElement | null
    const scrollPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const enfocables = () => Array.from(
      cajaRef.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? [],
    ).filter(el => el.offsetParent !== null || el === document.activeElement)

    if (enfocaAlAbrir) {
      const primeros = enfocables()
      ;(primeros[0] ?? cajaRef.current)?.focus?.()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cierraConEscape) alCerrar()
        return
      }
      if (e.key !== 'Tab') return
      const items = enfocables()
      if (!items.length) { e.preventDefault(); return }
      const primero = items[0], ultimo = items[items.length - 1]
      const activo = document.activeElement as HTMLElement | null
      // El ciclo se cierra sobre sí mismo en los dos sentidos.
      if (e.shiftKey && (activo === primero || !cajaRef.current?.contains(activo))) {
        e.preventDefault(); ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault(); primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrollPrevio
      disparador?.focus?.()
    }
  }, [abierto, alCerrar, cajaRef, cierraConEscape, enfocaAlAbrir])
}
