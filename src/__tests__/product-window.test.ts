import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ProductWindow } from '@/components/ProductWindow'
import { DEMO_ESCENARIOS } from '@/lib/demo-sandbox'

describe('ProductWindow (hero shot del producto)', () => {
  const html = renderToStaticMarkup(createElement(ProductWindow))

  it('renderiza sin lanzar y produce HTML', () => {
    expect(html.length).toBeGreaterThan(200)
    expect(html).toContain('NexusMED')
  })

  it('muestra la navegación real del producto', () => {
    for (const label of ['Agenda', 'Pacientes', 'Consulta', 'Recetas', 'Finanzas']) {
      expect(html).toContain(label)
    }
  })

  it('usa datos ficticios (iniciales), no nombres reales', () => {
    for (const e of DEMO_ESCENARIOS) {
      expect(html).toContain(e.cita.iniciales)
    }
    // etiqueta honesta de accesibilidad
    expect(html.toLowerCase()).toContain('ficticios')
  })
})
