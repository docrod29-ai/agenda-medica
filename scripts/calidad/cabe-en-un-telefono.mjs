#!/usr/bin/env node
/**
 * LO QUE UN TELÉFONO NO PUEDE ENCOGER — REG-265.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * El guardián `la-pantalla-cabe-en-un-telefono` cierra tres defectos medidos en
 * un iPhone de 390 px. Y su propio comentario declara lo que NO puede ver:
 *
 *   «Un desborde nuevo por otra causa —un `width` fijo, una tabla ancha, una
 *    imagen sin `max-width`— pasa por aquí sin despeinarse.»
 *
 * Esto cubre esas tres. No sustituye al navegador: **acota**.
 *
 * ── LAS TRES CLASES, Y POR QUÉ ESTAS TRES ───────────────────────────────────
 *
 * 1. **Ancho fijo > 360 px** en una pantalla de la aplicación. 360 es el ancho
 *    útil de los teléfonos pequeños que siguen en uso; por encima de eso, el
 *    elemento no cabe y arrastra la página entera de lado.
 *
 * 2. **Rejilla `minmax(Npx, …)` sin `min()`.** Es el error clásico: `auto-fit`
 *    colapsa columnas vacías, pero el suelo de N px **no baja de N px**. La
 *    forma correcta —`minmax(min(Npx, 100%), 1fr)`— es idéntica en pantalla
 *    ancha y cede en la estrecha.
 *
 * 3. **Imagen sin ninguna restricción de ancho.** Una foto clínica a tamaño
 *    natural desborda cualquier teléfono.
 *
 * ── LO QUE NO CUENTA, Y COSTÓ TRES INTENTOS AVERIGUARLO ─────────────────────
 *
 * La primera medición dio **23 anchos fijos**. Ninguno era real:
 *
 *   · `max-width: 540px` — mi expresión casaba con la COLA de `max-width`.
 *     `max-width` es exactamente lo contrario del defecto: es la cura.
 *   · Hojas de impresión de receta y orden a 1000 px — son **carta**, y su
 *     ancho fijo es correcto: ese documento no se lee en un teléfono, se
 *     imprime.
 *   · Plantillas dentro de `document.write` — un brazalete que sale por la
 *     impresora, no una pantalla.
 *
 * Y de **15 imágenes** «sin tope», once tenían `width: 100%`, dos eran QR de
 * 200 px —que caben de sobra— y **dos estaban dentro de un comentario**.
 *
 * Real, tras las tres pasadas: **cero**.
 *
 * Es la cuarta vez en esta sesión que un medidor mío informa de más antes de
 * decir la verdad (152 motores que eran 50; 42 que eran 8; el guardián de
 * pautas gritando en toda la UCI). **Un medidor que informa de más enseña a
 * ignorarlo** — igual que un aviso clínico. Por eso las exclusiones están
 * escritas aquí y no en mi cabeza.
 *
 * Uso:  node scripts/calidad/cabe-en-un-telefono.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()

/** Ancho útil del teléfono pequeño que hay que soportar. */
const ANCHO_MINIMO = 360

const DONDE = ['src/app', 'src/components']
const esPrueba = (p) => p.includes('__tests__') || /\.test\.tsx?$/.test(p)

function archivos(dir, acc = []) {
  let e
  try { e = readdirSync(dir) } catch { return acc }
  for (const n of e) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) archivos(p, acc)
    else if (/\.(tsx|css)$/.test(n) && !esPrueba(p)) acc.push(p)
  }
  return acc
}

/**
 * ¿Este trozo es superficie de IMPRESIÓN y no pantalla?
 *
 * Una receta es carta: su ancho fijo es correcto y forzarla a encoger rompería
 * el documento que el paciente se lleva.
 */
function esImpresion(contextoAntes) {
  return /document\.write|@media print|window\.open\(|membrete|hoja-carta|\.hoja\b/i.test(contextoAntes)
}

/**
 * Ancho a partir del cual una COLUMNA FIJA de una rejilla ya no cabe.
 *
 * Un teléfono de 360 px con el relleno habitual deja unos 328 útiles. Una
 * columna clavada en 160 px se lleva la mitad y deja a la otra sin sitio; a
 * partir de ahí la página se va de lado. Por debajo de 160 son columnas de
 * icono, de hora o de casilla, que sí caben.
 */
const COLUMNA_FIJA_MAXIMA = 160

/**
 * ¿Esta rejilla YA se apila en el teléfono?
 *
 * La primera medición de la clase 4 dio **cuatro**: configuración, la sección
 * de recetas, la orden y la receta. Los cuatro eran falsos: cada uno lleva su
 * `className`, y cada archivo trae su propia consulta de medios que la pone en
 * `grid-template-columns: 1fr !important` por debajo de 900 o 1000 px.
 *
 * El `!important` no es descuido: un estilo en línea gana a una clase, y sin él
 * la consulta de medios no haría nada. Es la forma **correcta** de tener una
 * rejilla de dos columnas en escritorio.
 *
 * Lo que sí era defecto —la pantalla de inicio, REG-306— no tenía `className`
 * ni consulta de medios: sólo la rejilla clavada. Ésa es la diferencia que hay
 * que medir, y no la presencia del `px`.
 */
function seApilaEnMovil(archivo, contextoAntes) {
  const clase = [...contextoAntes.matchAll(/className=["'`]([^"'`]+)["'`]/g)].pop()
  if (!clase) return false
  for (const nombre of clase[1].split(/\s+/)) {
    if (!nombre) continue
    const re = new RegExp(
      `@media[^{]*max-width[\\s\\S]{0,400}?\\.${nombre}\\s*\\{[^}]*grid-template-columns:[^;]*!important`)
    if (re.test(archivo)) return true
  }
  return false
}

const anchosFijos = []
const rejillasRigidas = []
const imagenesSinTope = []
const columnasClavadas = []

for (const dir of DONDE) {
  for (const p of archivos(join(RAIZ, dir))) {
    const bruto = readFileSync(p, 'utf8')
    const rel = relative(RAIZ, p)
    /**
     * Los comentarios se QUITAN antes de mirar, en vez de intentar adivinar
     * «¿estoy dentro de uno?» con un vistazo hacia atrás.
     *
     * El primer intento hacía eso y se le colaron dos `<img>` que vivían dentro
     * de un comentario JSX explicando cómo se captura el membrete en el PDF.
     * Un ejemplo escrito en un comentario no desborda ninguna pantalla.
     */
    const t = bruto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

    /* `(?<![a-zA-Z-])` para NO casar con la cola de `max-width` / `min-width`. */
    for (const m of t.matchAll(/(?<![a-zA-Z-])width:\s*'?(\d{3,4})px/g)) {
      const n = Number(m[1])
      if (n <= ANCHO_MINIMO) continue
      if (esImpresion(t.slice(Math.max(0, m.index - 300), m.index))) continue
      anchosFijos.push(`${rel}::${n}px`)
    }

    for (const m of t.matchAll(/minmax\(\s*(\d+)px/g)) {
      const antes = t.slice(Math.max(0, m.index - 16), m.index + 10)
      if (!antes.includes('min(')) rejillasRigidas.push(`${rel}::minmax(${m[1]}px`)
    }

    /**
     * CLASE 4 — columna de rejilla clavada en píxeles.  REG-306.
     *
     * `gridTemplateColumns: '1fr 300px'` no es un `width:` ni un `minmax(`, así
     * que las clases 1 y 2 no lo veían. Y es el defecto que dejó la pantalla de
     * inicio saliéndose del teléfono: 300 de los 328 píxeles útiles se los
     * llevaba la columna derecha, y lo demás se iba de lado.
     *
     * No basta con encontrar el `px`: **la forma correcta también lo tiene**.
     * `minmax(min(180px, 100%), 1fr)` cede en pantalla estrecha, y una columna
     * de 44 px para la hora cabe de sobra. Por eso sólo cuenta la pista que
     * (a) es un número seco de píxeles —ni dentro de `minmax`, ni de `min`— y
     * (b) pasa de `COLUMNA_FIJA_MAXIMA`.
     */
    for (const m of t.matchAll(/grid-?[Tt]emplate-?[Cc]olumns:\s*['"`]?([^'"`;\n}]+)/g)) {
      const valor = m[1]
      /* Lo que va dentro de minmax()/min()/clamp() ya sabe ceder: se retira
         antes de mirar, en vez de intentar excluirlo con el vistazo atrás que
         a este mismo script ya se le coló dos veces. */
      const seco = valor.replace(/(?:minmax|min|clamp)\([^)]*\)/g, ' ')
      for (const px of seco.matchAll(/(\d{2,4})px/g)) {
        const n = Number(px[1])
        if (n <= COLUMNA_FIJA_MAXIMA) continue
        if (esImpresion(t.slice(Math.max(0, m.index - 300), m.index))) continue
        if (seApilaEnMovil(t, t.slice(Math.max(0, m.index - 220), m.index))) continue
        columnasClavadas.push(`${rel}::${valor.trim().slice(0, 40)}`)
      }
    }

    for (const m of t.matchAll(/<img\b[\s\S]{0,400}?\/?>/g)) {
      const g = m[0]
      if (/maxWidth|max-width|width:\s*'?100%|width=|className|objectFit|inset:\s*0/.test(g)) continue
      /**
       * Medido en MILÍMETROS es un documento impreso, no una pantalla: el QR
       * de la receta se dimensiona en `mm` para que el escáner lo lea en papel.
       * Un `mm` no desborda un teléfono porque no vive en un teléfono.
       *
       * Se busca la UNIDAD y no el valor: el ancho es `${tamMm}mm`, y una
       * expresión que parase en la llave de la plantilla no lo veía.
       */
      if (/mm[`'"]/.test(g)) continue
      /* Un QR de 200 px cabe en 360: no es un desborde. */
      const fijo = /width:\s*(\d{2,4})/.exec(g)
      if (fijo && Number(fijo[1]) <= ANCHO_MINIMO) continue
      imagenesSinTope.push(`${rel}::${g.replace(/\s+/g, ' ').slice(0, 60)}`)
    }
  }
}

const total = anchosFijos.length + rejillasRigidas.length + imagenesSinTope.length + columnasClavadas.length

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, anchosFijos, rejillasRigidas, imagenesSinTope, columnasClavadas }, null, 2))
} else {
  console.log(
    `\n  Lo que un teléfono de ${ANCHO_MINIMO} px no puede encoger: ${total}\n` +
    `     · anchos fijos     ${anchosFijos.length}\n` +
    `     · rejillas rígidas ${rejillasRigidas.length}\n` +
    `     · imágenes sin tope ${imagenesSinTope.length}\n` +
    `     · columnas clavadas ${columnasClavadas.length}\n`)
  for (const x of [...anchosFijos, ...rejillasRigidas, ...imagenesSinTope, ...columnasClavadas]) console.log(`     · ${x}`)
  console.log(
    total === 0
      ? '\n  Ninguno. Lo que quede sólo se ve abriendo un navegador con un teléfono emulado.\n'
      : '',
  )
}
