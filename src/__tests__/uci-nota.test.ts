/**
 * Constructor determinista de la nota de evolución UCI: arma por sistemas SIN
 * inventar (secciones sin dato quedan vacías) y refleja los cálculos de los motores.
 */
import { describe, it, expect } from 'vitest'
import { construirSeccionesUCI } from '@/lib/uci/nota'

describe('construirSeccionesUCI', () => {
  it('devuelve las secciones por los 7 sistemas del Dr, en orden', () => {
    const s = construirSeccionesUCI({})
    expect(s.map(x => x.key)).toEqual([
      'contexto', 'neurologico', 'respiratorio', 'hemodinamico', 'abdominodigestivo',
      'hidrometabolico', 'hematoinfeccioso', 'musculoesqueletico', 'analisis', 'plan',
    ])
  })

  it('ANÁLISIS y PLAN son dos secciones distintas', () => {
    /**
     * El Dr.: «el plan deben ser indicaciones; lo que pasas es el análisis».
     *
     * Analisis = que esta pasando y por que. Plan = que se va a HACER: farmaco,
     * dosis, parametro, estudio. Alguien lo ejecuta. Meter razonamiento en la
     * seccion de indicaciones hacia que la nota pareciera ORDENAR algo que nadie
     * ordeno.
     */
    const s = construirSeccionesUCI({})
    expect(s.find(x => x.key === 'analisis')!.label).toBe('Análisis')
    expect(s.find(x => x.key === 'plan')!.label).toBe('Plan e indicaciones')
  })

  it('sin datos: las secciones clínicas quedan vacías (no inventa)', () => {
    const s = construirSeccionesUCI({})
    const by = Object.fromEntries(s.map(x => [x.key, x.value]))
    expect(by.neurologico).toBe('')
    expect(by.respiratorio).toBe('')
    expect(by.hemodinamico).toBe('')
    expect(by.abdominodigestivo).toBe('')
    expect(by.musculoesqueletico).toBe('')
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

  it('POCUS (VExUS/PLR) va al sistema hemodinámico', () => {
    const s = construirSeccionesUCI({ vci: '2.3', vHep: 'grave', vPor: 'grave', vRen: 'normal', plrDelta: '8', plrParam: 'LVOT_VTI' })
    const hemo = s.find(x => x.key === 'hemodinamico')!.value
    expect(hemo).toMatch(/VExUS/)
    expect(hemo).toMatch(/grado 3/)
    expect(hemo).toMatch(/no respondedor/)
  })

  it('la discusión del pase va al ANÁLISIS, no a las indicaciones', () => {
    const s = construirSeccionesUCI({}, { discusion: 'Adscrito: bajar volumen' })
    expect(s.find(x => x.key === 'analisis')!.value).toMatch(/Adscrito: bajar volumen/)
    // El plan queda para lo que el medico ORDENA, y lo escribe el.
    expect(s.find(x => x.key === 'plan')!.value).toBe('')
  })

  it('CKRT va a hidrometabólico y ECMO VA a hemodinámico', () => {
    const s = construirSeccionesUCI({
      ckrtMod: 'CVVHDF', ckrtPeso: '70', ckrtDial: '1000', ckrtPost: '500', ckrtUf: '150',
      ecmoConf: 'VA', ecmoPre: '260', ecmoPost: '200', ecmoBasal: '25', ecmoSpD: '84', ecmoSpI: '99',
    })
    expect(s.find(x => x.key === 'hidrometabolico')!.value).toMatch(/CKRT CVVHDF/)
    const hemo = s.find(x => x.key === 'hemodinamico')!.value
    expect(hemo).toMatch(/ECMO VA/)
    expect(hemo).toMatch(/diferencial|Harlequin|INSPECCIONAR/)
  })
})
