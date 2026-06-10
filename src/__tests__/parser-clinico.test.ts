import { describe, it, expect } from 'vitest'
import {
  normalizar,
  extraerSignosVitales,
  extraerComorbilidades,
  extraerMedicamentosPreop,
  extraerAlergias,
  extraerAntibioticosYPatogenos,
  extraerStopBang,
  extraerEdad,
  estaNegado,
  parsearTranscripcion,
  parserClinicoComoRespuestaIA,
} from '@/lib/expediente/parser-clinico'

describe('normalizar', () => {
  it('quita tildes y baja a minúsculas', () => {
    expect(normalizar('Niño Médico Está Aquí')).toBe('nino medico esta aqui')
  })
  it('colapsa espacios', () => {
    expect(normalizar('  hola    mundo  ')).toBe('hola mundo')
  })
})

describe('extraerSignosVitales', () => {
  it('extrae TA con formato sistólica/diastólica', () => {
    const r = extraerSignosVitales('Paciente con TA 130/80 estable')
    expect(r.ta).toBe('130/80')
  })
  it('extrae FC, FR, SpO2, temperatura, peso, talla', () => {
    const r = extraerSignosVitales(
      'FC 78 lpm, FR 16 rpm, SpO2 95%, temperatura 36.8, peso 72 kg, talla 1.70 m',
    )
    expect(r.fc).toBe(78)
    expect(r.fr).toBe(16)
    expect(r.spo2).toBe(95)
    expect(r.temperatura).toBe(36.8)
    expect(r.peso).toBe(72)
    expect(r.talla).toBe(1.7)
  })
  it('devuelve null cuando no hay datos', () => {
    const r = extraerSignosVitales('paciente refiere dolor abdominal')
    expect(r.fc).toBeNull()
    expect(r.ta).toBe('')
  })
})

describe('estaNegado', () => {
  it('detecta "niega" antes del término', () => {
    const t = 'niega diabetes mellitus tipo 2'
    const idx = t.indexOf('diabetes')
    expect(estaNegado(t, idx)).toBe(true)
  })
  it('detecta "sin antecedente de"', () => {
    const t = 'sin antecedente de hipertensión'
    const idx = t.indexOf('hipertensión')
    expect(estaNegado(t, idx)).toBe(true)
  })
  it('no marca negado si "niega" está lejos', () => {
    const t = 'niega TVP. Presenta diabetes activa.'
    const idx = t.indexOf('diabetes')
    expect(estaNegado(t, idx)).toBe(false)
  })
})

describe('extraerComorbilidades', () => {
  it('extrae HTA y DM positivas', () => {
    const r = extraerComorbilidades('paciente con HTA y diabetes tipo 2')
    expect(r.positivas).toContain('Hipertensión arterial')
    expect(r.positivas).toContain('Diabetes mellitus tipo 2')
    expect(r.preopFlags.hipertension).toBe(true)
    expect(r.preopFlags.diabetes).toBe(true)
  })
  it('separa negadas de positivas', () => {
    const r = extraerComorbilidades('niega EPOC, presenta SAOS')
    expect(r.negadas).toContain('EPOC')
    expect(r.positivas).toContain('SAOS')
    expect(r.preopFlags.epoc).toBe(false)
    expect(r.preopFlags.saos).toBe(true)
  })
})

describe('extraerMedicamentosPreop', () => {
  it('detecta betabloqueador, IECA, estatina', () => {
    const r = extraerMedicamentosPreop('toma metoprolol, losartán y atorvastatina')
    expect(r.preopFlags.tomaBetabloqueador).toBe(true)
    expect(r.preopFlags.tomaIECAoARA).toBe(true)
    expect(r.preopFlags.tomaEstatina).toBe(true)
  })
  it('detecta DOAC y marca tipoAnticoagulante', () => {
    const r = extraerMedicamentosPreop('paciente con apixabán 5 mg cada 12 horas')
    expect(r.preopFlags.tomaAnticoagulante).toBe(true)
    expect(r.preopFlags.tipoAnticoagulante).toBe('DOAC')
  })
  it('detecta warfarina como tipo distinto', () => {
    const r = extraerMedicamentosPreop('en warfarina con INR objetivo 2-3')
    expect(r.preopFlags.tipoAnticoagulante).toBe('warfarina')
  })
})

describe('extraerAlergias', () => {
  it('captura alergia a penicilina', () => {
    const r = extraerAlergias('refiere alergia a penicilina')
    expect(r).toContain('penicilina')
  })
})

describe('extraerAntibioticosYPatogenos', () => {
  it('detecta vocabulario PROA', () => {
    const r = extraerAntibioticosYPatogenos(
      'urocultivo positivo a E. coli BLEE, se inicia meropenem',
    )
    expect(r.antibioticos).toContain('meropenem')
    expect(r.patogenos).toContain('e. coli')
    expect(r.patogenos).toContain('blee')
  })
})

describe('extraerStopBang', () => {
  it('marca ronquido fuerte', () => {
    const r = extraerStopBang('ronca fuerte tras puertas cerradas')
    expect(r.snoring).toBe(true)
  })
  it('marca somnolencia diurna', () => {
    const r = extraerStopBang('refiere somnolencia diurna importante')
    expect(r.tiredness).toBe(true)
  })
  it('marca masculino', () => {
    const r = extraerStopBang('paciente masculino de 55 años')
    expect(r.genderMale).toBe(true)
  })
})

describe('extraerEdad', () => {
  it('captura edad en años', () => {
    expect(extraerEdad('paciente de 67 años de edad')).toBe(67)
    expect(extraerEdad('mujer de 45 años')).toBe(45)
  })
  it('devuelve null si no hay', () => {
    expect(extraerEdad('paciente sin edad documentada')).toBeNull()
  })
})

describe('parsearTranscripcion', () => {
  it('arma resumen estructurado con comorbilidades + negaciones + signos', () => {
    const t = 'Paciente con HTA y diabetes. Niega TVP previa. TA 140/85, SpO2 96%.'
    const r = parsearTranscripcion(t, 'valoracion_preoperatoria')
    expect(r.comorbilidades).toContain('Hipertensión arterial')
    expect(r.signosVitales.ta).toBe('140/85')
    expect(r.resumenClinico).toContain('Antecedentes')
    expect(r.resumenClinico).toContain('Niega')
    expect(r.resumenClinico).toContain('Transcripción original')
  })
  it('para preop arma preopInputs con flags top-level y nested', () => {
    const t = 'Hombre de 65 años con HTA, diabetes y SAOS. Toma metoprolol y apixabán.'
    const r = parsearTranscripcion(t, 'valoracion_preoperatoria')
    expect(r.preopInputs.hipertension).toBe(true)
    expect(r.preopInputs.diabetes).toBe(true)
    expect(r.preopInputs.saos).toBe(true)
    expect(r.preopInputs.tomaBetabloqueador).toBe(true)
    expect(r.preopInputs.tomaAnticoagulante).toBe(true)
    expect(r.preopInputs.tipoAnticoagulante).toBe('DOAC')
    expect(r.preopInputs.edad).toBe(65)
    expect((r.preopInputs.stopbang as Record<string, boolean>).genderMale).toBe(true)
  })
  it('para tipo no-preop NO incluye preopInputs', () => {
    const r = parsearTranscripcion('paciente con HTA', 'evolucion')
    expect(Object.keys(r.preopInputs)).toHaveLength(0)
  })
  it('transcripción vacía devuelve estructura vacía sin reventar', () => {
    const r = parsearTranscripcion('')
    expect(r.resumenClinico).toBe('')
    expect(r.signosVitales.fc).toBeNull()
  })
  it('si no hay datos estructurados, devuelve transcripción cruda como resumen', () => {
    const r = parsearTranscripcion('paciente acude por dolor inespecífico no clasificable')
    expect(r.resumenClinico).toContain('Transcripción')
    expect(r.resumenClinico).toContain('dolor inespecífico')
  })
})

describe('parserClinicoComoRespuestaIA', () => {
  it('devuelve shape compatible con cliente con fallbackLocal=true', () => {
    const r = parserClinicoComoRespuestaIA(
      'Hombre 70 años con HTA y diabetes. TA 135/80.',
      'valoracion_preoperatoria',
    )
    expect(r.ok).toBe(true)
    expect(r.fallbackLocal).toBe(true)
    expect(r.secciones.resumenClinico).toContain('Antecedentes')
    expect(r.signosVitales.ta).toBe('135/80')
    expect(r.preopInputs?.hipertension).toBe(true)
    expect(r.safety.fields_requiring_review.length).toBeGreaterThan(0)
  })
  it('para tipo no-preop deja preopInputs undefined', () => {
    const r = parserClinicoComoRespuestaIA('paciente estable', 'evolucion')
    expect(r.preopInputs).toBeUndefined()
  })
})
