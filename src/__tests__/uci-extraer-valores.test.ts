/**
 * nexusmed-icu-005 · voz del pase de visita → valores del Panel UCI
 */
import { describe, it, expect } from 'vitest'
import { extraerValoresUCI } from '@/lib/uci/extraccion'

describe('extraerValoresUCI', () => {
  it('extrae del dictado respiratorio (números en palabra)', () => {
    const t = 'Respiratorio: PEEP ocho, FiO2 cuarenta, plateau veinticuatro, PaO2 ochenta y dos, pH siete punto tres dos'
    const r = extraerValoresUCI(t)
    expect(r).toMatchObject({ peep: '8', fio2: '40', pplat: '24', pao2: '82', ph: '7.32' })
  })

  it('extrae hemodinamia y laboratorio', () => {
    const t = 'lactato dos punto uno, potasio seis punto ocho, glasgow diez, creatinina dos'
    const r = extraerValoresUCI(t)
    expect(r).toMatchObject({ lactato: '2.1', k: '6.8', glasgow: '10', creat: '2' })
  })

  it('acepta dígitos directos', () => {
    expect(extraerValoresUCI('PEEP 8 FiO2 40 plateau 24')).toMatchObject({ peep: '8', fio2: '40', pplat: '24' })
  })

  it('NO inventa: solo devuelve lo que reconoce', () => {
    const r = extraerValoresUCI('el paciente está estable, seguimos igual')
    expect(Object.keys(r)).toHaveLength(0)
  })
})
