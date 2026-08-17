/**
 * GOLDEN — el sello contaba con precisión la parte que no había fallado.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El manifiesto de procedencia cubría diagnósticos, medicamentos, alergias y
 * signos vitales: **datos estructurados**. La prosa de las secciones no entraba.
 *
 * Y los tres fallos que el Dr. encontró en producción vivieron **en la prosa**:
 *
 * · «la de la **docencia**» redactado como «**vesícula**».
 * · «¿diabetes o presión alta?» «**No**» redactado como «paciente con DM2 e HTA».
 * · «no se refiere motivo clínico en **este fragmento** de consulta».
 *
 * O sea que el sello decía «6 del dictado · 2 de IA» sobre los campos que no
 * habían fallado, y guardaba silencio sobre los párrafos que sí.
 *
 * ── LO QUE FALTABA ERA MIRAR ─────────────────────────────────────────────────
 *
 * El esquema de extracción trae **desde siempre** cada sección con su `value`,
 * su `confidence` y su `source_quote`. Nadie las leía.
 */
import { describe, it, expect } from 'vitest'
import { construirManifiesto, camposSinEvidencia, MUESTRA_PROSA } from '@/lib/expediente/procedencia'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const DICTADO =
  'Buenos días. Me duele el estómago desde hace tres días, sobre todo después de comer. ' +
  '¿Tiene diabetes o presión alta? No, nada de eso.'

const secOf = (m: ReturnType<typeof construirManifiesto>, id: string) =>
  m.campos.find(c => c.id === id)

describe('LA PROSA ENTRA AL MANIFIESTO', () => {
  it('una sección con cita verificable sale como «del dictado»', () => {
    const m = construirManifiesto(
      { secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Dolor epigástrico de tres días de evolución, posprandial.' }] },
      { secciones: { padecimiento: { value: 'Dolor epigástrico de tres días de evolución, posprandial.', source_quote: 'me duele el estómago desde hace tres días', confidence: 'alta' } } } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    const c = secOf(m, 'prosa:padecimiento')
    expect(c?.origen).toBe('dictado')
    expect(c?.etiqueta).toBe('Padecimiento actual')
  })

  it('una sección cuya cita NO está en el dictado baja a «ia»', () => {
    /**
     * Es el caso «docencia → vesícula»: la frase que respalda el párrafo no
     * existe en lo que se dijo.
     */
    const m = construirManifiesto(
      { secciones: [{ key: 'antecedentes', label: 'Antecedentes', value: 'Colecistectomía previa.' }] },
      { secciones: { antecedentes: { value: 'Colecistectomía previa.', source_quote: 'me operaron de la vesícula hace años', confidence: 'alta' } } } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    expect(secOf(m, 'prosa:antecedentes')?.origen).toBe('ia')
  })

  it('el resumen también se sella', () => {
    const m = construirManifiesto(
      { resumen: 'Paciente con dolor abdominal.' },
      { resumenEjecutivo: { value: 'Paciente con dolor abdominal.', source_quote: 'me duele el estómago desde hace tres días' } } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    expect(secOf(m, 'prosa:resumen')?.origen).toBe('dictado')
  })

  it('una sección vacía no ensucia el manifiesto', () => {
    const m = construirManifiesto({ secciones: [{ key: 'x', label: 'X', value: '   ' }] }, undefined, undefined, {})
    expect(m.campos).toHaveLength(0)
  })
})

describe('LA REGLA V3 SE APLICA DONDE OCURRIÓ EL FALLO', () => {
  const turnos = [
    { rol: 'Médico', texto: '¿Tiene diabetes o presión alta?' },
    { rol: 'Paciente', texto: 'No, nada de eso.' },
  ]

  it('«¿diabetes o presión alta?» «No» NO sostiene un antecedente', () => {
    /**
     * El caso exacto que el Dr. reportó: la enfermedad la nombra la PREGUNTA, y
     * el extractor la cosecha como si el paciente la hubiera afirmado.
     */
    const m = construirManifiesto(
      { secciones: [{ key: 'antecedentes', label: 'Antecedentes personales patológicos', value: 'Diabetes mellitus tipo 2 e hipertensión arterial.' }] },
      { secciones: { antecedentes: { value: 'Diabetes mellitus tipo 2 e hipertensión arterial.', source_quote: '¿Tiene diabetes o presión alta?' } } } as never,
      undefined,
      { transcripcion: DICTADO, turnos },
    )
    expect(secOf(m, 'prosa:antecedentes')?.origen).toBe('ia')
  })

  it('pero el padecimiento actual NO se juzga con esa regla', () => {
    /**
     * En el padecimiento o la exploración, el médico describe lo que ve. Exigir
     * que la cita la sostenga el paciente degradaría prosa correcta — y un sello
     * que degrada de más deja de significar nada.
     */
    const m = construirManifiesto(
      { secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Dolor epigástrico posprandial.' }] },
      { secciones: { padecimiento: { value: 'Dolor epigástrico posprandial.', source_quote: 'me duele el estómago desde hace tres días' } } } as never,
      undefined,
      { transcripcion: DICTADO, turnos },
    )
    expect(secOf(m, 'prosa:padecimiento')?.origen).toBe('dictado')
  })
})

describe('SI EL MÉDICO REESCRIBE EL PÁRRAFO, ES SUYO', () => {
  it('el texto editado sale como «manual», no como dictado', () => {
    // Misma regla que ya se aplicaba a la dosis de un medicamento: seguir
    // diciendo «dictado» sobre algo que el médico cambió es una firma falsa.
    const m = construirManifiesto(
      { secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Dolor epigástrico de CINCO días, reescrito por el médico.' }] },
      { secciones: { padecimiento: { value: 'Dolor epigástrico de tres días.', source_quote: 'me duele el estómago desde hace tres días' } } } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    expect(secOf(m, 'prosa:padecimiento')?.origen).toBe('manual')
  })
})

describe('LO QUE NO CAMBIA', () => {
  it('el aviso de firma sigue cubriendo sólo los tres de siempre', () => {
    /**
     * La prosa entra al sello, no al gate. Una sección resume varias frases y su
     * cita es una sola: meterla en el aviso lo llenaría de párrafos «sin
     * comprobar», y un aviso ruidoso se cierra sin leer — ahí se pierde entero,
     * incluida la alergia que sí importaba.
     */
    const m = construirManifiesto(
      { secciones: [{ key: 'antecedentes', label: 'Antecedentes', value: 'Algo sin respaldo.' }] },
      { secciones: { antecedentes: { value: 'Algo sin respaldo.', source_quote: 'frase que no se dijo jamás aquí' } } } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    expect(secOf(m, 'prosa:antecedentes')?.origen).toBe('ia')
    expect(camposSinEvidencia(m)).toEqual([])
  })

  it('el valor guardado es una muestra, no una copia de la nota', () => {
    // El manifiesto es una tabla de procedencia; el documento ya está al lado.
    const largo = 'a'.repeat(MUESTRA_PROSA + 200)
    const m = construirManifiesto({ secciones: [{ key: 'x', label: 'X', value: largo }] }, undefined, undefined, {})
    expect(m.campos[0].valor.length).toBeLessThanOrEqual(MUESTRA_PROSA + 1)
    expect(m.campos[0].valor.endsWith('…')).toBe(true)
  })

  it('sin secciones, el manifiesto es exactamente el de antes', () => {
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Gastritis' }] },
      { diagnosticos: [{ descripcion: 'Gastritis', source_quote: 'me duele el estómago desde hace tres días' }] } as never,
      undefined,
      { transcripcion: DICTADO },
    )
    expect(m.campos).toHaveLength(1)
    expect(m.campos[0].id).toBe('dx:0')
  })
})

describe('Y LA NOTA SE LA PASA', () => {
  /**
   * La vara se ajustó, y NO a la baja: antes exigía la forma literal del objeto
   * que `/consulta` escribía a mano al firmar. Esa forma se retiró porque era
   * justamente el problema — había tres listas de «qué es una nota para el
   * sello» y sólo ésta llevaba la prosa, así que el registro contaba 7 campos
   * y las dos pantallas 4. Ahora la prosa entra por `notaParaElSello()`.
   *
   * Se comprueban las DOS mitades: que la página se la pase, y que lo haga por
   * la definición compartida. Sin la segunda, esto volvería a pasar con una
   * pantalla que se escribiera su propia copia otra vez.
   */
  it('la consulta manda secciones y resumen al manifiesto, por la definición compartida', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('notaParaElSello({')
    expect(page).toMatch(/secciones,\s*resumen,/)
  })

  it('y `notaParaElSello` es lo que llega al manifiesto en las dos lecturas', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    // el sello que se ARCHIVA
    expect(page).toContain('construirManifiesto(\n          notaDelSello,')
    // el sello que se VE
    expect(page).toContain('final={notaDelSello}')
  })
})
