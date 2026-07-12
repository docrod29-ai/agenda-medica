import { describe, it, expect } from 'vitest'
import { entradaPorMedico, membreteValido, overrideRecetaValido, firmaValida } from '@/lib/impreso-medico'

describe('entradaPorMedico — resuelve impreso por médico tolerando desajuste de ids', () => {
  const hoja = (url: string) => ({ url, margenes: { top: 42, right: 22, bottom: 28, left: 22 } })

  it('usa la coincidencia EXACTA por medicoId cuando existe', () => {
    const mapa = { uidA: hoja('A.png'), otroId: hoja('B.png') }
    expect(entradaPorMedico(mapa, 'uidA', membreteValido)?.url).toBe('A.png')
  })

  it('BUG REAL: id de la nota (uid) NO coincide con la clave (doctors id) → cae a la única', () => {
    // Config guardó bajo el id de la subcolección doctors; la nota trae el uid.
    const mapa = { docAutoId_123: hoja('mi-membrete.png') }
    expect(entradaPorMedico(mapa, 'firebaseUID_xyz', membreteValido)?.url).toBe('mi-membrete.png')
  })

  it('clínica de un solo médico sin medicoId en la nota → usa la única', () => {
    const mapa = { cualquiera: hoja('unica.png') }
    expect(entradaPorMedico(mapa, '', membreteValido)?.url).toBe('unica.png')
    expect(entradaPorMedico(mapa, undefined, membreteValido)?.url).toBe('unica.png')
  })

  it('2+ médicos y ninguno coincide → undefined (NO adivina, para no cruzar hojas)', () => {
    const mapa = { d1: hoja('A.png'), d2: hoja('B.png') }
    expect(entradaPorMedico(mapa, 'noExiste', membreteValido)).toBeUndefined()
  })

  it('ignora entradas vacías (hoja "quitada" queda con url vacía)', () => {
    const mapa = { d1: hoja(''), d2: hoja('B.png') }
    // Solo una válida → se usa aunque el medicoId no coincida
    expect(entradaPorMedico(mapa, 'x', membreteValido)?.url).toBe('B.png')
  })

  it('mapa vacío o indefinido → undefined', () => {
    expect(entradaPorMedico(undefined, 'x', membreteValido)).toBeUndefined()
    expect(entradaPorMedico({}, 'x', membreteValido)).toBeUndefined()
  })

  it('override de receta: exacto gana; si no, la única con contenido', () => {
    const mapa = { docId: { paperSize: 'carta', membreteDataUrl: 'x' } }
    expect(entradaPorMedico(mapa, 'uid', overrideRecetaValido)).toEqual(mapa.docId)
    // objeto vacío no cuenta como válido
    expect(entradaPorMedico({ a: {}, b: { paperSize: 'a4' } }, 'z', overrideRecetaValido)).toEqual({ paperSize: 'a4' })
  })

  it('firma por médico: cadena no vacía es válida', () => {
    const mapa = { docId: 'data:image/png;base64,AAA' }
    expect(entradaPorMedico(mapa, 'uid', firmaValida)).toBe('data:image/png;base64,AAA')
    expect(entradaPorMedico({ a: '', b: 'firmaB' }, 'z', firmaValida)).toBe('firmaB')
  })
})
