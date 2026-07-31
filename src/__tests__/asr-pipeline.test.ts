/**
 * GOLDEN — el pipeline completo de dictado.
 *
 * Los diez casos críticos de `tests/critical-test-cases.json` del paquete del Dr.
 * pasan aquí de principio a fin, en su forma HABLADA, y se comprueba lo que él
 * declaró en cada uno: `must_preserve`, `must_not_confuse`, `must_not_output`.
 *
 * Esta es la prueba que importa: los módulos sueltos pueden estar bien y la
 * cadena estar mal.
 */
import { describe, it, expect } from 'vitest'
import { procesarTranscript } from '@/lib/asr/pipeline'

const p = (t: string) => procesarTranscript(t)

describe('Los diez casos críticos del paquete, de principio a fin', () => {
  it('1 · norepinefrina cero punto quince microgramos por kilo por minuto', () => {
    const r = p('norepinefrina cero punto quince microgramos por kilo por minuto')
    for (const t of ['norepinefrina', '0.15', 'mcg/kg/min']) expect(r.texto).toContain(t)
  })

  it('2 · PEEP doce, PIP treinta — y no se confunden', () => {
    const r = p('PEEP doce, PIP treinta')
    expect(r.texto).toBe('PEEP 12, PIP 30')
  })

  it('3 · ECMO veno venoso → ECMO VV, jamás VA', () => {
    const r = p('ECMO veno venoso')
    expect(r.texto).toContain('ECMO VV')
    expect(r.texto).not.toContain('ECMO VA')
  })

  it('4 · CKRT en CVVHDF — ni CVVH ni CVVHD', () => {
    const r = p('CKRT en CVVHDF')
    expect(r.texto).toContain('CKRT')
    expect(r.texto).toContain('CVVHDF')
    expect(r.texto.replace('CVVHDF', '')).not.toMatch(/CVVHD?\b/)
  })

  it('5 · niega dolor torácico — la negación sobrevive', () => {
    const r = p('niega dolor torácico')
    expect(r.texto).toBe('niega dolor torácico')
    expect(r.texto).not.toContain('refiere')
  })

  it('6 · edema de miembro inferior derecho — el lado sobrevive', () => {
    const r = p('edema de miembro inferior derecho')
    expect(r.texto).toContain('derecho')
    expect(r.texto).not.toContain('izquierdo')
  })

  it('7 · potasio cinco punto ocho milimoles por litro', () => {
    const r = p('potasio cinco punto ocho milimoles por litro')
    for (const t of ['5.8', 'mmol/L']) expect(r.texto).toContain(t)
  })

  it('8 · linezolid seiscientos miligramos cada doce horas', () => {
    const r = p('linezolid seiscientos miligramos cada doce horas')
    for (const t of ['linezolid', '600 mg', '12 horas']) expect(r.texto).toContain(t)
  })

  it('9 · PaO2 sesenta y PaCO2 cincuenta — no se confunden', () => {
    const r = p('pao2 sesenta y paco2 cincuenta')
    expect(r.texto).toBe('PaO2 60 y PaCO2 50')
  })

  it('10 · alergia a penicilina con urticaria', () => {
    const r = p('alergia a penicilina con urticaria')
    for (const t of ['penicilina', 'urticaria']) expect(r.texto).toContain(t)
  })

  it('ninguno de los diez pide confirmación: son casos limpios', () => {
    const casos = [
      'norepinefrina cero punto quince microgramos por kilo por minuto',
      'PEEP doce, PIP treinta', 'ECMO veno venoso', 'CKRT en CVVHDF',
      'niega dolor torácico', 'edema de miembro inferior derecho',
      'potasio cinco punto ocho milimoles por litro',
      'linezolid seiscientos miligramos cada doce horas',
      'pao2 sesenta y paco2 cincuenta', 'alergia a penicilina con urticaria',
    ]
    for (const c of casos) {
      const r = p(c)
      expect(r.requiereConfirmacion, `${c} → ${JSON.stringify(r.motivos)}`).toBe(false)
    }
  })
})

describe('El gate de ambigüedad', () => {
  it('una dosis sin cantidad obliga a preguntar', () => {
    const r = p('Meropenem gramos cada ocho horas')
    expect(r.requiereConfirmacion).toBe(true)
    expect(r.motivos).toContain('dosis_o_unidad_ambigua')
    expect(r.alertas.length).toBeGreaterThan(0)
  })

  it('el texto limpio no pide nada', () => {
    const r = p('Paciente estable, afebril, tolera la vía oral.')
    expect(r.requiereConfirmacion).toBe(false)
    expect(r.motivos).toEqual([])
    expect(r.alertas).toEqual([])
  })
})

describe('Invariantes de la cadena', () => {
  it('el crudo NUNCA se borra', () => {
    const t = 'norepinefrina cero punto quince microgramos por kilo por minuto'
    expect(p(t).crudo).toBe(t)
  })

  it('queda el texto de cada etapa, para poder auditar dónde cambió qué', () => {
    const r = p('dos gramos de meropenem en cvvhdf')
    expect(r.trazas.map(x => x.etapa)).toEqual(['crudo', 'corregido', 'cifras-y-unidades', 'siglas'])
    expect(r.trazas[0].texto).toBe('dos gramos de meropenem en cvvhdf')
    expect(r.trazas[3].texto).toContain('CVVHDF')
  })

  it('un texto sin nada que normalizar sale idéntico', () => {
    const t = 'El paciente refiere mejoría; continúa en control.'
    expect(p(t).texto).toBe(t)
  })

  it('cada cambio de cada etapa queda declarado', () => {
    const r = p('dos gramos en cvvhdf')
    expect(r.cambiosNormalizacion.length).toBeGreaterThan(0)
    expect(r.cambiosSiglas).toEqual([{ antes: 'cvvhdf', despues: 'CVVHDF' }])
  })

  it('una frase larga de UCI no pierde ninguna de sus cifras', () => {
    const r = p('PEEP doce, FiO2 sesenta por ciento, norepinefrina cero punto dos '
      + 'microgramos por kilo por minuto, meropenem dos gramos cada ocho horas')
    for (const t of ['12', '60', '0.2', '2 g', '8 horas']) {
      expect(r.texto, t).toContain(t)
    }
  })
})
