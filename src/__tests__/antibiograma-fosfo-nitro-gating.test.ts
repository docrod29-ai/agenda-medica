import { describe, it, expect } from 'vitest'
import { interpretarCMI } from '@/lib/expediente/antibiograma/clsi-breakpoints'
import { evaluarIntrinseca } from '@/lib/expediente/antibiograma/intrinseca'

/**
 * Decisión clínica del Dr (conservador > permisivo):
 *  - Nitrofurantoína/Fosfomicina: "S" solo en IVU (sitio orina). Fuera de eso → no aplicable.
 *  - Fosfomicina: solo E. coli urinaria; no extrapolar el breakpoint a otras Enterobacterales.
 *  - Enterococcus + TMP-SMX: alerta clínica (no conflicto de especie).
 */
describe('Fosfo/Nitro — gating por foco y organismo', () => {
  it('nitrofurantoína en orina (E. coli) → S utilizable', () => {
    const c = interpretarCMI('Escherichia coli', 'nitrofurantoina', 32, 'orina')
    expect(c?.categoria).toBe('S')
    expect(c?.noAplicable).toBeFalsy()
  })

  it('nitrofurantoína en sangre → NO aplicable (aunque la CMI sea baja)', () => {
    const c = interpretarCMI('Escherichia coli', 'nitrofurantoina', 32, 'sangre')
    expect(c?.noAplicable).toBe(true)
  })

  it('nitrofurantoína sin sitio → NO aplicable (no se asume urinario)', () => {
    const c = interpretarCMI('Escherichia coli', 'nitrofurantoina', 32)
    expect(c?.noAplicable).toBe(true)
  })

  it('fosfomicina E. coli urinaria → S utilizable', () => {
    const c = interpretarCMI('Escherichia coli', 'fosfomicina', 32, 'orina')
    expect(c?.categoria).toBe('S')
    expect(c?.noAplicable).toBeFalsy()
  })

  it('fosfomicina Klebsiella urinaria → NO aplicable (breakpoint solo E. coli)', () => {
    const c = interpretarCMI('Klebsiella pneumoniae', 'fosfomicina', 32, 'orina')
    expect(c?.noAplicable).toBe(true)
    expect(c?.motivoNoAplicable).toMatch(/E\. coli/)
  })

  it('fosfomicina E. coli en hemocultivo → NO aplicable (foco no urinario)', () => {
    const c = interpretarCMI('Escherichia coli', 'fosfomicina', 32, 'sangre')
    expect(c?.noAplicable).toBe(true)
  })
})

describe('Enterococcus + TMP-SMX — alerta clínica, no conflicto', () => {
  it('cotrimoxazol «S» en Enterococcus → alerta_clinica (no conflicto de especie)', () => {
    const notas = evaluarIntrinseca('Enterococcus faecalis', [
      { antibiotico: 'Trimetoprim-sulfametoxazol', interpretacion: 'S' },
    ])
    const tmp = notas.find(n => /trimetoprim|sulfa|cotrimox/i.test(n.antibiotico) || /TMP-SMX/i.test(n.mensaje))
    expect(tmp?.tipo).toBe('alerta_clinica')
    expect(notas.some(n => n.tipo === 'conflicto' && /reconfirmar/i.test(n.mensaje))).toBe(false)
  })
})
