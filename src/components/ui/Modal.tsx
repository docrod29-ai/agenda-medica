'use client'
import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDialogoDeTeclado } from '@/hooks/useDialogoDeTeclado'

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
   * Las cinco vivían aquí, escritas a mano, y estaban bien. Se sacaron a
   * `useDialogoDeTeclado` **sin cambiarlas** cuando hizo falta darles el mismo
   * teclado a los diálogos que no pueden ser un `Modal`: el aviso de cierre de
   * sesión (que no debe cerrarse con Escape), el cajón de navegación y la
   * paleta de búsqueda.
   *
   * Escribirlas cinco veces era la alternativa, y este repositorio ya sabe cómo
   * acaba eso.
   */
  useDialogoDeTeclado(open, cajaRef, onClose)

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
