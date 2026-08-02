/**
 * GOLDEN — el destierro silencioso de la lista de espera.
 *
 * Al ofrecer un hueco, la entrada pasaba a `contactado`, y la consulta de
 * ofertas futuras exigía `activo`: quien recibía UNA oferta y no contestaba
 * —estaba trabajando, no vio el mensaje— **no volvía a recibir ninguna nunca**.
 * Se quedaba en la lista para siempre, y la lista dejaba de servir para lo
 * único que hace.
 */
import { describe, it, expect } from 'vitest'
import { candidatos, HORAS_DE_GRACIA } from '@/lib/whatsapp/lista-espera'

const HORA = 3_600_000
const AHORA = Date.parse('2026-08-02T18:00:00.000Z')
const haceHoras = (h: number) => new Date(AHORA - h * HORA).toISOString()

describe('candidatos', () => {
  it('quien no contestó vuelve a la rueda pasadas las horas de gracia', () => {
    const r = candidatos([
      { id: 'a', estado: 'contactado', contactadoEn: haceHoras(HORAS_DE_GRACIA + 1), prioridad: 1 },
    ], AHORA)
    expect(r.map(e => e.id)).toEqual(['a'])
  })

  it('a quien acaba de recibir una oferta NO se le acribilla', () => {
    const r = candidatos([
      { id: 'a', estado: 'contactado', contactadoEn: haceHoras(1), prioridad: 1 },
    ], AHORA)
    expect(r).toEqual([])
  })

  it('los de baja no vuelven nunca', () => {
    // Pidió que se le quitara: eso se respeta.
    expect(candidatos([{ id: 'x', estado: 'baja', contactadoEn: haceHoras(99) }], AHORA)).toEqual([])
  })

  it('un `contactado` SIN fecha entra: es de antes de que se registrara', () => {
    // Dejarlo fuera sería mantener el destierro que esto viene a quitar.
    const r = candidatos([{ id: 'viejo', estado: 'contactado', prioridad: 2 }], AHORA)
    expect(r.map(e => e.id)).toEqual(['viejo'])
  })

  it('manda la prioridad, y a igual prioridad quien lleva más esperando', () => {
    const r = candidatos([
      { id: 'nuevo-p1', estado: 'activo', prioridad: 1, createdAt: '2026-08-01' },
      { id: 'viejo-p1', estado: 'activo', prioridad: 1, createdAt: '2026-06-01' },
      { id: 'p2', estado: 'activo', prioridad: 2, createdAt: '2026-01-01' },
    ], AHORA)
    expect(r.map(e => e.id)).toEqual(['viejo-p1', 'nuevo-p1', 'p2'])
  })

  it('sin prioridad declarada se va al final: no se le adivina una', () => {
    const r = candidatos([
      { id: 'sin', estado: 'activo', createdAt: '2020-01-01' },
      { id: 'con', estado: 'activo', prioridad: 3, createdAt: '2026-08-01' },
    ], AHORA)
    expect(r.map(e => e.id)).toEqual(['con', 'sin'])
  })
})
