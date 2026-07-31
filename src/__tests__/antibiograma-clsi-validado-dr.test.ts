/**
 * Breakpoints CLSI M100-Ed35 LEÍDOS Y AUTORIZADOS por el Dr. Rodríguez Luna
 * (infectólogo) directamente del documento, 2026-07. Estos tests BLINDAN los dos
 * cortes que estuvieron marcados "pendiente de validar": si un cambio futuro los
 * altera por error, la suite falla. No inventar valores: cualquier ajuste requiere
 * re-lectura del documento.
 */
import { describe, it, expect } from 'vitest'
import { interpretarCMI } from '@/lib/expediente/antibiograma/clsi-breakpoints'

describe('CLSI M100-Ed35 — validado por el Dr', () => {
  describe('Minociclina · Acinetobacter spp. (S ≤1, I =2, R ≥4)', () => {
    const cat = (cmi: number) => interpretarCMI('Acinetobacter baumannii', 'minociclina', cmi)?.categoria
    it('CMI 1 → S', () => expect(cat(1)).toBe('S'))
    it('CMI 0.5 → S', () => expect(cat(0.5)).toBe('S'))
    it('CMI 2 → I (banda intermedia)', () => expect(cat(2)).toBe('I'))
    it('CMI 4 → R', () => expect(cat(4)).toBe('R'))
    it('CMI 8 → R', () => expect(cat(8)).toBe('R'))
  })

  describe('Piperacilina-tazobactam · Pseudomonas aeruginosa (S ≤16, I =32, R ≥64)', () => {
    const cat = (cmi: number) => interpretarCMI('Pseudomonas aeruginosa', 'piperacilina-tazobactam', cmi)?.categoria
    it('CMI 16 → S', () => expect(cat(16)).toBe('S'))
    it('CMI 32 → I (NO SDD, indicación explícita del Dr)', () => {
      expect(cat(32)).toBe('I')
      expect(cat(32)).not.toBe('SDD')
    })
    it('CMI 64 → R', () => expect(cat(64)).toBe('R'))
    it('CMI 128 → R', () => expect(cat(128)).toBe('R'))
  })
})
