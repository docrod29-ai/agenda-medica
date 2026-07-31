import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'

/** Lote 7 clínico (validado por el Dr): sulfas sin diuréticos, carbapenémicos como
 *  precaución, teratógenos 'evitar' solo con embarazo confirmado. */
describe('Sulfas ya NO marca diuréticos', () => {
  it('furosemida con alergia a sulfas NO dispara choque', () => {
    const sug = copiloto({ alergias: 'sulfas', medicamentos: [{ nombre: 'Furosemida', dosis: '40 mg' }] })
    expect(sug.some(s => s.id.startsWith('alergia:'))).toBe(false)
  })
  it('hidroclorotiazida con alergia a sulfas NO dispara', () => {
    const sug = copiloto({ alergias: 'alérgico a sulfas', medicamentos: [{ nombre: 'Hidroclorotiazida', dosis: '25 mg' }] })
    expect(sug.some(s => s.id.startsWith('alergia:'))).toBe(false)
  })
  it('TMP-SMX con alergia a sulfas SÍ dispara (sulfa antibiótica)', () => {
    const sug = copiloto({ alergias: 'sulfas', medicamentos: [{ nombre: 'Trimetoprim-sulfametoxazol', dosis: '160/800' }] })
    expect(sug.some(s => s.id.startsWith('alergia:') && s.nivel === 'critico')).toBe(true)
  })
})

describe('Betalactámicos: carbapenémico = precaución, no crítico', () => {
  it('meropenem con alergia a penicilina → precaución (accion), no crítico', () => {
    const sug = copiloto({ alergias: 'penicilina', medicamentos: [{ nombre: 'Meropenem', dosis: '1 g' }] })
    const a = sug.find(s => s.id.includes('meropenem'))
    expect(a?.nivel).toBe('accion')
    expect(sug.some(s => s.nivel === 'critico' && s.id.includes('meropenem'))).toBe(false)
  })
  it('cefalosporina con alergia a penicilina sigue siendo crítica', () => {
    const sug = copiloto({ alergias: 'penicilina', medicamentos: [{ nombre: 'Ceftriaxona', dosis: '1 g' }] })
    expect(sug.some(s => s.nivel === 'critico' && s.id.includes('ceftriaxona'))).toBe(true)
  })
})

describe('Embarazo: teratógenos "evitar" solo con embarazo confirmado', () => {
  const mujer = { sexo: 'Femenino', edad: 28 }
  it('doxiciclina en mujer SIN Dx de embarazo NO avisa', () => {
    const sug = copiloto({ ...mujer, medicamentos: [{ nombre: 'Doxiciclina', dosis: '100 mg' }] })
    expect(sug.some(s => s.id.startsWith('gesta:'))).toBe(false)
  })
  it('doxiciclina CON Dx de embarazo SÍ avisa (accion)', () => {
    const sug = copiloto({ ...mujer, diagnosticos: [{ descripcion: 'Embarazo de 22 semanas' }], medicamentos: [{ nombre: 'Doxiciclina', dosis: '100 mg' }] })
    const g = sug.find(s => s.id.startsWith('gesta:evitar'))
    expect(g?.nivel).toBe('accion')
  })
  it('IECA (contraindicado) sigue avisando aunque no haya Dx de embarazo', () => {
    const sug = copiloto({ ...mujer, medicamentos: [{ nombre: 'Enalapril', dosis: '10 mg' }] })
    expect(sug.some(s => s.id.startsWith('gesta:') && s.nivel === 'critico')).toBe(true)
  })
})
