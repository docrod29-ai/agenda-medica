/**
 * TRINQUETE DE ACCESIBILIDAD — V9 · DESIGN-SYSTEM-001 / A11Y-GATE-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * De 566 archivos de prueba, **uno** era de accesibilidad, y era una expresión
 * regular sobre `layout.tsx` para comprobar que no se prohíbe el zoom. Ni
 * `axe-core`, ni `jest-axe`, ni `@axe-core/playwright` en `package.json`.
 * `eslint.config.mjs` son 18 líneas sin `jsx-a11y`.
 *
 * Objetivo declarado de V9: **WCAG 2.2 AA**. Nada lo sostenía, y nada impedía
 * una regresión.
 *
 * ── POR QUÉ ESTO Y NO `axe` ─────────────────────────────────────────────────
 *
 * `axe` es mejor herramienta y hay que tenerla: mide contraste real, orden de
 * foco y árbol de accesibilidad calculado, cosas que un `grep` no puede ver.
 * Pero necesita la aplicación **corriendo**, y la aplicación no arranca sin las
 * credenciales de Firebase, que este entorno no tiene. Un gate que sólo se puede
 * correr en la máquina del dueño no protege los días que él no está.
 *
 * Así que se hacen las dos cosas, en este orden: **hoy, el suelo estático que
 * corre en cualquier parte**; y `axe` sobre las nueve pantallas del paciente en
 * cuanto haya entorno con credenciales (`NAV-NAVEGADOR-001` en el backlog).
 * Este archivo declara explícitamente qué NO ve, para que nadie confunda el
 * suelo con el techo.
 *
 * ── QUÉ CUENTA COMO DEUDA ───────────────────────────────────────────────────
 *
 * Cuatro cosas, las cuatro con la misma consecuencia: alguien no puede usar el
 * producto.
 *
 * 1. **`botonSinNombre`** — un `<button>` cuyo contenido entero es un icono, y
 *    sin `aria-label` ni `aria-labelledby`. Un lector de pantalla anuncia
 *    «botón» y ya. El médico que lo usa con teclado no sabe cuál es el de
 *    borrar. `title` no cuenta: no se anuncia de forma fiable, no aparece en
 *    táctil y no lo ve quien navega con teclado.
 * 2. **`controlSinEtiqueta`** — `<input>`, `<select>` o `<textarea>` sin
 *    `aria-label`, sin `aria-labelledby` y sin `id` con el que una `<label>`
 *    pueda atarse. Un campo de dosis sin nombre es un campo de dosis que se
 *    rellena a ciegas.
 * 3. **`clicSinTeclado`** — `<div>`/`<span>`/`<li>` con `onClick` y sin `role`.
 *    Es la regla del sistema de diseño dicha en código: *un control
 *    interactivo que no es `<button>`* falla la compuerta. No se llega con
 *    tabulador, no responde a Intro, y el lector no dice que sea pulsable.
 * 4. **`imagenSinAlt`** — `<img>` sin `alt`. Con `alt=""` cuenta como
 *    decorativa y NO es deuda: declarar que una imagen no aporta información es
 *    una decisión correcta, no una omisión.
 *
 * ── QUÉ **NO** VE ───────────────────────────────────────────────────────────
 *
 * Y esto importa tanto como lo que ve, porque un medidor que se toma por
 * completo hace más daño que no tener ninguno:
 *
 * - **Contraste.** Ni de los tokens (ésos están medidos a mano en `globals.css`)
 *   ni de los 1 086 hexadecimales de las pantallas (ésos no se han medido
 *   nunca).
 * - **Orden de foco, trampa de foco en modales, cierre con Escape.**
 * - **Regiones vivas**: que un cambio dinámico se anuncie. Hay 1 `aria-live` en
 *   toda la aplicación; este trinquete no lo cuenta como deuda porque no sabe
 *   cuántas harían falta.
 * - **Si la etiqueta DICE algo útil.** Un `aria-label="botón"` pasa esta
 *   compuerta y no ayuda a nadie.
 * - **Nada de lo que sólo se ve con la aplicación corriendo.** La directiva V9
 *   §4 exige mirar; esto no sustituye mirar.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  archivosTsx, agregar, compararConTecho, escribirTecho, leerTechoDe, informar,
} from './trinquete-comun.mjs'

const RAIZ = process.cwd()
const TECHO = join(RAIZ, 'docs', 'design', 'a11y-techo.json')

export const DIMENSIONES = ['botonSinNombre', 'controlSinEtiqueta', 'clicSinTeclado', 'imagenSinAlt']

/** Los atributos de una etiqueta de apertura, desde `<tag` hasta su `>`.
 *  No se usa un analizador de JSX a propósito: haría falta compilar TypeScript
 *  dentro de la suite y este guardián tiene que ser barato para que se corra. */
function etiquetasDeApertura(texto, nombre) {
  const re = new RegExp(`<${nombre}(\\s[^>]*?)?(/?)>`, 'gs')
  return [...texto.matchAll(re)].map(m => ({ attrs: m[1] ?? '', indice: m.index ?? 0, autocerrada: m[2] === '/' }))
}

const tiene = (attrs, ...nombres) => nombres.some(n => new RegExp(`(^|\\s)${n}\\s*=`).test(attrs))

/**
 * Los tramos `<label>…</label>`, para no señalar un campo que SÍ está
 * etiquetado.
 *
 * Un control envuelto en su `<label>` está etiquetado de forma implícita: es
 * HTML válido, es lo que hacen las casillas de este producto, y contarlo como
 * defecto sería señalar de más. Un guardián que grita donde no hay nada enseña
 * a ignorarlo — la misma lección que REG-245 dejó con las alertas de UCI.
 *
 * No entiende `<label>` anidadas. No existen: anidar etiquetas no es HTML
 * válido.
 */
function tramosDeLabel(texto) {
  return [...texto.matchAll(/<label(\s[^>]*?)?>[\s\S]*?<\/label>/g)]
    .map(m => [m.index ?? 0, (m.index ?? 0) + m[0].length])
}

export function medirArchivo(texto) {
  const detalle = { botonSinNombre: [], controlSinEtiqueta: [], clicSinTeclado: [], imagenSinAlt: [] }

  /* 1 · Botón cuyo contenido entero es un icono autocerrado. */
  for (const m of texto.matchAll(/<button(\s[^>]*?)?>\s*(<[A-Z][A-Za-z0-9]*\s[^>]*?\/>|<[A-Z][A-Za-z0-9]*\/>)\s*<\/button>/gs)) {
    const attrs = m[1] ?? ''
    if (!tiene(attrs, 'aria-label', 'aria-labelledby')) {
      detalle.botonSinNombre.push(/<([A-Z][A-Za-z0-9]*)/.exec(m[2])?.[1] ?? 'icono')
    }
  }

  /* 2 · Campo sin nada con lo que nombrarlo. */
  const labels = tramosDeLabel(texto)
  const dentroDeLabel = i => labels.some(([a, b]) => i > a && i < b)
  for (const control of ['input', 'select', 'textarea']) {
    for (const { attrs, indice } of etiquetasDeApertura(texto, control)) {
      if (/(^|\s)type\s*=\s*["'{]?hidden/.test(attrs)) continue
      if (dentroDeLabel(indice)) continue
      if (!tiene(attrs, 'aria-label', 'aria-labelledby', 'id')) detalle.controlSinEtiqueta.push(control)
    }
  }

  /* 3 · Un div que hace de botón. */
  for (const contenedor of ['div', 'span', 'li', 'tr', 'td']) {
    for (const { attrs } of etiquetasDeApertura(texto, contenedor)) {
      if (tiene(attrs, 'onClick') && !tiene(attrs, 'role')) detalle.clicSinTeclado.push(contenedor)
    }
  }

  /* 4 · Imagen sin alt. `alt=""` es una decisión declarada, no una omisión. */
  for (const { attrs } of etiquetasDeApertura(texto, 'img')) {
    if (!tiene(attrs, 'alt')) detalle.imagenSinAlt.push('img')
  }

  const conteo = Object.fromEntries(DIMENSIONES.map(d => [d, detalle[d].length]))
  conteo.total = DIMENSIONES.reduce((n, d) => n + detalle[d].length, 0)
  return { conteo, detalle }
}

export function medir() {
  const archivos = archivosTsx([join(RAIZ, 'src', 'app'), join(RAIZ, 'src', 'components')], RAIZ)
  return agregar(archivos, DIMENSIONES, texto => medirArchivo(texto), RAIZ)
}

export function comparar(medicion, techo) {
  return compararConTecho(medicion, techo, DIMENSIONES)
}

export function leerTecho() {
  return leerTechoDe(TECHO)
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('trinquete-de-accesibilidad.mjs')) {
  const medicion = medir()

  if (process.argv.includes('--actualizar') || !existsSync(TECHO)) {
    escribirTecho(TECHO, medicion,
      'Techo del trinquete de accesibilidad (V9 · A11Y-GATE-001). SÓLO BAJA. Es un SUELO estático: no ve contraste, ni foco, ni nada que exija la aplicación corriendo.')
    console.log(`\n  Techo de accesibilidad fijado en ${medicion.totales.total} defectos sobre ${medicion.archivos.length} archivos.\n`)
    process.exit(0)
  }

  process.exit(informar({
    medicion,
    techo: leerTecho(),
    dimensiones: DIMENSIONES,
    nombre: 'deuda de accesibilidad',
    comoArreglar: 'Pon `aria-label` al botón de icono, `id` o `aria-label` al campo, y usa `<button>` en vez de un `<div onClick>`.',
    ordenActualizar: 'node scripts/design/trinquete-de-accesibilidad.mjs --actualizar',
  }))
}
