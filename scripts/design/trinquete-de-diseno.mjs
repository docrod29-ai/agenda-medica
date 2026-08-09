/**
 * TRINQUETE DEL SISTEMA DE DISEÑO — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
 *
 * `docs/DESIGN_SYSTEM.md:7` dice «si el código contradice esto, el documento
 * gana». No hay ninguna máquina que sostenga esa frase, y el código lleva
 * ganando desde hace 200 archivos: 1 086 hexadecimales a mano, 2 895 `fontSize`
 * en línea con 39 valores distintos, 1 092 radios con 20, 1 613 `gap` con 24.
 *
 * Un sistema de diseño sin compuerta es una recomendación.
 *
 * ── POR QUÉ TRINQUETE Y NO CERO ─────────────────────────────────────────────
 *
 * Exigir cero haría nacer el gate en rojo, y un gate que nadie puede poner en
 * verde se marca `continue-on-error` y deja de proteger. Ya pasó aquí con el
 * gate de ADRs y con el de lint (`scripts/lint-trinquete.mjs`, cuya mecánica
 * copia este archivo a propósito: dos trinquetes que se comportan distinto son
 * dos cosas que aprender).
 *
 * Así que la deuda se CONGELA y sólo puede bajar:
 *
 *   · más deriva que el techo  → falla, y dice en qué archivo se añadió
 *   · menos                    → falla también, pidiendo bajar el techo
 *
 * Lo segundo no es capricho: si el techo no se baja al arreglar algo, el margen
 * ganado se lo come el siguiente descuido sin que nadie se entere.
 *
 * ── Y LA REGLA QUE DE VERDAD MUERDE ─────────────────────────────────────────
 *
 * **Una pantalla NUEVA nace limpia.** El techo congela la deuda de los archivos
 * que ya existían; un archivo que no estaba en la foto no tiene deuda que
 * congelar, así que se le exige cero. Ésa es la compuerta que pide la directiva
 * V9 §1 para esta unidad —«que falle si una pantalla nueva no usa el sistema»—
 * y es la única forma de que la deriva deje de crecer mientras se limpia.
 *
 * ── QUÉ **NO** MIDE ─────────────────────────────────────────────────────────
 *
 * - **No mira una pantalla.** Cuenta literales en el código. Que un archivo dé
 *   cero no dice que se vea bien; dice que no inventó medidas.
 * - No mide contraste. Los 1 086 hexadecimales nunca se midieron y este script
 *   tampoco los mide: sólo sabe cuáles son un token reteclado a mano.
 * - No entiende cadenas compuestas (`padding: '8px 12px'`): sólo valores
 *   numéricos sueltos. Es deliberado — atribuir un valor a un lado de la caja
 *   exige adivinar, y un medidor que adivina enseña a ignorarlo.
 * - No vigila el CSS de `globals.css`. Ahí es donde el sistema se DEFINE.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  archivosTsx, agregar, compararConTecho, escribirTecho, leerTechoDe, informar,
} from './trinquete-comun.mjs'

const RAIZ = process.cwd()
const TECHO = join(RAIZ, 'docs', 'design', 'diseno-techo.json')
const GLOBALS = join(RAIZ, 'src', 'app', 'globals.css')

/** Las escalas sancionadas. Se declaran aquí Y en `globals.css`; que no se
 *  separen lo vigila `el-sistema-de-diseno-se-cumple.test.ts`, que las lee del
 *  CSS y las compara con éstas. Duplicarlas sin guardián sería la familia
 *  `depende_de_recordar` otra vez. */
export const ESCALA_TIPOGRAFIA = [10.5, 11, 12, 13, 14, 16, 20, 28]
export const ESCALA_RADIO = [0, 4, 6, 8, 10, 12, 14, 16, 50, 9999]
export const ESCALA_ESPACIO = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32]

/** Propiedades de espacio que se miden. `gap` y los rellenos/márgenes de un
 *  solo lado: son las que llevan un número suelto y por tanto las que se pueden
 *  comprobar sin adivinar. */
const PROPS_ESPACIO = [
  'gap', 'rowGap', 'columnGap',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
]

export const DIMENSIONES = ['hexRetecleado', 'tipografia', 'radio', 'espacio', 'sombra']

/**
 * Los hexadecimales que YA son un token, sacados de `globals.css`.
 *
 * Se derivan del CSS en vez de escribirse aquí porque una lista a mano se queda
 * atrás el día que alguien cambia un token, y entonces el trinquete deja de
 * cazar justo el caso que existe para cazar. Se leen los dos temas: el mismo
 * hexadecimal puede ser token en oscuro y literal ciego en claro — que es
 * exactamente lo que pasa con `#3D5AFE`.
 */
export function tokensHex(css = readFileSync(GLOBALS, 'utf8')) {
  const mapa = new Map()
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const hex = m[2].toUpperCase()
    if (!mapa.has(hex)) mapa.set(hex, m[1])
  }
  return mapa
}

/** Un número suelto en un estilo en línea: `fontSize: 13`, `fontSize: '13px'`,
 *  `fontSize: "13"`. Deja fuera `var(--x)`, `calc(...)` y las cadenas
 *  compuestas, que es lo que se quiere. */
function numerosDe(texto, prop) {
  const re = new RegExp(`\\b${prop}\\s*:\\s*['"\`]?(-?[0-9]+(?:\\.[0-9]+)?)(?:px)?['"\`]?\\s*[,}\\n]`, 'g')
  return [...texto.matchAll(re)].map(m => Number(m[1]))
}

/**
 * Cuenta la deriva de un archivo. Devuelve un objeto por dimensión más el
 * total, y el detalle de qué valores concretos la producen — sin el detalle, el
 * mensaje de fallo diría «subió a 43» y no serviría para arreglar nada.
 */
export function medirArchivo(texto, hexTokens) {
  const detalle = { hexRetecleado: [], tipografia: [], radio: [], espacio: [], sombra: [] }

  for (const m of texto.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = m[0].toUpperCase()
    if (hexTokens.has(hex)) detalle.hexRetecleado.push(`${m[0]} → var(${hexTokens.get(hex)})`)
  }
  for (const v of numerosDe(texto, 'fontSize')) {
    if (!ESCALA_TIPOGRAFIA.includes(v)) detalle.tipografia.push(v)
  }
  for (const v of numerosDe(texto, 'borderRadius')) {
    if (!ESCALA_RADIO.includes(v)) detalle.radio.push(v)
  }
  for (const prop of PROPS_ESPACIO) {
    for (const v of numerosDe(texto, prop)) {
      if (!ESCALA_ESPACIO.includes(Math.abs(v))) detalle.espacio.push(`${prop}: ${v}`)
    }
  }
  detalle.sombra = [...texto.matchAll(/\bboxShadow\s*:/g)].map(() => 'boxShadow en línea')

  const conteo = Object.fromEntries(DIMENSIONES.map(d => [d, detalle[d].length]))
  conteo.total = DIMENSIONES.reduce((n, d) => n + detalle[d].length, 0)
  return { conteo, detalle }
}

/** La medición completa del repositorio, hoy. */
export function medir() {
  const hexTokens = tokensHex()
  const archivos = archivosTsx([join(RAIZ, 'src', 'app'), join(RAIZ, 'src', 'components')], RAIZ)
  return agregar(archivos, DIMENSIONES, texto => medirArchivo(texto, hexTokens), RAIZ)
}

/** Compara la medición con el techo. Mecánica compartida — ver `trinquete-comun.mjs`. */
export function comparar(medicion, techo) {
  return compararConTecho(medicion, techo, DIMENSIONES)
}

export function leerTecho() {
  return leerTechoDe(TECHO)
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('trinquete-de-diseno.mjs')) {
  const medicion = medir()

  if (process.argv.includes('--actualizar') || !existsSync(TECHO)) {
    escribirTecho(TECHO, medicion,
      'Techo del trinquete de diseño (V9 · DESIGN-SYSTEM-001). SÓLO BAJA. `archivos` es la foto: un .tsx que no esté en la lista nace limpio.')
    console.log(`\n  Techo de diseño fijado en ${medicion.totales.total} usos de deriva sobre ${medicion.archivos.length} archivos.\n`)
    process.exit(0)
  }

  process.exit(informar({
    medicion,
    techo: leerTecho(),
    dimensiones: DIMENSIONES,
    nombre: 'deriva de diseño',
    comoArreglar: 'Usa las utilidades (bg-s2, text-fg2, rounded-10px, gap-8px, text-meta…) en vez de literales.',
    ordenActualizar: 'node scripts/design/trinquete-de-diseno.mjs --actualizar',
  }))
}
