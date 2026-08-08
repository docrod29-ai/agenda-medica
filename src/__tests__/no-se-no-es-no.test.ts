/**
 * GOLDEN — «No sé» no es «No», y «Pues no» sí es «No».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El motor de negaciones decidía si el paciente había dicho que no con esta
 * línea:
 *
 *     /^\s*(?:ah?,?\s*)?(?:no|nop|ninguna|ninguno|nada|negativo|nunca|…)\b/i
 *
 * Fallaba en las dos direcciones a la vez, y las dos hacen daño:
 *
 * **1. Disparaba de más.** `^no\b` leía «No sé, doctor» como una negación. Ese
 * es literalmente el caso oro `oro-rol-acompanante` (`src/lib/ia/casos-oro.ts`):
 * el médico pregunta por la diabetes, la paciente contesta «No sé, doctor» y
 * **el acompañante la confirma acto seguido**. El motor afirmaba que la paciente
 * lo había negado, y `corregirCertezaPorNegacion` reclasificaba a `descartado`
 * una diabetes referida y cierta. Igual con «No me acuerdo», «No estoy seguro»,
 * «No recuerdo», «No tengo idea», «No sabría decirle».
 *
 * **2. Disparaba de menos.** De las formas en que de verdad se contesta que no
 * en una consulta mexicana sólo entraba la escueta. Se quedaban fuera «Pues no,
 * doctor», «Fíjese que no», «Para nada», «Tampoco», «Mmm no», «Este, no», «Ay
 * no» — y cada una de ésas es el fallo original de REG-153: la nota cosecha
 * «diabetes» de la PREGUNTA y le fabrica al paciente un antecedente crónico que
 * se arrastra a todas las notas siguientes.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * 6-ago-2026, hallazgo C2/C3 de la auditoría de nueve dimensiones. Reproducido
 * antes de tocar nada, con el motor real y no con el informe: de veinte
 * respuestas de habla real, siete se leían al revés de como se dijeron.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Una lista de palabras haciendo de modelo del habla. El habla real trae
 * muletillas delante («pues», «este», «fíjese que») y trae formas de negar que
 * no empiezan por «no» («tampoco», «para nada»); y trae, sobre todo, un «no» que
 * no niega nada porque va pegado a un verbo de saber.
 *
 * Ahora se quita el relleno y se juzga el núcleo, y la DUDA se comprueba
 * **antes** que la negación, porque todas sus formas empiezan por «no».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Regla 4 de seguridad clínica: ausencia de dato no es dato de ausencia — y
 * **duda tampoco**. Un «no sé» no autoriza a mover la certeza en ninguna
 * dirección: hacia `descartado` borra lo que el acompañante confirmó, y hacia
 * `confirmado` le inventa al paciente una afirmación que no hizo. Se señala y
 * decide el médico, igual que con los avisos temporales.
 *
 * Y regla 5: señalar de menos, nunca de más. Por eso «nada más el asma» queda
 * fuera de las negativas — es un recorte que AFIRMA el asma, no una negación.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 * · No mide cobertura del habla real. `MULETILLAS` y `DUDA` son vocabulario, no
 *   criterio: lo que falte no se vigila. Sin corpus de consulta ambulatoria con
 *   diálogo (bloqueador B-02) no hay número que ponerle.
 * · No cubre el dictado con turnos etiquetados («Paciente: No sé»). Hoy el texto
 *   que llega a este motor es el `text` corrido del reconocedor, sin etiquetas;
 *   con etiquetas el ancla `^` no ve la respuesta y el motor calla entero. Es un
 *   hueco distinto y anterior a éste.
 * · No decide si el paciente tiene la enfermedad. Nunca lo hizo y sigue sin
 *   hacerlo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NIVEL, construirAvisos } from '@/lib/expediente/avisos-consulta'
import {
  condicionesNegadas, condicionesInciertas,
  contradicciones, afirmacionesSobreLoQueNoSabe,
  avisoDeDuda, avisosDeDudaDelExtractor, corregirCertezaPorNegacion,
  POR_QUE_LA_DUDA_NO_SE_RECLASIFICA,
} from '@/lib/expediente/negaciones'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** El caso oro `oro-rol-acompanante`, tal como está escrito en `casos-oro.ts`. */
const ORO = '¿Ha tenido diabetes? No sé, doctor. Sí, es diabética desde hace años, yo le pongo la insulina.'

describe('«NO SÉ» NO ES UNA NEGACIÓN', () => {
  it('el caso oro: la paciente no sabe y el motor ya NO dice que negó', () => {
    expect(condicionesNegadas(ORO).map(x => x.condicion)).toEqual([])
    expect(condicionesInciertas(ORO).map(x => x.condicion)).toEqual(['diabetes'])
  })

  it('la diabetes que el acompañante confirmó ya no se reclasifica a descartado', () => {
    /**
     * Éste es el daño concreto: la ruta `extraer-entidades` corría
     * `corregirCertezaPorNegacion` con lo «negado» y bajaba a `descartado` una
     * condición que el acompañante acababa de confirmar. Una entidad
     * estructurada tiene peor pinta que una frase: parece un dato verificado.
     */
    const cond = [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }]
    const r = corregirCertezaPorNegacion(cond, condicionesNegadas(ORO))
    expect(r.conditions[0].certeza).toBe('confirmado')
    expect(r.corregidas).toEqual([])
  })

  it('las seis formas de no acordarse tampoco niegan', () => {
    const dudas = [
      '¿Tiene diabetes? No sé.',
      '¿Es diabético? No estoy seguro.',
      '¿Tiene diabetes? No me acuerdo.',
      '¿Tiene diabetes? No recuerdo.',
      '¿Tiene diabetes? No tengo idea.',
      '¿Tiene diabetes? No sabría decirle.',
    ]
    for (const d of dudas) {
      expect(condicionesNegadas(d), d).toEqual([])
      expect(condicionesInciertas(d).map(x => x.condicion), d).toEqual(['diabetes'])
    }
  })

  it('«no que yo sepa» SIGUE siendo una negación', () => {
    /**
     * Es una negación con reserva, no una duda, y el módulo la trataba así desde
     * el principio: `que yo sepa no` estaba en la lista original. Meterla en la
     * duda al arreglar lo de al lado habría sido una regresión silenciosa.
     */
    expect(condicionesNegadas('¿Tiene diabetes? No que yo sepa.').map(x => x.condicion)).toEqual(['diabetes'])
    expect(condicionesNegadas('¿Tiene diabetes? Que yo sepa no.').map(x => x.condicion)).toEqual(['diabetes'])
  })

  it('si además lo niega de frente en otra pregunta, gana la negación', () => {
    // Una respuesta clara vale más que un «no sé» anterior; y el médico no
    // debería recibir los dos avisos sobre la misma enfermedad.
    const t = '¿Tiene diabetes? No sé. ¿O sea que no es diabético? No, no soy.'
    expect(condicionesNegadas(t).map(x => x.condicion)).toEqual(['diabetes'])
    expect(condicionesInciertas(t)).toEqual([])
  })
})

describe('LA DUDA SE SEÑALA, NO SE CORRIGE', () => {
  it('sobre la nota: se pide el respaldo, no se acusa de error', () => {
    const inciertas = condicionesInciertas(ORO)
    const [c] = afirmacionesSobreLoQueNoSabe(inciertas, 'Antecedentes: diabetes mellitus tipo 2 en tratamiento con insulina.')
    expect(c).toBeTruthy()
    const aviso = avisoDeDuda(c)
    expect(aviso).toMatch(/dijo no saberlo/)
    expect(aviso).toMatch(/déjalo escrito/)
    // No afirma que la nota se equivoque: el acompañante puede tener razón.
    expect(aviso).not.toMatch(/negación|se contradicen|corrige/)
  })

  it('sobre el extractor: sólo lo que viaja como CONFIRMADO', () => {
    /**
     * `sospecha`, `descartado` e `historia` ya declaran su propia reserva.
     * Repetírsela al médico es la fatiga de alerta que costó REG-181.
     */
    const inciertas = condicionesInciertas(ORO)
    const avisos = avisosDeDudaDelExtractor([
      { texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' },
      { texto: 'Diabetes mellitus tipo 2', certeza: 'sospecha' },
      { texto: 'Diabetes mellitus tipo 2', certeza: 'descartado' },
      { texto: 'Hipertensión arterial', certeza: 'confirmado' },
    ], inciertas)
    expect(avisos.map(a => a.texto)).toEqual(['Diabetes mellitus tipo 2'])
  })

  it('sin duda no hay aviso, y una nota que no la afirma tampoco', () => {
    expect(avisosDeDudaDelExtractor([{ texto: 'Diabetes', certeza: 'confirmado' }], [])).toEqual([])
    const inciertas = condicionesInciertas(ORO)
    expect(afirmacionesSobreLoQueNoSabe(inciertas, 'Antecedentes: niega tabaquismo.')).toEqual([])
  })

  it('el porqué de no reclasificar está escrito y nombra las dos direcciones', () => {
    expect(POR_QUE_LA_DUDA_NO_SE_RECLASIFICA).toMatch(/descartado/)
    expect(POR_QUE_LA_DUDA_NO_SE_RECLASIFICA).toMatch(/confirmado/)
    expect(POR_QUE_LA_DUDA_NO_SE_RECLASIFICA).toMatch(/acompañante/)
  })
})

describe('LAS FORMAS REALES DE DECIR QUE NO — antes se perdían', () => {
  /**
   * Cada una de éstas devolvía `[]`, y `[]` aquí significa que la nota puede
   * escribir «Diabetes mellitus tipo 2» sin que nadie lo note. Es el fallo
   * original de REG-153, vivo por otra puerta.
   */
  const negativas = [
    '¿Padece diabetes o hipertensión? Pues no, doctor.',
    '¿Tiene diabetes? Fíjese que no.',
    '¿Tiene diabetes? Fíjate que no.',
    '¿Es diabético? Para nada.',
    '¿Es diabético? Tampoco.',
    '¿Tiene diabetes? Mmm no.',
    '¿Tiene diabetes? Este, no.',
    '¿Tiene diabetes? Ay no.',
    '¿Tiene diabetes? Bueno, no.',
    '¿Tiene diabetes? Mire, no.',
    '¿Tiene diabetes? En absoluto.',
    '¿Tiene diabetes? Jamás.',
  ]

  it('las doce se reconocen como negación', () => {
    for (const t of negativas) {
      expect(condicionesNegadas(t).map(x => x.condicion), t).toContain('diabetes')
    }
  })

  it('y ninguna de las doce se confunde con una duda', () => {
    for (const t of negativas) expect(condicionesInciertas(t), t).toEqual([])
  })

  it('el aviso llega hasta el texto que ve el médico', () => {
    const negadas = condicionesNegadas('¿Padece diabetes? Pues no, doctor.')
    const [c] = contradicciones(negadas, 'Paciente con Diabetes mellitus tipo 2.')
    expect(c.condicion).toBe('diabetes')
  })
})

describe('LO QUE **NO** SE MARCA — los falsos positivos que se buscaron a propósito', () => {
  it('«nada más el asma» AFIRMA el asma; no niega las tres', () => {
    /**
     * El candado más caro de este cambio. A «¿diabetes, hipertensión o asma?» la
     * respuesta «nada más el asma» es un recorte, no una negación: sin el
     * `(?!\s+mas\b)` el núcleo `nada` marcaba las tres como negadas — incluida la
     * que el paciente acababa de reconocer.
     */
    const t = '¿Tiene diabetes, hipertensión o asma? Nada más el asma.'
    expect(condicionesNegadas(t)).toEqual([])
  })

  it('un «sí» con muletilla delante no se vuelve negación al quitarle el relleno', () => {
    for (const t of ['¿Tiene diabetes? Pues sí.', '¿Tiene diabetes? Este, sí, desde hace años.', '¿Tiene diabetes? Fíjese que sí.']) {
      expect(condicionesNegadas(t), t).toEqual([])
      expect(condicionesInciertas(t), t).toEqual([])
    }
  })

  it('el silencio no es una negación', () => {
    expect(condicionesNegadas('¿Tiene diabetes?')).toEqual([])
    expect(condicionesInciertas('¿Tiene diabetes?')).toEqual([])
  })

  it('el dictado del caso original sigue detectándose igual', () => {
    // Regresión al revés: el arreglo no puede llevarse por delante lo que ya
    // funcionaba. Es el fragmento REAL de la consulta que falló el 3-ago.
    const dictado = 'Ok. ¿Enfermedades crónicas como diabetes o presión alta? No. ¿Alguna enfermedad por la que tengas que consumir medicamento todos los días? No.'
    expect(condicionesNegadas(dictado).map(x => x.condicion).sort())
      .toEqual(['diabetes', 'hipertensión arterial'])
  })
})

describe('EL DATO TIENE QUE LLEGAR', () => {
  it('la barra declara su nivel y NO bloquea la firma', () => {
    /**
     * Qué bloquea la firma lo decidió el médico dueño el 5-ago con el dato
     * delante. Una duda del paciente es lo más débil de la pantalla: entra como
     * `revisa` y se puede plegar con «Ya lo revisé».
     */
    expect(NIVEL.duda_del_paciente).toBe('revisa')
    const avisos = construirAvisos({ dudas: [{ condicion: 'diabetes', mensaje: 'x' }] })
    expect(avisos.map(a => a.id)).toEqual(['duda:diabetes'])
    expect(avisos[0].descartable).toBe(true)
    expect(avisos[0].nivel).toBe('revisa')
  })

  it('la barra sabe olvidarlo cuando el médico lo revisa', () => {
    const avisos = construirAvisos({
      dudas: [{ condicion: 'diabetes', mensaje: 'x' }],
      revisados: new Set(['duda:diabetes']),
    })
    expect(avisos).toEqual([])
  })

  it('la ruta del extractor lo calcula y lo devuelve', () => {
    /**
     * Escrito y sin conectar es el fallo que este repositorio comete más: el
     * motor existe, nadie lo llama, y la prueba del motor pasa en verde.
     */
    const ruta = leer('src', 'app', 'api', 'expediente', 'extraer-entidades', 'route.ts')
    expect(ruta).toContain('avisosDeDudaDelExtractor(conditions, condicionesInciertas(texto))')
    expect(ruta).toMatch(/\n\s+avisosDuda,/)
  })

  it('la consulta lo recoge, lo pinta en la barra y lo pasa al panel', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('const inciertas = condicionesInciertas(dictado)')
    expect(page).toContain('afirmacionesSobreLoQueNoSabe(inciertas, textoNota)')
    expect(page).toContain('dudas: dudasNota.map(')
    expect(page).toContain('setAvisosDuda(')
    expect(page).toContain('avisosDuda={avisosDuda}')
  })

  it('el panel de entidades lo enseña y dice que no tocó nada', () => {
    const panel = leer('src', 'components', 'NerPanel.tsx')
    expect(panel).toContain('avisosDuda')
    expect(panel).toMatch(/el paciente dijo no saberlo/)
    expect(panel).toMatch(/No se tocaron/)
  })
})
