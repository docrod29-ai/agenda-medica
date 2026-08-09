/**
 * TRINQUETE DE ESCALA — tipografía, espaciado y radio dejan de crecer a ojo.
 *
 * ── QUÉ SE MIDIÓ ─────────────────────────────────────────────────────────────
 *
 * El color ya tiene gobierno (`color-trinquete`). Lo demás no tenía ninguno:
 *
 *   · **38** tamaños de letra distintos, en 2 749 usos. Cero tokens.
 *   · **37** valores de espaciado (`padding`/`margin`/`gap`), en 3 826 usos.
 *   · **28** radios — y la PÍLDORA escrita de CINCO formas: `100`, `999`,
 *     `9999`, `99` y `50`.
 *
 * ── LA PÍLDORA ERA EL ÚNICO DEFECTO, NO UNA CUESTIÓN DE GUSTO ────────────────
 *
 * Que un chip mida 12 o 12.5 px es criterio de diseño. Que «redondéalo entero»
 * se escriba de cinco maneras no lo es: el navegador recorta el radio a la mitad
 * del lado más corto, así que en un chip las cinco cifras se ven IGUAL — y en
 * cuanto una se aplica a algo más alto dejan de coincidir, sin que nadie se
 * entere hasta que se ve raro. Unificado en `var(--r-pill)` (128 usos, 62
 * archivos): no cambia un píxel de lo que ya estaba bien, y la próxima píldora
 * no inventa una sexta cifra. El radio bajó de 28 a 24 valores.
 *
 * ── DÓNDE ESTÁ LA DEUDA DE VERDAD ────────────────────────────────────────────
 *
 * No en los 6 575 usos: en los **53 valores que aparecen una o dos veces**, que
 * suman apenas **231 usos**. Ésos son el `fontSize: 66` suelto, el `gap: 70`, el
 * `borderRadius: 520`. Migrar ESO —no la pantalla entera— llevaría la tipografía
 * de 38 a 16 valores y el espaciado de 37 a 19, y es trabajo de un rato.
 *
 * Por eso el trinquete cuenta VARIEDAD, no usos: lo que importa no es cuántas
 * veces se escribe 13 px, es cuántos números distintos hay que recordar.
 *
 * ── UN TECHO Y NO UN CERO ────────────────────────────────────────────────────
 *
 * Mismo criterio que el trinquete de lint y el de color: la cifra **sólo baja**.
 * Subirla es meter un valor que nadie eligió, y eso es justo lo que esto impide.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Techos actuales. BAJARLOS al migrar; subirlos es introducir deuda. */
const TECHO_TAMANOS = 38
const TECHO_ESPACIADOS = 37
const TECHO_RADIOS = 24

/**
 * Las cinco formas de escribir «píldora». Ya no debe quedar ninguna: existe
 * `var(--r-pill)`.
 *
 * El `(?![\d.])` evita que `borderRadius: 1000` se lea como un `100` con basura
 * detrás — un guardián que casa de más acaba desactivándose por ruidoso.
 */
const PILDORA_A_MANO = /borderRadius:\s*(?:100|999|9999|99|50)(?![\d.])/g

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, out); continue }
    if (e.endsWith('.tsx') || e.endsWith('.ts')) out.push(p)
  }
  return out
}

/**
 * La explicación no cuenta como código.
 *
 * Este mismo archivo escribe `borderRadius: 100` para contar el fallo. Una
 * prueba que no distingue el código de su explicación acaba obligando a no
 * explicar nada.
 */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

const ARCHIVOS = fuentes('src')

function contar(patron: RegExp): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of ARCHIVOS) {
    for (const x of sinComentarios(readFileSync(p, 'utf8')).matchAll(patron)) {
      m.set(x[1], (m.get(x[1]) ?? 0) + 1)
    }
  }
  return m
}

/** Los valores que aparecen poco: la lista de trabajo, no un reproche. */
const sueltos = (m: Map<string, number>, umbral = 20) =>
  [...m].filter(([, n]) => n < umbral).sort((a, b) => a[1] - b[1])

describe('el barrido encuentra código de verdad', () => {
  it('si esto se rompe, todos los techos de abajo pasarían vacíos', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(200)
  })
})

describe('tipografía', () => {
  const tamanos = contar(/fontSize:\s*([\d.]+)/g)

  it(`no hay más de ${TECHO_TAMANOS} tamaños distintos`, () => {
    const lista = sueltos(tamanos).map(([v, n]) => `${v}(${n})`).join(' ')
    expect(tamanos.size, `sueltos, por si sirve de lista de trabajo: ${lista}`)
      .toBeLessThanOrEqual(TECHO_TAMANOS)
  })

  it('y la deuda está localizada, no repartida', () => {
    // Confirma la premisa del techo: si esto dejara de ser cierto, el criterio
    // «migra los sueltos» dejaría de servir y habría que replantear el trinquete.
    const s = sueltos(tamanos)
    expect(s.length).toBeGreaterThan(10)
    expect(s.reduce((a, [, n]) => a + n, 0)).toBeLessThan(300)
  })
})

describe('espaciado', () => {
  const esp = contar(/(?:padding|margin|gap|marginTop|marginBottom|paddingTop|paddingBottom|marginLeft|marginRight|paddingLeft|paddingRight):\s*(\d+)\b/g)

  it(`no hay más de ${TECHO_ESPACIADOS} valores distintos`, () => {
    const lista = sueltos(esp).map(([v, n]) => `${v}(${n})`).join(' ')
    expect(esp.size, `sueltos: ${lista}`).toBeLessThanOrEqual(TECHO_ESPACIADOS)
  })
})

describe('radio', () => {
  /**
   * UN TOKEN NO ES UN NÚMERO QUE HAYA QUE RECORDAR — REG-294.
   *
   * Este trinquete cuenta VARIEDAD: «lo que importa no es cuántas veces se
   * escribe 13 px, es cuántos números distintos hay que recordar». Pero contaba
   * cada `var(--r-…)` como un valor más, así que **adoptar un token subía la
   * cifra** y el guardián se ponía rojo por el arreglo. Pasó al convertir
   * `/privacidad` a `--r-card` y `--r-modal`: 24 → 26.
   *
   * Un guardián que se pone rojo cuando haces lo correcto enseña a no hacerlo.
   * Todos los tokens colapsan a una sola entrada: del sistema hay que recordar
   * el sistema, no cada uno de sus nombres.
   */
  const rad = new Map<string, number>()
  for (const [v, n] of contar(/borderRadius:\s*([\d.]+|'[^']+'|`[^`]+`)/g)) {
    const clave = /var\(--/.test(v) ? '(token del sistema)' : v
    rad.set(clave, (rad.get(clave) ?? 0) + n)
  }

  it(`no hay más de ${TECHO_RADIOS} radios distintos`, () => {
    const lista = sueltos(rad).map(([v, n]) => `${v}(${n})`).join(' ')
    expect(rad.size, `sueltos: ${lista}`).toBeLessThanOrEqual(TECHO_RADIOS)
  })

  it('LA PÍLDORA SE ESCRIBE DE UNA SOLA FORMA', () => {
    /**
     * Éste es el único de los tres que va a CERO, porque no es cuestión de
     * gusto: `100`, `999`, `9999`, `99` y `50` significan lo mismo y se ven
     * igual en un chip — hasta que una se aplica a algo más alto.
     */
    const culpables: string[] = []
    for (const p of ARCHIVOS) {
      for (const m of sinComentarios(readFileSync(p, 'utf8')).matchAll(PILDORA_A_MANO)) {
        culpables.push(`${p} → ${m[0]}`)
      }
    }
    expect(culpables, `usa var(--r-pill):\n${culpables.slice(0, 10).join('\n')}`).toEqual([])
  })

  it('y el token existe de verdad (no es un nombre que no resuelve)', () => {
    /**
     * Un token inexistente no da error: la propiedad se descarta EN SILENCIO y
     * el chip sale con las esquinas cuadradas. Ya pasó en este repositorio con
     * otros nombres inventados.
     */
    const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8')
    expect(css).toMatch(/--r-pill:\s*9999px/)
    expect(css).toMatch(/--r-circulo:\s*50%/)
  })

  it('el token está EN USO, no sólo declarado', () => {
    // Un token declarado que nadie usa es una decisión escrita y sin conectar.
    const usos = ARCHIVOS.filter(p => readFileSync(p, 'utf8').includes('var(--r-pill)')).length
    expect(usos).toBeGreaterThan(40)
  })
})
