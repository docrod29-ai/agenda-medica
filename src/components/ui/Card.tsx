import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Resalta al pasar el cursor (para tarjetas clickeables) */
  hover?: boolean
  /** Padding interno en px (default 16) */
  padding?: number
  children: ReactNode
}

/**
 * Superficie elevada base. Wrapper sobre `.card` del design system.
 * Plana por defecto (sin sombra decorativa); el borde define la superficie.
 */
export function Card({ hover, padding = 16, className, style, children, ...rest }: CardProps) {
  const classes = ['card', hover ? 'card-hover' : '', className].filter(Boolean).join(' ')
  return (
    <div className={classes} style={{ padding, ...style }} {...rest}>
      {children}
    </div>
  )
}
