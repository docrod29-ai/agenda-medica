import { describe, it, expect } from 'vitest'
import { sanitizarProsa } from '@/lib/expediente/sanitizar-prosa'

describe('sanitizarProsa', () => {
  it('devuelve cadena vacía para null/undefined/""', () => {
    expect(sanitizarProsa(null)).toBe('')
    expect(sanitizarProsa(undefined)).toBe('')
    expect(sanitizarProsa('')).toBe('')
  })

  it('no toca prosa clínica normal', () => {
    const t = 'Paciente masculino de 45 años con dolor abdominal de 3 días.'
    expect(sanitizarProsa(t)).toBe(t)
  })

  it('quita banderas internas de revisión (needs review)', () => {
    expect(sanitizarProsa('TA 120/80 needs review')).toBe('TA 120/80')
    expect(sanitizarProsa('TA 120/80 — (needs_review)')).toBe('TA 120/80')
  })

  it('quita "por confirmar (IA)" y "baja confianza"', () => {
    expect(sanitizarProsa('Dosis 500 mg (por confirmar (IA))')).toBe('Dosis 500 mg')
    expect(sanitizarProsa('FC 88 baja confianza')).toBe('FC 88')
  })

  it('quita comentarios sobre la transcripción/grabación', () => {
    expect(sanitizarProsa('Peso no especificado en la transcripción')).toBe('Peso')
    expect(sanitizarProsa('Talla, no se transcribió')).toBe('Talla')
    expect(sanitizarProsa('Signos no especificados en la grabación')).toBe('Signos')
  })

  it('limpia paréntesis vacíos, espacios dobles y espacios antes de puntuación', () => {
    expect(sanitizarProsa('Nota ( ) final')).toBe('Nota final')
    expect(sanitizarProsa('uno   dos')).toBe('uno dos')
    expect(sanitizarProsa('frase .')).toBe('frase.')
  })

  it('recorta espacios de los extremos', () => {
    expect(sanitizarProsa('   texto   ')).toBe('texto')
  })

  it('es idempotente (aplicarla dos veces da lo mismo)', () => {
    const t = 'TA 120/80 needs review, peso no se transcribió'
    const una = sanitizarProsa(t)
    expect(sanitizarProsa(una)).toBe(una)
  })
})
