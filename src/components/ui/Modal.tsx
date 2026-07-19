'use client'
import { useEffect } from 'react'
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
      <div className={['modal', SIZE_CLASS[size]].filter(Boolean).join(' ')} onMouseDown={e => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <div className="t-h2">{title}</div>
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
