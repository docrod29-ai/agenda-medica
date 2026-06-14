import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Acciones a la derecha (botones, filtros) */
  actions?: ReactNode
}

/** Encabezado de pantalla: título `.t-h1` + subtítulo + acciones. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="t-h1" style={{ margin: 0 }}>{title}</h1>
        {subtitle && <div className="page-header-sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
