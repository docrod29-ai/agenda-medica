/**
 * GOLDEN — el apagador de la hoja no llega al JS, así que el JS pregunta.
 *
 * ── LA REGLA, QUE YA ESTABA ESCRITA ─────────────────────────────────────────
 *
 * `lib/ui/continuidad.ts` la dice: «el apagador de la hoja no llega al JS; cada
 * comportamiento de movimiento decidido en JS pregunta por su cuenta».
 *
 * Es literal. `globals.css` apaga transiciones y animaciones bajo
 * `prefers-reduced-motion` con `!important`, y eso **no toca** ni la Web
 * Animations API ni `requestAnimationFrame` ni `startViewTransition`. Un
 * `!important` no puede detener código.
 *
 * ── QUÉ SE MIDIÓ ────────────────────────────────────────────────────────────
 *
 * En navegador, cinco pantallas, dos pasadas (30-ago):
 *
 *   con la preferencia:   0 transiciones · 0 animaciones CSS · 0 WAAPI corriendo
 *   sin la preferencia:  22–128 transiciones · 1–3 animaciones CSS
 *
 * Los ceros valen **porque al lado hay números grandes**: hay movimiento de
 * verdad y se apaga entero. Un producto sin animaciones daría los mismos ceros
 * y no probaría nada.
 *
 * ── QUÉ FIJA ESTA PRUEBA ────────────────────────────────────────────────────
 *
 * Lo que la medición NO puede vigilar sola: que mañana alguien añada una
 * coreografía en JS y se olvide de preguntar. La medición hay que invocarla; el
 * escáner corre en CI.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando la consulta a `matchMedia` de `puedeCoreografiar`, cae. Añadiendo un
 * `startViewTransition` en un archivo que no pregunta, cae con su nombre.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mira `requestAnimationFrame`. Los usos del árbol son de **medida y
 *   maquetación** —reposicionar la lente, vaciar el layout con doble rAF— y el
 *   medidor de nivel del audio, que es señal de que la grabación está viva, no
 *   decoración. Clasificado a mano, no vigilado: si mañana alguien anima algo
 *   con rAF, esto no lo caza.
 * · No prueba que un usuario con la preferencia puesta VEA menos movimiento;
 *   eso lo mide `arnes:menos-movimiento`, en navegador, y hay que invocarlo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PREGUNTA = /prefers-reduced-motion/

describe('la coreografía de continuidad pregunta antes de coreografiar', () => {
  const CONT = readFileSync('src/lib/ui/continuidad.ts', 'utf8')

  it('`puedeCoreografiar` consulta la preferencia del usuario', () => {
    const i = CONT.indexOf('export function puedeCoreografiar')
    expect(i, 'desapareció la compuerta de la coreografía').toBeGreaterThan(-1)
    const cuerpo = CONT.slice(i, CONT.indexOf('\n}', i))
    expect(cuerpo, 'la coreografía dejó de preguntar por «menos movimiento»').toMatch(PREGUNTA)
    expect(cuerpo).toMatch(/matchMedia/)
  })

  it('y navegar pasa por esa compuerta, no por el API directo', () => {
    const i = CONT.indexOf('export function navegarConContinuidad')
    const cuerpo = CONT.slice(i, i + 400)
    expect(cuerpo).toMatch(/if \(!puedeCoreografiar\(\)\)/)
  })
})

describe('nadie llama al API de transiciones sin preguntar', () => {
  it('todo archivo que usa `startViewTransition` consulta la preferencia', () => {
    const archivos = execSync(
      "grep -rl 'startViewTransition' src --include=*.ts --include=*.tsx || true",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(f => f && !f.includes('__tests__'))

    // Si el barrido no encuentra a nadie, no está probando nada.
    expect(archivos.length, 'nadie usa startViewTransition: ¿se retiró la coreografía?').toBeGreaterThan(0)

    for (const f of archivos) {
      expect(
        readFileSync(f, 'utf8'),
        `${f} llama a startViewTransition sin preguntar por «menos movimiento». ` +
        'El apagador de globals.css no llega hasta ahí.',
      ).toMatch(PREGUNTA)
    }
  })
})

describe('la hoja sigue apagando lo que sí alcanza', () => {
  const CSS = readFileSync('src/app/globals.css', 'utf8')

  it('el bloque global sigue puesto, y con `!important`', () => {
    const i = CSS.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(i, 'desapareció el apagador global de movimiento').toBeGreaterThan(-1)
    const bloque = CSS.slice(i, i + 400)
    expect(bloque).toMatch(/transition-duration: 0\.01ms !important/)
    expect(bloque).toMatch(/animation-duration: 0\.01ms !important/)
  })
})
