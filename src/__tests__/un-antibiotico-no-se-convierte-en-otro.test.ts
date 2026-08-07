/**
 * UN ANTIBIÓTICO NO SE CONVIERTE EN OTRO.
 *
 * ── LO QUE PASABA, REPRODUCIDO CON EL PIPELINE DE PRODUCCIÓN ────────────────
 *
 *   «Le doy azitro micina cinco días»   →  «Le roxitromicina 5 días»
 *   «Doy mico nazol tópico»             →  «Voriconazol tópico»
 *   «Le doy neo micina tópica»          →  «Le lincomicina tópica»
 *   «El paciente lleva cefa lotina…»    →  «…lleva cefazolina…»
 *
 * Los cuatro con `violaciones: []`. **Ni un aviso.** El médico —infectólogo—
 * dicta un antibiótico y en la nota aparece otro, sin que nada se lo diga.
 * Su queja fue: «me estás confundiendo antibióticos».
 *
 * ── LA CAUSA ────────────────────────────────────────────────────────────────
 *
 * Cuando el reconocedor parte el nombre («azitro micina»), el corrector prueba
 * ventanas de tres palabras y se traga el verbo de delante («doy azitro
 * micina»). Esa unión se busca POR PARECIDO entre 6 117 términos —4 053 de
 * ellos de un diccionario médico en inglés— y gana el más cercano, que puede
 * ser otro antimicrobiano.
 *
 * Y el filtro de longitud empeoraba las cosas: dejaba fuera a la azitromicina
 * correcta y dejaba pasar a la roxitromicina equivocada.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un antimicrobiano sólo se acepta si coincide EXACTO. No hay distancia segura
 * entre dos: sobre este mismo catálogo, 42 de 100 tienen un rival dentro del
 * umbral, y algunos a distancia 1 —vancomicina y lincomicina, cefazolina y
 * ceftarolina—. Cualquier número deja pares dentro.
 *
 * Lo útil se conserva: volver a unir un nombre partido. El problema nunca fue
 * unir, fue APROXIMAR.
 *
 * ── POR QUÉ NO BASTABA LA LISTA DE NOMBRES ──────────────────────────────────
 *
 * Primer intento: comparar contra las listas en español. «mico nazol» pasó de
 * «Voriconazol» a «Oxiconazol» — seguía mal, porque esos nombres viven en el
 * léxico en inglés y las listas no los tienen. Por eso además se miran las
 * TERMINACIONES, sacadas de los propios nombres del catálogo.
 */
import { describe, it, expect } from 'vitest'
import { procesarTranscript } from '@/lib/asr/pipeline'
import {
  ANTIBIOTICOS, ANTIFUNGICOS, ANTIVIRALES, ANTIRRETROVIRALES,
  corregirTranscripcion,
} from '@/lib/expediente/medical-vocabulary'

const texto = async (frase: string) => (await procesarTranscript(frase)).texto

describe('los cuatro casos que el médico sufrió', () => {
  it('«azitro micina» vuelve a ser azitromicina, no roxitromicina', async () => {
    const r = await texto('Le doy azitro micina cinco días.')
    expect(r).toContain('azitromicina')
    expect(r.toLowerCase()).not.toContain('roxitromicina')
  })

  it('«mico nazol» vuelve a ser miconazol, no voriconazol ni oxiconazol', async () => {
    const r = await texto('Doy mico nazol tópico.')
    expect(r.toLowerCase()).toContain('miconazol')
    expect(r.toLowerCase()).not.toContain('voriconazol')
    expect(r.toLowerCase()).not.toContain('oxiconazol')
  })

  it('«neo micina» vuelve a ser neomicina, no lincomicina', async () => {
    const r = await texto('Le doy neo micina tópica.')
    expect(r.toLowerCase()).toContain('neomicina')
    expect(r.toLowerCase()).not.toContain('lincomicina')
  })

  it('«cefa lotina» NO se convierte en cefazolina', async () => {
    /**
     * La cefalotina se usa en México y este repositorio la conoce en el
     * antibiograma, pero no está en el vocabulario del reconocedor. Antes eso
     * significaba «la cambio por la más parecida que sí conozco», SIEMPRE y sin
     * avisar. Ahora se queda como se dictó: partida, quizá, pero suya.
     *
     * Un nombre partido lo ve el médico y lo corrige. Un nombre cambiado por
     * otro fármaco real no se ve.
     */
    const r = await texto('El paciente lleva cefa lotina desde ayer.')
    expect(r.toLowerCase()).not.toContain('cefazolina')
  })
})

describe('lo que sí tenía que seguir funcionando', () => {
  const uniones: [string, string][] = [
    ['Inicio mero penem un gramo cada ocho.', 'meropenem'],
    ['Roté a pipera cilina tazobactam.', 'piperacilina'],
    ['Se agregó vanco micina por MRSA.', 'vancomicina'],
    ['Cef triaxona dos gramos al día.', 'ceftriaxona'],
  ]
  for (const [frase, esperado] of uniones) {
    it(`«${frase}» sigue uniéndose a ${esperado}`, async () => {
      expect((await texto(frase)).toLowerCase()).toContain(esperado)
    })
  }

  it('las correcciones que NO son antimicrobianos siguen igual', async () => {
    // La gliflozina de REG-065/066: el corrector sigue haciendo su trabajo.
    expect((await texto('Empaq linfosina diez miligramos.')).toLowerCase()).toContain('empagliflozina')
  })

  it('y el guardián de REG-066 sigue en pie', async () => {
    const r = await texto('Presenta problema activo parálisis facial periférica.')
    expect(r.toLowerCase()).not.toContain('acroparalysis')
  })
})

describe('el barrido: ningún antimicrobiano del catálogo se convierte en otro', () => {
  /**
   * La prueba de verdad. Se parte cada antimicrobiano por cada punto posible,
   * se le antepone un verbo —que es lo que la ventana de tres se tragaba— y se
   * comprueba que NO sale otro antimicrobiano distinto.
   *
   * Antes de la regla, este barrido devolvía 118 sustituciones.
   */
  const TODOS = [...ANTIBIOTICOS, ...ANTIFUNGICOS, ...ANTIVIRALES, ...ANTIRRETROVIRALES]
    .filter(t => !t.includes(' ') && t.length >= 10)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  /**
   * QUÉ CUENTA COMO SUSTITUCIÓN, Y QUÉ NO.
   *
   * Sustitución es que **desaparezca lo dictado y aparezca otro fármaco**. Ésa
   * es la que mata: el médico lee un antibiótico que él no dijo y no tiene cómo
   * saberlo.
   *
   * NO cuenta que el texto se quede partido («cipr ofloxacino»): eso se ve, se
   * corrige, y no afirma nada falso. Es el resultado que la regla busca cuando
   * no está segura — preferir lo visiblemente roto a lo invisiblemente
   * cambiado.
   *
   * Tampoco cuentan las combinaciones con barra: partir «ampicilina/sulbactam»
   * deja «ampicilina» suelta, que es un componente del propio fármaco dictado,
   * no otro distinto. Es un artefacto de partir por la barra, no del corrector.
   */
  it(`ninguno de los ${TODOS.length} desaparece y sale otro en su lugar`, () => {
    const culpables: string[] = []
    const conocidos = new Set(TODOS.map(norm))
    for (const farmaco of TODOS) {
      if (farmaco.includes('/')) continue
      for (let i = 4; i < farmaco.length - 3; i++) {
        const partido = `${farmaco.slice(0, i)} ${farmaco.slice(i)}`
        const salida = norm(corregirTranscripcion(`Le doy ${partido} hoy`).corregido)
        // ¿Sigue estando lo que se dictó, entero o partido tal cual?
        if (salida.includes(norm(farmaco)) || salida.includes(norm(partido))) continue
        for (const palabra of salida.split(/\s+/)) {
          if (conocidos.has(palabra) && palabra !== norm(farmaco)) {
            culpables.push(`${partido} → ${palabra} (se dictó ${farmaco})`)
          }
        }
      }
    }
    expect(culpables.slice(0, 12), `${culpables.length} sustituciones`).toEqual([])
  })
})
