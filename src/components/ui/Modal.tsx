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

  return (
    <div className="modal-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div className={['modal', SIZE_CLASS[size]].filter(Boolean).join(' ')} onClick={e => e.stopPropagation()}>
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
