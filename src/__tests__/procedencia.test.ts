import { describe, it, expect } from 'vitest'
import { construirManifiesto, resumenProcedencia, normaliza, POR_QUE_V3 } from '@/lib/expediente/procedencia'

describe('Sello de procedencia', () => {
  it('clasifica dictado (con cita), IA (sin cita) y manual', () => {
    const m = construirManifiesto(
      {
        diagnosticos: [{ descripcion: 'Neumonía adquirida en la comunidad' }, { descripcion: 'Hipertensión' }],
        medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
        alergias: ['Penicilina'],
      },
      {
        diagnosticos: [
          { descripcion: 'Neumonía adquirida en la comunidad', source_quote: 'tiene tos con flema y fiebre', confidence: 'alta' },
          { descripcion: 'Hipertensión', confidence: 'media' }, // sin cita → IA
        ],
        medicamentos: [{ nombre: 'Amoxicilina', source_quote: 'le voy a dar amoxicilina', confidence: 'alta' }],
        // Penicilina NO está en la extracción → manual
      },
      undefined,
      /**
       * v984: LA TRANSCRIPCIÓN ES OBLIGATORIA PARA SELLAR «DICTADO».
       *
       * Antes, sin transcripción se conservaba `dictado` «para no degradar algo
       * que quizá era correcto». El efecto real era el contrario: el sello decía
       * «esto lo dijo el paciente» **sin haber comprobado nada**. Un sello que a
       * veces miente vale menos que ninguno, porque quien lo lee no sabe cuál de
       * las dos veces le tocó.
       *
       * El camino real de la pantalla SÍ la pasa, así que cerrar aquí no degrada
       * ninguna nota: sólo obliga a que la comprobación ocurra.
       */
      { transcripcion: 'tiene tos con flema y fiebre, le voy a dar amoxicilina' },
    )
    const by = Object.fromEntries(m.campos.map(c => [c.valor.split(' ')[0], c.origen]))
    expect(m.campos.find(c => c.valor.startsWith('Neumonía'))!.origen).toBe('dictado')
    expect(m.campos.find(c => c.valor.startsWith('Neumonía'))!.cita).toContain('flema')
    expect(m.campos.find(c => c.valor === 'Hipertensión')!.origen).toBe('ia')
    expect(by['Penicilina']).toBe('manual')
    // `confirmados: 0` porque a esta llamada no se le pasan los vistos buenos del
    // médico — que es como quedan las notas anteriores a que existieran.
    expect(m.resumen).toEqual({ dictado: 2, ia: 1, manual: 1, confirmados: 0, total: 4 })
  })

  it('coincidencia laxa: "cefalea" del dictado cubre "cefalea tensional" final', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Cefalea tensional' }] },
      { diagnosticos: [{ descripcion: 'cefalea', source_quote: 'me duele la cabeza' }] },
      undefined,
      { transcripcion: 'me duele la cabeza desde ayer' },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('SIN transcripción no se sella «dictado», por buena que sea la cita', () => {
    /**
     * Falla cerrado. Una cita perfecta que nadie pudo comprobar es indistinguible
     * de una cita inventada — y el sello existe justamente para distinguirlas.
     */
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Cefalea tensional' }] },
      { diagnosticos: [{ descripcion: 'cefalea', source_quote: 'me duele la cabeza' }] },
    )
    expect(m.campos[0].origen).toBe('ia')
  })

  it('y una cita que NO aparece en la transcripción tampoco se sella', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Cefalea tensional' }] },
      { diagnosticos: [{ descripcion: 'cefalea', source_quote: 'me duele la cabeza' }] },
      undefined,
      { transcripcion: 'vengo por dolor de rodilla' },
    )
    expect(m.campos[0].origen).toBe('ia')
  })

  it('sin extracción, todo es manual', () => {
    const m = construirManifiesto({ diagnosticos: [{ descripcion: 'Diabetes' }] })
    expect(m.resumen.manual).toBe(1)
    expect(m.resumen.dictado).toBe(0)
  })

  it('resumenProcedencia es legible', () => {
    expect(resumenProcedencia({ dictado: 6, ia: 2, manual: 1, total: 9 })).toBe('6 del dictado · 2 de IA · 1 a mano')
    expect(resumenProcedencia({ dictado: 0, ia: 0, manual: 0, total: 0 })).toBe('sin datos estructurados')
  })

  it('normaliza quita acentos y baja a minúsculas', () => {
    expect(normaliza('  Neumonía Atípica ')).toBe('neumonia atipica')
  })
})

/**
 * «LO ACEPTÓ EL MÉDICO» — la mitad que faltaba del sello.
 *
 * De dónde salió un dato y si un humano lo hizo suyo son dos preguntas
 * distintas, y el registro sólo respondía la primera. Guardaba `camposAprobados: 3`,
 * un número suelto: sabía CUÁNTOS había aceptado el médico y no CUÁLES. Ante una
 * revisión, «aprobó tres cosas» no dice nada de la que se discute.
 *
 * La prueba que manda de este bloque es la del DESFASE DE ÍNDICES. Registrar un
 * visto bueno en el diagnóstico equivocado sería un dato falso en el expediente,
 * con la firma del médico encima — peor que no registrar nada.
 */
describe('confirmación del médico, campo por campo', () => {
  const extraction = {
    diagnosticos: [
      { descripcion: 'Faringitis aguda', source_quote: 'le duele la garganta' },
      { descripcion: 'Hipertensión', source_quote: 'trae la presión alta' },
    ],
    medicamentos: [{ nombre: 'Amoxicilina', source_quote: 'le doy amoxicilina' }],
  }

  it('lo aceptado se marca; lo no aceptado queda en `false`, no en indefinido', () => {
    // La diferencia entre «nadie lo aceptó» y «no aplica» es justo la que importa.
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Faringitis aguda' }, { descripcion: 'Hipertensión' }] },
      extraction,
      new Set(['dx:0']),
    )
    expect(m.campos[0].confirmado).toBe(true)
    expect(m.campos[1].confirmado).toBe(false)
    expect(m.resumen.confirmados).toBe(1)
  })

  it('lo escrito a mano no se pregunta: no hay nada que aceptar', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Lumbalgia mecánica' }] },
      extraction,
      new Set(['dx:0']),
    )
    expect(m.campos[0].origen).toBe('manual')
    expect(m.campos[0].confirmado).toBeUndefined()
  })

  it('EL DESFASE DE ÍNDICES: el visto bueno no puede saltar de diagnóstico', () => {
    /**
     * El panel numera sobre la lista de la EXTRACCIÓN; el manifiesto, sobre la
     * lista FINAL. Si el médico rechaza el primer diagnóstico, «Hipertensión»
     * pasa a ser `dx:0` en la nota pero sigue siendo `dx:1` en el panel.
     *
     * Comparar los índices a secas daría por aceptada la Hipertensión con el
     * visto bueno que el médico le dio a la Faringitis. Aquí se comprueba lo
     * contrario: el `dx:0` aprobado corresponde a un diagnóstico que ya NO está
     * en la nota, así que no confirma nada.
     */
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Hipertensión' }] },   // rechazó la faringitis
      extraction,
      new Set(['dx:0']),                                     // aprobó la FARINGITIS
    )
    expect(m.campos[0].valor).toBe('Hipertensión')
    expect(m.campos[0].confirmado).toBe(false)
    expect(m.resumen.confirmados).toBe(0)
  })

  it('…y con el visto bueno correcto sí se registra', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Hipertensión' }] },
      extraction,
      new Set(['dx:1']),
    )
    expect(m.campos[0].confirmado).toBe(true)
  })

  it('los signos vitales se identifican por nombre: ahí no hay desfase posible', () => {
    const m = construirManifiesto(
      { signosVitales: { ta: '120/80' } },
      { signosVitales: { ta: { value: '120/80', source_quote: 'ciento veinte sobre ochenta' } } },
      new Set(['sv:ta']),
    )
    expect(m.campos[0].confirmado).toBe(true)
  })

  it('SIN el conjunto de aprobados, el sello es exactamente el de antes', () => {
    // Compatibilidad: las notas viejas no lo llevan y no deben ganar un `false`
    // que se leería como «el médico no aceptó nada».
    const m = construirManifiesto({ diagnosticos: [{ descripcion: 'Faringitis aguda' }] }, extraction)
    expect(m.campos[0].confirmado).toBeUndefined()
    expect(m.resumen.confirmados).toBe(0)
  })

  it('la frase del sello nombra al médico sólo cuando hubo vistos buenos', () => {
    const con = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Faringitis aguda' }] }, extraction, new Set(['dx:0']),
    )
    expect(resumenProcedencia(con.resumen)).toMatch(/aceptados por el médico/)

    const sin = construirManifiesto({ diagnosticos: [{ descripcion: 'Faringitis aguda' }] }, extraction)
    expect(resumenProcedencia(sin.resumen)).not.toMatch(/aceptados/)
  })
})

/**
 * GOLDEN — las dos formas en que el sello mentía.
 *
 * El sello es lo que un perito lee para saber quién puso cada dato en una nota
 * firmada. Si dice «dictado» sobre algo que el médico escribió, o entrecomilla
 * una frase que nadie dijo, es peor que no existir.
 */
describe('el sello no puede mentir', () => {
  it('una cita que NO está en la transcripción baja el campo a «ia»', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Neumonía' }] },
      { diagnosticos: [{ descripcion: 'Neumonía', source_quote: 'el paciente dijo algo que nunca dijo', confidence: 'alta' }] },
      undefined,
      { transcripcion: 'tiene tos con flema desde el martes' },
    )
    expect(m.campos[0].origen).toBe('ia')
    expect(m.campos[0].cita).toBeUndefined()
  })

  it('con la cita verificada sí queda como «dictado»', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Neumonía' }] },
      { diagnosticos: [{ descripcion: 'Neumonía', source_quote: 'tos con flema', confidence: 'alta' }] },
      undefined,
      { transcripcion: 'Tiene TOS CON FLEMA desde el martes' },   // acentos y mayúsculas no importan
    )
    expect(m.campos[0].origen).toBe('dictado')
    expect(m.campos[0].cita).toBe('tos con flema')
  })

  it('si el médico CORRIGE la dosis, el campo deja de ser «dictado»', () => {
    const m = construirManifiesto(
      { medicamentos: [{ nombre: 'Amoxicilina', dosis: '875 mg' }] },
      { medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', source_quote: 'amoxicilina de 500', confidence: 'alta' }] },
      undefined,
      { transcripcion: 'le voy a dar amoxicilina de 500' },
    )
    expect(m.campos[0].origen).toBe('manual')
    expect(m.campos[0].cita).toBeUndefined()
  })

  it('sin bloque de extracción se puede decir que lo puso la MÁQUINA, no el médico', () => {
    // El parser local no deja extracción: todo salía como «manual», o sea «lo
    // escribió el médico», sobre datos que produjo una máquina.
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Neumonía' }] },
      undefined, undefined,
      { sinExtraccion: 'ia' },
    )
    expect(m.campos[0].origen).toBe('ia')
  })
})

/**
 * ── V3 (v986) · UNA CITA DEL MÉDICO NO PRUEBA UN ANTECEDENTE DEL PACIENTE ────
 *
 * Es la defensa contra el caso que el Dr. encontró en producción, atacado una
 * capa antes que el motor de contradicciones.
 *
 * El interrogatorio se dicta nombrando la enfermedad en la PREGUNTA:
 *
 *     Médico:   «¿Enfermedades crónicas como diabetes o presión alta?»
 *     Paciente: «No.»
 *
 * Un extractor que busca su cita textual la encuentra —«diabetes» está en el
 * dictado, literalmente— y sella el diagnóstico como **dictado**. La cita es
 * verdadera y la conclusión es falsa: quien nombró la enfermedad fue el médico.
 *
 * La v976 lo atrapa DESPUÉS, contrastando. Esto impide que el sello de «lo dijo
 * el paciente» se pueda construir sobre las palabras del médico.
 */
describe('V3 · de quién es la cita', () => {
  const TURNOS = [
    { rol: 'Médico', texto: '¿Enfermedades crónicas como diabetes o presión alta?' },
    { rol: 'Paciente', texto: 'No, ninguna. Vengo por dolor abdominal desde hace tres días.' },
  ]
  const TRANSCRIPCION = TURNOS.map(t => `${t.rol}: ${t.texto}`).join('\n')

  it('un diagnóstico citado del turno del MÉDICO no se sella como dictado', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2' }] },
      { diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', source_quote: 'diabetes o presión alta' }] },
      undefined,
      { transcripcion: TRANSCRIPCION, turnos: TURNOS },
    )
    expect(m.campos[0].origen).toBe('ia')
  })

  it('y uno citado del turno del PACIENTE sí', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Dolor abdominal' }] },
      { diagnosticos: [{ descripcion: 'Dolor abdominal', source_quote: 'dolor abdominal desde hace tres días' }] },
      undefined,
      { transcripcion: TRANSCRIPCION, turnos: TURNOS },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('las alergias también son antecedente del paciente', () => {
    const turnos = [
      { rol: 'Médico', texto: '¿Alergias? ¿Me dijiste que al yodo?' },
      { rol: 'Paciente', texto: 'Nada más.' },
    ]
    const m = construirManifiesto(
      { alergias: ['Yodo'] },
      { alergias: [{ alergeno: 'Yodo', source_quote: '¿Me dijiste que al yodo?' }] },
      undefined,
      { transcripcion: turnos.map(t => t.texto).join('\n'), turnos },
    )
    expect(m.campos[0].origen).toBe('ia')
  })

  it('una DOSIS citada del médico SIGUE siendo dictado — el médico prescribe', () => {
    /**
     * El falso positivo caro. V3 se aplica sólo a antecedentes y diagnósticos:
     * degradar una dosis por venir del turno del médico convertiría la defensa
     * en ruido, porque el médico es quien prescribe.
     */
    const turnos = [{ rol: 'Médico', texto: 'Le voy a dar amoxicilina 500 mg cada 8 horas.' }]
    const m = construirManifiesto(
      { medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }] },
      { medicamentos: [{ nombre: 'Amoxicilina', source_quote: 'le voy a dar amoxicilina' }] },
      undefined,
      { transcripcion: turnos[0].texto, turnos },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('SIN turnos no degrada nada: el manifiesto queda como antes', () => {
    // Un dictado sin separación de voces no puede juzgarse, y castigarlo sería
    // convertir una limitación en un defecto del médico.
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Diabetes' }] },
      { diagnosticos: [{ descripcion: 'Diabetes', source_quote: 'diabetes o presión alta' }] },
      undefined,
      { transcripcion: TRANSCRIPCION },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('si la cita aparece en los DOS turnos, basta con que la diga el paciente', () => {
    const turnos = [
      { rol: 'Médico', texto: '¿Tiene diabetes?' },
      { rol: 'Paciente', texto: 'Sí, tengo diabetes desde hace diez años.' },
    ]
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Diabetes' }] },
      { diagnosticos: [{ descripcion: 'Diabetes', source_quote: 'diabetes' }] },
      undefined,
      { transcripcion: turnos.map(t => t.texto).join('\n'), turnos },
    )
    expect(m.campos[0].origen).toBe('dictado')
  })

  it('la razón está escrita', () => {
    expect(POR_QUE_V3).toMatch(/la cita es verdadera y la conclusión es falsa/)
    expect(POR_QUE_V3).toMatch(/el médico es quien prescribe/)
  })
})
