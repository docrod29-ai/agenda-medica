/**
 * EL ESCUDO DE UNA ORACIÓN SE PRESTABA A LA SIGUIENTE — REG-286.
 *
 * ── EL COMENTARIO YA NOMBRABA EL FALLO ──────────────────────────────────────
 *
 * `VENTANA_DEL_ESCUDO` llevaba escrito, desde que se fijó:
 *
 *   *«Más larga empezaría a leer la oración anterior y un escudo ajeno taparía
 *    una afirmación real — que es el fallo caro.»*
 *
 * Conocía el modo de fallo exacto y eligió **60 caracteres** como defensa.
 *
 * ── PERO 60 CARACTERES NO SON UNA ORACIÓN ───────────────────────────────────
 *
 * «Antecedente de asma. » mide **21**. El escudo cruzaba el punto sin esfuerzo.
 * Medido el 9-ago-2026 con `primeraMencionSinEscudo` de verdad:
 *
 *     «Antecedente de asma. Cursa con neumonía.»          → CALLABA
 *     «Niega diabetes. Diagnóstico de diabetes tipo 2.»   → CALLABA
 *
 * **El segundo es el que duele.** La nota AFIRMA una diabetes justo después de
 * que el paciente la negara, y la alarma de contradicción —que es la razón de
 * existir de este motor, la que nació del caso que el Dr. encontró en
 * producción— se quedaba muda.
 *
 * ── LA LECCIÓN ──────────────────────────────────────────────────────────────
 *
 * **Un número no puede expresar «la misma oración».** La ventana de 60 se queda
 * como tope —para eso sirve un número— y el corte lo hace el punto, que es lo
 * que de verdad separa una afirmación de otra.
 */
import { describe, it, expect } from 'vitest'
import { primeraMencionSinEscudo, VENTANA_DEL_ESCUDO } from '@/lib/expediente/mencion-en-la-nota'

/** El escudo tal como lo pasan los dos motores que usan esta función. */
const ESCUDO = /\b(?:niega|no\s+(?:tiene|refiere)|sin\s+antecedente[s]?\s+de|antecedente\s+de)\b/i

const avisa = (texto: string, forma: string) =>
  primeraMencionSinEscudo(texto, [forma], ESCUDO) !== null

describe('los dos casos que lo motivan', () => {
  it('«Niega diabetes. Diagnóstico de diabetes tipo 2.» AVISA', () => {
    /**
     * Es el motivo entero de este motor: la nota afirma lo que el paciente
     * negó. Que callara aquí lo dejaba sin función.
     */
    expect(avisa('Niega diabetes. Diagnóstico de diabetes tipo 2.', 'diabetes')).toBe(true)
  })

  it('«Antecedente de asma. Cursa con neumonía.» AVISA por la neumonía', () => {
    expect(avisa('Antecedente de asma. Cursa con neumonía.', 'neumonia')).toBe(true)
  })

  it('y el punto y coma corta igual que el punto', () => {
    expect(avisa('Niega diabetes; diagnóstico de diabetes tipo 2', 'diabetes')).toBe(true)
  })

  it('y el salto de línea también', () => {
    expect(avisa('ANTECEDENTES: asma.\nPADECIMIENTO ACTUAL: neumonía.', 'neumonia')).toBe(true)
  })
})

describe('el escudo DENTRO de su oración sigue escudando', () => {
  /**
   * El riesgo del arreglo es el contrario: gritar sobre notas bien escritas.
   * Un aviso que salta cuando la nota está bien se ignora, y entonces tampoco
   * se ve el que importa.
   */
  for (const [texto, forma] of [
    ['Niega diabetes.', 'diabetes'],
    ['Antecedente de asma', 'asma'],
    ['Sin antecedente de diabetes en la familia', 'diabetes'],
    ['No refiere asma ni alergias', 'asma'],
  ] as const) {
    it(`«${texto}» calla`, () => {
      expect(avisa(texto, forma)).toBe(false)
    })
  }
})

describe('y lo que la nota afirma sin escudo sigue avisando', () => {
  it('«Paciente con diabetes tipo 2»', () => {
    expect(avisa('Paciente con diabetes tipo 2', 'diabetes')).toBe(true)
  })
})

describe('la ventana sigue siendo un TOPE, no el criterio', () => {
  it('60 caracteres siguen declarados', () => {
    expect(VENTANA_DEL_ESCUDO).toBe(60)
  })

  it('un escudo a más de 60 caracteres no alcanza, aunque no haya punto en medio', () => {
    /**
     * El tope no sobra: sin él, un «niega» al principio de un párrafo largo
     * escudaría todo lo que viniera detrás hasta el siguiente punto.
     */
    const lejos = 'Niega diabetes ' + 'x'.repeat(70) + ' diabetes tipo 2'
    expect(avisa(lejos, 'diabetes')).toBe(true)
  })
})
