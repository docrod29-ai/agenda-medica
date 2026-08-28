/**
 * CONTRASTE WCAG 2.2 — LA FÓRMULA, SIN NAVEGADOR.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO EN UN ARNÉS DE PLAYWRIGHT ────────────────────────
 *
 * `scripts/design/axe-*.mjs` ya mide contraste **de verdad**, pintado, con
 * axe-core dentro de Chromium. Pero necesita un servidor levantado y el
 * emulador de Firestore sembrado: no corre en CI, corre cuando alguien se
 * acuerda. Un guardián que sólo corre cuando alguien se acuerda no es una red.
 *
 * Los TOKENS sí se pueden medir sin pintar nada: son valores literales en
 * `globals.css` y la fórmula de WCAG es aritmética cerrada. Esto no sustituye a
 * axe —no sabe qué texto va sobre qué fondo en la pantalla real— pero sí caza
 * la regresión que importa: **alguien retoca un token y deja un par crítico
 * por debajo del mínimo**, que es exactamente como se rompió `--text3` antes.
 *
 * ── QUÉ **NO** HACE ─────────────────────────────────────────────────────────
 *
 * - No mira composición real. Si una pantalla pinta `--text3` sobre `--nexus`
 *   sin que ese par esté declarado abajo, esto no lo ve.
 * - No mide texto sobre imagen, sobre degradado ni sobre vídeo.
 * - No mide el estado `:hover`/`:focus` de un token derivado con `color-mix()`.
 * - No sabe el tamaño de la letra: aplica el umbral de texto normal (4,5:1) a
 *   todo par declarado como texto. Es deliberadamente conservador — el umbral
 *   flojo de 3:1 sólo vale para ≥ 24 px o ≥ 19 px en negrita, y un token no
 *   sabe con qué tamaño lo van a usar.
 */

/** `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)` → `{ r, g, b, a }` en 0-255 / 0-1. */
export function leerColor(valor) {
  const v = String(valor).trim()

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]
    const par = h.length === 3 ? [...h].map(c => c + c) : h.match(/../g)
    return { r: parseInt(par[0], 16), g: parseInt(par[1], 16), b: parseInt(par[2], 16), a: 1 }
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i)
  if (rgb) {
    const alfa = rgb[4] === undefined
      ? 1
      : rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4])
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alfa }
  }

  return null
}

/**
 * Un color translúcido NO tiene luminancia propia: la que se ve es la mezcla
 * con lo que hay debajo. Sin este paso, `--border: rgba(242,239,233,0.08)` se
 * mediría como si fuera casi blanco — y daría un contraste espléndido que
 * nadie ve nunca.
 */
export function componer(frente, fondo) {
  if (frente.a >= 1) return { r: frente.r, g: frente.g, b: frente.b, a: 1 }
  const mezcla = c => frente[c] * frente.a + fondo[c] * (1 - frente.a)
  return { r: mezcla('r'), g: mezcla('g'), b: mezcla('b'), a: 1 }
}

/** Luminancia relativa — WCAG 2.x, §relative luminance. */
export function luminancia({ r, g, b }) {
  const lineal = c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
}

/** Razón de contraste entre dos colores ya compuestos sobre opaco. */
export function razon(colorA, colorB) {
  const la = luminancia(colorA)
  const lb = luminancia(colorB)
  const claro = Math.max(la, lb)
  const oscuro = Math.min(la, lb)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Contraste de un color (quizá translúcido) sobre un fondo opaco. Redondeado a 2. */
export function contraste(frenteCrudo, fondoCrudo) {
  const fondo = leerColor(fondoCrudo)
  const frente = leerColor(frenteCrudo)
  if (!fondo || !frente) return null
  if (fondo.a < 1) return null // un fondo translúcido no se puede medir sin saber qué hay debajo
  return Math.round(razon(componer(frente, fondo), fondo) * 100) / 100
}
