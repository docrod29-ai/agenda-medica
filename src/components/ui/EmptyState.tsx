import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  /** Ilustración de marca grande (reemplaza al icono chico cuando se da). */
  illustration?: ReactNode
  title: string
  description?: string
  /** Acción opcional (p. ej. un Button para crear el primer registro) */
  action?: ReactNode
  /**
   * RTC-30 — CUÁNTO ESPACIO MERECE EL VACÍO.
   *
   * `'hero'` (por defecto) es el estado vacío de siempre: icono centrado,
   * título, frase y botón, en 48px de aire. Vale cuando el vacío ES la
   * pantalla — un consultorio sin ningún paciente todavía —, porque entonces
   * lo único que hay que hacer es lo que ese botón hace.
   *
   * `'linea'` es para el vacío de UN BLOQUE dentro de una pantalla que sigue
   * teniendo trabajo debajo. Se midió al quitar la tarjeta contenedora de Hoy
   * (RTC-31): sin la caja que lo justificaba, el hero de «Sin citas hoy» dejó
   * 250px de vacío ilustrado por encima de los pendientes que sí requerían
   * atención. Un bloque sin contenido no puede pesar más que uno con trabajo
   * dentro: dice lo que sabe, en una línea, y sigue.
   *
   * Es una VARIANTE, no un componente nuevo: el mismo estado vacío con la
   * decisión de cuánto espacio ocupa hecha explícita.
   */
  variante?: 'hero' | 'linea'
}

/**
 * Estado vacío con propósito: dice qué hacer, no solo "no hay datos".
 * Wrapper sobre `.empty-state`.
 */
export function EmptyState({ icon, illustration, title, description, action, variante = 'hero' }: EmptyStateProps) {
  if (variante === 'linea') {
    return (
      <div className="empty-state empty-state--linea">
        <div>
          <span className="empty-state-title">{title}</span>
          {description && <span className="empty-state-desc"> {description}</span>}
        </div>
        {action}
      </div>
    )
  }
  return (
    <div className="empty-state">
      {illustration
        ? <div className="empty-illus" style={{ marginBottom: 6, opacity: 0.95 }}>{illustration}</div>
        : icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}
