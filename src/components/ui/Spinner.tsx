import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: number
  /** Texto opcional al lado del spinner */
  label?: string
  /** Centra vertical/horizontalmente con padding generoso */
  center?: boolean
}

/** Indicador de carga consistente (lucide Loader2 + animación spin). */
export function Spinner({ size = 18, label, center }: SpinnerProps) {
  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 13 }}>
      <Loader2 size={size} style={{ animation: 'spin 1s linear infinite', color: 'var(--nexus)' }} />
      {label}
    </span>
  )
  if (!center) return content
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      {content}
    </div>
  )
}
