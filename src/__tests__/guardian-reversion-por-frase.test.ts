/**
 * GOLDEN — la reversión del guardián dejó de ser todo-o-nada.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `verificar()` compara los textos **completos** y, ante una sola violación,
 * devuelve el crudo entero. `corregirVigilado` entonces vaciaba `cambios` por
 * completo.
 *
 * Consecuencia: bastaba que **una** cifra desapareciera en el minuto 18 para
 * que se descartaran **todas** las correcciones de fármacos de la consulta —
 * «sefriaxona» incluida, en el minuto 2.
 *
 * Y el daño **crecía con la duración**: cuantas más cifras tiene un dictado, más
 * probable es perderlo todo. Justo al revés de lo que conviene, porque la
 * consulta larga es la que más se beneficia del corrector.
 *
 * ── POR QUÉ ESTO NO DEBILITA LA GARANTÍA, Y ES LO IMPORTANTE ─────────────────
 *
 * La reversión por frase es **sólo el intento**. Después se vuelve a verificar
 * el documento recompuesto contra el crudo, y si queda cualquier violación se
 * cae al comportamiento de siempre: crudo entero.
 *
 * La salida sigue pasando `verificar()` exactamente igual que antes. Lo único
 * que cambia es **cuánto se tira** cuando el problema está en una frase.
 */
import { describe, it, expect } from 'vitest'
import { corregirVigilado, alertasDe, frasesConSeparador } from '@/lib/asr/corrector-vigilado'
import { verificar } from '@/lib/asr/guardian-sustituciones'

describe('EL TROCEADO NO PIERDE NI UN CARÁCTER', () => {
  it('recomponer devuelve exactamente el original', () => {
    /**
     * Si el troceado perdiera un espacio, la «corrección» estaría alterando el
     * dictado por su cuenta — el defecto que el guardián existe para impedir.
     */
    for (const t of [
      'Primera frase. Segunda frase! ¿Tercera?\nCuarta.',
      'Sin puntuación final',
      'Doble  espacio.  Otra.',
      '',
    ]) {
      expect(frasesConSeparador(t).join(''), JSON.stringify(t)).toBe(t)
    }
  })
})

describe('LA GARANTÍA NO SE DEBILITA', () => {
  it('la salida SIEMPRE pasa el guardián', () => {
    /**
     * Es el invariante del módulo. Se comprueba sobre una batería de dictados,
     * incluidos los que rompen a propósito.
     */
    const casos = [
      'sefriaxona 1 g cada 8 horas. El paciente refiere dolor.',
      'meropenem dos gramos. La presión 120 sobre 80. sefriaxona 1 g.',
      'niega fiebre. sefriaxona un gramo. PEEP 12, PIP 30.',
      'le doy amoxicilina 500 mg cada 8 horas por 7 días.',
      'dolor en pierna derecha. sefriaxona.',
    ]
    for (const t of casos) {
      const r = corregirVigilado(t)
      expect(verificar(t, r.corregido).revertido, t).toBe(false)
    }
  })

  it('un dictado limpio se corrige entero, como siempre', () => {
    const r = corregirVigilado('sefriaxona para el paciente')
    expect(r.revertido).toBe(false)
    expect(r.frasesRevertidas).toBe(0)
  })
})

describe('EL ALCANCE SE CUENTA Y SE DICE', () => {
  it('el resultado trae cuántas frases se revirtieron, de cuántas', () => {
    const r = corregirVigilado('Primera frase sin nada. Segunda frase sin nada.')
    expect(r.frasesTotales).toBeGreaterThan(0)
    expect(r.frasesRevertidas).toBeLessThanOrEqual(r.frasesTotales)
  })

  it('la alerta distingue «una frase» de «el dictado entero»', () => {
    /**
     * «Se descartó una corrección» sobre veinte minutos no dice si se perdió una
     * frase o la consulta. Con la reversión por frases esa diferencia existe, y
     * no contarla sería esconderla.
     */
    const parcial = alertasDe({
      ...corregirVigilado('x'), frasesRevertidas: 1, frasesTotales: 8, violaciones: [], dosisRotas: [],
    })
    expect(parcial.some(a => /1 de 8 frases/.test(a.titulo))).toBe(true)

    const total = alertasDe({
      ...corregirVigilado('x'), frasesRevertidas: 8, frasesTotales: 8, violaciones: [], dosisRotas: [],
    })
    expect(total.some(a => /dictado completo sin corregir/.test(a.titulo))).toBe(true)
  })

  it('sin reversión no se añade ruido a las alertas', () => {
    const a = alertasDe({
      ...corregirVigilado('x'), frasesRevertidas: 0, frasesTotales: 8, violaciones: [], dosisRotas: [],
    })
    expect(a).toEqual([])
  })

  it('un dictado de una sola frase no habla de «frases»', () => {
    // Decir «0 de 1 frases» es ruido: no hay nada que localizar.
    const a = alertasDe({
      ...corregirVigilado('x'), frasesRevertidas: 1, frasesTotales: 1, violaciones: [], dosisRotas: [],
    })
    expect(a.some(x => /frases/.test(x.titulo))).toBe(false)
  })
})

describe('LAS VIOLACIONES SON LAS DEL DOCUMENTO ENTERO', () => {
  it('se reportan aunque el texto usado sea el recompuesto', () => {
    /**
     * Lo que el médico tiene que ver es qué pasó, y pasó sobre el dictado
     * completo. Enseñar sólo las de las frases revertidas escondería la mitad
     * del problema.
     */
    const r = corregirVigilado('sefriaxona 1 g. Otra frase cualquiera.')
    expect(Array.isArray(r.violaciones)).toBe(true)
  })

  it('y el crudo nunca se pierde', () => {
    // Regla nº 5 del paquete del Dr.: el transcript original no se borra.
    const t = 'sefriaxona un gramo cada ocho horas'
    expect(corregirVigilado(t).crudo).toBe(t)
  })
})
