import type { ReactNode } from 'react'
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react'

type Tone = 'info' | 'cobalt' | 'success' | 'warning' | 'danger'

interface AlertProps {
  tone?: Tone
  title?: ReactNode
  /** Sobrescribe el icono por defecto del tono. `null` lo oculta. */
  icon?: ReactNode | null
  children?: ReactNode
}

const TONE_CLASS: Record<Tone, string> = {
  info: '',
  cobalt: 'alert-cobalt',
  success: 'alert-green',
  warning: 'alert-amber',
  danger: 'alert-red alert-danger',
}

const DEFAULT_ICON: Record<Tone, ReactNode> = {
  info: <Info size={16} />,
  cobalt: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  warning: <AlertTriangle size={16} />,
  danger: <ShieldAlert size={18} />,
}

/**
 * Banner de aviso consolidado. Reemplaza los banners inline dispersos
 * (alergia, interacciones, controlados, etc.) con una API única.
 */
export function Alert({ tone = 'info', title, icon, children }: AlertProps) {
  const showIcon = icon === null ? null : (icon ?? DEFAULT_ICON[tone])
  return (
    <div className={['alert', TONE_CLASS[tone]].filter(Boolean).join(' ')} role="alert">
      {showIcon && <span className="alert-icon">{showIcon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}
