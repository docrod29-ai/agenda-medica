/**
 * NEXUS-QUALITY-013 — 'puerperio' (posparto) no es embarazo.
 * La regex de "embarazo confirmado" incluía 'puerper', así que a una paciente
 * puérpera le disparaba avisos de teratógeno categoría 'evitar' ("La paciente
 * cursa embarazo") pese a que el feto ya nació. La lactancia es otra cosa.
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'

const med = [{ nombre: 'Atorvastatina 20 mg' }]

describe('puerperio ≠ embarazo en el aviso de teratógenos', () => {
  it('puérpera con estatina → NO dispara "evita en el embarazo"', () => {
    const s = copiloto({
      sexo: 'Femenino', edad: 30, medicamentos: med,
      diagnosticos: [{ descripcion: 'Puerperio fisiológico' }],
    })
    expect(s.some(x => x.id === 'gesta:evitar:Atorvastatina 20 mg')).toBe(false)
  })
  it('embarazada con estatina → SÍ dispara "evita en el embarazo" (sin regresión)', () => {
    const s = copiloto({
      sexo: 'Femenino', edad: 30, medicamentos: med,
      diagnosticos: [{ descripcion: 'Embarazo de 20 semanas de gestación' }],
    })
    expect(s.some(x => x.id === 'gesta:evitar:Atorvastatina 20 mg')).toBe(true)
  })
})
