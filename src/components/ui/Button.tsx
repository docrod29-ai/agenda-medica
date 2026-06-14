import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Icono lucide a la izquierda del texto */
  icon?: ReactNode
  /** Muestra spinner y deshabilita */
  loading?: boolean
  /** Ocupa todo el ancho disponible */
  block?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
}

/**
 * Botón base. Wrapper tipado sobre las clases `.btn` del design system.
 * Variantes: primary (acción), secondary, ghost (terciaria), danger.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, block, disabled, className, children, ...rest },
  ref,
) {
  const classes = ['btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(' ')
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      style={block ? { width: '100%' } : undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        icon
      )}
      {children}
    </button>
  )
})
