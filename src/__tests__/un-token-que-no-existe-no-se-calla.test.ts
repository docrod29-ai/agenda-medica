/**
 * UN TOKEN QUE NO EXISTE NO SE CALLA — V9 · DESIGN-SYSTEM-001 · REG-291.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Catorce tokens del sistema de diseño se **usaban sin estar declarados en
 * ninguna parte**. CSS no avisa de eso: una declaración cuyo `var()` no resuelve
 * y no lleva respaldo es *inválida a la computación*, y el navegador la
 * descarta en silencio. La propiedad no se aplica y no pasa nada visible —
 * excepto que el color que alguien eligió a propósito no está.
 *
 * Los tres que muerden, todos en pantallas de Practice:
 *
 * 1. **`/configuracion` · entrega de mensajes a pacientes.** El contador
 *    «Fallidos» se pinta `data.fallidos ? 'var(--danger)' : 'var(--text2)'`.
 *    `--danger` no existe: el ternario se evalúa, elige el rojo, y el rojo se
 *    descarta. **El contador de mensajes que no llegaron al paciente nunca se
 *    ponía rojo.** El mensaje de error de ese mismo panel, igual.
 *
 * 2. **`/pacientes` · aviso de posible duplicado.** `--warn-bg`, `--warn-text`
 *    y `--warn-border` tampoco existían, pero ahí sí había respaldo — y el
 *    respaldo llevaba colores de tema CLARO (`#fff8e6` crema, `#8a6100`
 *    marrón). O sea: sí se veía, y se veía **mal**. El único panel crema de una
 *    aplicación oscura, y justo el que defiende el invariante nº1 (UN PACIENTE ·
 *    UNA IDENTIDAD).
 *
 * 3. **`.t-h3`**, usada dos veces, no existe en la escala. Con el *preflight*
 *    de Tailwind los encabezados heredan tamaño y peso, así que el título de
 *    sección salía del tamaño del texto corrido: la jerarquía declarada no se
 *    dibujaba.
 *
 * ── POR QUÉ NO ES COSMÉTICO ─────────────────────────────────────────────────
 *
 * Los dos primeros son señales, no adorno. Un contador de fallos que no se pone
 * rojo es un fallo que nadie mira; un aviso de paciente duplicado que se ve como
 * un error de maquetación es un aviso que se aprende a ignorar. Es la misma
 * lección de REG-245 por el otro lado: allí un guardián gritaba de más y enseñó
 * a ignorarlo; aquí no grita nada.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando: se extrajeron todos los `var(--x)` de `src/` y se restaron los
 * `--x:` declarados en `globals.css`. Ninguna prueba podía verlo porque no hay
 * nada que ejecutar — es un símbolo que no resuelve, y CSS no tiene errores de
 * símbolo. Misma familia que REG-266 (`@keyframes spin` referenciado 90 veces y
 * definido en ningún sitio global).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo `var(--token)` que aparezca en `src/` tiene que estar declarado en
 * `globals.css`, o ser uno de los **inyectados en tiempo de ejecución** por
 * `next/font` — que se listan abajo, uno a uno, con el sitio que los crea. La
 * lista es corta a propósito: cada nombre que se le añade es un token que deja
 * de estar vigilado.
 *
 * Un respaldo (`var(--x, algo)`) **no salva**: si el token no existe, quien
 * pinta es el respaldo, y entonces el sistema de diseño no gobierna ese píxel.
 * Es exactamente el caso 2.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `var(--danger)` a `secciones-comunicacion.tsx`, o quitando
 * `--warn-bg` de `globals.css`, la primera prueba falla y nombra el archivo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No comprueba que el token sea el ADECUADO.** `var(--green)` donde tocaba
 *   `var(--red)` resuelve igual de bien. Eso lo ve un ojo, no un `grep`.
 * - **No mide contraste.** Que el token exista no dice que se lea. Los cocientes
 *   de los tokens están medidos a mano en `globals.css`; los de los ~900
 *   hexadecimales sueltos del código **siguen sin medirse**.
 * - **No vigila el sentido contrario**: un token declarado y que ya no usa nadie
 *   no falla aquí. Sobra, no rompe.
 * - **No cubre los respaldos rancios**: `var(--nexus, #3d5afe)` aparece 82 veces
 *   y el respaldo nombra un color que `--nexus` abandonó (hoy es `#6E84FE`). No
 *   se dispara nunca y por eso no es un defecto, pero documenta en falso el
 *   sistema. Va como `DESIGN-RESPALDOS-001` en el backlog, con su recuento.
 * - **No mira CSS que no sea `globals.css`** ni estilos que lleguen de una
 *   librería.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const RAIZ = process.cwd()
const GLOBALS = join(RAIZ, 'src', 'app', 'globals.css')

/**
 * Tokens que NO viven en `globals.css` porque los crea `next/font` al renderizar
 * y los cuelga de `<html>` (`src/app/layout.tsx`). Cada uno con su origen.
 */
const INYECTADOS_EN_EJECUCION = new Set([
  '--font-geist-sans', // layout.tsx · Geist({ variable })
  '--font-geist-mono', // layout.tsx · Geist_Mono({ variable })
  '--font-fraunces',   // layout.tsx · Fraunces({ variable })
])

/** Clases tipográficas del sistema, para la segunda prueba. */
const PREFIJO_ESCALA = /\bt-[a-z0-9][a-z0-9-]*\b/g

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue
      fuentes(p, acc)
    } else if (e.endsWith('.tsx') || e.endsWith('.ts')) acc.push(p)
  }
  return acc
}

/**
 * Quita comentarios de bloque y de línea antes de buscar.
 *
 * No es celo: `src/lib/hospital/news2.ts` explica en su cabecera por qué los
 * colores del NEWS2 «son cadenas `var(--x)` y no hexadecimales». Un guardián
 * que se queja de un ejemplo dentro de un comentario es un guardián que se
 * silencia (REG-245).
 */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const css = readFileSync(GLOBALS, 'utf8')
/** Todo `--x:` que aparezca a la izquierda de dos puntos es una declaración. */
const declarados = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]))
/** Nombres de clase definidos en `globals.css` (`.t-h1 {`, `.nx-num,`…). */
const clasesCss = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)\s*[,{:]/gi)].map((m) => m[1]))

const archivos = fuentes(join(RAIZ, 'src'))

describe('el sistema de diseño no puede referirse a lo que no ha declarado', () => {
  it('todo var(--token) usado en src está declarado en globals.css', () => {
    const huerfanos: string[] = []
    for (const archivo of archivos) {
      const texto = sinComentarios(readFileSync(archivo, 'utf8'))
      for (const m of texto.matchAll(/var\(\s*(--[a-z0-9-]+)(\$\{)?/gi)) {
        /**
         * `var(--badge-${tono}-t)`: el nombre se compone en ejecución y no hay
         * nada estático que comprobar. Se salta, y la cobertura que se pierde
         * se recupera en la prueba de abajo, que exige las seis familias de
         * insignia por su nombre. Sin eso, el salto sería un agujero.
         */
        if (m[2]) continue
        const token = m[1]
        if (declarados.has(token) || INYECTADOS_EN_EJECUCION.has(token)) continue
        huerfanos.push(`${relative(RAIZ, archivo)} → ${token}`)
      }
    }
    expect([...new Set(huerfanos)].sort()).toEqual([])
  })

  it('cada tono de StatusBadge tiene sus dos tokens, en los dos temas', () => {
    /**
     * `StatusBadge` compone el nombre del token: `var(--badge-${tono}-t)`. Ahí
     * la prueba de arriba no puede mirar, así que se mira aquí — y por el lado
     * que importa: **los tonos que el componente declara**, no los que
     * `globals.css` resulte tener. Un estado de cita con un tono nuevo y sin
     * token pintaría la insignia sin color y sin avisar.
     *
     * Los dos temas, además: el claro redefine las seis parejas por separado,
     * y ésa es exactamente la clase de olvido que ya pasó (`--text3` corregido
     * sólo en oscuro, `globals.css:1230`).
     */
    const src = readFileSync(join(RAIZ, 'src', 'components', 'StatusBadge.tsx'), 'utf8')
    const tonos = [...new Set([...src.matchAll(/tono:\s*'([a-z]+)'/g)].map((m) => m[1]))]
    expect(tonos.length).toBeGreaterThanOrEqual(5)

    const claro = css.match(/:root\[data-theme="light"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(claro).not.toBe('')
    for (const tono of tonos) {
      for (const parte of ['t', 'b']) {
        expect(declarados.has(`--badge-${tono}-${parte}`)).toBe(true)
        expect(claro).toContain(`--badge-${tono}-${parte}:`)
      }
    }
  })

  it('las clases de la escala tipográfica que se usan existen', () => {
    /**
     * `.t-h3` se usaba y no existe. La escala tiene seis pasos y el séptimo no
     * se inventa: el que la usaba quería `.t-h2`.
     */
    const huerfanas: string[] = []
    for (const archivo of archivos) {
      if (!archivo.endsWith('.tsx')) continue
      const texto = sinComentarios(readFileSync(archivo, 'utf8'))
      for (const m of texto.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const clases = m[1] ?? m[2] ?? m[3] ?? ''
        for (const c of clases.match(PREFIJO_ESCALA) ?? []) {
          if (!clasesCss.has(c)) huerfanas.push(`${relative(RAIZ, archivo)} → .${c}`)
        }
      }
    }
    expect([...new Set(huerfanas)].sort()).toEqual([])
  })

  it('los tokens que la escala tipográfica declara existen y los usan sus clases', () => {
    /**
     * La escala vivía sólo dentro de las clases `.t-*`. Ahora vive en tokens y
     * las clases los leen: un único sitio donde cambia un tamaño. Si alguien
     * vuelve a teclear el número dentro de la clase, esto lo caza.
     */
    const escala = ['display', 'h1', 'h2', 'body', 'caption', 'overline']
    for (const paso of escala) expect(declarados.has(`--fs-${paso}`)).toBe(true)

    const clase = (n: string) => css.match(new RegExp(`\\.t-${n}\\s*\\{[^}]*\\}`))?.[0] ?? ''
    for (const [n, token] of [
      ['display', '--fs-display'], ['h1', '--fs-h1'], ['h2', '--fs-h2'],
      ['body', '--fs-body'], ['caption', '--fs-caption'], ['overline', '--fs-overline'],
    ]) {
      expect(clase(n)).toContain(`font-size: var(${token})`)
    }
  })

  it('@theme expone los tokens, que es lo que hace que exista la utilidad', () => {
    /**
     * La causa raíz del monolito de estilo en línea era que `@theme inline`
     * exponía **cuatro** cosas: sin utilidad que usar, el código no tiene
     * alternativa al `style={{…}}`. Esta prueba fija el suelo por familia para
     * que nadie lo estreche sin querer.
     */
    const bloque = css.match(/@theme inline\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(bloque).not.toBe('')
    const cuenta = (prefijo: string) =>
      [...bloque.matchAll(new RegExp(`^\\s*${prefijo}[a-z0-9-]+\\s*:`, 'gim'))].length
    expect(cuenta('--color-')).toBeGreaterThanOrEqual(20)
    expect(cuenta('--radius-')).toBeGreaterThanOrEqual(5)
    expect(cuenta('--spacing-')).toBeGreaterThanOrEqual(7)
    expect(cuenta('--shadow-')).toBeGreaterThanOrEqual(2)
    expect(cuenta('--text-')).toBeGreaterThanOrEqual(6)

    /**
     * Y la trampa que casi entra: declarar `--font-display` DENTRO de `@theme`
     * lo haría referirse a sí mismo. Una variable CSS circular no da error: se
     * vuelve inválida y se lleva por delante a `.t-display`, la única clase que
     * la usa.
     */
    expect(bloque).not.toMatch(/^\s*--font-display\s*:/m)
  })

  it('la utilidad LLEGA: Tailwind la emite, y apuntando al token', async () => {
    /**
     * Las cuatro pruebas de arriba comprueban que el CÓDIGO dice lo acordado.
     * Ninguna comprueba que Tailwind lo acepte — y ésa es exactamente la regla
     * `el-dato-tiene-que-LLEGAR`: hay que mirar del otro lado antes de dar algo
     * por entregado.
     *
     * Aquí se compila `globals.css` de verdad y se exige que:
     *
     *   1. la utilidad exista (si `@theme` no la ve, no se emite y nadie se
     *      entera hasta que una clase no hace nada), y
     *   2. su valor sea `var(--token)` y **no el color literal**. Es lo que
     *      hace `inline` y es lo que sostiene el cambio de tema: el claro se
     *      hace redefiniendo `--bg` bajo `[data-theme="light"]`. Una utilidad
     *      con el valor congelado compilaría igual, pasaría cualquier revisión
     *      de código, y dejaría media aplicación clavada en oscuro.
     *
     * `@source inline(...)` fuerza la generación: Tailwind sólo emite lo que
     * encuentra usado, y estas utilidades acaban de nacer.
     */
    const [{ default: postcss }, { default: tailwind }] = await Promise.all([
      import('postcss'),
      import('@tailwindcss/postcss'),
    ])
    const sonda = 'bg-lienzo text-texto-3 border-borde rounded-card rounded-modal '
      + 'gap-sp3 p-sp6 shadow-modal text-h1 text-cuerpo bg-aviso-fondo bg-nexus-solido'
    const entrada = `${css}\n@source inline("${sonda}");\n`
    const salida = (await postcss([tailwind()]).process(entrada, { from: GLOBALS })).css

    const esperado: Record<string, string> = {
      'bg-lienzo': 'background-color: var(--bg)',
      'text-texto-3': 'color: var(--text3)',
      'border-borde': 'border-color: var(--border)',
      'rounded-card': 'border-radius: var(--r-card)',
      'rounded-modal': 'border-radius: var(--r-modal)',
      'gap-sp3': 'gap: var(--sp-3)',
      'p-sp6': 'padding: var(--sp-6)',
      'text-h1': 'font-size: var(--fs-h1)',
      'text-cuerpo': 'font-size: var(--fs-body)',
      'bg-aviso-fondo': 'background-color: var(--warn-bg)',
      'bg-nexus-solido': 'background-color: var(--nexus-solido)',
    }
    const fallos: string[] = []
    for (const [clase, decl] of Object.entries(esperado)) {
      const regla = salida.match(new RegExp(`\\.${clase}\\s*\\{[^}]*\\}`))?.[0]
      if (!regla) { fallos.push(`${clase}: Tailwind no la emite`); continue }
      if (!regla.includes(decl)) fallos.push(`${clase}: ${regla.replace(/\s+/g, ' ')} — se esperaba «${decl}»`)
    }
    expect(fallos).toEqual([])
  }, 60_000)
})
