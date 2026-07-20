import { describe, it, expect } from 'vitest'
import { entradaPorMedico, membreteValido, overrideRecetaValido, firmaValida } from '@/lib/impreso-medico'

/**
 * El cuarto parámetro (`unicoMedico`) es el que decide si se puede usar la única
 * entrada válida cuando no hay coincidencia exacta.
 *
 * Es tan importante porque el match exacto CASI SIEMPRE falla: las notas se
 * sellan con el uid de Firebase y la configuración se guarda con el id de la
 * subcolección `doctors`. Así que esa rama no es la excepción, es el camino
 * normal — y en un consultorio de dos médicos significaba estampar la firma
 * escaneada de uno en la receta del otro.
 */
describe('entradaPorMedico — resuelve impreso por médico tolerando desajuste de ids', () => {
  const hoja = (url: string) => ({ url, margenes: { top: 42, right: 22, bottom: 28, left: 22 } })

  it('usa la coincidencia EXACTA por medicoId cuando existe', () => {
    const mapa = { uidA: hoja('A.png'), otroId: hoja('B.png') }
    // Con match exacto da igual cuántos médicos haya: es su propia hoja.
    expect(entradaPorMedico(mapa, 'uidA', membreteValido)?.url).toBe('A.png')
    expect(entradaPorMedico(mapa, 'uidA', membreteValido, true)?.url).toBe('A.png')
  })

  it('un solo médico: el desajuste uid ↔ doctors id cae a la única', () => {
    // Config guardó bajo el id de la subcolección doctors; la nota trae el uid.
    const mapa = { docAutoId_123: hoja('mi-membrete.png') }
    expect(entradaPorMedico(mapa, 'firebaseUID_xyz', membreteValido, true)?.url).toBe('mi-membrete.png')
  })

  it('un solo médico sin medicoId en la nota → usa la única', () => {
    const mapa = { cualquiera: hoja('unica.png') }
    expect(entradaPorMedico(mapa, '', membreteValido, true)?.url).toBe('unica.png')
    expect(entradaPorMedico(mapa, undefined, membreteValido, true)?.url).toBe('unica.png')
  })

  it('REGRESIÓN — SUPLANTACIÓN: con varios médicos NO se usa la única entrada', () => {
    // Consultorio con los doctores A y B; solo A subió su firma. Antes esto
    // devolvía la firma de A para CUALQUIER médico, así que la receta de B salía
    // firmada por A. Una firma ausente se nota; una firma ajena no.
    const soloA = { docA: 'data:image/png;base64,FIRMA-DE-A' }
    expect(entradaPorMedico(soloA, 'uid-de-B', firmaValida, false)).toBeUndefined()
  })

  it('por defecto NO adivina: hay que declarar explícitamente que es un solo médico', () => {
    const mapa = { docAutoId_123: hoja('mi-membrete.png') }
    expect(entradaPorMedico(mapa, 'otro-uid', membreteValido)).toBeUndefined()
  })

  it('2+ entradas válidas y ninguna coincide → undefined aunque sea un solo médico', () => {
    const mapa = { d1: hoja('A.png'), d2: hoja('B.png') }
    expect(entradaPorMedico(mapa, 'noExiste', membreteValido, true)).toBeUndefined()
    expect(entradaPorMedico(mapa, 'noExiste', membreteValido, false)).toBeUndefined()
  })

  it('ignora entradas vacías (hoja "quitada" queda con url vacía)', () => {
    const mapa = { d1: hoja(''), d2: hoja('B.png') }
    expect(entradaPorMedico(mapa, 'x', membreteValido, true)?.url).toBe('B.png')
    expect(entradaPorMedico(mapa, 'x', membreteValido, false)).toBeUndefined()
  })

  it('mapa vacío o indefinido → undefined', () => {
    expect(entradaPorMedico(undefined, 'x', membreteValido, true)).toBeUndefined()
    expect(entradaPorMedico({}, 'x', membreteValido, true)).toBeUndefined()
  })

  it('override de receta: exacto gana; la única solo con un médico', () => {
    const mapa = { docId: { paperSize: 'carta', membreteDataUrl: 'x' } }
    expect(entradaPorMedico(mapa, 'uid', overrideRecetaValido, true)).toEqual(mapa.docId)
    // objeto vacío no cuenta como válido
    expect(entradaPorMedico({ a: {}, b: { paperSize: 'a4' } }, 'z', overrideRecetaValido, true)).toEqual({ paperSize: 'a4' })
    expect(entradaPorMedico({ a: {}, b: { paperSize: 'a4' } }, 'z', overrideRecetaValido, false)).toBeUndefined()
  })

  it('firma por médico: cadena no vacía es válida', () => {
    const mapa = { docId: 'data:image/png;base64,AAA' }
    expect(entradaPorMedico(mapa, 'uid', firmaValida, true)).toBe('data:image/png;base64,AAA')
    expect(entradaPorMedico({ a: '', b: 'firmaB' }, 'z', firmaValida, true)).toBe('firmaB')
  })
})
