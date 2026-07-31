/**
 * GOLDEN — Clinical Dose Resolver V4 (capa 2).
 *
 * Cada caso comprueba una de las doce reglas del dataset del Dr. sobre un
 * fármaco REAL del catálogo verificado. No se afirma ninguna dosis: se
 * comprueba QUÉ EXIGE el motor antes de dejar que nadie mire una cifra.
 */
import { describe, it, expect } from 'vitest'
import { resolveDoseRule, fusionadas } from '@/lib/antimicrobianos/v4/resolver'
import { FARMACOS } from '@/lib/antimicrobianos/v4/catalogo'
import { evaluar } from '@/lib/antimicrobianos/v4/kernel'
import type { PeticionDosis } from '@/lib/antimicrobianos/v4/tipos'

const reglas = (r: ReturnType<typeof resolveDoseRule>) => r.avisos.map(a => a.regla)

describe('Primero: ¿de qué fármaco estamos hablando?', () => {
  it('un fármaco pendiente dice que está pendiente, no da una dosis', () => {
    const r = resolveDoseRule({ farmaco: 'Ampicillin' })
    expect(r.farmaco).toBeNull()
    expect(r.noResuelve).toMatch(/pendiente/)
    // Y ofrece lo que sí tiene, para que elija una persona.
    expect(r.candidatos).toContain('Ampicillin-sulbactam')
  })

  it('un nombre ambiguo pide precisar en vez de elegir', () => {
    const r = resolveDoseRule({ farmaco: 'Vancomycin' })
    expect(r.farmaco).toBeNull()
    expect(r.noResuelve).toMatch(/ambiguo/)
    expect(r.candidatos).toEqual(expect.arrayContaining(['Vancomycin IV', 'Vancomycin PO']))
  })

  it('sin fármaco no se resuelve nada', () => {
    expect(resolveDoseRule({ farmaco: 'cefalexina' }).noResuelve).toMatch(/No hay una regla verificada/)
  })
})

describe('RULE_SOURCE_SEPARATION: la ficha y la guía no se fusionan', () => {
  it('las dos capas viajan por separado, con sus fuentes', () => {
    const r = resolveDoseRule({ farmaco: 'Meropenem-vaborbactam' })
    expect(r.reglaDosis.label?.texto).toBeTruthy()
    expect(r.reglaDosis.guideline?.texto).toBeTruthy()
    expect(r.reglaDosis.label?.fuentes.length).toBeGreaterThan(0)
  })

  it('cuando difieren de verdad, se dice', () => {
    const distintos = FARMACOS.filter(f => f.label_regimen.trim() !== f.guideline_regimen.trim())
    expect(distintos.length).toBe(3)   // sólo 3 de 49 hoy
    for (const f of distintos) {
      expect(reglas(resolveDoseRule({ farmaco: f.drug }))).toContain('RULE_SOURCE_SEPARATION')
    }
  })

  it('DEFECTO DEL DATASET: 11 entradas traen ficha y guía FUSIONADAS', () => {
    /**
     * `RULE_SOURCE_SEPARATION` es una regla HARD del propio dataset —«guardar la
     * dosis de ficha y la de guía en campos SEPARADOS; si difieren, mostrar las
     * dos con su contexto; nunca fusionarlas»— y once entradas la incumplen: el
     * texto lleva las dos dosis en la misma cadena y está COPIADO en los dos
     * campos. Entre ellas ceftazidima/avibactam («2 h por FDA, 3 h por IDSA») y
     * ceftriaxona («1-2 g q24h, máx 4 g/día; meningitis 2 g q12h»), que son los
     * dos ejemplos con los que se pidió este motor.
     *
     * El motor NO parte la frase: separar «2 h» de «3 h» con una expresión
     * regular es el parseo con consecuencia clínica que este módulo evita. La
     * DECLARA, y la separación la hace quien verifica los datos.
     *
     * La lista va explícita: si mañana se arregla una, este caso se pone rojo y
     * hay que bajar el número a conciencia — que es lo que se quiere.
     */
    const fus = FARMACOS.filter(fusionadas).map(f => f.drug).sort()
    expect(fus).toHaveLength(11)
    expect(fus).toContain('Ceftazidime-avibactam')
    expect(fus).toContain('Ceftriaxone')
    for (const d of fus) {
      const r = resolveDoseRule({ farmaco: d })
      expect(r.avisos.some(a => /fusionadas/.test(a.texto)), d).toBe(true)
    }
  })

  it('46 de 49 tienen los dos campos IDÉNTICOS: la regla casi no se ejercita', () => {
    // No es un error por sí solo, pero explica por qué la separación de fuentes
    // todavía no aporta nada en la práctica: la V4 tiene que llenarla.
    const iguales = FARMACOS.filter(f => f.label_regimen.trim() === f.guideline_regimen.trim())
    expect(iguales).toHaveLength(46)
  })
})

describe('RULE_CRRT_NO_GENERIC: la pauta de CrCl <10 NO es la de CRRT', () => {
  const enCVVHDF: PeticionDosis = {
    farmaco: 'Ceftazidime-avibactam',
    paciente: {
      pesoKg: 78,
      renal: { crcl: 5, crclMetodo: 'cockcroft-gault', uresis: 0 },
      trr: { activa: true, modalidad: 'CVVHDF', efluente: 2700, funcionRenalResidual: 0, horasSinTratamiento: 2 },
    },
  }

  it('un anúrico en CVVHDF no cae a la fila de insuficiencia renal grave', () => {
    /**
     * Si cayera, daría una dosis plausible, ordenada y BAJA — infradosificando
     * al enfermo más grave de la unidad, que es el que menos margen tiene. Que
     * salga «valoración de especialista» es incómodo y es lo correcto.
     */
    const r = resolveDoseRule(enCVVHDF)
    expect(reglas(r)).toContain('RULE_CRRT_NO_GENERIC')
    expect(r.exige.join(' ')).toMatch(/CRRT específica/)
    // Y el kernel lo convierte en un no-pasa, no en una dosis.
    const v = evaluar(enCVVHDF, { porDosis: 2500, tomasPorDia: 3, unidad: 'mg' }, r.contexto)
    expect(v.estado).toBe('UNKNOWN_INSUFFICIENT_DATA')
  })

  it('RULE_RRT_INPUTS: sin modalidad, efluente y paradas no se resuelve', () => {
    const r = resolveDoseRule({ farmaco: 'Ceftazidime-avibactam', paciente: { trr: { activa: true } } })
    expect(r.exige.join(' ')).toMatch(/modalidad/)
  })

  it('un fármaco que SÍ trae regla de CRRT no dispara la alarma', () => {
    // Cefiderocol declara pauta por efluente en su ficha.
    const r = resolveDoseRule({
      farmaco: 'Cefiderocol',
      paciente: { trr: { activa: true, modalidad: 'CVVHDF', efluente: 2500, funcionRenalResidual: 0, horasSinTratamiento: 1 } },
    })
    expect(reglas(r)).not.toContain('RULE_CRRT_NO_GENERIC')
    expect(r.ajustes.some(a => a.que === 'CRRT')).toBe(true)
  })
})

describe('RULE_RENAL_ESTIMATOR: no se cambia un estimador por otro en silencio', () => {
  it('si la fuente ajusta por eGFR y sólo hay CrCl, se avisa', () => {
    const r = resolveDoseRule({
      farmaco: 'Meropenem-vaborbactam',   // su ajuste está escrito en eGFR
      paciente: { renal: { crcl: 40, crclMetodo: 'cockcroft-gault' } },
    })
    expect(reglas(r)).toContain('RULE_RENAL_ESTIMATOR')
  })

  it('sin ninguna medida de función renal, se exige', () => {
    const r = resolveDoseRule({ farmaco: 'Meropenem', paciente: {} })
    expect(r.exige.join(' ')).toMatch(/función renal/)
  })
})

describe('RULE_UNSTABLE_AKI y RULE_ARC', () => {
  it('con la función renal deteriorándose no se mantiene una dosis de estado estable', () => {
    const r = resolveDoseRule({
      farmaco: 'Meropenem',
      paciente: { renal: { crcl: 45, trayectoria: 'deteriorando', akiEstadio: 2 } },
    })
    expect(reglas(r)).toContain('RULE_UNSTABLE_AKI')
  })

  it('CrCl ≥130 activa la revisión por aclaramiento aumentado', () => {
    const r = resolveDoseRule({ farmaco: 'Meropenem', paciente: { renal: { crcl: 160 } } })
    expect(reglas(r)).toContain('RULE_ARC')
    expect(r.ajustes.some(a => a.que === 'aclaramiento aumentado')).toBe(true)
  })
})

describe('RULE_MIC_CONTEXT y RULE_AST_VERSION', () => {
  it('una CMI sin estándar ni versión se marca', () => {
    const r = resolveDoseRule({ farmaco: 'Meropenem', microbiologia: { cmi: 2 }, paciente: { renal: { crcl: 90 } } })
    expect(reglas(r)).toContain('RULE_AST_VERSION')
  })

  it('una CMI CENSURADA no se trata como número exacto', () => {
    // «>2» no es 2: el valor real está por encima del rango medido.
    const r = resolveDoseRule({
      farmaco: 'Meropenem',
      microbiologia: { cmi: 2, cmiOperador: '>', estandarAST: 'CLSI', versionAST: 'M100 Ed36 2026' },
      paciente: { renal: { crcl: 90 } },
    })
    expect(reglas(r)).toContain('RULE_MIC_CONTEXT')
    expect(r.avisos.find(a => a.regla === 'RULE_MIC_CONTEXT')?.texto).toMatch(/censurada/)
  })
})

describe('RULE_TDM y RULE_WEIGHT en los aminoglucósidos', () => {
  it('la monitorización es parte de la regla, no metadato opcional', () => {
    const r = resolveDoseRule({ farmaco: 'Amikacin', paciente: { pesoKg: 70, renal: { crcl: 90 } } })
    expect(reglas(r)).toContain('RULE_TDM')
    expect(r.ajustes.some(a => a.que === 'TDM')).toBe(true)
  })

  it('amikacina sin peso ni función renal: bloqueo por datos, no «sobredosis»', () => {
    const p: PeticionDosis = { farmaco: 'Amikacin', paciente: {} }
    const r = resolveDoseRule(p)
    const v = evaluar(p, { porKg: 20, tomasPorDia: 1 }, r.contexto)
    expect(v.estado).toBe('UNKNOWN_INSUFFICIENT_DATA')
    expect(v.datosFaltantes.join(' ')).toMatch(/función renal/)
  })
})

describe('La estrategia decide el origen, y el origen decide el veredicto', () => {
  it('infusión extendida se marca como PK/PD, no como dosis alta cualquiera', () => {
    const r = resolveDoseRule({
      farmaco: 'Meropenem', estrategia: 'infusion_extendida',
      paciente: { renal: { crcl: 160 }, criticamenteEnfermo: true, sepsisOChoque: true },
    })
    expect(r.contexto.origen).toBe('pkpd')
    expect(reglas(r)).toContain('RULE_BETA_LACTAM_INFUSION')
  })

  it('sin estrategia declarada, el origen es la ficha', () => {
    expect(resolveDoseRule({ farmaco: 'Meropenem' }).contexto.origen).toBe('label')
  })

  it('un fármaco que no está READY lo dice', () => {
    const r = resolveDoseRule({ farmaco: 'Metronidazole' })
    expect(r.avisos.some(a => /CONDITIONAL/.test(a.texto))).toBe(true)
    // Y su falta de fuentes también se declara.
    expect(r.avisos.some(a => /no declara fuentes/.test(a.texto))).toBe(true)
  })
})
