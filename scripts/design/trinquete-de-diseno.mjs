#!/usr/bin/env node
/**
 * EL TRINQUETE DEL SISTEMA DE DISEÑO — V9 · DESIGN-SYSTEM-001.
 *
 * ── POR QUÉ UN TRINQUETE Y NO UNA PROHIBICIÓN ───────────────────────────────
 *
 * Prohibir el estilo en línea hoy pondría en rojo 177 de 200 archivos. Un
 * guardián que nadie puede poner en verde se desactiva en una tarde, y con él
 * se pierde la única señal que había. Es la misma lección de REG-245: un
 * guardián que grita de más enseña a ignorarlo.
 *
 * Así que se cuenta la deuda, se sella el número, y **el número sólo puede
 * bajar**. Es lo que ya funciona en `lint-trinquete.mjs`, aplicado al diseño.
 *
 * ── QUÉ MIDE, Y POR QUÉ CADA COSA ───────────────────────────────────────────
 *
 *   respaldosDeToken   `var(--x, #hex)` — un respaldo es un SEGUNDO valor para
 *                      el mismo token, y aquí los 280 que había estaban
 *                      obsoletos: `var(--text, #0f172a)` habría pintado texto
 *                      casi negro sobre el lienzo casi negro. Techo **0**: no
 *                      es deuda tolerable, es una bomba de relojería.
 *
 *   hexEnLinea         Colores literales en TSX. No siguen al tema, así que un
 *                      literal claro se cuela en el modo oscuro — ya pasó tres
 *                      veces (ver `--panel` y `--warn-*` en `globals.css`).
 *
 *   tamanosFueraDeEscala  `fontSize` en línea que no está en la escala de seis
 *                      pasos. Los cuatro más usados —13, 12.5, 11, 11.5— no
 *                      estaban en ella; medio píxel de diferencia no es una
 *                      decisión, es una deriva.
 *
 *   radiosFueraDeEscala   `borderRadius` que no es 6/10/14 ni un token.
 *
 *   sombrasEnLinea     `boxShadow` literal. Había 24 valores distintos en 28
 *                      usos: casi cada sombra era única, que es exactamente lo
 *                      contrario de una jerarquía de elevación.
 *
 * ── LOS CONTADORES DE GENERICIDAD (RT-01, V15 §29/§41) ──────────────────────
 *
 * El equipo rojo de V15 encontró que la vara anterior no podía medir lo que
 * decía medir: `GENERIC_AI_AESTHETIC_AUDIT.md` contaba CLASES Tailwind
 * (`bg-gradient-to-*`, `shadow-lg`) en un código 88,5 % estilo-en-línea — sus
 * ceros eran artefactos de método. Éstos cuentan el VALOR CSS, viva donde viva
 * (TSX en línea o `globals.css`, que aquí SÍ se mira: un degradado en la hoja
 * pinta igual que uno en línea):
 *
 *   gradientes     `linear/radial/conic-gradient(`. La señal n.º 1 de plantilla
 *                  de IA. Cuenta también los neutros (shimmer de esqueleto con
 *                  tokens): el techo se sella donde está y sólo baja — que un
 *                  degradado nuevo tenga que desplazar a uno viejo.
 *
 *   cristal        `backdrop-filter` (y su variante camelCase). El glassmorphism
 *                  ubicuo es la segunda señal; los usos legítimos están acotados
 *                  y documentados en `globals.css`.
 *
 *   halosDeColor   `rgba(r,g,b,…)` CON CROMA (r≠g o g≠b) dentro de una
 *                  declaración de sombra: el resplandor de color alrededor de
 *                  una caja es decoración de plantilla, no elevación. Las
 *                  sombras neutras (negras/grises) las cuenta `sombrasEnLinea`.
 *
 * ── QUÉ **NO** MIDE ─────────────────────────────────────────────────────────
 *
 * - **No mide si la pantalla se ve bien.** Mide adherencia al sistema. Una
 *   pantalla puede estar al 100 % de tokens y ser ilegible.
 * - **No cuenta `style={{}}` a secas.** Un estilo en línea que usa `var(--…)`
 *   es correcto: el problema nunca fue el atributo, fue el valor suelto.
 * - **No mira `src/app/globals.css` para la deuda de tokens** (ahí es donde los
 *   literales DEBEN vivir) — pero SÍ para la genericidad, que no depende de
 *   dónde viva el valor sino de que se pinte.
 * - **No vigila accesibilidad ni contraste.** Eso es `A11Y-GATE-001`.
 * - **No juzga la INTENCIÓN de un degradado**: cuenta todos. El techo sellado
 *   es la opinión; la lista `porArchivo` dice dónde mirar.
 *
 * Uso:  node scripts/design/trinquete-de-diseno.mjs
 *       node scripts/design/trinquete-de-diseno.mjs --actualizar   (baja el techo)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = process.cwd()
const TECHOS = join(RAIZ, 'scripts', 'design', 'techos-de-diseno.json')

/** La escala declarada. Un valor fuera de aquí es deriva, no decisión. */
const TAMANOS = new Set([10.5, 12, 14, 16, 20, 28])
const RADIOS = new Set([6, 10, 14, 50, 9999])

function fuentes(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue
      fuentes(p, acc)
    } else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** Genericidad en un fuente: degradados, cristal y halos de color (RT-01). */
function genericidadEn(src) {
  const gradientes = (src.match(/(?:linear|radial|conic)-gradient\(/g) ?? []).length
  const cristal = (src.match(/backdrop-filter|backdropFilter/gi) ?? []).length
  let halos = 0
  // Sólo dentro de una declaración de sombra: un rgba de color en un borde o
  // un fondo es deuda de `hexEnLinea`/tokens, no un halo.
  for (const decl of src.matchAll(/(?:box-shadow|boxShadow)[^;\n]*/g)) {
    for (const c of decl[0].matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      if (c[1] !== c[2] || c[2] !== c[3]) halos++
    }
  }
  return { gradientes, cristal, halos }
}

export function medir() {
  const conteo = {
    respaldosDeToken: 0, hexEnLinea: 0, tamanosFueraDeEscala: 0, radiosFueraDeEscala: 0, sombrasEnLinea: 0,
    gradientes: 0, cristal: 0, halosDeColor: 0,
  }
  const porArchivo = {}

  for (const archivo of fuentes(join(RAIZ, 'src'))) {
    const src = readFileSync(archivo, 'utf8')
    const rel = relative(RAIZ, archivo)

    // Un respaldo de color dentro de var(): el token ya tiene valor en los dos temas.
    const respaldos = (src.match(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g) ?? []).length

    // Literales de color FUERA de un var(): los de dentro ya los cuenta `respaldos`.
    const hex = (src.replace(/var\([^)]*\)/g, '').match(/#[0-9a-fA-F]{6}\b/g) ?? []).length

    let tam = 0
    for (const m of src.matchAll(/fontSize:\s*([0-9.]+)\b/g)) if (!TAMANOS.has(Number(m[1]))) tam++

    let rad = 0
    for (const m of src.matchAll(/borderRadius:\s*([0-9.]+)\b/g)) if (!RADIOS.has(Number(m[1]))) rad++

    const sombras = (src.match(/boxShadow:\s*['"`]/g) ?? []).length

    const { gradientes, cristal, halos } = genericidadEn(src)

    const total = respaldos + hex + tam + rad + sombras + gradientes + cristal + halos
    if (total) porArchivo[rel] = { respaldos, hex, tam, rad, sombras, gradientes, cristal, halos, total }
    conteo.respaldosDeToken += respaldos
    conteo.hexEnLinea += hex
    conteo.tamanosFueraDeEscala += tam
    conteo.radiosFueraDeEscala += rad
    conteo.sombrasEnLinea += sombras
    conteo.gradientes += gradientes
    conteo.cristal += cristal
    conteo.halosDeColor += halos
  }

  // La genericidad no depende de dónde viva el valor: globals.css también
  // pinta. Sólo los tres contadores de RT-01 — la deuda de tokens NO se mide
  // aquí, porque la hoja es justo donde los literales deben vivir.
  const hoja = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')
  const g = genericidadEn(hoja)
  if (g.gradientes + g.cristal + g.halos) {
    porArchivo['src/app/globals.css'] = {
      respaldos: 0, hex: 0, tam: 0, rad: 0, sombras: 0,
      gradientes: g.gradientes, cristal: g.cristal, halos: g.halos,
      total: g.gradientes + g.cristal + g.halos,
    }
  }
  conteo.gradientes += g.gradientes
  conteo.cristal += g.cristal
  conteo.halosDeColor += g.halos

  return { conteo, porArchivo }
}

/**
 * EL CUERPO DE LÍNEA DE ÓRDENES SÓLO CORRE SI SE INVOCA DIRECTAMENTE.
 *
 * Sin esta guarda, `import` desde una prueba ejecuta el script entero. Costó
 * dos defectos reales, y el segundo es el que da miedo:
 *
 *  1. `trinquete-de-diseno.mjs` llamaba a `process.exit(1)` al importarlo, así
 *     que una regresión de diseño **tumbaba la recolección** de la prueba en vez
 *     de fallar un caso. El fallo se veía, pero decía otra cosa.
 *
 *  2. `inventario-de-pantallas.mjs` REESCRIBÍA el markdown al importarlo. La
 *     prueba comparaba el archivo contra `generar()`… después de que el propio
 *     import lo hubiera puesto al día. **El guardián no podía fallar nunca.**
 *     Una prueba que no puede fallar no es una prueba — y ésta llevaba dos
 *     commits fingiendo que lo era.
 */
const INVOCADO_DIRECTAMENTE = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (INVOCADO_DIRECTAMENTE) {
  cli()
}

function cli() {
const { conteo, porArchivo } = medir()
const techos = JSON.parse(readFileSync(TECHOS, 'utf8'))

if (process.argv.includes('--actualizar')) {
  const bajados = []
  for (const k of Object.keys(conteo)) {
    if (conteo[k] < techos.techos[k]) { bajados.push(`${k}: ${techos.techos[k]} → ${conteo[k]}`); techos.techos[k] = conteo[k] }
  }
  techos.peores = Object.entries(porArchivo).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
    .map(([f, d]) => ({ archivo: f, ...d }))
  writeFileSync(TECHOS, JSON.stringify(techos, null, 2) + '\n')
  console.log(bajados.length ? `✓ techo bajado:\n   ${bajados.join('\n   ')}` : '· nada que bajar')
  process.exit(0)
}

let subio = false
console.log('\n  TRINQUETE DE DISEÑO\n')
for (const k of Object.keys(conteo)) {
  const t = techos.techos[k]
  const señal = conteo[k] > t ? '✗' : conteo[k] < t ? '↓' : '·'
  if (conteo[k] > t) subio = true
  console.log(`  ${señal} ${k.padEnd(22)} ${String(conteo[k]).padStart(5)}   techo ${t}`)
}

if (subio) {
  console.log('\n  El sistema de diseño perdió terreno. Arregla el cambio, NO subas el techo.')
  console.log('  Los tokens viven en src/app/globals.css; el porqué, en docs/design/NEXUS_DESIGN_SYSTEM.md\n')
  const peores = Object.entries(porArchivo).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
  for (const [f, d] of peores) console.log(`     ${String(d.total).padStart(4)}  ${f}`)
  console.log()
  process.exit(1)
}
console.log('\n  Sin deuda de diseño nueva.\n')
}
