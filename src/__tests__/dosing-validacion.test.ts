/**
 * GOLDEN — validación médica del dataset de dosis.
 *
 * La regla que se protege: **una firma vale para la versión que se firmó.**
 * Si entra un dataset con dosis corregidas, las firmas viejas dejan de describir
 * lo que hay en pantalla — dirían «validado» sobre un número que nadie miró.
 */
import { describe, it, expect } from 'vitest'
import { estadoDe, firmar, avance, type FirmaValidacion } from '@/lib/dosing/validacion'

const V = '2.0-core'
const H = '0520abd4310e002e960336606c6a3a83c26a15159f9f5080187f5f931a102a9c'
const MEDICO = { uid: 'u1', nombre: 'Dr. David Rodríguez' }
const FECHA = '2026-07-30T20:00:00.000Z'

const firma = (over: Partial<FirmaValidacion> = {}): FirmaValidacion => ({
  ...firmar('Meropenem', MEDICO, { version: V, huella: H }, FECHA), ...over,
})

describe('Sin firma, nada está validado', () => {
  it('sin firma → sin_validar', () => {
    expect(estadoDe(null, V, H).estado).toBe('sin_validar')
    expect(estadoDe(undefined, V, H).estado).toBe('sin_validar')
  })
})

describe('Una firma vale para SU versión, y sólo para ella', () => {
  it('misma versión y misma huella → validado', () => {
    const e = estadoDe(firma(), V, H)
    expect(e.estado).toBe('validado')
  })

  it('el dataset cambió de versión → CADUCADA, no validado', () => {
    const e = estadoDe(firma(), '2.1-core', H)
    expect(e.estado).toBe('caducada')
    if (e.estado === 'caducada') expect(e.porQue).toMatch(/2\.0-core/)
  })

  it('misma versión pero la huella cambió → CADUCADA', () => {
    // El caso peligroso: alguien corrigió una dosis sin subir el número de
    // versión. La huella lo delata.
    const e = estadoDe(firma(), V, 'otra-huella-distinta')
    expect(e.estado).toBe('caducada')
  })

  it('la firma caducada NO se pierde: se conserva quién y cuándo', () => {
    const e = estadoDe(firma(), '2.1-core', H)
    if (e.estado === 'caducada') {
      expect(e.firma.validadoPorNombre).toBe('Dr. David Rodríguez')
      expect(e.firma.fecha).toBe(FECHA)
    }
  })
})

describe('Firmar deja constancia completa', () => {
  it('guarda quién, cuándo y sobre qué versión', () => {
    const f = firmar('Vancomycin IV', MEDICO, { version: V, huella: H }, FECHA, 'Cotejado con UCSF')
    expect(f).toMatchObject({
      farmaco: 'Vancomycin IV', validadoPor: 'u1',
      validadoPorNombre: 'Dr. David Rodríguez', fecha: FECHA,
      versionDataset: V, huellaDataset: H, nota: 'Cotejado con UCSF',
    })
  })

  it('sin nota, no inventa una', () => {
    expect(firmar('Meropenem', MEDICO, { version: V, huella: H }, FECHA).nota).toBeUndefined()
    expect(firmar('Meropenem', MEDICO, { version: V, huella: H }, FECHA, '   ').nota).toBeUndefined()
  })

  it('no se puede firmar sin fármaco, sin médico o sin fecha', () => {
    expect(() => firmar('', MEDICO, { version: V, huella: H }, FECHA)).toThrow(/fármaco/)
    expect(() => firmar('X', { uid: '', nombre: '' }, { version: V, huella: H }, FECHA)).toThrow(/uid/)
    expect(() => firmar('X', MEDICO, { version: V, huella: H }, '')).toThrow(/fecha/)
  })

  it('la fecha se PASA, no la pone el módulo', () => {
    // Un reloj escondido dentro de una función pura la vuelve no reproducible, y
    // esta firma es un registro con valor de auditoría.
    expect(firmar('X', MEDICO, { version: V, huella: H }, FECHA).fecha).toBe(FECHA)
  })
})

describe('El avance del consultorio', () => {
  const FARMACOS = ['Meropenem', 'Vancomycin IV', 'Cefepime', 'Daptomycin']

  it('cuenta validados, caducados y pendientes', () => {
    const firmas = {
      Meropenem: firma(),
      'Vancomycin IV': firma({ farmaco: 'Vancomycin IV' }),
      Cefepime: firma({ farmaco: 'Cefepime', versionDataset: '1.0-viejo' }),
    }
    const a = avance(FARMACOS, firmas, V, H)
    expect(a).toEqual({ total: 4, validados: 2, caducados: 1, sinValidar: 1, porcentaje: 50 })
  })

  it('sin ninguna firma, cero por ciento', () => {
    expect(avance(FARMACOS, {}, V, H)).toEqual({
      total: 4, validados: 0, caducados: 0, sinValidar: 4, porcentaje: 0,
    })
  })

  it('un dataset nuevo tira el avance a cero — y ése es el punto', () => {
    const firmas = Object.fromEntries(FARMACOS.map(f => [f, firma({ farmaco: f })]))
    expect(avance(FARMACOS, firmas, V, H).porcentaje).toBe(100)
    expect(avance(FARMACOS, firmas, '2.1-core', H).porcentaje).toBe(0)
    expect(avance(FARMACOS, firmas, '2.1-core', H).caducados).toBe(4)
  })

  it('sin fármacos no divide por cero', () => {
    expect(avance([], {}, V, H).porcentaje).toBe(0)
  })
})
