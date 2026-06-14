import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Acción opcional (p. ej. un Button para crear el primer registro) */
  action?: ReactNode
}

/**
 * Estado vacío con propósito: dice qué hacer, no solo "no hay datos".
 * Wrapper sobre `.empty-state`.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}
