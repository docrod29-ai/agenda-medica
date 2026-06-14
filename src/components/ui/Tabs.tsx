import type { ReactNode } from 'react'

export interface TabItem<K extends string = string> {
  key: K
  label: ReactNode
  /** Contador opcional mostrado junto al label */
  count?: number
}

interface TabsProps<K extends string = string> {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
}

/** Navegación por pestañas (borde inferior). Wrapper sobre `.tabs`/`.tab`. */
export function Tabs<K extends string = string>({ items, value, onChange, className }: TabsProps<K>) {
  return (
    <div className={['tabs', className].filter(Boolean).join(' ')}>
      {items.map(t => (
        <button
          key={t.key}
          type="button"
          className={`tab${value === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {typeof t.count === 'number' && t.count > 0 && (
            <span style={{ marginLeft: 6, opacity: 0.7 }}>({t.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
