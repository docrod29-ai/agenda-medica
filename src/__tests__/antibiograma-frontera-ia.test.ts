import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma'
import { resumenDeterminista } from '@/lib/expediente/antibiograma/razonar'
import { validarRazonamiento } from '@/lib/expediente/antibiograma/validar-razonamiento'

/**
 * La frontera IA↔motor: el motor manda sobre los HECHOS, el modelo aporta juicio.
 * Estos tests fijan que esa frontera no dependa solo del texto del prompt.
 */
const ENTRADA = {
  organismo: 'Klebsiella pneumoniae',
  resultados: [
    { antibiotico: 'Meropenem', interpretacion: 'R' as const },
    { antibiotico: 'Ceftriaxona', interpretacion: 'R' as const },
    { antibiotico: 'Amikacina', interpretacion: 'S' as const },
  ],
}

describe('el prompt recibe las alertas críticas del motor', () => {
  it('REGRESIÓN: alertas, aislamiento y notificación llegan al resumen', () => {
    // Se omitían: el modelo razonaba sin las consecuencias accionables de su
    // propio motor (infectología obligada, precaución de contacto, NOM-045).
    const r = interpretarAntibiograma(ENTRADA)
    const resumen = resumenDeterminista(ENTRADA, r)
    if (r.alertas.length) expect(resumen).toContain('ALERTAS del motor')
    if (r.aislamiento) expect(resumen.toLowerCase()).toContain('aislamiento')
    if (r.notificacionObligatoria) expect(resumen).toContain('NOTIFICACIÓN OBLIGATORIA')
  })

  it('el panel y los fenotipos siguen estando', () => {
    const r = interpretarAntibiograma(ENTRADA)
    const resumen = resumenDeterminista(ENTRADA, r)
    expect(resumen).toContain('Panel S/I/R')
    expect(resumen).toContain('Meropenem=R')
  })
})

describe('validarRazonamiento — el texto del modelo no puede contradecir los hechos', () => {
  const interp = interpretarAntibiograma(ENTRADA)

  it('detecta que recomienda un fármaco que el panel reporta R', () => {
    const texto = 'TRATAMIENTO PRIORIZADO: iniciar meropenem 2 g cada 8 h en infusión extendida.'
    const c = validarRazonamiento(texto, interp, ENTRADA)
    expect(c.length).toBeGreaterThan(0)
    expect(c.some(x => /meropenem/i.test(x.agente))).toBe(true)
  })

  it('NO marca como contradicción el fármaco que el texto dice EVITAR', () => {
    // Ahí el modelo está coincidiendo con el motor, no contradiciéndolo.
    const texto = 'QUÉ EVITAR Y POR QUÉ: evitar meropenem, la cepa lo hidroliza.'
    expect(validarRazonamiento(texto, interp, ENTRADA)).toHaveLength(0)
  })

  it('un texto coherente no genera ninguna anotación', () => {
    const texto = 'TRATAMIENTO PRIORIZADO: amikacina guiada por CMI, con infectología.'
    expect(validarRazonamiento(texto, interp, ENTRADA)).toHaveLength(0)
  })

  it('detecta la resistencia intrínseca de la especie', () => {
    const entrada = {
      organismo: 'Klebsiella pneumoniae',
      resultados: [{ antibiotico: 'Ampicilina', interpretacion: 'R' as const }],
    }
    const texto = 'Se puede usar ampicilina a dosis altas.'
    const c = validarRazonamiento(texto, interpretarAntibiograma(entrada), entrada)
    expect(c.length).toBeGreaterThan(0)
  })

  it('no revienta con texto vacío ni con panel vacío', () => {
    expect(validarRazonamiento('', interp, ENTRADA)).toHaveLength(0)
    expect(validarRazonamiento('algo', interp, { organismo: '', resultados: [] })).toHaveLength(0)
  })

  it('no duplica la misma anotación aunque el fármaco aparezca varias veces', () => {
    const texto = 'Usar meropenem. Insisto: meropenem en infusión extendida. Meropenem.'
    expect(validarRazonamiento(texto, interp, ENTRADA)).toHaveLength(1)
  })
})

describe('HLAR: exige el tamiz de alto nivel', () => {
  it('REGRESIÓN: gentamicina R de panel rutinario NO es HLAR', () => {
    // El enterococo es intrínsecamente R de bajo nivel a aminoglucósidos: esa R es
    // lo esperado. Declararlo HLAR abandona la sinergia en endocarditis sin base.
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecalis',
      resultados: [
        { antibiotico: 'Ampicilina', interpretacion: 'S' },
        { antibiotico: 'Gentamicina', interpretacion: 'R' },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'HLAR')).toBe(false)
    // Y se pide explícitamente el tamiz que sí lo decide.
    expect((r.advertencias ?? []).join(' ')).toMatch(/alto nivel/i)
  })

  it('el tamiz de alto nivel R SÍ establece HLAR', () => {
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecalis',
      resultados: [
        { antibiotico: 'Ampicilina', interpretacion: 'S' },
        { antibiotico: 'Gentamicina alto nivel', interpretacion: 'R' },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'HLAR')).toBe(true)
  })

  it('REGRESIÓN: una CMI censurada «>500» ya no se lee como 500 exacto', () => {
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecalis',
      resultados: [
        { antibiotico: 'Gentamicina alto nivel', interpretacion: 'R', cmi: 500, cmiCensurada: '>' },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'HLAR')).toBe(true)
  })
})
