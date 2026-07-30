import { describe, it, expect } from 'vitest'
import {
  clasificarConfirmacion,
  planificarConfirmaciones,
  preguntaDeDesambiguacion,
  hayCandidatoCercano,
  CONCEPTOS_NIVEL_1,
  CONCEPTOS_NIVEL_2,
  NIVELES_CONFIRMACION,
  MARGEN_AMBIGUEDAD,
  CONFIANZA_BAJA,
  type SenalesConfirmacion,
} from '@/lib/uci/confirmacion'

/**
 * Decisión ICU-Q4.4 del médico dueño — confirmación basada en riesgo.
 *
 * Los dos ejemplos que él escribió SON el criterio de aceptación:
 *   · «RASS menos cuatro» · confianza 0.98 · contexto neuro → registrar SIN
 *     preguntar, mostrando `RASS −4 ✓`.
 *   · «PEEP ocho» → PEEP 0.73 / PIP 0.68 → preguntar «¿PEEP 8 o PIP 8?».
 *
 * Y la regla que atraviesa todo: «El LLM no toma la decisión final de seguridad.
 * La clasificación debe ser DETERMINISTA.»
 *
 * Datos 100 % sintéticos.
 */

const base = (extra: Partial<SenalesConfirmacion> = {}): SenalesConfirmacion => ({
  concepto: 'peep',
  confianzaVoz: 0.97,
  contextoConcuerda: true,
  plausible: true,
  unidadAmbigua: false,
  seVuelveOrden: false,
  ...extra,
})

// ═══════════════════════════════════════════════════════════════════════
describe('ICU-Q4.4 · EJEMPLO 1 del Dr — RASS −4 con 0.98 NO se pregunta', () => {
  const d = clasificarConfirmacion(base({ concepto: 'rass', confianzaVoz: 0.98 }))

  it('se registra sin interrumpir ← criterio de aceptación', () => {
    expect(d.interrumpeAhora).toBe(false)
    expect(d.nivel).toBe('PASSIVE')
  })

  it('no da motivos, porque no los hay', () => {
    expect(d.motivos).toEqual([])
  })
})

describe('ICU-Q4.4 · EJEMPLO 2 del Dr — «PEEP ocho» con PEEP 0.73 / PIP 0.68', () => {
  const d = clasificarConfirmacion(base({
    concepto: 'peep',
    confianzaVoz: 0.73,
    candidatos: [{ concepto: 'peep', confianza: 0.73 }, { concepto: 'pip', confianza: 0.68 }],
  }))

  it('SÍ pregunta ← criterio de aceptación', () => {
    expect(d.nivel).toBe('CONFIRM_IF_AMBIGUOUS')
    expect(d.interrumpeAhora).toBe(true)
  })

  it('nombra los DOS candidatos en disputa', () => {
    expect(d.candidatosEnDisputa?.map(c => c.concepto)).toEqual(['peep', 'pip'])
  })

  it('la pregunta es la del charter, literal', () => {
    expect(preguntaDeDesambiguacion(8, d.candidatosEnDisputa ?? []))
      .toBe('¿PEEP 8 o PIP 8?')
  })

  it('da los motivos: confianza baja Y candidato cercano', () => {
    expect(d.motivos.join(' · ')).toMatch(/[Cc]onfianza baja/)
    expect(d.motivos.join(' · ')).toMatch(/candidatos.*cerca/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('NIVEL 1 · lo que se vuelve orden se confirma SIEMPRE', () => {
  it.each(CONCEPTOS_NIVEL_1)('«%s» es ALWAYS_CONFIRM aunque la confianza sea perfecta', (concepto) => {
    const d = clasificarConfirmacion(base({ concepto, confianzaVoz: 1 }))
    expect(d.nivel).toBe('ALWAYS_CONFIRM')
  })

  it('un dato cualquiera que se vuelve orden TAMBIÉN sube a nivel 1', () => {
    expect(clasificarConfirmacion(base({ concepto: 'algo', seVuelveOrden: true })).nivel)
      .toBe('ALWAYS_CONFIRM')
  })

  it('NO interrumpe el dictado — se confirma ANTES de guardar la orden', () => {
    // Es la diferencia entre un flujo usable y un modal a media frase. La
    // decisión lo dice: «Se extraen durante el dictado sin interrumpir».
    const d = clasificarConfirmacion(base({ concepto: 'dosis' }))
    expect(d.interrumpeAhora).toBe(false)
    expect(d.motivos[0]).toMatch(/antes de guardar/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('NIVEL 2 · sólo se pregunta si hay una razón concreta', () => {
  it.each(CONCEPTOS_NIVEL_2)('«%s» limpio NO interrumpe', (concepto) => {
    expect(clasificarConfirmacion(base({ concepto })).interrumpeAhora).toBe(false)
  })

  it.each([
    ['confianza baja', { confianzaVoz: 0.5 }, /[Cc]onfianza baja/],
    ['unidad ambigua', { unidadAmbigua: true }, /unidad.*ambigua/i],
    ['valor improbable', { plausible: false }, /improbable/i],
    ['contexto que no concuerda', { contextoConcuerda: false }, /contexto/i],
    ['discrepa del cálculo', { discrepaConCalculo: true }, /motor determinista/i],
  ])('pregunta por %s', (_caso, senal, patron) => {
    const d = clasificarConfirmacion(base(senal))
    expect(d.interrumpeAhora).toBe(true)
    expect(d.motivos.join(' · ')).toMatch(patron)
  })

  it('acumula TODOS los motivos, no sólo el primero', () => {
    const d = clasificarConfirmacion(base({ confianzaVoz: 0.4, unidadAmbigua: true, plausible: false }))
    expect(d.motivos.length).toBeGreaterThanOrEqual(3)
  })

  it('`plausible: null` (no evaluable) NO cuenta como improbable', () => {
    // Un dato que no se puede evaluar no es un dato malo: confundirlos generaría
    // preguntas por todo lo que el sistema aún no sabe validar.
    expect(clasificarConfirmacion(base({ plausible: null })).interrumpeAhora).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('los umbrales están ANCLADOS a los ejemplos, no inventados', () => {
  it('el margen de ambigüedad cubre la separación 0.73 / 0.68 del ejemplo', () => {
    expect(MARGEN_AMBIGUEDAD).toBeGreaterThanOrEqual(0.05)
  })

  it('la confianza baja deja pasar 0.98 y atrapa 0.73 (los dos ejemplos)', () => {
    expect(CONFIANZA_BAJA).toBeGreaterThan(0.73)
    expect(CONFIANZA_BAJA).toBeLessThan(0.98)
  })

  it('son CONSTANTES con nombre, no números sueltos en un `if`', () => {
    // Para que calibrarlos sea un acto explícito y revisable del médico dueño.
    expect(typeof MARGEN_AMBIGUEDAD).toBe('number')
    expect(typeof CONFIANZA_BAJA).toBe('number')
  })

  it('un segundo candidato LEJANO no genera ambigüedad', () => {
    const r = hayCandidatoCercano(0.95, [
      { concepto: 'peep', confianza: 0.95 }, { concepto: 'pip', confianza: 0.20 },
    ])
    expect(r.ambiguo).toBe(false)
    expect(r.enDisputa).toEqual([])
  })

  it('sin candidatos alternativos no hay ambigüedad', () => {
    expect(hayCandidatoCercano(0.9).ambiguo).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('REGLA ANTIFATIGA — nunca cinco preguntas seguidas', () => {
  const cinco: SenalesConfirmacion[] = [
    base({ concepto: 'peep', confianzaVoz: 0.4 }),
    base({ concepto: 'pip', confianzaVoz: 0.4 }),
    base({ concepto: 'fio2', plausible: false }),
    base({ concepto: 'rass', unidadAmbigua: true }),
    base({ concepto: 'dosis' }),           // nivel 1
  ]
  const plan = planificarConfirmaciones(cinco)

  it('se CUENTAN y se resumen en una línea, no se disparan cinco modales', () => {
    expect(plan.resumen).toBe('5 elementos requieren revisión.')
  })

  it('separa lo que va antes de guardar de lo que interrumpe ahora', () => {
    expect(plan.antesDeGuardar).toBe(1)     // la dosis
    expect(plan.interrumpen).toBe(4)
  })

  it('sin nada que revisar NO hay aviso', () => {
    expect(planificarConfirmaciones([base()]).resumen).toBeNull()
  })

  it('el singular está bien escrito', () => {
    expect(planificarConfirmaciones([base({ plausible: false })]).resumen)
      .toBe('1 elemento requiere revisión.')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('forma y determinismo', () => {
  it('los cuatro niveles de la decisión, ni uno más', () => {
    expect([...NIVELES_CONFIRMACION]).toEqual([
      'ALWAYS_CONFIRM', 'CONFIRM_IF_AMBIGUOUS', 'PASSIVE', 'NONE',
    ])
  })

  it('narrativa no crítica no pide nada', () => {
    const d = clasificarConfirmacion({
      concepto: 'secreciones', confianzaVoz: 0.6, contextoConcuerda: true,
      plausible: null, unidadAmbigua: false, seVuelveOrden: false,
    })
    expect(d.nivel).toBe('NONE')
    expect(d.interrumpeAhora).toBe(false)
  })

  it('es DETERMINISTA: la misma entrada da la misma salida', () => {
    // La decisión lo exige: el LLM no toma la decisión final de seguridad.
    const s = base({ confianzaVoz: 0.5, unidadAmbigua: true })
    expect(clasificarConfirmacion(s)).toEqual(clasificarConfirmacion(s))
  })

  it('no muta la señal que recibe', () => {
    const s = base({ confianzaVoz: 0.5 })
    const antes = JSON.stringify(s)
    clasificarConfirmacion(s)
    expect(JSON.stringify(s)).toBe(antes)
  })

  it('la pregunta de desambiguación necesita DOS candidatos', () => {
    expect(preguntaDeDesambiguacion(8, [{ concepto: 'peep', confianza: 0.9 }])).toBeNull()
  })
})
