import { describe, it, expect } from 'vitest'
import { pruebasDesdeReporte } from '@/lib/expediente/antibiograma/vision'

/**
 * Regresión P1 (seguridad del paciente): "No se detecta carbapenemasa" se marcaba
 * POSITIVO (el guard solo cubría /no detect/ pegado) → inventaba carbapenemasa/BLEE/
 * MRSA a partir de un reporte NEGATIVO → sobre-tratamiento + aislamiento innecesario.
 */
describe('pruebasDesdeReporte — negativo debe ganar', () => {
  const casosNeg = [
    'No se detecta',
    'No se detectó',
    'No se detectada',
    'No detectó',
    'No detectada',
    'Negativo',
    'No productor',
    'Ausente',
  ]
  for (const r of casosNeg) {
    it(`"${r}" → neg`, () => {
      expect(pruebasDesdeReporte([{ nombre: 'Carbapenemasa', resultado: r }]).carbapenemasa).toBe('neg')
    })
  }

  const casosPos = [
    'Positivo',
    'Detectado',
    'Se detecta',
    'Productor de carbapenemasa',
  ]
  for (const r of casosPos) {
    it(`"${r}" → pos`, () => {
      expect(pruebasDesdeReporte([{ nombre: 'Carbapenemasa', resultado: r }]).carbapenemasa).toBe('pos')
    })
  }

  it('el caso reportado: "No se detecta carbapenemasa" NO fabrica una carbapenemasa', () => {
    const out = pruebasDesdeReporte([{ nombre: 'Carbapenemasa (mCIM)', resultado: 'No se detecta' }])
    expect(out.carbapenemasa).toBe('neg')
  })

  it('BLEE y MRSA con fraseo negativo mexicano también quedan neg', () => {
    expect(pruebasDesdeReporte([{ nombre: 'BLEE', resultado: 'No se detecta' }]).esbl).toBe('neg')
    expect(pruebasDesdeReporte([{ nombre: 'Cefoxitina screen (MRSA)', resultado: 'No se detectó' }]).cefoxitinaScreen).toBe('neg')
  })

  it('clase de carbapenemasa positiva sí se conserva', () => {
    const out = pruebasDesdeReporte([{ nombre: 'Carbapenemasa', resultado: 'Positivo, NDM' }])
    expect(out.carbapenemasa).toBe('pos')
    expect(out.claseCarbapenemasa).toBe('NDM')
  })
})
