/**
 * À la carte: el médico arma cualquier combinación de módulos y se cotiza por médico.
 */
import { describe, it, expect } from 'vitest'
import { precioCombinacion, PRECIO_MODULO } from '@/lib/modulos'

describe('precioCombinacion (à la carte)', () => {
  it('consulta + UCI incluye la agenda como base y suma los módulos', () => {
    const r = precioCombinacion(['expediente', 'uci'])
    expect(r.modulos).toContain('agenda')
    expect(r.porMedico).toBe(PRECIO_MODULO.agenda + PRECIO_MODULO.expediente + PRECIO_MODULO.uci)
  })
  it('solo UCI también incluye la agenda base', () => {
    const r = precioCombinacion(['uci'])
    expect(r.porMedico).toBe(PRECIO_MODULO.agenda + PRECIO_MODULO.uci)
  })
  it('escala por número de médicos', () => {
    const r = precioCombinacion(['expediente'], 3)
    expect(r.total).toBe(r.porMedico * 3)
  })
  it('ignora claves de módulo inexistentes', () => {
    const r = precioCombinacion(['expediente', 'inexistente'])
    expect(r.porMedico).toBe(PRECIO_MODULO.agenda + PRECIO_MODULO.expediente)
  })
})
