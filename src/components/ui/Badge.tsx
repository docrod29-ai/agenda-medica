import type { ReactNode } from 'react'

type Tone = 'neutral' | 'cobalt' | 'green' | 'amber' | 'red'

interface BadgeProps {
  tone?: Tone
  /** Muestra un punto de color antes del texto */
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'badge-neutral',
  cobalt: 'badge-cobalt',
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
}

const DOT_COLOR: Record<Tone, string> = {
  neutral: 'var(--text3)',
  cobalt: 'var(--nexus)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
}

/** Etiqueta compacta de estado/categoría. Wrapper sobre `.badge`. */
export function Badge({ tone = 'neutral', dot, icon, children }: BadgeProps) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`}>
      {dot && <span className="badge-dot" style={{ background: DOT_COLOR[tone] }} />}
      {icon}
      {children}
    </span>
  )
}
