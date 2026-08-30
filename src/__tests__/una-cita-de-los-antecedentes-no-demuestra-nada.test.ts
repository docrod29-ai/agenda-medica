/**
 * GOLDEN — el pasaje existe, es literal, y aun así el estudio no lo demuestra.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * REG-359 cerró la **invención** del respaldo: el pasaje se ancla carácter a
 * carácter contra el texto del artículo, así que el modelo no puede fabricar una
 * cita. Lo que no cerró es la **interpretación**, y hay una forma de citar mal
 * que es a la vez la más común y la única detectable sin un modelo:
 *
 *     citar los ANTECEDENTES de un estudio como si fueran sus hallazgos.
 *
 * Un resumen estructurado empieza casi siempre por «BACKGROUND: se cree que la
 * terapia corta es equivalente…». Eso **no es un resultado**: es lo que se creía
 * antes de hacer el estudio, y a veces es exactamente lo que el estudio vino a
 * refutar. Anclado como cita se lee igual que una conclusión, con su `[2]` al
 * lado, que es el formato que un médico lee como «esto está respaldado».
 *
 * Lo mismo con el OBJETIVO —«este ensayo evalúa si…»— y con los MÉTODOS —«se
 * aleatorizaron 400 pacientes»—: dicen qué se quiso y cómo, no qué se encontró.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * PubMed **lo dice** en el XML (`<AbstractText Label="BACKGROUND">`), y el
 * producto lo tiraba: la expresión que extraía el resumen se comía el atributo
 * (`<AbstractText[^>]*>`) y unía todo en un texto plano. El dato se calculaba y
 * se perdía en la misma función. Misma familia que REG-398.
 *
 * ── LO QUE ESTE GOLDEN **NO** PROTEGE ───────────────────────────────────────
 *
 * **No es un evaluador de entailment**, y decir que lo es sería el atajo que
 * este repositorio persigue. No juzga si el pasaje SIGNIFICA lo que la
 * afirmación dice — eso exige un modelo, su conjunto de referencia y un umbral
 * que tiene que fijar un médico (`ia/contratos-de-evaluacion.ts` lo tiene
 * declarado como pendiente).
 *
 * Es la **precondición**: de dónde sale la frase. Un pasaje de los resultados
 * todavía puede citarse mal; uno de los antecedentes casi siempre lo está.
 *
 * ── LAS DOS REGLAS QUE LO ORDENAN ───────────────────────────────────────────
 *
 * 1. **No se borra nada, se marca.** Igual que lo no respaldado: la afirmación
 *    puede ser cierta y el artículo puede ser el correcto. Lo que no puede es
 *    parecer que ese estudio la demostró.
 * 2. **No saber no es una falta.** Un resumen sin estructura no es un resumen
 *    malo. Marcar por no saber de qué parte sale convertiría la ausencia de dato
 *    en dato de ausencia, y llenaría de avisos las citas correctas hasta que el
 *    médico deje de leerlos.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La polaridad.** «no redujo la mortalidad» citado como «redujo la
 *   mortalidad» sigue pasando si el pasaje sale de los resultados. Es el
 *   siguiente trozo y no se finge hecho.
 * · **El matiz.** «podría reducir» citado como «reduce», igual.
 * · **El texto completo de PMC.** Un pasaje que venga de ahí no está en ninguna
 *   sección del resumen y se devuelve «no se sabe», que es la verdad.
 * · **No mide nada.** No hay conjunto de referencia de citas fuera de contexto;
 *   el contrato de evaluación lo declara como hueco.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  normalizarEtiqueta, puedeSostenerUnaAfirmacion, seccionDelPasaje,
  procedenciaDelPasaje, NO_SE_SABE,
  POR_QUE_NO_ES_ENTAILMENT, POR_QUE_NO_SE_MARCA_LO_QUE_NO_SE_SABE,
} from '@/lib/evidencia/de-donde-sale-el-pasaje'
import {
  verificarAfirmaciones, citasFueraDeLosHallazgos,
  POR_QUE_FUERA_DE_LOS_HALLAZGOS_ES_OTRO_PROBLEMA,
} from '@/lib/evidencia/verificar-la-cita'

const ANTECEDENTES = 'Se cree que la terapia corta es equivalente a la larga en bacteriemia no complicada.'
const RESULTADOS = 'La terapia de 7 dias no fue inferior a la de 14 dias (diferencia 1.2%, IC95% -3.5 a 5.9).'

const ARTICULO = {
  pmid: '38412345',
  titulo: 'Short-course therapy for uncomplicated bacteraemia',
  revista: 'Clinical Infectious Diseases',
  anio: '2024',
  resumen: `${ANTECEDENTES} ${RESULTADOS}`,
  secciones: [
    { etiqueta: 'BACKGROUND', texto: ANTECEDENTES },
    { etiqueta: 'RESULTS', texto: RESULTADOS },
  ],
}

const AHORA = '2026-08-30T12:00:00.000Z'

describe('las etiquetas que escriben las revistas, no las cuatro del manual', () => {
  it('reconoce las canónicas', () => {
    expect(normalizarEtiqueta('BACKGROUND')).toBe('antecedentes')
    expect(normalizarEtiqueta('METHODS')).toBe('metodos')
    expect(normalizarEtiqueta('RESULTS')).toBe('resultados')
    expect(normalizarEtiqueta('CONCLUSIONS')).toBe('conclusiones')
  })

  it('y las que usan las revistas de verdad', () => {
    /**
     * `FINDINGS` e `INTERPRETATION` son de Lancet; `PURPOSE`, de radiología;
     * `PATIENTS AND METHODS`, de las quirúrgicas. Reconocer sólo las cuatro
     * canónicas dejaría media literatura sin sección, que es justo el estado en
     * que este módulo no puede ayudar.
     */
    expect(normalizarEtiqueta('FINDINGS')).toBe('resultados')
    expect(normalizarEtiqueta('INTERPRETATION')).toBe('conclusiones')
    expect(normalizarEtiqueta('PURPOSE')).toBe('objetivo')
    expect(normalizarEtiqueta('PATIENTS AND METHODS')).toBe('metodos')
    expect(normalizarEtiqueta('Objetivos')).toBe('objetivo')
    expect(normalizarEtiqueta('Conclusiones')).toBe('conclusiones')
  })

  it('una etiqueta desconocida NO se coloca en la que más se le parezca', () => {
    /* Adivinar la sección sería inventar la procedencia del pasaje, que es
       exactamente lo que este módulo existe para impedir. */
    expect(normalizarEtiqueta('TRIAL REGISTRATION')).toBe('sin_etiqueta')
    expect(normalizarEtiqueta('')).toBe('sin_etiqueta')
    expect(normalizarEtiqueta(undefined)).toBe('sin_etiqueta')
  })
})

describe('qué parte del artículo puede sostener una afirmación', () => {
  it('los resultados y las conclusiones, sí', () => {
    expect(puedeSostenerUnaAfirmacion('resultados')).toBe(true)
    expect(puedeSostenerUnaAfirmacion('conclusiones')).toBe(true)
  })

  it('los antecedentes, el objetivo y los métodos, NO', () => {
    for (const s of ['antecedentes', 'objetivo', 'metodos'] as const) {
      expect(puedeSostenerUnaAfirmacion(s), s).toBe(false)
    }
  })

  it('y lo que no se sabe NO se marca', () => {
    /**
     * Un resumen sin estructura no es un resumen malo. Si esto devolviera
     * `false`, cada artículo sin secciones saldría con un aviso y el médico
     * dejaría de leerlos — que es como un aviso deja de proteger sin dejar de
     * funcionar.
     */
    expect(puedeSostenerUnaAfirmacion('sin_etiqueta')).toBe(true)
    expect(POR_QUE_NO_SE_MARCA_LO_QUE_NO_SE_SABE).toMatch(/ausencia de dato/)
  })
})

describe('de dónde sale un pasaje ya anclado', () => {
  const partes = ARTICULO.secciones.map(s => ({
    seccion: normalizarEtiqueta(s.etiqueta), etiqueta: s.etiqueta, texto: s.texto,
  }))

  it('lo sitúa en su sección', () => {
    expect(seccionDelPasaje('terapia corta es equivalente', partes)?.seccion).toBe('antecedentes')
    expect(seccionDelPasaje('no fue inferior a la de 14 dias', partes)?.seccion).toBe('resultados')
  })

  it('aguanta que el modelo devuelva el pasaje con otros espacios', () => {
    /* Llega del modelo y puede traer un salto de línea donde el resumen tiene un
       espacio. El anclaje ya comprobó que el texto está; aquí sólo se busca EN
       QUÉ trozo estaba. */
    expect(seccionDelPasaje('terapia corta\n  es   equivalente', partes)?.seccion).toBe('antecedentes')
  })

  it('un pasaje que no está en el resumen devuelve «no se sabe», no un error', () => {
    /* Viene del texto completo de PMC. No saber de dónde sale no lo hace malo. */
    expect(seccionDelPasaje('hazard ratio de 0.81 en el analisis por protocolo', partes)).toBeNull()
    expect(procedenciaDelPasaje('algo que no está', partes)).toBe(NO_SE_SABE)
  })

  it('y la procedencia explica POR QUÉ, no sólo dónde', () => {
    const p = procedenciaDelPasaje('terapia corta es equivalente', partes)
    expect(p.sostiene).toBe(false)
    expect(p.etiqueta).toBe('BACKGROUND')
    expect(p.porQue).toMatch(/lo que se creía antes/)
  })
})

describe('la verificación marca la cita, y NO la confunde con una inventada', () => {
  it('AL REVÉS: sin las secciones no se puede marcar nada', () => {
    /**
     * El estado anterior, reproducido: sin `secciones` el artículo es un texto
     * plano y una cita de los antecedentes pasa indistinguible de una de los
     * resultados.
     */
    const sinEstructura = { ...ARTICULO, secciones: undefined }
    const r = citasFueraDeLosHallazgos(
      [{ texto: 'La terapia corta es equivalente.', citas: [1], pasajes: ['terapia corta es equivalente'] }],
      [sinEstructura],
    )
    expect(r).toEqual([])
  })

  it('con las secciones, la cita de los antecedentes queda marcada', () => {
    const r = citasFueraDeLosHallazgos(
      [{ texto: 'La terapia corta es equivalente.', citas: [1], pasajes: ['terapia corta es equivalente'] }],
      [ARTICULO],
    )
    expect(r).toHaveLength(1)
    expect(r[0].pmid).toBe('38412345')
    expect(r[0].procedencia.seccion).toBe('antecedentes')
  })

  it('y la de los resultados NO se marca', () => {
    /* La defensa no puede volver sospechosa toda cita: entonces no distingue
       nada. */
    const r = citasFueraDeLosHallazgos(
      [{ texto: 'Siete dias no fueron inferiores.', citas: [1], pasajes: ['no fue inferior a la de 14 dias'] }],
      [ARTICULO],
    )
    expect(r).toEqual([])
  })

  it('se marca el PASAJE, no la afirmación entera', () => {
    /* Una afirmación que cita dos artículos y sólo tiene un pasaje flojo no es
       una afirmación sin respaldo. */
    const r = citasFueraDeLosHallazgos(
      [{
        texto: 'La terapia corta sirve.',
        citas: [1, 1],
        pasajes: ['no fue inferior a la de 14 dias', 'terapia corta es equivalente'],
      }],
      [ARTICULO],
    )
    expect(r).toHaveLength(1)
    expect(r[0].procedencia.seccion).toBe('antecedentes')
  })

  it('viaja en la verificación, aparte de lo no respaldado', () => {
    /**
     * Son dos defectos distintos: una cita sin anclar NO EXISTE en el artículo;
     * una anclada en los antecedentes existe y es literal, y aun así no
     * demuestra nada. Mezclarlas escondería la segunda dentro de la primera.
     */
    const v = verificarAfirmaciones(
      [{ texto: 'La terapia corta es equivalente.', citas: [1], pasajes: ['terapia corta es equivalente'] }],
      [ARTICULO], AHORA,
    )
    expect(v.sePudoVerificar).toBe(true)
    expect(v.fueraDeLosHallazgos).toHaveLength(1)
    expect(POR_QUE_FUERA_DE_LOS_HALLAZGOS_ES_OTRO_PROBLEMA).toMatch(/dos defectos distintos/)
  })

  it('sin fuentes utilizables no se inventa una lista', () => {
    const v = verificarAfirmaciones([], [], AHORA)
    expect(v.sePudoVerificar).toBe(false)
    expect(v.fueraDeLosHallazgos).toEqual([])
  })
})

describe('el dato llega desde PubMed hasta el aviso del médico', () => {
  const PUBMED = readFileSync('src/lib/evidencia/pubmed.ts', 'utf8')
  const RUTA = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')

  it('la etiqueta ya no se la come la expresión que extrae el resumen', () => {
    expect(PUBMED).toMatch(/<AbstractText\(\[\^>\]\*\)>/)
    expect(PUBMED).toMatch(/\\bLabel="\(\[\^"\]\*\)"/)
  })

  it('y el `resumen` sigue siendo exactamente lo que era', () => {
    /**
     * Es lo que se le enseña al modelo y contra lo que se ancla la cita:
     * cambiarlo desalinearía el anclaje de REG-359. La sección se AÑADE, no
     * sustituye a nada.
     */
    expect(PUBMED).toMatch(/const resumen = partes\.join\(' '\)\.slice\(0, 1200\)/)
  })

  it('sólo viajan las partes que traen etiqueta', () => {
    /* Fabricar una sección para un resumen sin estructura sería inventar la
       procedencia. */
    expect(PUBMED).toMatch(/const secciones = trozos\.filter\(t => t\.etiqueta\)/)
    expect(PUBMED).toMatch(/\.\.\.\(secciones\.length \? \{ secciones \} : \{\}\)/)
  })

  it('y el médico recibe un aviso PROPIO, no el de las citas inventadas', () => {
    expect(RUTA).toMatch(/verificacion\.fueraDeLosHallazgos\.length > 0/)
    expect(RUTA).toMatch(/no son sus hallazgos/)
  })

  it('el módulo dice, con todas las letras, que NO es entailment', () => {
    /* Dar por cerrado WS-12.entailment con esto sería el atajo. */
    expect(POR_QUE_NO_ES_ENTAILMENT).toMatch(/no juzga si el pasaje significa/i)
    expect(POR_QUE_NO_ES_ENTAILMENT).toMatch(/umbral que tiene que fijar un médico/)
  })
})
