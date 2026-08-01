'use client'
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type Size = 'md' | 'wide' | 'xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  size?: Size
  /** Contenido del pie (botones de acción) */
  footer?: ReactNode
  /** Cerrar al hacer click en el overlay (default true) */
  closeOnOverlay?: boolean
  children: ReactNode
}

const SIZE_CLASS: Record<Size, string> = { md: '', wide: 'modal-wide', xl: 'modal-xl' }

/** Diálogo modal. Wrapper sobre `.modal-overlay`/`.modal`. Cierra con Escape u overlay. */
export function Modal({ open, onClose, title, size = 'md', footer, closeOnOverlay = true, children }: ModalProps) {
  const cajaRef = useRef<HTMLDivElement>(null)

  /**
   * ESCAPE, FOCO ATRAPADO, FOCO INICIAL, SCROLL BLOQUEADO Y FOCO DEVUELTO.
   *
   * Antes sólo escuchaba Escape. Faltaban las otras cuatro, y se notaban:
   *
   *  · Sin trampa de foco, un Tab de más salía del modal y se navegaba la lista
   *    de citas de atrás sin verla — con el diálogo de cobro abierto encima.
   *  · Sin foco inicial, quien usa lector de pantalla se quedaba donde estaba y
   *    el diálogo no existía para él.
   *  · Sin bloquear el scroll del cuerpo, en móvil el fondo se desplazaba bajo
   *    el modal al arrastrar.
   *  · Sin devolver el foco, al cerrar se volvía al principio de la página en
   *    vez de al botón que lo abrió.
   */
  useEffect(() => {
    if (!open) return
    const disparador = document.activeElement as HTMLElement | null
    const scrollPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const enfocables = () => Array.from(
      cajaRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(el => el.offsetParent !== null || el === document.activeElement)

    // Foco inicial: el primer control del diálogo, o el diálogo mismo si no hay.
    const primeros = enfocables()
    ;(primeros[0] ?? cajaRef.current)?.focus?.()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
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
  }, [open, onClose])

  const titleId = useId()

  if (!open) return null

  /**
   * Cerrar en mouseDown y solo si el gesto EMPEZÓ en el fondo.
   *
   * Con onClick en el overlay, seleccionar texto dentro del modal y soltar el
   * botón fuera cerraba el modal: el click se despacha en el ancestro común. En
   * un formulario largo (una cita, una nota) eso tiraba todo lo capturado por
   * intentar copiar una línea.
   */
  const cerrarSiEsElFondo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlay) return
    if (e.target !== e.currentTarget) return
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={cerrarSiEsElFondo}>
      <div
        ref={cajaRef}
        tabIndex={-1}
        className={['modal', SIZE_CLASS[size]].filter(Boolean).join(' ')}
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="modal-header">
            <div className="t-h2" id={titleId}>{title}</div>
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
