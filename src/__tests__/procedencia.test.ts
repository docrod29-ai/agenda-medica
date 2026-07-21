import { describe, it, expect } from 'vitest'
import { construirManifiesto, resumenProcedencia, normaliza } from '@/lib/expediente/procedencia'

describe('Sello de procedencia', () => {
  it('clasifica dictado (con cita), IA (sin cita) y manual', () => {
    const m = construirManifiesto(
      {
        diagnosticos: [{ descripcion: 'Neumonía adquirida en la comunidad' }, { descripcion: 'Hipertensión' }],
        medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
        alergias: ['Penicilina'],
      },
      {
        diagnosticos: [
          { descripcion: 'Neumonía adquirida en la comunidad', source_quote: 'tiene tos con flema y fiebre', confidence: 'alta' },
          { descripcion: 'Hipertensión', confidence: 'media' }, // sin cita → IA
        ],
        medicamentos: [{ nombre: 'Amoxicilina', source_quote: 'le voy a dar amoxicilina', confidence: 'alta' }],
        // Penicilina NO está en la extracción → manual
      },
    )
    const by = Object.fromEntries(m.campos.map(c => [c.valor.split(' ')[0], c.origen]))
    expect(m.campos.find(c => c.valor.startsWith('Neumonía'))!.origen).toBe('dictado')
    expect(m.campos.find(c => c.valor.startsWith('Neumonía'))!.cita).toContain('flema')
    expect(m.campos.find(c => c.valor === 'Hipertensión')!.origen).toBe('ia')
    expect(by['Penicilina']).toBe('manual')
    expect(m.resumen).toEqual({ dictado: 2, ia: 1, manual: 1, total: 4 })
  })

  it('coincidencia laxa: "cefalea" del dictado cubre "cefalea tensional" final', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Cefalea tensional' }] },
      { diagnosticos: [{ descripcion: 'cefalea', source_quote: 'me duele la cabeza' }] },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('sin extracción, todo es manual', () => {
    const m = construirManifiesto({ diagnosticos: [{ descripcion: 'Diabetes' }] })
    expect(m.resumen.manual).toBe(1)
    expect(m.resumen.dictado).toBe(0)
  })

  it('resumenProcedencia es legible', () => {
    expect(resumenProcedencia({ dictado: 6, ia: 2, manual: 1, total: 9 })).toBe('6 del dictado · 2 de IA · 1 a mano')
    expect(resumenProcedencia({ dictado: 0, ia: 0, manual: 0, total: 0 })).toBe('sin datos estructurados')
  })

  it('normaliza quita acentos y baja a minúsculas', () => {
    expect(normaliza('  Neumonía Atípica ')).toBe('neumonia atipica')
  })
})
