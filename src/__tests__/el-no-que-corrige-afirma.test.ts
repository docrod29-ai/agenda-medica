/**
 * EL «NO» QUE CORRIGE Y AFIRMA EN LA MISMA FRASE — REG-271.
 *
 * ── DE DÓNDE VIENE, Y POR QUÉ SE VERIFICÓ ANTES DE CREÉRSELO ────────────────
 *
 * La rutina `NEG-002` lo encontró en su rama. Antes de absorber nada se
 * reprodujo aquí, sobre el árbol que corre en producción, con `respuestaNiega`
 * de verdad. Las cinco formas se leían como negación:
 *
 *     «No, sí tengo.»        → NIEGA
 *     «No, sí padezco»       → NIEGA
 *     «no, claro que sí»     → NIEGA
 *     «No, así es»           → NIEGA
 *     «No, efectivamente»    → NIEGA
 *
 * ── POR QUÉ ES DE LOS PEORES ────────────────────────────────────────────────
 *
 * El daño va en la dirección mala. El paciente **afirma** que padece la
 * enfermedad, el expediente registra que la **negó**, y después
 * `corregirCertezaPorNegacion` la reclasifica a `descartado`. La pantalla de
 * contradicciones no salta, porque para ella todo cuadra.
 *
 * Es el gemelo de «no sé» (que ya estaba resuelto) y el reverso de REG-251: allí
 * el panel certificaba en verde lo contrario de lo dictado; aquí el motor
 * convierte un sí en un no antes de que nadie lo mire.
 *
 * ── LA CAUSA, EN UNA LÍNEA ──────────────────────────────────────────────────
 *
 * `NEGATIVAS` sólo mira el ARRANQUE de la respuesta. **Y el arranque no siempre
 * es lo que se contestó.**
 */
import { describe, it, expect } from 'vitest'
import { respuestaNiega } from '@/lib/expediente/negaciones'

describe('«no, sí» afirma: no puede quedar como negación', () => {
  const AFIRMAN = [
    'No, sí tengo.',
    'No, sí padezco',
    'no, claro que sí',
    'No, así es',
    'No, efectivamente',
    'Pues no, sí tengo desde hace años',
    'No, sí. Desde los cuarenta.',
  ]
  for (const r of AFIRMAN) {
    it(`«${r}» NO niega`, () => {
      expect(respuestaNiega(r), `«${r}» se está leyendo como una negación`).toBe(false)
    })
  }
})

describe('y la negación de verdad sigue contando', () => {
  /**
   * El riesgo de esta reparación es el contrario: apagar negaciones legítimas.
   * Perder una negación deja un antecedente sin descartar; fabricarla descarta
   * uno real. Las dos direcciones se sostienen aquí.
   */
  const NIEGAN = [
    'No.',
    'No, ninguna',
    'No, nunca',
    'No, para nada',
    'Pues no',
    'Fíjese que no',
    'Tampoco.',
  ]
  for (const r of NIEGAN) {
    it(`«${r}» sigue negando`, () => {
      expect(respuestaNiega(r), `«${r}» dejó de contar como negación`).toBe(true)
    })
  }
})

describe('lo que ya estaba resuelto no se rompe', () => {
  it('«no sé» sigue sin ser una negación', () => {
    /** No saber no es negar: ausencia de dato no es dato de ausencia. */
    for (const r of ['No sé', 'No sé, doctor', 'No me acuerdo', 'No recuerdo']) {
      expect(respuestaNiega(r), `«${r}»`).toBe(false)
    }
  })

  it('«no, sino» no es el «no» correctivo — y tampoco debe afirmar por error', () => {
    /**
     * El guardián mira hacia delante por LETRA y no por `\b`, así que «sino»
     * no se confunde con «sí no». Si `(?![a-záéíóúüñ])` se cayera, esta prueba
     * lo diría.
     */
    expect(respuestaNiega('No, sino la de mi hermana')).toBe(true)
  })
})

describe('el fin de palabra: `\\b` no vale tras una vocal acentuada', () => {
  it('la expresión NO usa `\\b` después de `s[ií]`', () => {
    /**
     * `\b` de JavaScript trabaja sobre `\w`, que es ASCII: entre «í» y el final
     * de la cadena no hay frontera de palabra. Es la misma trampa que tuvo
     * apagado el guardián de «No sé.» sin que su regla pareciera mal escrita.
     */
    const fuente = String(respuestaNiega)
    expect(fuente).toBeTruthy()
    const modulo = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/expediente/negaciones.ts'), 'utf8')
    expect(modulo).toMatch(/NO_CORRECTIVO[\s\S]{0,200}\(\?!\[a-záéíóúüñ\]\)/)
  })
})
