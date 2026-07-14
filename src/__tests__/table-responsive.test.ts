import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { Table, type Column } from '@/components/ui/Table'

interface Row { nombre: string; total: number }
const columns: Column<Row>[] = [
  { key: 'nombre', header: 'Nombre', render: r => r.nombre },
  { key: 'total', header: 'Total', align: 'right', render: r => `$${r.total}` },
]
const rows: Row[] = [{ nombre: 'Ana', total: 100 }, { nombre: 'Beto', total: 250 }]

const render = (props: object = {}) =>
  renderToStaticMarkup(createElement(Table<Row>, { columns, rows, rowKey: (r: Row) => r.nombre, ...props } as never))

describe('Table responsive (modo tarjeta móvil)', () => {
  it('por defecto activa el modo tarjeta (clase rwd) y emite data-label desde encabezados de texto', () => {
    const html = render()
    expect(html).toContain('table-wrap rwd')
    expect(html).toContain('data-label="Nombre"')
    expect(html).toContain('data-label="Total"')
  })

  it('mobileCards=false desactiva el modo tarjeta (sin clase rwd)', () => {
    const html = render({ mobileCards: false })
    expect(html).toContain('class="table-wrap"')
    expect(html).not.toContain('rwd')
  })

  it('renderiza todas las filas', () => {
    const html = render()
    expect(html).toContain('Ana')
    expect(html).toContain('Beto')
    expect(html).toContain('$250')
  })
})
