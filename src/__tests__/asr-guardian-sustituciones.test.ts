/**
 * GOLDEN — guardián de sustituciones del pipeline clínico de dictado.
 *
 * Los casos críticos vienen de `tests/critical-test-cases.json` del paquete
 * NexusMED_CLINICAL_ASR_PIPELINE_V1 que entregó el Dr. Aquí se prueba la parte
 * que le toca a ESTE módulo: que un intercambio prohibido no pueda salir vivo.
 * La normalización de cifras y unidades («cero punto quince» → 0.15) es otro
 * módulo y tiene sus propios golden.
 *
 * Regla que se está protegiendo: **una corrección que toca una cifra, una
 * unidad, una sigla crítica, una negación o la lateralidad se descarta.**
 */
import { describe, it, expect } from 'vitest'
import { verificar, cifrasLibres } from '@/lib/asr/guardian-sustituciones'
import { corregirVigilado } from '@/lib/asr/corrector-vigilado'
import { PARES_PROHIBIDOS } from '@/lib/asr/politica-critica'

describe('cifrasLibres — distingue una cantidad de un nombre', () => {
  it('captura las cantidades', () => {
    expect(cifrasLibres('Meropenem 2 gramos cada 8 horas')).toEqual(['2', '8'])
    expect(cifrasLibres('norepinefrina 0.15 mcg/kg/min')).toEqual(['0.15'])
    expect(cifrasLibres('plaquetas 48,000')).toEqual(['48.000'])
  })

  it('NO confunde con cantidad los dígitos que forman parte de un nombre', () => {
    // Si los contara, el guardián revertiría correcciones buenas: el corrector
    // canoniza «te cuatro libre» → «T4 libre» y eso está bien.
    for (const nombre of ['T4 libre', 'CD4', 'HbA1c', 'H1N1', 'PaO2', 'cmH2O',
      'COVID-19', 'IL-6', 'CA 19-9', '5-FU', 'vitamina B12', 'anti-PR3']) {
      expect(cifrasLibres(nombre), nombre).toEqual([])
    }
  })
})

describe('El guardián revierte lo que nunca debe cambiar', () => {
  it('REG-065 — una cifra que desaparece revierte la corrección', () => {
    const v = verificar('Meropenem 2 gramos cada 8 horas', 'Meropenem gramos cada 8 horas')
    expect(v.revertido).toBe(true)
    expect(v.texto).toBe('Meropenem 2 gramos cada 8 horas')
    expect(v.violaciones[0].clase).toBe('cambio_dosis')
  })

  it('mg → mcg revierte: es un factor de mil', () => {
    const v = verificar('linezolid 600 mg cada 12 horas', 'linezolid 600 mcg cada 12 horas')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'cambio_unidad')).toBe(true)
  })

  it('PEEP → PIP revierte', () => {
    const v = verificar('PEEP 12, PIP 30', 'PIP 12, PIP 30')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'cambio_modo_ventilador')).toBe(true)
  })

  it('ECMO VV → ECMO VA revierte', () => {
    const v = verificar('paciente en ECMO VV', 'paciente en ECMO VA')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'cambio_tipo_ecmo')).toBe(true)
  })

  it('CVVHDF → CVVHD revierte: cambia el aclaramiento del antibiótico', () => {
    const v = verificar('CKRT en CVVHDF', 'CKRT en CVVHD')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'cambio_modo_ckrt')).toBe(true)
  })

  it('PaO2 → PaCO2 revierte', () => {
    const v = verificar('PaO2 60 y PaCO2 50', 'PaCO2 60 y PaCO2 50')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'sustitucion_analito')).toBe(true)
  })

  it('perder la negación revierte', () => {
    const v = verificar('niega dolor torácico', 'refiere dolor torácico')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'volteo_negacion')).toBe(true)
  })

  it('derecho → izquierdo revierte, y se reporta UNA sola vez', () => {
    const v = verificar('edema de miembro inferior derecho', 'edema de miembro inferior izquierdo')
    expect(v.revertido).toBe(true)
    const lat = v.violaciones.filter(x => x.clase === 'cambio_lateralidad')
    expect(lat).toHaveLength(1)
  })

  it('/h → /min revierte: un factor de sesenta en la infusión', () => {
    const v = verificar('norepinefrina a 5 mL/h', 'norepinefrina a 5 mL/min')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.some(x => x.clase === 'cambio_frecuencia')).toBe(true)
  })

  it('cada par prohibido del paquete se detecta en ambos sentidos', () => {
    for (const p of PARES_PROHIBIDOS) {
      const ida = verificar(`valor ${p.a} final`, `valor ${p.b} final`)
      const vuelta = verificar(`valor ${p.b} final`, `valor ${p.a} final`)
      expect(ida.revertido, `${p.a} → ${p.b}`).toBe(true)
      expect(vuelta.revertido, `${p.b} → ${p.a}`).toBe(true)
    }
  })
})

describe('El guardián NO estorba a las correcciones buenas', () => {
  it('deja pasar la corrección de un fármaco partido', () => {
    const v = verificar('inicia em pagli flozina 10 mg', 'inicia empagliflozina 10 mg')
    expect(v.revertido).toBe(false)
    expect(v.texto).toBe('inicia empagliflozina 10 mg')
  })

  it('deja pasar la canonización de una sigla que el reconocedor destrozó', () => {
    // Aparecer no es violación: escribir CVVHDF donde llegó basura es su trabajo.
    const v = verificar('paciente en cbvhdf', 'paciente en CVVHDF')
    expect(v.revertido).toBe(false)
  })

  it('un nombre con dígitos que aparece no cuenta como cifra inventada', () => {
    const v = verificar('solicito te cuatro libre', 'solicito T4 libre')
    expect(v.revertido).toBe(false)
  })

  it('texto sin cambios no reporta nada', () => {
    const t = 'Paciente estable, sin datos de sangrado.'
    const v = verificar(t, t)
    expect(v.revertido).toBe(false)
    expect(v.violaciones).toHaveLength(0)
    expect(v.requiereConfirmacion).toBe(false)
  })
})

describe('corregirVigilado — el corrector real, con el guardián delante', () => {
  const CRITICOS = [
    'norepinefrina 0.15 mcg/kg/min',
    'PEEP 12, PIP 30',
    'ECMO VV',
    'CKRT en CVVHDF',
    'niega dolor torácico',
    'edema de miembro inferior derecho',
    'potasio 5.8 mmol/L',
    'linezolid 600 mg cada 12 horas',
    'PaO2 60 y PaCO2 50',
    'alergia a penicilina con urticaria',
  ]

  it('ninguno de los casos críticos del paquete pierde una cifra', () => {
    for (const frase of CRITICOS) {
      const r = corregirVigilado(frase)
      expect(cifrasLibres(r.corregido), frase).toEqual(cifrasLibres(frase))
    }
  })

  it('ninguno de los casos críticos del paquete sale revertido', () => {
    // Si alguno revierte es que el corrector está tocando algo que no debe:
    // el guardián lo salva, pero hay que enterarse.
    for (const frase of CRITICOS) {
      const r = corregirVigilado(frase)
      expect(r.revertido, `${frase} → ${r.propuesto}`).toBe(false)
    }
  })

  it('el crudo NUNCA se borra', () => {
    const r = corregirVigilado('inicia em pagli flozina 10 mg')
    expect(r.crudo).toBe('inicia em pagli flozina 10 mg')
    expect(r.propuesto).toContain('empagliflozina')
  })

  it('una dosis sin cantidad pide confirmación aunque nada se haya revertido', () => {
    const r = corregirVigilado('Meropenem gramos cada 8 horas')
    expect(r.revertido).toBe(false)
    expect(r.dosisRotas.length).toBeGreaterThan(0)
    expect(r.requiereConfirmacion).toBe(true)
  })

  it('cuando se revierte, no se anuncian cambios que no se aplicaron', () => {
    const r = corregirVigilado('Meropenem 2 gramos')
    // Este ya no revierte (REG-065), pero el contrato debe cumplirse siempre.
    if (r.revertido) expect(r.cambios).toHaveLength(0)
    else expect(r.corregido).toBe(r.propuesto)
  })
})
