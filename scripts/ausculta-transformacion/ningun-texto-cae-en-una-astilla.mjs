#!/usr/bin/env node
/**
 * NINGÚN TEXTO SE PINTA EN UNA ASTILLA — REG-434.
 *
 * ── QUÉ BUSCA ───────────────────────────────────────────────────────────────
 *
 * Un bloque de texto cuyo ancho renderizado es tan pequeño que las palabras
 * caen **una por renglón**. Es el aspecto que tiene un hijo de `grid` al que se
 * le olvidó declarar su columna: la rejilla lo auto-coloca en la primera hueca
 * —que suele ser la estrecha del número o del icono— y el párrafo se derrama
 * verticalmente por una tira de 34 px.
 *
 * ── POR QUÉ NINGUNA COMPUERTA LO CAZABA ─────────────────────────────────────
 *
 * · **No desborda a lo ancho.** Cabe: el texto se ajusta a la tira.
 * · **No falla axe.** Contraste, roles y etiquetas están bien.
 * · **No rompe el blanco táctil.** Ni siquiera es un control.
 * · **No sale en una captura de escritorio**, porque a partir de 1000 px la
 *   regla que faltaba sí existe.
 *
 * Lo vio el dueño en su iPhone. Se reproduce igual en Chromium a 390: la
 * auto-colocación de `grid` no depende del motor.
 *
 * ── EL CRITERIO, Y POR QUÉ ES ÉSE ───────────────────────────────────────────
 *
 * Palabras ÷ renglones. Un párrafo normal lleva de 6 a 14 palabras por renglón
 * en un teléfono; el defecto da **1,0**. El umbral se pone en 2,5 para dejar
 * fuera los casos legítimos de texto corto y estrecho —una etiqueta de eje, un
 * pie de tabla— sin dejar pasar la astilla.
 *
 * Se miran sólo bloques con **6 palabras o más**: por debajo de eso, «una
 * palabra por renglón» puede ser una decisión de maquetación y no un accidente.
 *
 *   node scripts/ausculta-transformacion/ningun-texto-cae-en-una-astilla.mjs [base] [ancho…]
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3400'
const ANCHOS = (process.argv[3] ?? '390,640,900,1440').split(',').map(Number)
const RUTAS = ['/', '/precios', '/demo', '/demo/razonamiento', '/evidencia', '/seguridad',
  '/arquitectura', '/operacion', '/contacto', '/paquetes', '/privacidad', '/terminos']
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const nav = await chromium.launch({ executablePath: CHROME })
let astillas = 0
for (const W of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: W, height: 900 } })
  const pag = await ctx.newPage()
  for (const ruta of RUTAS) {
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await pag.waitForTimeout(1200)
    const malos = await pag.evaluate(() => {
      const fuera = []
      for (const e of document.querySelectorAll('p, li, blockquote, dd, figcaption, td, th')) {
        // Sólo hojas de texto: un <li> que contiene <p> lo mide el <p>.
        if (e.querySelector('p, li, blockquote, ul, ol, table')) continue
        // `innerText` y no `textContent`: el segundo pega los hijos SIN espacio
        // («⭐ Estándar» + «Razonamiento…» = «EstándarRazonamiento»), y eso
        // subcontaba las palabras y disparaba falsos positivos en cada tabla.
        const t = (e.innerText || '').trim()
        const palabras = t ? t.split(/\s+/).length : 0
        if (palabras < 6) continue
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const r = e.getBoundingClientRect()
        if (r.height === 0) continue
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
        const renglones = Math.max(Math.round(r.height / lh), 1)
        const porRenglon = palabras / renglones
        if (porRenglon >= 2.5) continue
        /*
         * Y la firma que distingue el DEFECTO del texto legítimamente estrecho:
         * la astilla es mucho más angosta que el sitio que tiene. Una celda de
         * tabla de 298 px en una fila de 858 es una columna, y está bien; una
         * cita de 34 px en un bloque de 342 es un párrafo que cayó en la
         * columna del número. Sin este filtro la sonda acusaba 25 sitios, 24 de
         * ellos sanos — y una sonda que grita en falso se acaba ignorando, que
         * es el mismo fallo que perseguimos en los avisos del producto.
         */
        const proporcion = r.width / Math.max(e.parentElement?.getBoundingClientRect().width ?? r.width, 1)
        if (proporcion > 0.45 || r.width > 200) continue
        fuera.push({
          etiqueta: e.tagName.toLowerCase(),
          clase: (e.className || '').toString().split(/\s+/)[0] || '—',
          ancho: Math.round(r.width),
          disponible: Math.round(e.parentElement?.getBoundingClientRect().width ?? 0),
          palabras, renglones, porRenglon: +porRenglon.toFixed(2),
          texto: t.slice(0, 46),
        })
      }
      return fuera
    }).catch(() => [])
    for (const m of malos) {
      astillas++
      console.log(`  ✗ ${ruta} @${W}  <${m.etiqueta}.${m.clase}> ${m.ancho}px de ${m.disponible}  ${m.palabras} palabras / ${m.renglones} renglones = ${m.porRenglon}  «${m.texto}…»`)
    }
  }
  await ctx.close()
}
console.log(`\n  bloques de texto caídos en una astilla: ${astillas}`)
await nav.close()
process.exit(astillas > 0 ? 1 : 0)
