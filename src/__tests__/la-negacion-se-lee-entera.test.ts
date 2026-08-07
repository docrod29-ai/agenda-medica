/**
 * GOLDEN — la respuesta se lee entera, no por su primera palabra.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El motor de negaciones (REG-«el paciente dijo que no», 3-ago-2026) decidía si
 * una respuesta negaba mirando si EMPEZABA por una palabra negativa:
 *
 *     /^\s*(?:ah?,?\s*)?(?:no|nop|ninguna|ninguno|nada|negativo|nunca|…)\b/
 *
 * Eso falla en los dos sentidos a la vez.
 *
 * **Se escapaban negaciones reales.** Casi nadie contesta «No.» a secas: dice
 * «Pues no», «Fíjese que no», «Para nada», «Qué va», «Gracias a Dios no»,
 * «Tampoco», o el transcriptor mete un guion de turno («— No») y la palabra deja
 * de ser la primera. Con la respuesta perdida, la defensa entera no corría y el
 * antecedente crónico inventado —el fallo original— volvía a pasar.
 *
 * **Y se señalaban negaciones que nadie dijo, que es peor.** «¿Desde cuándo
 * tiene diabetes? **No hace mucho**, como dos años» empieza por «no» y afirma.
 * Igual «Nunca la he dejado de tomar» y «Nada más esa, sí».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Estaba anotado como C2/C3 en el plan de la auditoría de las nueve dimensiones
 * (`docs/maintenance/PROGRAMA-NOCTURNO-IA-2026-08-05.md`), y se reprodujo con el
 * motor real antes de tocar nada: de 22 formas de negar del habla mexicana, 9 se
 * perdían; y de 6 respuestas afirmativas que empiezan con palabra negativa, 4 se
 * leían como negación.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Un prefijo no es una respuesta. La palabra negativa puede llegar detrás de una
 * muletilla, y puede ir seguida de lo que convierte la frase en afirmación.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Los dos sentidos acaban en lo mismo: un antecedente crónico equivocado que se
 * arrastra a todas las notas siguientes. Por un lado la diabetes que el paciente
 * negó entra como confirmada; por el otro `corregirCertezaPorNegacion` degradaba
 * a **descartado** una diabetes que el paciente acababa de confirmar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Delante del «no» sólo se admite una **lista cerrada** de muletillas y el
 *    signo de turno. Cualquier prefijo dejaría pasar «Sí, pero no…».
 * 2. Detrás, la negación tiene que **cerrar**: puntuación y más negaciones, o
 *    una de las frases negativas conocidas.
 * 3. Si en la respuesta hay una afirmación, no se decide nada. Señalar de menos,
 *    nunca de más (`clinical-safety.md` §5).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - **Dictado sin acentos**: la marca de afirmación busca «sí» acentuado, porque
 *   sin acento se confunde con la conjunción «si». Un transcriptor que no
 *   acentúe pierde esa protección.
 * - **Vocabulario, no criterio**: las muletillas, las negaciones y las frases
 *   negativas son listas. Que falte una forma significa que ese caso NO se
 *   vigila — no que se dé por afirmado.
 * - **No decide quién tiene razón**: sigue sin resolver si vale el dictado o la
 *   nota. Eso es del médico (`POR_QUE_NO_SE_CORRIGE_SOLO`).
 * - **No mira quién habló**: si el reconocedor atribuyó mal el turno, este motor
 *   razona sobre esa atribución (ver `roles-hablante.ts`).
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas, contradicciones, esRespuestaNegativa,
  corregirCertezaPorNegacion,
} from '@/lib/expediente/negaciones'

const niega = (dictado: string) => condicionesNegadas(dictado).map(x => x.condicion)

describe('LAS NEGACIONES QUE SE PERDÍAN — el habla real no dice «No.» a secas', () => {
  const casos: [string, string][] = [
    ['¿Padece diabetes o presión alta? Pues no.', 'diabetes'],
    ['¿Es usted diabético? Fíjese que no.', 'diabetes'],
    ['¿Tiene diabetes? Para nada.', 'diabetes'],
    ['¿Tiene presión alta? Qué va.', 'hipertensión arterial'],
    ['¿Padece diabetes? Gracias a Dios no.', 'diabetes'],
    ['¿Padece hipertensión? Tampoco.', 'hipertensión arterial'],
    ['¿Tiene diabetes? Nel.', 'diabetes'],
    ['¿Tiene asma? En absoluto.', 'asma'],
    ['¿Tiene diabetes? La verdad que no.', 'diabetes'],
    ['¿Es epiléptico? Creo que no.', 'epilepsia'],
  ]
  for (const [dictado, esperada] of casos) {
    it(`«${dictado}» → niega ${esperada}`, () => {
      expect(niega(dictado)).toContain(esperada)
    })
  }

  it('el guion de turno del transcriptor no esconde la respuesta', () => {
    // Los dos caminos: guion y comillas. Con el prefijo, el «no» dejaba de ser
    // la primera palabra y la negación entera se perdía.
    expect(niega('¿Tiene diabetes? — No.')).toContain('diabetes')
    expect(niega('¿Tiene diabetes? "No".')).toContain('diabetes')
  })

  it('las muletillas se apilan, como en la consulta', () => {
    expect(niega('¿Tiene diabetes? Ah, pues no.')).toContain('diabetes')
  })
})

describe('LAS AFIRMACIONES QUE SE LEÍAN COMO NEGACIÓN — el sentido caro', () => {
  const afirmaciones = [
    '¿Desde cuándo tiene diabetes? No hace mucho, como dos años.',
    '¿Tiene diabetes? Nunca la he dejado de tomar.',
    '¿Tiene diabetes? Nada más esa, sí.',
    '¿Tiene diabetes? No, bueno sí, la borderline.',
    '¿Tiene diabetes? No me acuerdo cuándo empezó.',
    '¿Tiene asma? Nada más de niño.',
  ]
  for (const dictado of afirmaciones) {
    it(`«${dictado}» NO es una negación`, () => {
      expect(niega(dictado)).toEqual([])
    })
  }

  it('una diabetes confirmada NO se degrada a descartado por un falso «no»', () => {
    // Éste es el daño concreto: la ruta de extracción reclasifica lo negado, así
    // que un falso positivo aquí borra un antecedente que el paciente acaba de
    // confirmar — el mismo fallo que el motor existe para impedir, del revés.
    const negadas = condicionesNegadas('¿Desde cuándo tiene diabetes? No hace mucho, como dos años.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }],
      negadas,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('una afirmación en la respuesta deja la decisión al médico, no la resuelve', () => {
    expect(esRespuestaNegativa('No, bueno sí')).toBe(false)
    expect(esRespuestaNegativa('Sí, pero no me la checo')).toBe(false)
  })
})

describe('LA NEGACIÓN PEGADA AL TÉRMINO', () => {
  it('«no es diabético» niega', () => {
    expect(niega('No es diabético.')).toContain('diabetes')
  })

  it('«niega ser hipertenso» también', () => {
    expect(niega('El paciente niega ser hipertenso.')).toContain('hipertensión arterial')
  })

  it('«no cuenta con antecedente de» y «sin datos de» también', () => {
    expect(niega('No cuenta con antecedente de diabetes.')).toContain('diabetes')
    expect(niega('Sin datos de asma.')).toContain('asma')
  })

  it('pero un «no es» que va de otra cosa NO tapa una afirmación de la nota', () => {
    /**
     * El fallo caro del otro lado: si «no es» valiera en toda la ventana de 60
     * caracteres, esta nota —que SÍ afirma la diabetes— dejaría de contradecir
     * al dictado y el aviso no saldría.
     */
    const negadas = condicionesNegadas('¿Tiene diabetes? No.')
    const nota = 'El paciente no es candidato a cirugía. Diabetes mellitus tipo 2 en control.'
    expect(contradicciones(negadas, nota).map(c => c.condicion)).toContain('diabetes')
  })

  it('y una nota bien escrita con «no es diabético» sigue sin alertar', () => {
    const negadas = condicionesNegadas('¿Tiene diabetes? No.')
    expect(contradicciones(negadas, 'El paciente no es diabético.')).toEqual([])
  })
})

describe('LO QUE NO CAMBIA', () => {
  it('el silencio sigue sin ser una negación', () => {
    expect(niega('¿Enfermedades crónicas como diabetes?')).toEqual([])
    expect(esRespuestaNegativa('')).toBe(false)
    expect(esRespuestaNegativa('   ')).toBe(false)
  })

  it('el caso del Dr. del 3-ago sigue cazado', () => {
    expect(niega('¿Enfermedades crónicas como diabetes o presión alta? No.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial']))
  })

  it('una enfermedad nombrada y afirmada no entra en la lista', () => {
    expect(niega('¿Tiene diabetes? Sí, desde hace 10 años.')).toEqual([])
  })
})
