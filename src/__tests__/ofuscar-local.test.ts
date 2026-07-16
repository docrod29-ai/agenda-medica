import { describe, it, expect } from 'vitest'
import { ofuscar, desofuscar, estaOfuscado } from '@/lib/seguridad/ofuscar-local'

describe('Ofuscación local de PHI (síncrona)', () => {
  const secreto = 'uid-medico-123'
  const phi = JSON.stringify({ nota: 'Paciente Juan Pérez, dx bronquitis', dosis: '500 mg' })

  it('ida y vuelta recupera el texto exacto', () => {
    const o = ofuscar(phi, secreto)
    expect(o).not.toContain('Juan')        // ya no está en texto plano
    expect(estaOfuscado(o)).toBe(true)
    expect(desofuscar(o, secreto)).toBe(phi)
  })

  it('con secreto distinto NO recupera el original', () => {
    const o = ofuscar(phi, secreto)
    expect(desofuscar(o, 'otro-uid')).not.toBe(phi)
  })

  it('maneja acentos y unicode', () => {
    const t = 'Niño con dolor abdominal — José Ramírez'
    expect(desofuscar(ofuscar(t, secreto), secreto)).toBe(t)
  })

  it('retrocompat: un borrador VIEJO en texto plano devuelve null (no está ofuscado)', () => {
    expect(desofuscar('{"nota":"texto plano viejo"}', secreto)).toBe(null)
    expect(estaOfuscado('{"nota":"texto plano viejo"}')).toBe(false)
  })

  it('cadena corrupta no rompe', () => {
    expect(desofuscar('NXO1:@@@no-base64@@@', secreto)).toBe(null)
  })
})
