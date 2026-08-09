/**
 * «OBE-SIDA-D» DECÍA VIH, Y CON ESO SE DESCARTABA UN VIH — REG-285.
 *
 * ── EL DEFECTO, EN UNA LÍNEA ────────────────────────────────────────────────
 *
 *     if (c.formas.some(f => t.includes(sinAcentos(f)))) …
 *
 * `includes` casa **subcadenas**. Y «obe·sida·d» contiene «sida»:
 *
 *     condicionesNegadas('Niega obesidad')  →  [{ condicion: 'VIH' }]
 *
 * ── POR QUÉ NO SE QUEDA AHÍ ─────────────────────────────────────────────────
 *
 * De esa lista lee `corregirCertezaPorNegacion`, que reclasifica a
 * **`descartado`** lo que la IA extrajo. Un paciente con **VIH real** cuyo
 * expediente diga «niega obesidad» quedaba con el **VIH descartado**.
 *
 * En un consultorio de infectología —que es éste— eso no es una curiosidad de
 * cadenas de texto.
 *
 * ── EL LÍMITE NO ES `\b`, Y ESO IMPORTA ─────────────────────────────────────
 *
 * El texto ya viene sin tildes, así que `\b` funcionaría… hasta que alguien
 * quite la normalización. Se mira hacia los lados por **carácter** —letra o
 * dígito—, que es lo que de verdad se quiere decir.
 *
 * El **dígito** no sobra: «dm 2» y «tb pulmonar» llevan número, y sin esa
 * condición «dm 2» casaría dentro de «dm 20 mg».
 *
 * ── Y LA MISMA COMPARACIÓN VIVÍA EN EL MÓDULO DE AL LADO ────────────────────
 *
 * `temporalidad.ts` tenía `includes` sobre su propio vocabulario. Se arregla
 * con **el mismo comparador exportado**, no con una copia: dos formas de
 * comparar es exactamente cómo se arregla un módulo y se deja el de al lado —
 * la forma de REG-267, otra vez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { condicionesNegadas, cronicasEn, comoPalabra, CRONICAS } from '@/lib/expediente/negaciones'
import { padecimientosEn } from '@/lib/expediente/temporalidad'

describe('el caso que lo motiva', () => {
  it('«Niega obesidad» NO niega el VIH', () => {
    expect(condicionesNegadas('Niega obesidad').map(c => c.condicion)).toEqual([])
  })

  it('ni lo nombra', () => {
    expect(cronicasEn('obesidad')).toEqual([])
    expect(padecimientosEn('obesidad')).toEqual([])
  })

  it('«Paciente con obesidad y sida» sí nombra el VIH — por el «sida» de verdad', () => {
    /**
     * El arreglo no puede costar la detección real: «sida» como palabra sigue
     * siendo VIH. Perder eso sería el error contrario, y en infectología el peor.
     */
    expect(cronicasEn('Paciente con obesidad y sida')).toEqual(['VIH'])
  })

  it('y «Niega sida» sigue negando el VIH', () => {
    expect(condicionesNegadas('Niega sida').map(c => c.condicion)).toEqual(['VIH'])
  })
})

describe('el dígito del límite no sobra', () => {
  it('«Niega dm 2» es diabetes', () => {
    expect(condicionesNegadas('Niega dm 2').map(c => c.condicion)).toEqual(['diabetes'])
  })

  it('pero «dm 20 mg» no nombra ninguna enfermedad', () => {
    /** Sin el dígito en el límite, «dm 2» casaría dentro de «dm 20». */
    expect(cronicasEn('dm 20 mg')).toEqual([])
  })
})

describe('lo que ya funcionaba sigue funcionando', () => {
  for (const [frase, esperado] of [
    ['Niega diabetes', ['diabetes']],
    ['Niega presión alta', ['hipertensión arterial']],
    ['Niega hipertensión', ['hipertensión arterial']],
    ['Niega tb pulmonar', ['tuberculosis']],
    ['Niega VIH', ['VIH']],
  ] as const) {
    it(`«${frase}»`, () => {
      expect(condicionesNegadas(frase).map(c => c.condicion)).toEqual([...esperado])
    })
  }
})

describe('el comparador, mirado de cerca', () => {
  it('casa la palabra entera y no una parte', () => {
    expect(comoPalabra('sida').test('sida')).toBe(true)
    expect(comoPalabra('sida').test('obesidad')).toBe(false)
    expect(comoPalabra('sida').test('el sida, sí')).toBe(true)
  })

  it('acepta formas de varias palabras', () => {
    expect(comoPalabra('presion alta').test('con presion alta desde 2019')).toBe(true)
  })

  it('no se rompe con signos dentro de la forma', () => {
    /** Las formas se escapan: un `.` o un `(` no puede mandar en la expresión. */
    expect(() => comoPalabra('a.b(c')).not.toThrow()
    expect(comoPalabra('a.b(c').test('axbxc')).toBe(false)
  })

  it('y ninguna forma del vocabulario casa dentro de otra palabra', () => {
    /**
     * Barrido sobre TODO el vocabulario, no sobre el caso que se encontró: una
     * forma nueva que fuera subcadena de una palabra común falla aquí aunque
     * nadie haya pensado en ella.
     */
    const trampas = ['obesidad', 'sobrepeso', 'desidia', 'presidencia', 'residual', 'cancerbero']
    const falsos: string[] = []
    for (const c of CRONICAS) {
      for (const f of c.formas) {
        for (const palabra of trampas) {
          if (comoPalabra(f).test(palabra)) falsos.push(`«${f}» (${c.canonica}) casa dentro de «${palabra}»`)
        }
      }
    }
    expect(falsos, falsos.join('\n  ')).toEqual([])
  })
})

describe('una sola forma de comparar, no dos', () => {
  it('`temporalidad.ts` usa el comparador de `negaciones.ts`', () => {
    /**
     * Ésta es la que impide repetir REG-267. Mientras cada módulo tenga su
     * propia comparación, arreglar uno deja el otro roto — y nadie lo nota,
     * porque los dos «funcionan».
     */
    const temp = readFileSync(join(process.cwd(), 'src/lib/expediente/temporalidad.ts'), 'utf8')
    expect(temp).toContain('comoPalabra')
    expect(temp).not.toMatch(/formas\.some\(f => t\.includes\(sinAcentos\(f\)\)\)/)
  })
})
