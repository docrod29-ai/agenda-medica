/**
 * GOLDEN — el sistema de diseño existe y la aplicación no le obedecía.
 * V9 · `DESIGN-SYSTEM-001` · `DESIGN-THEME-001`.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La auditoría `PATIENT-UX-TRUTH-001` esperaba encontrar «cara de producto
 * generado por IA» y encontró lo contrario: hay una identidad declarada, oscura,
 * con los cocientes de contraste WCAG calculados a mano y escritos en el propio
 * CSS. Cero degradados, cero morados, **una** `rounded-2xl` en toda la
 * aplicación.
 *
 * El defecto era el otro: **el sistema existe y la aplicación lo esquiva.**
 *
 *   6 065 `style={{` en 177 de 200 archivos (88,5 %)
 *   1 205 hexadecimales a mano (151 distintos)
 *   ~3 000 `fontSize` en línea, ~60 valores para una escala de 6
 *   adopción de `components/ui/`: 48 de 200 archivos
 *
 * ── CÓMO SE DESCUBRIÓ, Y CUÁL ERA LA CAUSA RAÍZ ──────────────────────────────
 *
 * Contando. Y la causa no es dejadez: **`@theme inline` exponía CUATRO
 * entradas**. Todo el resto del sistema vivía en variables CSS que Tailwind no
 * conoce, así que no existían utilidades que usar. El código no tenía
 * alternativa al estilo en línea — es mecánica, no descuido.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un token que Tailwind no ve no es un token: es una convención que hay que
 * recordar. Y `.claude/rules/` ya tiene nombre para eso —`depende_de_recordar`—
 * y una lección cara (REG-241): **un tablero que depende de que alguien se
 * acuerde, miente.**
 *
 * La prueba de que el enfoque funciona ya existía antes de esta unidad:
 * `--r-pill` sustituyó una píldora escrita de cinco formas (`100`, `999`,
 * `9999`, `99`, `50`) y hoy tiene 131 adopciones. Un token bien puesto **sí** se
 * adopta aquí.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No aprueba ninguna pantalla.** Nadie ha abierto un navegador en esta
 *   unidad, y la directiva V9 §4 prohíbe aprobar interfaz leyendo el código.
 *   Esto vigila el CIMIENTO, no el resultado.
 * · No mide contraste: los tokens ya vienen medidos, los 1 161 literales que
 *   quedan **no se han medido nunca**.
 * · No cuenta `style={{` ni `fontSize`: esas dos deudas siguen abiertas y su
 *   trinquete llega con la escala tipográfica.
 * · El trinquete de literales cuenta ocurrencias, no pantallas: bajar el número
 *   no dice que una pantalla concreta quedara bien.
 * · Excluye `globals.css` a propósito — es donde los literales DEBEN vivir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')

/** Cuerpo del bloque `@theme inline`, que es lo que Tailwind convierte en utilidades. */
function bloqueTema(): string {
  const m = CSS.match(/@theme inline\s*\{([\s\S]*?)\n\}/)
  if (!m) throw new Error('no hay bloque @theme inline en globals.css')
  return m[1]
}

/**
 * Variables que NO las declara la hoja de estilo: las inyecta `next/font` en el
 * elemento raíz (`layout.tsx`, campo `variable`). Se declaran aquí para que la
 * comprobación de abajo no las dé por rotas, y para que se note el día que
 * alguien quite una fuente.
 */
const DE_NEXT_FONT = ['--font-geist-sans', '--font-geist-mono', '--font-fraunces']

describe('DESIGN-THEME-001 · Tailwind tiene que VER el sistema', () => {
  it('el bloque @theme inline expone mucho más que las cuatro entradas de origen', () => {
    /**
     * TRINQUETE, no cifra exacta: puede subir, nunca bajar. Cuatro era el número
     * con el que la aplicación no tenía a dónde ir.
     */
    const entradas = bloqueTema().match(/^\s*--[\w-]+\s*:/gm) ?? []
    expect(
      entradas.length,
      `@theme inline expone ${entradas.length} entradas. Eran 4 y por eso el ` +
      'código no tenía utilidades que usar. Este número sólo puede subir.',
    ).toBeGreaterThanOrEqual(36)
  })

  it('es `inline`, y eso no es un detalle de estilo', () => {
    /**
     * Al revés: sin `inline`, Tailwind COPIA el valor del token en la utilidad
     * en vez de apuntar a la variable. `bg-surface-2` congelaría el color del
     * tema oscuro y el tema claro dejaría de cambiar — con las utilidades
     * puestas por toda la aplicación, y sin que falle nada.
     */
    expect(CSS).toContain('@theme inline')
  })

  it('ningún token expuesto apunta a una variable que no existe', () => {
    /**
     * `--color-x: var(--no-existe)` no falla: produce una utilidad que no pinta
     * nada. Es «el dato tiene que LLEGAR» en versión CSS — el otro lado de la
     * frontera es la hoja de estilo, y hay que mirarlo.
     */
    const declaradas = new Set(CSS.match(/^\s*(--[\w-]+)\s*:/gm)?.map(l => l.trim().replace(/\s*:$/, '')) ?? [])
    const rotos: string[] = []
    for (const [, nombre, apunta] of bloqueTema().matchAll(/(--[\w-]+)\s*:\s*var\((--[\w-]+)\)/g)) {
      if (!declaradas.has(apunta) && !DE_NEXT_FONT.includes(apunta)) rotos.push(`${nombre} → ${apunta}`)
    }
    expect(rotos, `tokens expuestos que apuntan a la nada:\n${rotos.join('\n')}`).toEqual([])
  })

  it('las escalas que faltaban existen: espacio, radio intermedio y sombra', () => {
    // No cambian un píxel de nada hoy. Existen para que la próxima pantalla
    // tenga a dónde ir, que es la única forma en que un token se adopta.
    for (const t of ['--sp-1', '--sp-4', '--sp-8', '--r-sm', '--r-md', '--r-lg', '--sombra-1', '--sombra-2']) {
      expect(CSS, `falta el token ${t}`).toContain(`${t}:`)
    }
  })

  it('la escala de sombra se queda CORTA a propósito', () => {
    /**
     * «Exceso de sombras» está en la lista de lo que la interfaz no debe parecer
     * (directiva V9). Dos pasos es una decisión, y esta prueba impide que se
     * convierta en cinco sin que nadie lo discuta.
     */
    const pasos = CSS.match(/^\s*--sombra-\d+\s*:/gm) ?? []
    expect(pasos.length, 'si hacen falta más de dos sombras, es una decisión de diseño, no un añadido').toBeLessThanOrEqual(2)
  })
})

/* ── El trinquete de literales ───────────────────────────────────────────── */

function fuentes(dir = join(RAIZ, 'src'), acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') fuentes(p, acc); continue }
    if (/\.(tsx?|css)$/.test(n) && !p.endsWith('globals.css')) acc.push(p)
  }
  return acc
}

/**
 * TECHO DE LITERALES HEXADECIMALES — medido el 9-ago-2026.
 *
 * Sólo puede BAJAR. Es el mismo patrón que `lint-trinquete.mjs`, que lleva el
 * techo de lint en 96 y ha funcionado: si un cambio lo sube, se arregla el
 * cambio, no se sube el techo.
 *
 * Los cuatro más repetidos dicen de qué va la deuda: `#fff` (158), el azul de
 * marca reescrito a mano `#3d5afe` (122), y los *slate* `#64748b` y `#0f172a`,
 * que **no siguen al tema** — son la reaparición del defecto ya documentado en
 * `globals.css`, donde una página con `var(--panel)` caía al respaldo claro y
 * pintaba tarjetas blancas sobre el lienzo oscuro.
 */
const TECHO_LITERALES = 1161

describe('DESIGN-THEME-001 · trinquete de hexadecimales a mano', () => {
  it(`no hay más de ${TECHO_LITERALES} literales hexadecimales fuera de globals.css`, () => {
    let total = 0
    const peores: Record<string, number> = {}
    for (const f of fuentes()) {
      const n = (readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length
      if (n) { total += n; peores[f.replace(RAIZ + '/', '')] = n }
    }
    const top = Object.entries(peores).sort((a, b) => b[1] - a[1]).slice(0, 5)
    expect(
      total,
      `Hay ${total} literales hexadecimales y el techo es ${TECHO_LITERALES}.\n` +
      `Peores archivos: ${top.map(([f, n]) => `${f} (${n})`).join(', ')}\n\n` +
      'NUNCA subas el techo para pasar el CI: usa un token de globals.css. ' +
      'Un color a mano no sigue al tema y su contraste no lo ha medido nadie.',
    ).toBeLessThanOrEqual(TECHO_LITERALES)
  })

  it('el trinquete no está midiendo el vacío', () => {
    // Al revés: si el recorrido se rompe, `total` da 0 y la prueba de arriba
    // pasa en verde sin vigilar nada. Con 143 archivos afectados, un suelo de 50
    // es holgado y detecta un walker roto.
    const archivos = fuentes().filter(f => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')))
    expect(archivos.length, 'el recorrido de archivos no encuentra nada: está roto').toBeGreaterThan(50)
  })
})
