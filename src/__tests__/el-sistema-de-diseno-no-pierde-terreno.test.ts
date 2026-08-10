/**
 * EL SISTEMA DE DISEÑO NO PIERDE TERRENO — V9 · DESIGN-SYSTEM-001 · REG-298.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * **280 referencias a token traían un respaldo de color escrito a mano**, del
 * tipo `var(--text, #0f172a)`. Parecen defensivas. No lo eran:
 *
 *   · **253 estaban OBSOLETAS** — el respaldo no coincidía ni con el valor
 *     oscuro ni con el claro de su propio token. Eran los colores de ANTES del
 *     rediseño, congelados en el código.
 *   · **5 apuntaban a tokens que NO EXISTEN** (`--warn-bg`, `--warn-border`,
 *     `--warn-text`, `--success`), así que el respaldo no era un respaldo: era
 *     **el único valor que se pintaba jamás**, igual en claro que en oscuro.
 *   · Sólo 22 coincidían con la realidad.
 *
 * El peor: `var(--text, #0f172a)`, en 35 sitios. Si ese respaldo llegara a
 * usarse, pintaría texto casi negro sobre el lienzo `#0B0C0E`. Contraste
 * ≈ 1,05 : 1. **Texto invisible.**
 *
 * Y el visible hoy: la tarjeta de aviso de `/pacientes` se pintaba color crema
 * (`#fff8e6`) sobre el lienzo oscuro, porque `--warn-bg` no existía. Es la
 * TERCERA aparición de esta forma — las dos anteriores están contadas en el
 * comentario de `--panel` en `globals.css`.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Empezando `DESIGN-SYSTEM-001` con una cifra de la auditoría anterior: «1 205
 * hexadecimales a mano, 125 de ellos el azul de marca retecleado». Al ir a
 * sustituirlos resultó que **la mayoría no eran literales sueltos sino
 * respaldos dentro de `var()`** — y la auditoría había contado mal.
 *
 * Eso convirtió un hallazgo mediano en uno peor: no había un color repetido a
 * mano, había **un segundo sistema de color entero, obsoleto, escondido dentro
 * del primero**. Y en cinco sitios era el que mandaba.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un respaldo es un **segundo valor para la misma decisión**. Nace igual que el
 * primero y se queda quieto mientras el token evoluciona. Nadie lo actualiza
 * porque nadie lo ve: sólo se pintaría si el token faltara, y el token nunca
 * falta… hasta el día que sí.
 *
 * Familia: **`se_contradice`**. Ninguna de las dos partes está mal por su
 * cuenta —el token es correcto, el respaldo lo fue— y por eso ninguna revisión
 * de una sola pieza lo encuentra.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Un token, un valor por tema, cero respaldos.** Si el token existe, el
 * respaldo sobra; si no existe, hay que definirlo, no parchearlo en el sitio de
 * uso. El techo de `respaldosDeToken` es **0** y sólo puede seguir siendo 0.
 *
 * Para el resto de la deuda —literales, tamaños, radios, sombras— no se
 * prohíbe: se cuenta y se sella. Prohibir hoy pondría en rojo 177 de 200
 * archivos, y un guardián que nadie puede poner en verde se desactiva en una
 * tarde (REG-245).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No dice que ninguna pantalla se vea bien.** Mide adherencia al sistema,
 *   no calidad visual ni legibilidad.
 * - **No verifica en navegador.** La tarjeta crema sobre lienzo oscuro se
 *   dedujo de que el token no existía; verla con los ojos sigue pendiente y
 *   está en `NAV-NAVEGADOR-001`.
 * - **No mide contraste.** Eso es `A11Y-GATE-001`, que todavía no existe.
 * - **No impide el estilo en línea.** Un `style={{ color: 'var(--text) }}` es
 *   correcto: el problema nunca fue el atributo, fue el valor suelto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { medir as medirSinTipar } from '../../scripts/design/trinquete-de-diseno.mjs'

/** El script es `.mjs` y no trae tipos; aquí se le pone el que de verdad devuelve. */
const medir = medirSinTipar as () => { conteo: Record<string, number> }

const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')
const TECHOS = JSON.parse(readFileSync(join(RAIZ, 'scripts', 'design', 'techos-de-diseno.json'), 'utf8'))

/** Los tokens de un bloque, con los comentarios fuera (traen llaves). */
function tokensDe(selector: string): Record<string, string> {
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  let j = css.indexOf(selector) + selector.length
  while (css[j] !== '{') j++
  let k = j, prof = 0
  for (;;) {
    if (css[k] === '{') prof++
    else if (css[k] === '}' && --prof === 0) break
    k++
  }
  const out: Record<string, string> = {}
  for (const m of css.slice(j, k).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const oscuro = tokensDe(':root')
const claro = tokensDe(':root[data-theme="light"]')

describe('un token, un valor por tema, cero respaldos', () => {
  it('no queda NINGÚN respaldo de color dentro de `var()`', () => {
    /**
     * Ésta es la que muerde. Probada al revés: reponiendo un solo
     * `var(--text, #0f172a)` en cualquier `.tsx`, falla.
     */
    expect(medir().conteo.respaldosDeToken).toBe(0)
  })

  it('el techo de respaldos es 0 y no puede ser otra cosa', () => {
    /**
     * El resto de los techos son deuda tolerada que va bajando. Éste no: un
     * respaldo obsoleto no es deuda, es un valor equivocado esperando su turno.
     * Si alguien sube este techo «temporalmente», esta prueba lo dice.
     */
    expect(TECHOS.techos.respaldosDeToken).toBe(0)
  })
})

describe('los tokens que el código usa existen de verdad', () => {
  it('todo `var(--x)` de un `.tsx` está definido en `globals.css`', () => {
    /**
     * `--warn-bg`, `--warn-border`, `--warn-text` y `--success` se usaban sin
     * existir. No fallaba nada visible en las pruebas: CSS no avisa de una
     * variable que falta, simplemente usa el respaldo — y ahí estaba el otro
     * defecto. Quitados los respaldos, un token inexistente ya no pinta nada,
     * así que esta comprobación pasa de higiene a necesaria.
     */
    /**
     * Las variables de `next/font` NO viven en `globals.css`: las inyecta el
     * cargador de fuentes sobre `<html>` (ver `app/layout.tsx`). Son legítimas y
     * se declaran aquí para que el guardián no las persiga — y para que se note
     * el día que alguien quite una fuente y deje su variable colgando.
     */
    const DE_NEXT_FONT = ['--font-plex-sans', '--font-plex-mono', '--font-fraunces']
    const layout = readFileSync(join(RAIZ, 'src', 'app', 'layout.tsx'), 'utf8')
    for (const v of DE_NEXT_FONT) expect(layout, `${v} ya no lo inyecta next/font`).toContain(v)

    const definidos = new Set([...Object.keys(oscuro), ...Object.keys(claro), ...DE_NEXT_FONT])
    const fuentes = (dir: string, acc: string[] = []): string[] => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, acc) }
        else if (e.endsWith('.tsx')) acc.push(p)
      }
      return acc
    }
    const huerfanos = new Set<string>()
    for (const f of fuentes(join(RAIZ, 'src'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[a-z0-9-]+)[,)]/g)) {
        if (!definidos.has(m[1]) && !CSS.includes(`${m[1]}:`)) huerfanos.add(m[1])
      }
    }
    expect([...huerfanos].sort()).toEqual([])
  })

  it('los cuatro que faltaban están definidos en LOS DOS temas', () => {
    /** Definirlos sólo en oscuro repetiría el defecto en el otro tema. */
    for (const t of ['--warn-bg', '--warn-border', '--warn-text', '--success']) {
      expect(oscuro[t], `${t} falta en el tema oscuro`).toBeTruthy()
      expect(claro[t], `${t} falta en el tema claro`).toBeTruthy()
    }
  })
})

describe('las escalas del sistema existen y Tailwind las ve', () => {
  it('hay escala de radio, espacio, elevación, movimiento y tipografía', () => {
    for (const t of ['--r-sm', '--r-md', '--r-lg', '--sp-1', '--sp-6', '--elev-1', '--elev-3', '--mov-normal', '--mov-nada', '--t-body', '--t-display']) {
      expect(oscuro[t], `falta ${t}`).toBeTruthy()
    }
  })

  it('`@theme inline` expone bastante más que cuatro cosas', () => {
    /**
     * Era la CAUSA RAÍZ del monolito de estilo en línea: Tailwind sólo veía
     * `--color-background`, `--color-foreground`, `--font-sans` y `--font-mono`,
     * así que no había ninguna utilidad de marca que usar y el código no tenía
     * alternativa. Sin esto, cualquier barrido visual es repintar dos veces.
     */
    const bloque = /@theme inline \{[\s\S]*?\n\}/.exec(CSS)?.[0] ?? ''
    const expuestos = (bloque.match(/^\s+--[a-z0-9-]+:/gm) ?? []).length
    expect(expuestos).toBeGreaterThanOrEqual(30)
  })

  it('los nombres nuevos llevan prefijo `nx-` y no pisan la escala de Tailwind', () => {
    /**
     * `--spacing-4` sin prefijo redefiniría `p-4` en TODA la aplicación de una
     * vez. Con `--spacing-nx-4` se añade vocabulario sin reinterpretar el que
     * ya se usa, que es la diferencia entre migrar poco a poco y migrar de
     * golpe.
     */
    const bloque = /@theme inline \{[\s\S]*?\n\}/.exec(CSS)?.[0] ?? ''
    const sinPrefijo = (bloque.match(/^\s+--(color|radius|spacing|shadow|text)-(?!nx-)[a-z0-9-]+:/gm) ?? [])
      .map(s => s.trim())
      .filter(s => !/--color-(background|foreground):/.test(s))
    expect(sinPrefijo).toEqual([])
  })
})

describe('el trinquete de diseño sólo baja', () => {
  it('ninguna métrica supera su techo', () => {
    const { conteo } = medir()
    const subidas = Object.keys(TECHOS.techos)
      .filter(k => conteo[k] > TECHOS.techos[k])
      .map(k => `${k}: ${conteo[k]} > ${TECHOS.techos[k]}`)
    expect(subidas, 'se añadió deuda de diseño; arregla el cambio, no subas el techo').toEqual([])
  })

  it('el techo sellado es el que mide el script hoy, sin holgura escondida', () => {
    /**
     * Un techo con margen es un techo que no muerde. Si alguien lo sube «por si
     * acaso», la deuda cabe sin que nadie se entere. Se exige que el sello sea
     * exactamente la medición — ni más, ni menos.
     */
    const { conteo } = medir()
    for (const k of Object.keys(TECHOS.techos)) expect(TECHOS.techos[k], `holgura en ${k}`).toBe(conteo[k])
  })
})
