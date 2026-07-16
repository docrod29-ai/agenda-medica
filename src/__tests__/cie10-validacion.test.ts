import { describe, it, expect } from 'vitest'
import { validarFormatoCie10, cie10EnCatalogoBase } from '@/lib/cie10'

describe('validarFormatoCie10', () => {
  it('acepta códigos con forma ICD-10 válida', () => {
    for (const c of ['A00', 'A04.9', 'B18.2', 'U07.1', 'J20', 'E11.9', 'S06.0X']) {
      expect(validarFormatoCie10(c)).toBe(true)
    }
  })

  it('rechaza códigos malformados / alucinados', () => {
    for (const c of ['XYZ', '12.3', 'A0', 'AA0', 'A00.', 'diabetes', 'A00-9', '']) {
      expect(validarFormatoCie10(c)).toBe(false)
    }
  })

  it('normaliza espacios y minúsculas', () => {
    expect(validarFormatoCie10('  a04.9 ')).toBe(true)
  })

  it('tolera null/undefined', () => {
    expect(validarFormatoCie10(null)).toBe(false)
    expect(validarFormatoCie10(undefined)).toBe(false)
  })
})

describe('cie10EnCatalogoBase', () => {
  it('reconoce códigos del catálogo base', () => {
    expect(cie10EnCatalogoBase('A41.9')).toBe(true) // Sepsis
    expect(cie10EnCatalogoBase('u07.1')).toBe(true) // COVID (case-insensitive)
  })
  it('un código inexistente no está en el base', () => {
    expect(cie10EnCatalogoBase('Z99.9')).toBe(false)
  })
})
