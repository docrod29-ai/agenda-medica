import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  /** Alinea a la derecha (útil para números) */
  align?: 'left' | 'right' | 'center'
  width?: number | string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  /** Contenido a mostrar cuando no hay filas */
  empty?: ReactNode
  /**
   * En móvil (≤640px) cada fila se muestra como TARJETA "Encabezado: valor"
   * (evita tablas ilegibles en teléfono). Default true. Poner false para
   * tablas que se leen mejor con scroll horizontal. Solo afecta ≤640px.
   */
  mobileCards?: boolean
}

/** Etiqueta para el modo tarjeta móvil: solo si el encabezado es texto. */
function labelDe(header: ReactNode): string | undefined {
  return typeof header === 'string' ? header : undefined
}

/** Tabla densa. Wrapper sobre `.table-wrap` + estilos `table` del design system. */
export function Table<T>({ columns, rows, rowKey, onRowClick, empty, mobileCards = true }: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }
  return (
    <div className={mobileCards ? 'table-wrap rwd' : 'table-wrap'}>
      <table>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map(c => (
                <td key={c.key} data-label={labelDe(c.header) ?? ''} style={{ textAlign: c.align ?? 'left' }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
