/**
 * GOLDEN — el paciente dijo QUE NO y la nota le puso dos enfermedades crónicas.
 *
 * ── EL CASO, DEL DR., EN PRODUCCIÓN (3-ago-2026) ─────────────────────────────
 *
 * En el dictado:
 *
 *     «¿Enfermedades crónicas como diabetes o presión alta?  No.»
 *
 * En el resumen que salió en pantalla:
 *
 *     «Paciente con Hipertensión arterial, Diabetes mellitus tipo 2.»
 *
 * Palabras del Dr.: *«ve claramente dice que no tiene DM2 y le pones que es DM e
 * hipertenso»*.
 *
 * ── POR QUÉ ES EL PEOR DE LOS TRES FALLOS DE ESTA SESIÓN ─────────────────────
 *
 * «Vesícula» era un órgano de más en un padecimiento. Un antecedente crónico
 * inventado es otra cosa: cambia el riesgo quirúrgico, cambia la elección de
 * fármacos y **se arrastra** — los antecedentes se copian a todas las notas
 * siguientes, así que el error se propaga solo y cada copia lo vuelve más
 * creíble.
 *
 * ── POR QUÉ PASA ─────────────────────────────────────────────────────────────
 *
 * El interrogatorio se dicta NOMBRANDO las enfermedades en la pregunta. Un
 * extractor ve «diabetes» y «presión alta» en el texto y las cosecha; el «No» es
 * una palabra corta, en otra frase y dicha por otra persona.
 *
 * ── LA DEFENSA ES DE DOS CAPAS ───────────────────────────────────────────────
 *
 * Una regla en el prompt (barata, ayuda) **y** un motor determinista que
 * contrasta lo negado contra lo afirmado. La regla sola no basta: un prompt es
 * una petición que se cumple casi siempre, y «casi siempre» sobre un antecedente
 * crónico no es suficiente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  condicionesNegadas, contradicciones, avisoDeContradiccion, cronicasEn, CRONICAS,
  POR_QUE_NO_SE_CORRIGE_SOLO, POR_QUE_UN_MOTOR_Y_NO_SOLO_PROMPT,
} from '@/lib/expediente/negaciones'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** El fragmento REAL del dictado de la consulta que falló. */
const DICTADO = `Ok. ¿Alergias? ¿Me dijiste que al yodo? Nada más. Y pues al contraste de los estudios de imagen. Pues sí, me dijeron que era el yodo. Ok. ¿Enfermedades crónicas como diabetes o presión alta? No. ¿Alguna enfermedad por la que tengas que consumir medicamento todos los días? No. ¿Cirugías que te hayan hecho previamente? Sí, la de la docencia, tanto como tal.`

/** Y el resumen REAL que salió. */
const RESUMEN_MALO = 'Paciente con Hipertensión arterial, Diabetes mellitus tipo 2.'

describe('EL CASO EXACTO QUE EL DR. VIO EN PANTALLA', () => {
  it('el motor detecta que negó las dos', () => {
    const n = condicionesNegadas(DICTADO).map(x => x.condicion)
    expect(n).toContain('diabetes')
    expect(n).toContain('hipertensión arterial')
  })

  it('y cazaría el resumen que salió', () => {
    const c = contradicciones(condicionesNegadas(DICTADO), RESUMEN_MALO)
    expect(c.map(x => x.condicion).sort()).toEqual(['diabetes', 'hipertensión arterial'])
  })

  it('el aviso trae LO QUE SE OYÓ y LO QUE SE ESCRIBIÓ', () => {
    /**
     * Sin las dos mitades, el médico tiene que volver al audio para saber de qué
     * se le está hablando — y entre paciente y paciente eso no ocurre.
     */
    const [c] = contradicciones(condicionesNegadas(DICTADO), RESUMEN_MALO)
    const a = avisoDeContradiccion(c)
    expect(a).toMatch(/en el dictado se oyó una negación/)
    expect(a).toMatch(/la nota lo afirma/)
    expect(a).toMatch(/antes de firmar/)
  })

  it('NO decide cuál es la correcta', () => {
    /**
     * Un paciente puede negar una diabetes que sí tiene documentada de hace tres
     * años; entonces la nota tiene razón y el interrogatorio no. Elegir sería
     * tomar una decisión clínica, que no le toca al software.
     */
    const [c] = contradicciones(condicionesNegadas(DICTADO), RESUMEN_MALO)
    expect(avisoDeContradiccion(c)).toMatch(/Revisa cuál corresponde/)
    expect(POR_QUE_NO_SE_CORRIGE_SOLO).toMatch(/decisión clínica del médico/)
  })
})

describe('LO QUE **NO** SE MARCA — el falso positivo caro', () => {
  it('si la nota ya lo escribió bien, no hay alerta', () => {
    // «Niega diabetes e hipertensión» es EXACTAMENTE lo correcto. Alertar aquí
    // enseñaría al médico a descartar la alerta sin leerla.
    const c = contradicciones(condicionesNegadas(DICTADO), 'Antecedentes: niega diabetes e hipertensión arterial.')
    expect(c).toEqual([])
  })

  it('«sin antecedente de diabetes» tampoco alerta', () => {
    const c = contradicciones(condicionesNegadas(DICTADO), 'Sin antecedente de diabetes conocido.')
    expect(c.map(x => x.condicion)).not.toContain('diabetes')
  })

  it('una enfermedad que el paciente SÍ afirmó no entra en la lista de negadas', () => {
    const d = '¿Enfermedades crónicas como diabetes? Sí, diabetes desde hace diez años.'
    expect(condicionesNegadas(d)).toEqual([])
  })

  it('el silencio NO es una negación', () => {
    /**
     * No contestar no es negar. Tratarlo como negación fabricaría un negativo
     * que nadie dijo — el mismo fallo, en espejo.
     */
    const d = '¿Enfermedades crónicas como diabetes o presión alta? Bueno, doctor, mi mamá sí tenía.'
    expect(condicionesNegadas(d)).toEqual([])
  })

  it('una enfermedad nombrada fuera de pregunta y sin negación no se toca', () => {
    const d = 'El paciente acude por dolor. Tiene diabetes de larga evolución.'
    expect(condicionesNegadas(d)).toEqual([])
  })
})

describe('LAS FORMAS EN QUE SE CONTESTA DE VERDAD', () => {
  const casos: [string, string][] = [
    ['¿Padece diabetes? Ninguna.', 'diabetes'],
    ['¿Es hipertenso? Nada.', 'hipertensión arterial'],
    ['¿Ha tenido asma? Nunca.', 'asma'],
    ['¿Enfermedades crónicas como diabetes? No, ninguna.', 'diabetes'],
    ['Niega diabetes.', 'diabetes'],
    ['No tiene hipertensión.', 'hipertensión arterial'],
  ]
  for (const [dictado, esperada] of casos) {
    it(`«${dictado}» → niega ${esperada}`, () => {
      expect(condicionesNegadas(dictado).map(x => x.condicion)).toContain(esperada)
    })
  }

  it('la respuesta puede venir en la frase siguiente o pegada', () => {
    // El dictado corrido no separa turnos, así que se miran las dos.
    expect(condicionesNegadas('¿Diabetes?\nNo.').map(x => x.condicion)).toContain('diabetes')
  })
})

describe('EL VOCABULARIO es vocabulario, no criterio clínico', () => {
  it('reconoce las formas mexicanas de decirlo', () => {
    expect(cronicasEn('¿presión alta?')).toContain('hipertensión arterial')
    expect(cronicasEn('¿es diabético?')).toContain('diabetes')
  })

  it('cada entrada tiene su forma canónica y sus variantes', () => {
    for (const c of CRONICAS) {
      expect(c.canonica.length, c.canonica).toBeGreaterThan(2)
      expect(c.formas.length, c.canonica).toBeGreaterThan(0)
    }
  })

  it('que falte una enfermedad hace que NO se vigile, no que se dé por buena', () => {
    // El motor sólo puede señalar de menos. Es una limitación declarada, no un
    // silencio: si mañana falta «lupus», el caso no se vigila y punto — nunca se
    // afirma que el paciente no lo tenga.
    expect(leer('src', 'lib', 'expediente', 'negaciones.ts'))
      .toMatch(/señalar de menos, nunca de más/)
  })
})

describe('LA DEFENSA ES DE DOS CAPAS', () => {
  it('capa 1 — la regla está en el prompt', () => {
    const p = leer('src', 'lib', 'expediente', 'prompts.ts')
    expect(p).toMatch(/UNA ENFERMEDAD NOMBRADA EN LA PREGUNTA NO ES UN DIAGNÓSTICO/)
    expect(p).toMatch(/JAMÁS en diagnósticos/)
  })

  it('capa 2 — y NO se confía sólo en ella', () => {
    expect(POR_QUE_UN_MOTOR_Y_NO_SOLO_PROMPT).toMatch(/un prompt es una petición/)
  })

  it('el motor está conectado a la pantalla de consulta', () => {
    /**
     * Escrito, probado y sin conectar es el fallo que este repositorio lleva
     * toda la sesión persiguiendo. Aquí sería peor: un guardián apagado se lee
     * como un guardián que no encontró nada.
     */
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('condicionesNegadas(dictado)')
    expect(page).toContain('avisoDeContradiccion')
    expect(page).toContain('La nota afirma algo que en el dictado se negó')
  })

  it('y contrasta contra TODA la nota, no sólo contra el resumen', () => {
    // La contradicción da igual en qué campo aparezca: el expediente se lee
    // entero, y un antecedente falso en «antecedentes» es exactamente el que se
    // arrastra a las notas siguientes.
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toMatch(/\[resumen, diagnosticos\.join\('\. '\), \.\.\.Object\.values\(secciones/)
  })
})

describe('EL CONTRASTE FUNCIONA SOBRE LA NOTA ENTERA', () => {
  it('lo caza aunque esté en antecedentes y no en el resumen', () => {
    const nota = 'Motivo: dolor abdominal.\nAntecedentes: diabetes mellitus tipo 2 en tratamiento.'
    const c = contradicciones(condicionesNegadas(DICTADO), nota)
    expect(c.map(x => x.condicion)).toContain('diabetes')
  })

  it('sin nota que contrastar no inventa contradicciones', () => {
    expect(contradicciones(condicionesNegadas(DICTADO), '')).toEqual([])
  })

  it('sin dictado tampoco', () => {
    expect(condicionesNegadas('')).toEqual([])
  })
})
