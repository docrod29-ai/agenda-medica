/**
 * Constructor determinista de la nota de evolución UCI: arma por sistemas SIN
 * inventar (secciones sin dato quedan vacías) y refleja los cálculos de los motores.
 */
import { describe, it, expect } from 'vitest'
import { construirSeccionesUCI } from '@/lib/uci/nota'

describe('construirSeccionesUCI', () => {
  it('devuelve las 10 secciones de evolucion_uci en orden', () => {
    const s = construirSeccionesUCI({})
    expect(s.map(x => x.key)).toEqual([
      'contexto', 'neurologico', 'respiratorio', 'hemodinamico', 'renal_metabolico',
      'gastrointestinal', 'hematoinfeccioso', 'piel_dispositivos', 'ultrasonido', 'plan',
    ])
  })

  it('sin datos: las secciones clínicas quedan vacías (no inventa)', () => {
    const s = construirSeccionesUCI({})
    const by = Object.fromEntries(s.map(x => [x.key, x.value]))
    expect(by.neurologico).toBe('')
    expect(by.respiratorio).toBe('')
    expect(by.hemodinamico).toBe('')
    // ultrasonido siempre lleva el recordatorio de seguridad
    expect(by.ultrasonido).toMatch(/Ninguna medición aislada/)
  })

  it('caso SDRA: respiratorio refleja P/F, driving pressure y VT/PBW', () => {
    const s = construirSeccionesUCI({
      sexo: 'M', talla: '170', vt: '420', fio2: '60', peep: '10', pplat: '26',
      pao2: '78', muestra: 'arterial', modo: 'AC-VC', fr: '22',
    })
    const resp = s.find(x => x.key === 'respiratorio')!.value
    expect(resp).toMatch(/PaO₂\/FiO₂ 130/)      // 78/0.6
    expect(resp).toMatch(/Driving pressure 16/) // 26-10
    expect(resp).toMatch(/mL\/kg PBW/)
    expect(resp).toMatch(/A\/C VC/)
  })

  it('POCUS: refleja VExUS grado y respuesta a líquidos', () => {
    const s = construirSeccionesUCI({ vci: '2.3', vHep: 'grave', vPor: 'grave', vRen: 'normal', plrDelta: '8', plrParam: 'LVOT_VTI' })
    const us = s.find(x => x.key === 'ultrasonido')!.value
    expect(us).toMatch(/VExUS/)
    expect(us).toMatch(/grado 3/)
    expect(us).toMatch(/no respondedor/)
  })

  it('la discusión del pase va al plan', () => {
    const s = construirSeccionesUCI({}, { discusion: 'Adscrito: bajar volumen' })
    expect(s.find(x => x.key === 'plan')!.value).toMatch(/Adscrito: bajar volumen/)
  })

  it('CKRT va a la sección renal y ECMO a dispositivos', () => {
    const s = construirSeccionesUCI({
      ckrtMod: 'CVVHDF', ckrtPeso: '70', ckrtDial: '1000', ckrtPost: '500', ckrtUf: '150',
      ecmoConf: 'VA', ecmoPre: '260', ecmoPost: '200', ecmoBasal: '25', ecmoSpD: '84', ecmoSpI: '99',
    })
    expect(s.find(x => x.key === 'renal_metabolico')!.value).toMatch(/CKRT CVVHDF/)
    const disp = s.find(x => x.key === 'piel_dispositivos')!.value
    expect(disp).toMatch(/ECMO VA/)
    expect(disp).toMatch(/diferencial|Harlequin|INSPECCIONAR/)
  })
})
