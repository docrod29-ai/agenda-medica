/**
 * GOLDEN — Safety Kernel V4.
 *
 * Los seis escenarios son los que el Dr. escribió al pedir el motor. Cada uno
 * existe porque `if (dose > drug.maxDose)` lo contesta MAL.
 *
 * IMPORTANTE: los límites de estos casos se pasan explícitos, no salen de un
 * catálogo. Aquí se prueba **cómo decide el kernel**, no cuánto vale una dosis:
 * las cifras clínicas viven en el dataset verificado y las valida el médico.
 */
import { describe, it, expect } from 'vitest'
import { evaluar, dejaPasar, unidadAmbigua, datosQueFaltan } from '@/lib/antimicrobianos/v4/kernel'
import type { PeticionDosis } from '@/lib/antimicrobianos/v4/tipos'

const paciente = { pesoKg: 70, renal: { crcl: 90, crclMetodo: 'cockcroft-gault' as const } }

describe('Faltar un dato no es lo mismo que estar mal', () => {
  it('amikacina sin peso → no se puede resolver, no «sobredosis»', () => {
    const p: PeticionDosis = { farmaco: 'Amikacin', via: 'IV', paciente: {} }
    const v = evaluar(p, { porKg: 20, tomasPorDia: 1 }, { exige: ['función renal'] })
    expect(v.estado).toBe('UNKNOWN_INSUFFICIENT_DATA')
    expect(v.datosFaltantes).toContain('peso documentado en kg')
    expect(v.datosFaltantes).toContain('función renal')
    expect(dejaPasar(v)).toBe(false)
  })

  it('colistina 150 mg sin decir CBA o CMS → unidad ambigua', () => {
    // La misma cifra son dos dosis distintas. No es una dosis alta.
    const p: PeticionDosis = { farmaco: 'Colistimethate sodium (colistin)', via: 'IV', paciente }
    const v = evaluar(p, { porDosis: 150, tomasPorDia: 2, unidad: 'mg' })
    expect(v.estado).toBe('UNKNOWN_INSUFFICIENT_DATA')
    expect(v.datosFaltantes.join(' ')).toMatch(/CBA/)
    expect(v.datosFaltantes.join(' ')).toMatch(/CMS/)
  })

  it('pero con la unidad declarada deja de faltar', () => {
    const p: PeticionDosis = { farmaco: 'Colistimethate sodium (colistin)', via: 'IV', paciente }
    expect(unidadAmbigua(p, { porDosis: 150, unidad: 'CBA' })).toEqual([])
    expect(unidadAmbigua({ farmaco: 'Meropenem' }, { porDosis: 2000, unidad: 'mg' })).toEqual([])
  })

  it('sin peso documentado, una dosis en mg/kg no se calcula', () => {
    expect(datosQueFaltan({ farmaco: 'Gentamicin' }, { porKg: 7 })).toContain('peso documentado en kg')
    expect(datosQueFaltan({ farmaco: 'Gentamicin', paciente }, { porKg: 7 })).toEqual([])
  })
})

describe('Estar por encima de lo habitual no es estar mal', () => {
  const limites = {
    usualMaxPorDosis: 1000, usualMaxPorDia: 2000,
    contextualMaxPorDosis: 2000, contextualMaxPorDia: 4000,
    tipoMaximo: 'CONTEXTUAL' as const, unidad: 'mg',
  }

  it('ceftriaxona 2 g q12h en meningitis: alta y válida', () => {
    // Con un maxDose único, éste es el caso que se marca como error todos los días.
    const p: PeticionDosis = { farmaco: 'Ceftriaxone', indicacion: 'meningitis', sitioInfeccion: 'SNC', paciente }
    const v = evaluar(p, { porDosis: 2000, tomasPorDia: 2, unidad: 'mg' }, { limites, origen: 'guideline' })
    expect(v.estado).toBe('VALID_HIGH_DOSE')
    expect(dejaPasar(v)).toBe(true)
    expect(v.alertas[0].nivel).toBe('INFO')          // informa, no interrumpe
    expect(v.alertas[0].mensaje).toMatch(/No es una sobredosis/)
  })

  it('meropenem 2 g q8h en 3 h con ARC: optimización PK/PD', () => {
    const p: PeticionDosis = {
      farmaco: 'Meropenem', estrategia: 'infusion_extendida',
      paciente: { ...paciente, renal: { crcl: 160, aclaramientoAumentado: true }, criticamenteEnfermo: true },
    }
    /**
     * Límites propios: 2 g c/8 h son 6 g al día, y el tope genérico de arriba
     * (4 g/día) los bloquearía. La primera versión de este caso salía roja por
     * eso — la cifra de prueba estaba por debajo de una pauta normal, no el
     * kernel equivocado. Son valores de FIXTURE, no una afirmación clínica.
     */
    const v = evaluar(p, { porDosis: 2000, tomasPorDia: 3, unidad: 'mg' }, {
      limites: { usualMaxPorDia: 3000, contextualMaxPorDia: 6000, tipoMaximo: 'PKPD_DEPENDENT', unidad: 'mg' },
      origen: 'pkpd',
    })
    expect(v.estado).toBe('VALID_PKPD_OPTIMIZED')
    expect(dejaPasar(v)).toBe(true)
  })

  it('daptomicina 10 mg/kg/día: dosis alta respaldada, no sobredosis', () => {
    const p: PeticionDosis = { farmaco: 'Daptomycin', paciente }
    const v = evaluar(p, { porDosis: 700, tomasPorDia: 1, porKg: 10, unidad: 'mg' },
      { limites: { usualMaxPorDia: 420, contextualMaxPorDia: 1000, tipoMaximo: 'CONTEXTUAL', unidad: 'mg' },
        origen: 'off_label_respaldado' })
    expect(v.estado).toBe('VALID_OFF_LABEL_SUPPORTED')
    expect(dejaPasar(v)).toBe(true)
  })

  it('la MISMA cifra sin respaldo de guía ni PK/PD sí avisa', () => {
    /**
     * Lo que decide el veredicto es el ORIGEN de la pauta, no la magnitud.
     * Sin una pauta que lo respalde en este contexto, pasar de lo habitual es
     * exactamente lo que hay que enseñarle al médico — pero avisando, no
     * bloqueando: sigue estando por debajo del máximo del contexto.
     */
    const p: PeticionDosis = { farmaco: 'Ceftriaxone', paciente }
    const v = evaluar(p, { porDosis: 2000, tomasPorDia: 2, unidad: 'mg' }, { limites })
    expect(v.estado).toBe('WARN_ABOVE_USUAL')
    expect(v.alertas[0].nivel).toBe('WARN')
    expect(dejaPasar(v)).toBe(true)   // avisa; la decisión sigue siendo del médico
  })
})

describe('Lo que sí se detiene', () => {
  const limites = {
    usualMaxPorDosis: 1000, usualMaxPorDia: 2000,
    contextualMaxPorDosis: 2000, contextualMaxPorDia: 4000,
    absolutoMaxPorDosis: 4000, absolutoMaxPorDia: 8000,
    tipoMaximo: 'EXPLICIT' as const, unidad: 'mg',
  }

  it('por encima del máximo del contexto: BLOCK', () => {
    const p: PeticionDosis = { farmaco: 'Ceftriaxone', indicacion: 'neumonía', paciente }
    const v = evaluar(p, { porDosis: 3000, tomasPorDia: 2, unidad: 'mg' }, { limites, origen: 'guideline' })
    expect(v.estado).toBe('BLOCK_CONTEXTUAL_MAX')
    expect(dejaPasar(v)).toBe(false)
    // El mensaje nombra la indicación: un tope sin contexto no se puede rebatir.
    expect(v.alertas[0].mensaje).toMatch(/neumonía/)
  })

  it('el techo absoluto manda sobre cualquier respaldo', () => {
    // Ni una guía ni un objetivo PK/PD levantan el techo duro.
    const p: PeticionDosis = { farmaco: 'Ceftriaxone', paciente }
    const v = evaluar(p, { porDosis: 5000, tomasPorDia: 2, unidad: 'mg' }, { limites, origen: 'pkpd' })
    expect(v.estado).toBe('BLOCK_CONTEXTUAL_MAX')
    expect(v.alertas[0].codigo).toBe('SUPERA_MAXIMO_ABSOLUTO')
  })

  it('el total DIARIO también cuenta, no sólo la toma', () => {
    // 1.5 g cada 3 h son 12 g al día con cada toma «dentro de rango».
    const p: PeticionDosis = { farmaco: 'Ceftriaxone', paciente }
    const v = evaluar(p, { porDosis: 1500, tomasPorDia: 8, unidad: 'mg' }, { limites })
    expect(v.estado).toBe('BLOCK_CONTEXTUAL_MAX')
  })
})

describe('Sin regla verificada no se afirma nada', () => {
  it('sin límites: no se dice que esté bien', () => {
    const v = evaluar({ farmaco: 'Algo raro', paciente }, { porDosis: 500, tomasPorDia: 3, unidad: 'mg' })
    expect(v.estado).toBe('UNKNOWN_INSUFFICIENT_DATA')
    expect(dejaPasar(v)).toBe(false)
  })

  it('con la regla pero sin máximo declarado: valoración de especialista', () => {
    // No es lo mismo «no tengo la regla» que «la regla no fija un techo aquí».
    const v = evaluar({ farmaco: 'Cefiderocol', paciente }, { porDosis: 2000, tomasPorDia: 3, unidad: 'mg' },
      { limites: { tipoMaximo: 'NONE' }, fuentes: ['DML_FETROJA_2026'] })
    expect(v.estado).toBe('SPECIALIST_REVIEW')
    expect(v.fuentes).toContain('DML_FETROJA_2026')
  })

  it('una pauta dentro de lo habitual pero que NO es la de la ficha, se dice', () => {
    // §RULE_SOURCE_SEPARATION: que la app y la ficha difieran es información.
    const v = evaluar({ farmaco: 'Ceftazidime-avibactam', paciente },
      { porDosis: 2500, tomasPorDia: 3, unidad: 'mg' },
      { limites: { usualMaxPorDosis: 2500, tipoMaximo: 'EXPLICIT' }, origen: 'guideline' })
    expect(v.estado).toBe('VALID_STANDARD')
    expect(v.alertas.some(a => a.codigo === 'DIFIERE_DE_FICHA')).toBe(true)
  })
})
