/**
 * «EN EL SEGMENTO ST» ES ANATOMÍA, NO METATEXTO — REG-186.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * El saneador de prosa existe para borrar al modelo describiendo su entrada:
 * «no se refiere motivo **en este fragmento de consulta**». El patrón que lo
 * caza llevaba un `?` que hacía **opcional** el «de la consulta», así que
 * también cazaba «en el segmento», «en la parte», «en la porción» y «en el
 * tramo» sueltos — que en una nota clínica son **localizaciones anatómicas**.
 *
 * Comprobado con el motor real antes de tocarlo:
 *
 *     «ECG con infradesnivel en el segmento ST de 2 mm» → «…infradesnivelST…»
 *     «Dolor en la parte baja de la espalda»            → «Dolorbaja…»
 *     «Lesión en la porción distal del húmero»          → «Lesióndistal…»
 *
 * Cuatro de cada cinco frases clínicas legítimas salían amputadas — y la
 * primera es un infarto.
 *
 * ── LA ASIMETRÍA ─────────────────────────────────────────────────────────────
 *
 * Dejar pasar un metatexto ensucia la nota. Borrar una localización anatómica
 * **cambia lo que dice el expediente** y se imprime así. No se parecen.
 */
import { describe, it, expect } from 'vitest'
import { sanitizarProsa } from '@/lib/expediente/sanitizar-prosa'

describe('la topografía clínica sobrevive intacta', () => {
  const ANATOMIA = [
    'ECG con infradesnivel en el segmento ST de 2 mm',
    'Dolor en la parte baja de la espalda',
    'Lesión en la porción distal del húmero',
    'Soplo en el tramo medio del esternón',
    'Estenosis en el segmento proximal de la descendente anterior',
    'Hipoventilación en la parte inferior del hemitórax derecho',
  ]

  for (const frase of ANATOMIA) {
    it(`no toca «${frase.slice(0, 42)}…»`, () => {
      expect(sanitizarProsa(frase)).toBe(frase)
    })
  }
})

describe('pero el metatexto se sigue borrando', () => {
  it('«en este fragmento de consulta» se va', () => {
    expect(sanitizarProsa('No se refiere motivo en este fragmento de consulta'))
      .not.toContain('fragmento')
  })

  it('«en esta parte de la grabación» también', () => {
    expect(sanitizarProsa('Sin datos en esta parte de la grabación'))
      .not.toContain('grabación')
  })

  it('«en este tramo de la entrevista» también', () => {
    expect(sanitizarProsa('No explorado en este tramo de la entrevista'))
      .not.toContain('entrevista')
  })

  it('«según la transcripción» sigue cayendo', () => {
    expect(sanitizarProsa('Refiere disnea según la transcripción'))
      .not.toContain('transcripción')
  })
})

describe('la asimetría que justifica el criterio', () => {
  it('dejar un metatexto ensucia; borrar anatomía cambia el expediente', () => {
    /**
     * El infradesnivel del ST de 2 mm es un dato de infarto. Que se imprimiera
     * como «infradesnivelST» no es una errata: es el hallazgo pegado al verbo,
     * en un documento firmado con cédula profesional.
     */
    const nota = 'ECG con infradesnivel en el segmento ST de 2 mm en cara inferior'
    expect(sanitizarProsa(nota)).toContain('segmento ST')
    expect(sanitizarProsa(nota)).toContain('2 mm')
  })
})
