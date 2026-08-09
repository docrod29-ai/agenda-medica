#!/usr/bin/env node
/**
 * EL TRINQUETE DE DISEÑO — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ MIDE, Y POR QUÉ ESE Y NO OTRO ───────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` encontró la causa raíz del monolito de estilo en línea
 * y la escribió en `DESIGN-THEME-001`: **`@theme inline` exponía cuatro
 * valores**, así que Tailwind no tenía utilidades que ofrecer y el código no
 * tenía alternativa al `style={{ … }}`. No era dejadez: era mecánica.
 *
 * Ensanchar `@theme` quita el motivo. No quita la deuda ya escrita — 6 065
 * estilos en línea, 1 205 hexadecimales, ~60 tamaños de letra donde la escala
 * declara ocho. Y una deuda que nadie mide vuelve a crecer mientras se limpia.
 *
 * Este trinquete la CONGELA. Igual que `lint-trinquete.mjs`, con una regla más
 * que ahí no hace falta y aquí sí:
 *
 *   · más deuda que el techo         → falla, y dice en qué archivo creció
 *   · menos                          → falla también, pidiendo bajar el techo
 *   · **archivo nuevo con deuda > 0** → falla siempre
 *
 * La tercera es la que pide la directiva V9 con todas las letras: «hay
 * compuerta que falla si una pantalla nueva no los usa». Una pantalla que nace
 * hoy nace con el sistema; lo viejo se limpia por barrido, no por sorpresa.
 *
 * ── QUÉ MIDE ESTE Y NO OTRO — LA DIVISIÓN DEL TRABAJO ───────────────────────
 *
 * Este repositorio YA tiene dos guardianes de diseño, y duplicar su criterio
 * sería el defecto que este programa persigue (una entidad, una fuente de
 * verdad). Así que aquí no se vuelve a juzgar lo que ellos ya juzgan:
 *
 * | Guardián | Qué gobierna | Qué NO puede ver |
 * |---|---|---|
 * | `color-trinquete.test.ts` | **El color.** Lista curada de crudos con token, con sus excepciones razonadas: el papel (se rasteriza, `var()` no resuelve) y las paletas categóricas (existen para distinguir, no para significar) | Un archivo nuevo: su techo es global |
 * | `escala-visual-trinquete.test.ts` | **La variedad**: cuántos números distintos hay que recordar en todo `src` | Lo mismo — y además no distingue archivo |
 * | **este** | **Ocurrencias por archivo** fuera de la escala, en lo que se pinta | El color: no lo toca, es de `color-trinquete` |
 *
 * El color no se cuenta aquí **a propósito**. Contarlo con una expresión regular
 * genérica marcaría como deuda los hexadecimales de la receta impresa y los de
 * las paletas de etiqueta, que están bien y tienen su motivo escrito.
 *
 * Lo que sí es nuevo, y ninguno de los dos puede dar, es **por archivo**: un
 * techo global deja pasar una pantalla nueva entera mientras otra se limpia.
 *
 * ── LOS DOS CONTADORES ──────────────────────────────────────────────────────
 *
 *   tipo   `fontSize` fuera de la escala. Los medios píxeles (12,5 · 13,5 ·
 *          11,5) no son una decisión de nadie: son copia de una copia. Y no
 *          sobreviven al redondeo del navegador con el zoom del sistema, que es
 *          justo lo que usa el médico cansado a las nueve de la noche.
 *   radio  `borderRadius` fuera de {6, 10, 14}. Incluye el `9999` crudo: existe
 *          `--r-pill` y tiene 131 adopciones. Ver el bloque RADIO de
 *          `globals.css` — la píldora llegó a estar escrita de cinco formas.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No aprueba una pantalla.** Cuenta valores fuera del sistema; no ve
 *   jerarquía, ni contraste real, ni si la pantalla se entiende. Aprobar una
 *   pantalla exige abrirla en un navegador (directiva V9 §4) y ningún `grep`
 *   sustituye eso.
 * - **No mide `src/lib/`** ni las rutas de API: ahí no se pinta.
 * - **No cuenta el estilo en línea en sí.** `style={{ padding: 12 }}` con un
 *   valor de la escala no es deuda de diseño: es sintaxis. La deuda es el valor
 *   inventado, no dónde se escribe.
 * - **No mide color.** Es de `color-trinquete.test.ts`, con su lista curada y
 *   sus excepciones. Aquí sólo se heredaría el criterio, mal.
 * - **No mide espacio.** La variedad la gobierna `escala-visual-trinquete`. Un
 *   `padding` fuera de los múltiplos de 4 casi no existe en este repositorio:
 *   contar lo que ya está bien sólo añade ruido.
 * - **No lee CSS.** `globals.css` es la fuente de los tokens.
 * - Cuenta ocurrencias de texto, no píxeles pintados. Un hexadecimal dentro de
 *   una rama muerta cuenta igual. Es deliberado: el código muerto también se
 *   copia.
 *
 * Uso:
 *   node scripts/design/trinquete-de-diseno.mjs               comprueba
 *   node scripts/design/trinquete-de-diseno.mjs --actualizar  fija el techo
 *   node scripts/design/trinquete-de-diseno.mjs --detalle     enseña dónde
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const RAIZ = process.cwd()
const TECHO = 'docs/design/diseno-techo.json'

/** Dónde se pinta. `src/lib/` no pinta; `src/app/api/` tampoco. */
export const CARPETAS = [join('src', 'app'), join('src', 'components')]

/**
 * LA ESCALA TIPOGRÁFICA, EN NÚMEROS.
 *
 * Ocho pasos, no seis. `docs/DESIGN_SYSTEM.md` declaraba seis (28·20·16·14·12·
 * 10,5) y la aplicación usaba otros: los cuatro tamaños más frecuentes —13
 * (538 usos), 12,5 (466), 12 (424), 11 (295)— y dos de ellos ni aparecían en la
 * escala. Una escala que la aplicación no usa no es una escala: es un deseo.
 *
 * Así que la escala absorbe los dos pasos enteros que faltaban (13 y 11) y
 * **rechaza los medios píxeles**. Ningún píxel se mueve hoy por esto; lo que
 * cambia es que el siguiente `fontSize` no inventa un valor número 61.
 */
export const ESCALA_TIPO = [28, 20, 16, 14, 13, 12, 11, 10.5]

/** `docs/DESIGN_SYSTEM.md` §4: 6 controles · 10 tarjetas · 14 modales. */
export const ESCALA_RADIO = [6, 10, 14]

/**
 * EXCEPCIONES, CON SU MOTIVO ESCRITO.
 *
 * Una excepción sin motivo es una lista de archivos que alguien fue añadiendo.
 * Estos dos no pueden resolver `var(--…)`, y por razones distintas:
 */
export const EXCEPCIONES = {
  'src/app/opengraph-image.tsx':
    'Lo pinta satori en el servidor, no un navegador: no hay hoja de estilos ni ' +
    'variables CSS que resolver. Un token aquí saldría literal en la imagen.',
  'src/app/global-error.tsx':
    'Es el boundary que se activa cuando ni el layout raíz carga — y globals.css ' +
    'lo importa el layout. Sus valores fijos son la decisión correcta, y su propio ' +
    'comentario ya lo dice.',
}

const COMENTARIO_BLOQUE = /\/\*[\s\S]*?\*\//g
const COMENTARIO_LINEA = /^\s*\/\/.*$/gm

/** El comentario que explica un color no es un color. Se quita antes de contar. */
export function sinComentarios(texto) {
  return texto.replace(COMENTARIO_BLOQUE, '').replace(COMENTARIO_LINEA, '')
}

const TAMANO = /fontSize:\s*(?:'|")?(-?\d+(?:\.\d+)?)(?:px)?(?:'|")?/g
const RADIO = /borderRadius:\s*(?:'|")?(\d+(?:\.\d+)?)(?:px|%)?(?:'|")?/g

/**
 * Mide UN texto. Separado de la lectura de disco a propósito: así la prueba
 * puede meterle el defecto a mano y comprobar que lo cuenta — un guardián que
 * sólo se prueba con el repositorio en verde no se ha probado.
 */
export function medirTexto(texto) {
  const limpio = sinComentarios(texto)

  let tipo = 0
  const tiposFuera = []
  for (const m of limpio.matchAll(TAMANO)) {
    const v = Number(m[1])
    if (!ESCALA_TIPO.includes(v)) { tipo++; tiposFuera.push(v) }
  }

  let radio = 0
  const radiosFuera = []
  for (const m of limpio.matchAll(RADIO)) {
    const v = Number(m[1])
    if (!ESCALA_RADIO.includes(v)) { radio++; radiosFuera.push(v) }
  }

  return { tipo, radio, total: tipo + radio, tiposFuera, radiosFuera }
}

function archivos(dir, salida = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'api' || entrada === '__tests__' || entrada === 'node_modules') continue
      archivos(ruta, salida)
    } else if (/\.(tsx|ts)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      salida.push(ruta)
    }
  }
  return salida
}

/** Recorre lo que se pinta y devuelve `{ total, porArchivo }`. */
export function medir() {
  const porArchivo = {}
  let total = 0
  for (const carpeta of CARPETAS) {
    const abs = join(RAIZ, carpeta)
    if (!existsSync(abs)) continue
    for (const ruta of archivos(abs)) {
      const rel = relative(RAIZ, ruta).split(sep).join('/')
      if (EXCEPCIONES[rel]) continue
      const m = medirTexto(readFileSync(ruta, 'utf8'))
      if (m.total > 0) { porArchivo[rel] = m.total; total += m.total }
    }
  }
  return { total, porArchivo }
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const esCLI = process.argv[1] && process.argv[1].endsWith('trinquete-de-diseno.mjs')
if (esCLI) {
  const actualizar = process.argv.includes('--actualizar')
  const detalle = process.argv.includes('--detalle')
  const { total, porArchivo } = medir()

  if (detalle) {
    const orden = Object.entries(porArchivo).sort((a, b) => b[1] - a[1])
    for (const [f, n] of orden.slice(0, 40)) console.log(`  ${String(n).padStart(4)}  ${f}`)
    console.log(`\n  ${orden.length} archivos con deuda · ${total} valores fuera del sistema\n`)
  }

  if (actualizar || !existsSync(TECHO)) {
    writeFileSync(TECHO, JSON.stringify({
      queEs: 'Techo del trinquete de diseño (V9 · DESIGN-SYSTEM-001). Sólo puede BAJAR. Lo escribe scripts/design/trinquete-de-diseno.mjs --actualizar.',
      escalaTipo: ESCALA_TIPO,
      escalaRadio: ESCALA_RADIO,
      total,
      porArchivo,
    }, null, 2) + '\n')
    console.log(`\n  Techo de diseño fijado en ${total} valores fuera del sistema.\n`)
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const nuevos = Object.entries(porArchivo).filter(([f]) => !(f in techo.porArchivo))
  const crecieron = Object.entries(porArchivo).filter(([f, n]) => (techo.porArchivo[f] ?? 0) < n && f in techo.porArchivo)

  if (nuevos.length) {
    console.error('\n  DISEÑO: un archivo NUEVO nace con valores fuera del sistema.\n')
    for (const [f, n] of nuevos) console.error(`     ${f}  →  ${n}`)
    console.error('\n  Lo nuevo se escribe con los tokens de globals.css. Ver docs/DESIGN_SYSTEM.md.\n')
    process.exit(1)
  }
  if (total > techo.total) {
    console.error(`\n  DISEÑO: ${total} valores fuera del sistema, el techo son ${techo.total}.\n`)
    for (const [f, n] of crecieron) console.error(`     ${f}  ${techo.porArchivo[f]} → ${n}`)
    console.error('')
    process.exit(1)
  }
  if (total < techo.total) {
    console.error(`\n  DISEÑO: ${total} < techo ${techo.total}. Baja el techo:`)
    console.error('     node scripts/design/trinquete-de-diseno.mjs --actualizar\n')
    console.error('  Un trinquete que no se aprieta es un tope.\n')
    process.exit(1)
  }
  console.log(`\n  Diseño: ${total} valores fuera del sistema, igual que el techo. Sin deuda nueva.\n`)
}
