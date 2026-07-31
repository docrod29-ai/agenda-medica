/**
 * Manos libres: la voz del pase debe llenar TODO el panel (números + categorías).
 */
import { describe, it, expect } from 'vitest'
import { extraerValoresUCI, extraerCategoricosUCI } from '@/lib/uci/extraccion'

describe('extracción numérica ampliada', () => {
  it('vasopresores, neuro, POCUS y metabólico', () => {
    const o = extraerValoresUCI('norepinefrina 0.2, dopamina 5, dobutamina 3, presión intracraneal 18, temperatura 38.5, creatinina 1.6, cloro 108, albúmina 2.5, TAPSE 20, líneas b 4, vena cava inferior 2.3')
    expect(o.norepi).toBe('0.2')
    expect(o.dopa).toBe('5')
    expect(o.dobu).toBe('3')
    expect(o.pic).toBe('18')
    expect(o.temp).toBe('38.5')
    expect(o.cl).toBe('108')
    expect(o.tapse).toBe('20')
    expect(o.lineasB).toBe('4')
    expect(o.vci).toBe('2.3')
  })
})

describe('extracción categórica (selectores)', () => {
  it('modo ventilatorio y soporte', () => {
    expect(extraerCategoricosUCI('paciente en asistido controlado por volumen').modo).toBe('AC-VC')
    expect(extraerCategoricosUCI('en modo presión soporte').modo).toBe('PSV')
    expect(extraerCategoricosUCI('ventilación mecánica').soporte).toBe('si')
  })
  it('muestra arterial NO se confunde con "presión arterial"', () => {
    expect(extraerCategoricosUCI('la presión arterial está baja').muestra).toBeUndefined()
    expect(extraerCategoricosUCI('gasometría arterial reciente').muestra).toBe('arterial')
  })
  it('pupilas', () => {
    expect(extraerCategoricosUCI('pupilas fijas').pupilas).toBe('fijas')
    expect(extraerCategoricosUCI('anisocoria derecha').pupilas).toBe('anisocoria')
  })
  it('VExUS por vena', () => {
    const o = extraerCategoricosUCI('vena hepática con flujo grave, porta leve, renal normal')
    expect(o.vHep).toBe('grave')
    expect(o.vPor).toBe('leve')
    expect(o.vRen).toBe('normal')
  })
  it('PLR, CKRT y ECMO', () => {
    expect(extraerCategoricosUCI('elevación de piernas con LVOT-VTI').plrParam).toBe('LVOT_VTI')
    expect(extraerCategoricosUCI('en CVVHDF').ckrtMod).toBe('CVVHDF')
    expect(extraerCategoricosUCI('ECMO veno-arterial').ecmoConf).toBe('VA')
  })
})
