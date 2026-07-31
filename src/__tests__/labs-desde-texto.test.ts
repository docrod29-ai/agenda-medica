import { describe, it, expect } from 'vitest'
import { labsDesdeEstudios, valorNumerico } from '@/lib/expediente/labs-desde-texto'

/**
 * Estos valores alimentan fórmulas que producen CONDUCTA: la TFG decide el ajuste
 * de dosis, el FIB-4 decide si se deriva a hepatología. Un mapeo equivocado no da
 * un dato feo, da una indicación equivocada.
 *
 * Por eso los tests van en las dos direcciones: que mapee lo que debe, y que
 * calle cuando no está seguro.
 */
describe('valorNumerico', () => {
  it('lee números con coma decimal y con desigualdad', () => {
    expect(valorNumerico('1,4')).toBe(1.4)
    expect(valorNumerico('<0.5')).toBe(0.5)
    expect(valorNumerico(' 250 ')).toBe(250)
  })

  it('NO interpreta una tensión arterial como analito', () => {
    expect(valorNumerico('120/80')).toBeNull()
  })

  it('con varios números es ambiguo y devuelve null', () => {
    expect(valorNumerico('1.2 a 1.8')).toBeNull()
  })

  it('sin número no inventa', () => {
    expect(valorNumerico('normal')).toBeNull()
    expect(valorNumerico('')).toBeNull()
    expect(valorNumerico(undefined)).toBeNull()
  })
})

describe('mapeo de estudios a laboratorios', () => {
  it('mapea lo esencial del dictado', () => {
    const labs = labsDesdeEstudios([
      { texto: 'Creatinina', valor: '1.4', unidad: 'mg/dL' },
      { texto: 'AST', valor: '45' },
      { texto: 'ALT', valor: '38' },
      { texto: 'Colesterol total', valor: '210' },
      { texto: 'Triglicéridos', valor: '180' },
    ])
    expect(labs.creatinina).toBe(1.4)
    expect(labs.ast).toBe(45)
    expect(labs.alt).toBe(38)
    expect(labs.colesterolTotal).toBe(210)
    expect(labs.trigliceridos).toBe(180)
  })

  it('las plaquetas en miles se normalizan a unidades absolutas (FIB-4)', () => {
    expect(labsDesdeEstudios([{ texto: 'Plaquetas', valor: '250', unidad: 'x10³/µL' }]).plaquetas).toBe(250_000)
    expect(labsDesdeEstudios([{ texto: 'Plaquetas', valor: '250000' }]).plaquetas).toBe(250_000)
  })

  it('NO confunde hemoglobina con hemoglobina glucosilada', () => {
    const labs = labsDesdeEstudios([
      { texto: 'Hemoglobina glucosilada', valor: '7.2', unidad: '%' },
      { texto: 'Hemoglobina', valor: '13.5', unidad: 'g/dL' },
    ])
    expect(labs.hba1c).toBe(7.2)
    expect(labs.hemoglobina).toBe(13.5)
  })

  it('NO toma la creatinina EN ORINA como la sérica', () => {
    // La TFG se calcula con la sérica; usar la urinaria daría un ajuste de dosis
    // equivocado.
    expect(labsDesdeEstudios([{ texto: 'Creatinina en orina', valor: '90' }]).creatinina).toBeUndefined()
  })

  it('un valor fuera de rango plausible NO se mapea', () => {
    // Casi siempre es otra unidad o un error de transcripción. Meterlo a la
    // fórmula de CKD-EPI produciría una TFG inventada.
    expect(labsDesdeEstudios([{ texto: 'Creatinina', valor: '450' }]).creatinina).toBeUndefined()
    expect(labsDesdeEstudios([{ texto: 'Potasio', valor: '140' }]).potasio).toBeUndefined()
  })

  it('un estudio SIN resultado no genera ningún valor', () => {
    const labs = labsDesdeEstudios([
      { texto: 'Biometría hemática', valor: '' },
      { texto: 'Química sanguínea' },
    ])
    expect(Object.keys(labs)).toHaveLength(0)
  })

  it('ante dos menciones del mismo analito gana la PRIMERA', () => {
    // El dictado suele mencionar el valor actual antes que el histórico.
    const labs = labsDesdeEstudios([
      { texto: 'Creatinina', valor: '1.4' },
      { texto: 'Creatinina', valor: '0.9' },
    ])
    expect(labs.creatinina).toBe(1.4)
  })

  it('no revienta con entrada vacía o indefinida', () => {
    expect(labsDesdeEstudios([])).toEqual({})
    expect(labsDesdeEstudios(undefined)).toEqual({})
  })

  it('un texto que no es analito conocido se ignora', () => {
    expect(labsDesdeEstudios([{ texto: 'Radiografía de tórax', valor: '2' }])).toEqual({})
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P2): «colesterol no-HDL» casaba \bhdl\b (el guion
 * separa palabra) y un no-HDL de 140 se guardaba como un HDL excelente → PREVENT
 * subestimaba el riesgo cardiovascular.
 */
describe('Colesterol no-HDL no se confunde con HDL', () => {
  const mapa = (texto: string, valor: string) => labsDesdeEstudios([{ texto, valor }])
  it('«colesterol no-HDL» NO se guarda como hdl', () => {
    expect(mapa('colesterol no-HDL', '140').hdl).toBeUndefined()
  })
  it('«no HDL» con espacio tampoco', () => {
    expect(mapa('no HDL', '140').hdl).toBeUndefined()
  })
  it('el HDL de verdad sí se sigue capturando', () => {
    expect(mapa('HDL', '45').hdl).toBe(45)
    expect(mapa('colesterol HDL', '52').hdl).toBe(52)
  })
})
