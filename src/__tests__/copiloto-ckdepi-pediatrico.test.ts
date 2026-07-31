/**
 * NEXUS-QUALITY-004 — P0: CKD-EPI 2021 no está validada en < 18 años. El copiloto
 * calculaba una TFG "adulta" en menores y emitía contraindicaciones renales con una
 * fórmula inaplicable. Ahora aplica una guarda pediátrica (deriva a Schwartz).
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'

const med = [{ nombre: 'Metformina 850 mg' }] as never

describe('guarda pediátrica en el ajuste renal del copiloto', () => {
  it('menor de 18: NO contraindica por CKD-EPI adulta; emite nota pediátrica (Schwartz)', () => {
    const s = copiloto({ edad: 15, sexo: 'Masculino', labs: { creatinina: 2.0 }, medicamentos: med })
    const renal = s.filter(x => x.id.startsWith('renal:'))
    expect(renal.some(x => x.id === 'renal:pediatrico')).toBe(true)
    expect(renal.every(x => x.nivel !== 'critico')).toBe(true)
  })
  it('adulto con TFG muy baja: SÍ emite el ajuste/contraindicación renal (no regresión)', () => {
    const s = copiloto({ edad: 70, sexo: 'Masculino', labs: { creatinina: 4.0 }, medicamentos: med })
    expect(s.some(x => x.id.startsWith('renal:') && x.id !== 'renal:pediatrico')).toBe(true)
  })
})
