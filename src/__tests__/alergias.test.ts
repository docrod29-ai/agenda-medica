import { describe, it, expect } from 'vitest'
import { parsearAlergiasTexto, alergiasDe, tieneAlergiaGrave } from '@/lib/seguridad/alergias'

describe('Alergias estructuradas', () => {
  it('parsea texto libre con varios separadores', () => {
    expect(parsearAlergiasTexto('Penicilina, Sulfas; Mariscos').map(a => a.alergeno))
      .toEqual(['Penicilina', 'Sulfas', 'Mariscos'])
    expect(parsearAlergiasTexto('')).toEqual([])
    expect(parsearAlergiasTexto(undefined)).toEqual([])
  })

  it('usa las estructuradas si existen', () => {
    const p = { alergias: 'ignorar', alergiasEstructuradas: [{ alergeno: 'Penicilina', severidad: 'grave' as const }] }
    const r = alergiasDe(p)
    expect(r).toHaveLength(1)
    expect(r[0].alergeno).toBe('Penicilina')
    expect(r[0].severidad).toBe('grave')
  })

  it('cae al texto libre si no hay estructuradas', () => {
    expect(alergiasDe({ alergias: 'Penicilina, Sulfas' }).map(a => a.alergeno)).toEqual(['Penicilina', 'Sulfas'])
  })

  it('deduplica por alérgeno (case-insensitive)', () => {
    expect(alergiasDe({ alergias: 'Penicilina, penicilina, PENICILINA' })).toHaveLength(1)
  })

  it('tieneAlergiaGrave detecta severidad grave', () => {
    expect(tieneAlergiaGrave({ alergiasEstructuradas: [{ alergeno: 'X', severidad: 'grave' }] })).toBe(true)
    expect(tieneAlergiaGrave({ alergias: 'Polvo' })).toBe(false)
  })
})
