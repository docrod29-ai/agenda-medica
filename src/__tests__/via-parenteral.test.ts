import { describe, it, expect } from 'vitest'
import { corregirViaParenteral, esParenteralPuro } from '@/lib/expediente/via-parenteral'

describe('corregirViaParenteral', () => {
  it('corrige insulina con vía oral (o vacía) a subcutánea', () => {
    expect(corregirViaParenteral('Insulina glargina', 'oral')).toBe('sc')
    expect(corregirViaParenteral('Insulina', '')).toBe('sc')
    expect(corregirViaParenteral('insulina lispro', undefined)).toBe('sc')
    expect(corregirViaParenteral('Insulina NPH', 'vo')).toBe('sc')
  })

  it('corrige heparinas de bajo peso', () => {
    expect(corregirViaParenteral('Enoxaparina', 'oral')).toBe('sc')
    expect(corregirViaParenteral('Fondaparinux', '')).toBe('sc')
  })

  it('corrige GLP-1 inyectables SIN forma oral', () => {
    expect(corregirViaParenteral('Liraglutida', 'oral')).toBe('sc')
    expect(corregirViaParenteral('Dulaglutida', 'oral')).toBe('sc')
    expect(corregirViaParenteral('Tirzepatida', 'oral')).toBe('sc')
  })

  it('NO toca semaglutida (existe Rybelsus oral): "oral" puede ser correcto', () => {
    expect(corregirViaParenteral('Semaglutida', 'oral')).toBe('oral')
  })

  it('NO toca fármacos orales normales', () => {
    expect(corregirViaParenteral('Metformina', 'oral')).toBe('oral')
    expect(corregirViaParenteral('Amoxicilina', '')).toBe('')
    expect(corregirViaParenteral('Paracetamol', 'oral')).toBe('oral')
  })

  it('RESPETA la vía si el médico puso una explícita distinta de oral', () => {
    // Insulina IV en hospital: si se dictó IV explícita, NO se sobre-escribe.
    expect(corregirViaParenteral('Insulina regular', 'iv')).toBe('iv')
    expect(corregirViaParenteral('Enoxaparina', 'im')).toBe('im')
  })

  it('esParenteralPuro identifica el conjunto', () => {
    expect(esParenteralPuro('Insulina glargina')).toBe(true)
    expect(esParenteralPuro('Enoxaparina')).toBe(true)
    expect(esParenteralPuro('Semaglutida')).toBe(false)
    expect(esParenteralPuro('Metformina')).toBe(false)
  })
})
