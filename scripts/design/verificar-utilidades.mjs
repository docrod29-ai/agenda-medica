/**
 * ¿LLEGAN DE VERDAD LAS UTILIDADES DEL SISTEMA DE DISEÑO?
 *
 * V9 · DESIGN-SYSTEM-001. Hermano directo de la regla
 * `.claude/rules/el-dato-tiene-que-llegar.md`.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ─────────────────────────────────────────────
 *
 * Declarar un token en `@theme` **no** es lo mismo que tener una utilidad. Entre
 * las dos cosas hay un compilador con reglas propias: si el token se declara en
 * el espacio de nombres equivocado, si dos espacios chocan, si `inline` no se
 * usa donde el valor es un `var()` que el tema reescribe — el CSS compila igual,
 * sin error, y la clase que uno escribe en el JSX **simplemente no existe**.
 *
 * Eso es exactamente la familia de REG-167 y REG-170: el código decía lo
 * acordado y nadie fue a mirar del otro lado. Aquí «el otro lado» es la hoja de
 * estilos compilada, así que se compila y se mira.
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 *
 * Se compila el `globals.css` **real** —no un extracto, no una copia— con dos
 * cambios mínimos:
 *
 *   · `source(none)`, para no rastrear los 203 `.tsx` del proyecto en cada
 *     ejecución de la suite (tardaría segundos y no aporta nada aquí);
 *   · `@source inline(...)` con las clases que se quieren comprobar, que es la
 *     forma que da Tailwind v4 de pedir una utilidad sin que nadie la use aún.
 *
 * Y luego se comprueba en el CSS de salida que la regla existe y que su valor
 * es el `var()` que se esperaba, no un color congelado.
 *
 * ── QUÉ **NO** COMPRUEBA ────────────────────────────────────────────────────
 *
 * - No abre un navegador. Que la clase exista en el CSS no dice que la pantalla
 *   se vea bien; la directiva V9 §4 exige mirarla, y esto no la sustituye.
 * - No comprueba la cascada: una utilidad puede existir y perder contra un
 *   estilo en línea del propio componente. Con 6 065 `style={{` en el
 *   repositorio, eso pasará — y es el trabajo de `VISUAL-EXCELLENCE-001`.
 * - No mide contraste.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const GLOBALS = join(process.cwd(), 'src', 'app', 'globals.css')

/**
 * Compila `globals.css` pidiendo las clases indicadas.
 * @param {string[]} clases
 * @returns {Promise<string>} el CSS de salida
 */
export async function compilar(clases) {
  const [{ default: postcss }, { default: tailwind }] = await Promise.all([
    import('postcss'),
    import('@tailwindcss/postcss'),
  ])
  const css = readFileSync(GLOBALS, 'utf8')
  if (!css.includes('@import "tailwindcss";')) {
    throw new Error('globals.css ya no importa tailwindcss como se esperaba: revisa este script antes de fiarte de él.')
  }
  const entrada = css.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
    + `\n@source inline("${clases.join(' ')}");\n`
  /* `from` apunta dentro de src/app para que las rutas relativas del CSS se
     resuelvan igual que en el build de verdad. El archivo no existe y no hace
     falta que exista: postcss sólo usa la ruta para resolver. */
  const salida = await postcss([tailwind()]).process(entrada, { from: join(process.cwd(), 'src', 'app', '__sonda.css') })
  return salida.css
}

/** ¿Emitió el compilador una regla para esta clase? */
export function tieneRegla(css, clase) {
  return new RegExp(`\\.${clase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`).test(css)
}

/** El cuerpo de la regla de esa clase, para poder mirar su valor. */
export function cuerpoDeRegla(css, clase) {
  const re = new RegExp(`\\.${clase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  return re.exec(css)?.[1]?.trim() ?? null
}

if (process.argv[1] && process.argv[1].endsWith('verificar-utilidades.mjs')) {
  const clases = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (!clases.length) {
    console.error('Uso: node scripts/design/verificar-utilidades.mjs bg-s2 text-meta gap-8px …')
    process.exit(1)
  }
  const css = await compilar(clases)
  let faltan = 0
  for (const c of clases) {
    const cuerpo = cuerpoDeRegla(css, c)
    if (cuerpo === null) { faltan++; console.error(`  FALTA  .${c}`) }
    else console.log(`  ok     .${c} { ${cuerpo.replace(/\s+/g, ' ')} }`)
  }
  process.exit(faltan ? 1 : 0)
}
