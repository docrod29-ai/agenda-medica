import { describe, it, expect } from 'vitest'
import { resumirEntregas } from '@/lib/whatsapp/entregas'
import type { EstadoMensaje } from '@/lib/whatsapp/status'

const s = (estado: string, extra: Partial<EstadoMensaje> = {}): EstadoMensaje => ({
  wamid: `w${Math.round(estado.length)}${extra.errorCode ?? ''}${Object.keys(extra).length}`,
  estado, ...extra,
})

describe('Resumen de entregabilidad (Iter. 7)', () => {
  it('cuenta estados y calcula tasas', () => {
    const items: EstadoMensaje[] = [
      { wamid: 'a', estado: 'read' },
      { wamid: 'b', estado: 'read' },
      { wamid: 'c', estado: 'delivered' },
      { wamid: 'd', estado: 'sent' },
      { wamid: 'e', estado: 'failed', errorCode: 131026, errorTitulo: 'No entregable' },
    ]
    const r = resumirEntregas(items)
    expect(r.total).toBe(5)
    expect(r.leidos).toBe(2)
    expect(r.entregados).toBe(3) // 2 read + 1 delivered
    expect(r.fallidos).toBe(1)
    expect(r.fallosPermanentes).toBe(1)
    expect(r.tasaEntrega).toBe(0.6)        // 3/5
    expect(r.tasaLectura).toBe(redondear(2 / 3)) // 2/3 de los entregados
    expect(r.porEstado).toMatchObject({ read: 2, delivered: 1, sent: 1, failed: 1 })
  })

  it('agrupa fallos por código, de mayor a menor', () => {
    const items: EstadoMensaje[] = [
      { wamid: 'a', estado: 'failed', errorCode: 131026, errorTitulo: 'No entregable' },
      { wamid: 'b', estado: 'failed', errorCode: 131026 },
      { wamid: 'c', estado: 'failed', errorCode: 131050, errorTitulo: 'Opt-out' },
    ]
    const r = resumirEntregas(items)
    expect(r.fallosPorCodigo[0]).toMatchObject({ codigo: 131026, cuenta: 2 })
    expect(r.fallosPorCodigo[1]).toMatchObject({ codigo: 131050, cuenta: 1 })
    expect(r.fallosPermanentes).toBe(3)
  })

  it('lista vacía → ceros sin dividir por cero', () => {
    const r = resumirEntregas([])
    expect(r).toMatchObject({ total: 0, entregados: 0, tasaEntrega: 0, tasaLectura: 0 })
    expect(r.fallosPorCodigo).toEqual([])
  })
})

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000
}
