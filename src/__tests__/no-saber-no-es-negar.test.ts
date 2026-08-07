/**
 * GOLDEN — «no sé» no es «no lo tengo», y «pues no» sí es «no».
 *
 * ── CÓMO SE DESCUBRIÓ (7-ago-2026) ──────────────────────────────────────────
 *
 * Último punto abierto del plan de la auditoría de las nueve dimensiones
 * (hallazgo C2/C3): «faltan negadores del habla real». Antes de tocar nada se
 * pasaron por `condicionesNegadas` diecisiete respuestas de consulta hablada.
 * Fallaron seis. Y al probar la dirección contraria —lo que el motor detecta de
 * MÁS— apareció un defecto peor, que nadie había reportado.
 *
 * ── DEFECTO 1: LA NEGACIÓN QUE NO LLEGABA ───────────────────────────────────
 *
 *     «¿Padece diabetes o hipertensión?  Pues no.»        → NO se detectaba
 *     «¿Tiene diabetes?  Fíjese que no.»                  → NO se detectaba
 *     «¿Es diabético?  Gracias a Dios no.»                → NO se detectaba
 *
 * La expresión anclaba la negativa al principio de la respuesta, y en la
 * consulta casi nadie contesta con el «no» pelado. Como la enfermedad se nombra
 * en la PREGUNTA, perder el «no» deja el antecedente crónico cosechado y
 * confirmado: exactamente el caso que el Dr. encontró el 3-ago y que
 * `negacion-diagnostico-inventado.test.ts` protege — protegido sólo para la
 * forma de respuesta que él dictó aquel día.
 *
 * ── DEFECTO 2, PEOR: EL NEGATIVO QUE NADIE DIJO ─────────────────────────────
 *
 *     «¿Tiene diabetes?  No sé.»          → la condición salía `descartado`
 *     «¿Tiene diabetes?  No me acuerdo.»  → la condición salía `descartado`
 *
 * Reproducido con el motor real llamando a `corregirCertezaPorNegacion`, que es
 * lo que corre en `api/expediente/extraer-entidades`. El paciente decía que no
 * sabía y el expediente escribía que lo había negado, en un campo estructurado
 * que se arrastra a todas las notas siguientes con pinta de dato verificado.
 * Es la regla 4 del charter al revés: ausencia de dato convertida en dato de
 * ausencia. Y la causa era la misma línea: «no sé» empieza por «no».
 *
 * ── DEFECTO 3: «NADA MÁS» NO ES «NADA» ──────────────────────────────────────
 *
 *     «¿Tiene diabetes o hipertensión?  Nada más la diabetes.»
 *
 * El `nada` suelto negaba las DOS. El extractor pasaba a `descartado` la
 * enfermedad que el paciente acababa de afirmar: un antecedente real borrado
 * por una palabra que significaba lo contrario.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El preámbulo admitido es una lista CERRADA de muletillas. «Cualquier cosa
 * antes del no» dejaría entrar «Sí, desde hace diez años, pero no tomo nada»
 * como negación — y el error caro va en esa dirección: perder una negación
 * cuesta un aviso, fabricarla borra un antecedente.
 *
 * La duda se mira ANTES que la negativa, y no reclasifica nada: sale como
 * aviso. Ni se afirma el antecedente ni su ausencia.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo respuestas a una pregunta que nombra la enfermedad, o negación en
 *   línea. «No sabe si tiene diabetes» dicho en tercera persona no se marca
 *   como duda: no se vigila, no se da por bueno.
 * · La duda en línea dentro de la NOTA no se lee: si la nota dice «niega
 *   diabetes» y el paciente dijo «no sé», `contradicciones` lo salta por la
 *   ventana de 60 caracteres. Señala de menos.
 * · La lista de muletillas es vocabulario, no criterio: la que falte deja esa
 *   respuesta sin vigilar.
 * · No se mide sobre corpus. Los casos de aquí son habla de consulta mexicana
 *   escrita a mano, no transcripciones reales — no hay número de cobertura.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas,
  condicionesDudosas,
  contradicciones,
  avisoDeContradiccion,
  corregirCertezaPorNegacion,
  avisosDeDudaDelExtractor,
} from '@/lib/expediente/negaciones'

/** Lo que el extractor devuelve cuando cosecha el término de la pregunta. */
const COSECHADA = [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }]

describe('la negación llega aunque no venga pelada', () => {
  const NIEGAN: [string, string][] = [
    ['pues', '¿Padece diabetes? Pues no.'],
    ['fíjese que', '¿Tiene diabetes? Fíjese que no.'],
    ['muletilla + doctor', '¿Diabetes? Pues fíjese que no, doctor.'],
    ['duda fonética', '¿Diabetes? Mmm, no.'],
    ['gracias a Dios', '¿Es diabético? Gracias a Dios no.'],
    ['para nada', '¿Tiene diabetes? Para nada.'],
    ['qué va', '¿Tiene diabetes? Qué va.'],
    ['el no pelado, que ya funcionaba', '¿Tiene diabetes? No.'],
  ]

  for (const [nombre, dictado] of NIEGAN) {
    it(`«${nombre}» cuenta como negación`, () => {
      expect(condicionesNegadas(dictado).map(n => n.condicion)).toContain('diabetes')
      // Y llega hasta donde cambia algo: la condición cosechada se descarta.
      const { conditions } = corregirCertezaPorNegacion(COSECHADA, condicionesNegadas(dictado))
      expect(conditions[0].certeza).toBe('descartado')
    })
  }

  it('la negación de dos enfermedades en una pregunta alcanza a las dos', () => {
    const n = condicionesNegadas('¿Padece diabetes o hipertensión? Pues no.')
    expect(n.map(x => x.condicion).sort()).toEqual(['diabetes', 'hipertensión arterial'])
  })
})

describe('lo que NO puede contar como negación', () => {
  it('«Sí, desde hace diez años» no es una negación aunque siga un «no»', () => {
    const d = '¿Tiene diabetes? Sí, pero no tomo nada.'
    expect(condicionesNegadas(d)).toEqual([])
    expect(condicionesDudosas(d)).toEqual([])
    const { conditions } = corregirCertezaPorNegacion(COSECHADA, condicionesNegadas(d))
    expect(conditions[0].certeza).toBe('confirmado')
  })

  it('«nada más la diabetes» significa SÓLO la diabetes: no la borra', () => {
    const d = '¿Tiene diabetes o hipertensión? Nada más la diabetes.'
    const { conditions } = corregirCertezaPorNegacion(COSECHADA, condicionesNegadas(d))
    expect(conditions[0].certeza).toBe('confirmado')
  })

  it('«nada de eso» sí niega — el «nada» suelto no se pierde', () => {
    expect(condicionesNegadas('¿Tiene asma? Nada de eso.').map(n => n.condicion)).toContain('asma')
  })
})

describe('no saber no es negar', () => {
  const DUDAS: [string, string][] = [
    ['no sé', '¿Tiene diabetes? No sé.'],
    ['no me acuerdo', '¿Tiene diabetes? No me acuerdo.'],
    ['el «no,» de discurso delante', '¿Tiene diabetes? No, no me acuerdo.'],
    ['no estoy seguro', '¿Tiene diabetes? No estoy seguro.'],
    ['no recuerdo', '¿Tiene diabetes? No recuerdo, doctor.'],
    ['quién sabe', '¿Tiene diabetes? Quién sabe.'],
  ]

  for (const [nombre, dictado] of DUDAS) {
    it(`«${nombre}» NO descarta la condición`, () => {
      expect(condicionesNegadas(dictado)).toEqual([])
      expect(condicionesDudosas(dictado).map(n => n.condicion)).toContain('diabetes')
      const { conditions, corregidas } = corregirCertezaPorNegacion(COSECHADA, condicionesNegadas(dictado))
      expect(conditions[0].certeza).toBe('confirmado')
      expect(corregidas).toEqual([])
    })
  }

  it('y no calla: la duda sale como aviso del extractor', () => {
    const dudosas = condicionesDudosas('¿Tiene diabetes? No me acuerdo.')
    const avisos = avisosDeDudaDelExtractor(COSECHADA, dudosas)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].condicion).toBe('diabetes')
    expect(avisos[0].cita).toContain('acuerdo')
  })

  it('lo que el extractor ya dio por descartado no genera aviso de duda', () => {
    const dudosas = condicionesDudosas('¿Tiene diabetes? No sé.')
    expect(avisosDeDudaDelExtractor([{ texto: 'Diabetes mellitus tipo 2', certeza: 'descartado' }], dudosas)).toEqual([])
  })

  it('«No, y no sé de mi familia» sigue siendo una negación del paciente', () => {
    const d = '¿Tiene diabetes? No, y no sé de mi familia.'
    expect(condicionesNegadas(d).map(n => n.condicion)).toContain('diabetes')
    expect(condicionesDudosas(d)).toEqual([])
  })

  it('«que yo sepa no» es una negación matizada, no una duda', () => {
    const d = '¿Usted es hipertenso? Que yo sepa no.'
    expect(condicionesNegadas(d).map(n => n.condicion)).toContain('hipertensión arterial')
    expect(condicionesDudosas(d)).toEqual([])
  })
})

describe('el aviso dice lo que el paciente dijo, no otra cosa', () => {
  const NOTA = 'Paciente con Diabetes mellitus tipo 2 en control.'

  it('la duda contra la nota se avisa, y sin llamarla negación', () => {
    const dudosas = condicionesDudosas('¿Tiene diabetes? No me acuerdo.')
    const cs = contradicciones(dudosas, NOTA)
    expect(cs).toHaveLength(1)
    const texto = avisoDeContradiccion(cs[0])
    expect(texto).toContain('no lo sabía')
    expect(texto).not.toContain('negación')
  })

  it('la negación de verdad conserva su redacción', () => {
    const cs = contradicciones(condicionesNegadas('¿Tiene diabetes? Pues no.'), NOTA)
    expect(cs).toHaveLength(1)
    expect(avisoDeContradiccion(cs[0])).toContain('negación')
  })

  it('si la nota ya lo niega, no hay contradicción que avisar', () => {
    const cs = contradicciones(condicionesNegadas('¿Tiene diabetes? Pues no.'), 'Niega diabetes e hipertensión.')
    expect(cs).toEqual([])
  })
})

describe('el dato tiene que LLEGAR — los llamadores reales', () => {
  it('la ruta del extractor calcula las dudas y las devuelve', async () => {
    const { readFileSync } = await import('node:fs')
    const ruta = readFileSync('src/app/api/expediente/extraer-entidades/route.ts', 'utf8')
    expect(ruta).toContain('condicionesDudosas(texto)')
    expect(ruta).toContain('avisosDeDudaDelExtractor(conditions, dudosas)')
    expect(ruta).toContain('avisosDeDuda,')
  })

  it('la consulta contrasta la nota contra las negadas Y las dudosas', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(page).toContain('...condicionesNegadas(dictado), ...condicionesDudosas(dictado)')
    expect(page).toContain('avisosDeDuda={avisosDeDuda}')
  })

  it('el panel pinta el aviso de duda', async () => {
    const { readFileSync } = await import('node:fs')
    const panel = readFileSync('src/components/NerPanel.tsx', 'utf8')
    expect(panel).toContain('avisosDeDuda')
    expect(panel).toContain('NO SABER')
  })
})
