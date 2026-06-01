import { describe, it, expect } from 'vitest'
import {
  normalizarTermino,
  validarAlergiasVsMedicamentos,
  validacionesGeneralesMedicamentos,
  esMedicamentoCritico,
} from '@/lib/expediente/medical-dictionary'

describe('normalizarTermino', () => {
  it('corrige typos conocidos con alta confianza', () => {
    const r = normalizarTermino('losartan')
    expect(r.suggested).toBe('losartán')
    expect(r.confidence).toBe('alta')
    expect(r.needs_review).toBe(false)
  })
  it('corrige ceftriazona → ceftriaxona', () => {
    const r = normalizarTermino('ceftriazona')
    expect(r.suggested).toBe('ceftriaxona')
  })
  it('expande abreviatura conocida', () => {
    const r = normalizarTermino('DM2')
    expect(r.suggested).toBe('diabetes mellitus tipo 2')
    expect(r.confidence).toBe('alta')
  })
  it('NO cambia término desconocido — needs_review', () => {
    const r = normalizarTermino('xyzofarmaco-no-existe')
    expect(r.suggested).toBe('xyzofarmaco-no-existe')
    expect(r.confidence).toBe('baja')
    expect(r.needs_review).toBe(true)
  })
})

describe('validarAlergiasVsMedicamentos (interacciones)', () => {
  it('alergia a penicilina + amoxicilina → alerta crítica', () => {
    const alertas = validarAlergiasVsMedicamentos(
      [{ alergeno: 'penicilina', reaccion: 'urticaria' }],
      [{ nombre: 'amoxicilina', dosis: '500 mg' }],
    )
    expect(alertas.length).toBeGreaterThan(0)
    expect(alertas[0].severidad).toBe('critica')
  })
  it('sin alergia → sin alerta', () => {
    const alertas = validarAlergiasVsMedicamentos(
      [],
      [{ nombre: 'amoxicilina', dosis: '500 mg' }],
    )
    expect(alertas).toHaveLength(0)
  })
  it('alergia a AINE + ibuprofeno → alerta', () => {
    const alertas = validarAlergiasVsMedicamentos(
      [{ alergeno: 'AINE' }],
      [{ nombre: 'ibuprofeno', dosis: '400 mg' }],
    )
    expect(alertas.some(a => a.severidad === 'critica')).toBe(true)
  })
})

describe('validacionesGeneralesMedicamentos', () => {
  it('embarazo + warfarina → alerta crítica', () => {
    const a = validacionesGeneralesMedicamentos([{ nombre: 'warfarina' }], { embarazo: true })
    expect(a[0]?.severidad).toBe('critica')
  })
  it('ERC + metformina → advertencia', () => {
    const a = validacionesGeneralesMedicamentos([{ nombre: 'metformina' }], { erc: true })
    expect(a[0]?.severidad).toBe('advertencia')
  })
  it('anticoagulado + ibuprofeno → advertencia', () => {
    const a = validacionesGeneralesMedicamentos([{ nombre: 'ibuprofeno' }], { anticoagulado: true })
    expect(a[0]?.severidad).toBe('advertencia')
  })
})

describe('esMedicamentoCritico', () => {
  it.each(['warfarina', 'insulina', 'metotrexato', 'morfina', 'diazepam'])(
    '%s es crítico',
    (m) => expect(esMedicamentoCritico(m)).toBe(true),
  )
  it('paracetamol NO es crítico', () => {
    expect(esMedicamentoCritico('paracetamol')).toBe(false)
  })
})
