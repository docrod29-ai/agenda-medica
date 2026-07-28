/**
 * P0 (auditoría): "no tiene/presenta/refiere X" se leía como X POSITIVO porque el
 * afirmador ("tiene") dentro del negador ("no tiene") cancelaba la negación.
 */
import { describe, it, expect } from 'vitest'
import { estaNegado } from '@/lib/expediente/parser-clinico'

describe('estaNegado · negaciones con afirmador embebido', () => {
  const casos: [string, string, boolean][] = [
    ['no tiene diabetes', 'diabetes', true],
    ['no presenta hipertensión', 'hipertensión', true],
    ['no refiere alergias', 'alergias', true],
    ['nunca tuvo cáncer', 'cáncer', true],
    ['sin datos de sepsis', 'sepsis', true],
    ['niega tabaquismo', 'tabaquismo', true],
    ['presenta diabetes', 'diabetes', false],           // afirmación real
    ['refiere hipertensión de años', 'hipertensión', false],
    ['niega tvp. presenta diabetes', 'diabetes', false], // negación cerrada por punto
  ]
  it.each(casos)('"%s" · término "%s" negado=%s', (texto, term, esperado) => {
    const idx = texto.toLowerCase().indexOf(term.toLowerCase())
    expect(estaNegado(texto, idx)).toBe(esperado)
  })
})
