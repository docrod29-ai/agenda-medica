#!/usr/bin/env node
/**
 * TRINQUETE DEL SISTEMA DE DISEÑO — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ MIDE, Y POR QUÉ ESTAS CINCO CIFRAS ──────────────────────────────────
 *
 * La auditoría `PATIENT-UX-TRUTH-001` encontró que el problema de esta interfaz
 * no es que parezca hecha por una IA —no hay degradados morados ni tarjetas
 * redondeadas por todas partes— sino que **el sistema de diseño existe y la
 * aplicación no le obedece**: 6 065 estilos en línea en el 88,5 % de los
 * archivos, 146 hexadecimales escritos a mano, ~2 900 `fontSize` en línea con
 * 39 valores distintos para una escala que declara seis.
 *
 * Y encontró la causa: `@theme inline` sólo exponía CUATRO tokens a Tailwind.
 * Todo lo demás vivía en variables CSS que Tailwind no ve, así que **no había
 * utilidades que usar**. No era dejadez: era mecánica.
 *
 * DESIGN-SYSTEM-001 ensancha `@theme inline` para que la alternativa exista, y
 * este trinquete es lo que impide que la deuda vuelva a crecer mientras se
 * paga. Exigir cero hoy pondría el gate en rojo el primer día — y un gate que
 * nadie puede poner en verde acaba con `continue-on-error`, que es como se
 * murió el gate de ADRs. Así que se congela y **sólo puede bajar**.
 *
 * ── LAS CIFRAS ──────────────────────────────────────────────────────────────
 *
 *   hexCrudos       Colores escritos a mano en TS/TSX. Un color a mano no sigue
 *                   al tema: es el motivo de que /arquitectura saliera blanca
 *                   sobre lienzo oscuro.
 *   hexDistintos    Cuántos colores DISTINTOS (sin distinguir mayúsculas). Sube
 *                   cada vez que alguien inventa un gris más.
 *   hexEnDosCajas   Valores escritos en dos mayúsculas (`#3d5afe` y `#3D5AFE`).
 *                   Techo **0**: es puro, no cambia un píxel, y mientras exista
 *                   cualquier recuento de colores miente por exceso.
 *   fontSizeEnLinea Tamaños de letra en línea. La escala vive en `.t-*`.
 *   radioEnLinea    Radios numéricos en línea. La escala vive en `--r-*`.
 *   espacioEnLinea  `gap` y `padding` numéricos en línea. La escala, en `--e-*`.
 *
 * ── LO QUE ESTE TRINQUETE NO MIDE ───────────────────────────────────────────
 *
 * No mide si la pantalla está BIEN. Un archivo puede usar todos los tokens y
 * ser ilegible. La jerarquía, el contraste percibido y el ritmo se juzgan
 * mirando el producto —regla de `.claude/rules/design-system.md`: no se aprueba
 * una interfaz leyendo el código— y eso es `VISUAL-EXCELLENCE-001`.
 *
 * Tampoco mide accesibilidad: eso es `A11Y-GATE-001`, y necesita `axe` sobre el
 * producto corriendo.
 *
 * Uso:
 *   node scripts/design/trinquete-de-diseno.mjs
 *   node scripts/design/trinquete-de-diseno.mjs --actualizar   ← aprieta el trinquete
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const TECHO = 'docs/design/trinquete-de-diseno.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

/** Un hexadecimal completo: 3, 4, 6 u 8 dígitos, y nada hexadecimal detrás. */
const HEX = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g
const FONT_SIZE = /fontSize:\s*'?([0-9.]+)/g
const RADIO = /borderRadius:\s*'?([0-9.]+)/g
const ESPACIO = /\b(?:gap|padding|rowGap|columnGap):\s*'?([0-9.]+)/g

/**
 * Los archivos que cuentan: los que PINTAN. Se excluyen las pruebas —un golden
 * que reproduce un color a mano lo hace a propósito— y `globals.css` no entra
 * porque es la fuente de verdad: ahí los hexadecimales son los tokens.
 */
export function archivosQuePintan() {
  return execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
    .trim().split('\n')
    .filter(f => f && !f.includes('__tests__'))
}

export function medir(archivos = archivosQuePintan()) {
  const porCaja = new Map()   // hex en minúsculas → Map(escritura → veces)
  let hexCrudos = 0, fontSizeEnLinea = 0, radioEnLinea = 0, espacioEnLinea = 0
  const porArchivo = {}

  for (const f of archivos) {
    const s = readFileSync(f, 'utf8')
    let enEste = 0
    for (const m of s.matchAll(HEX)) {
      hexCrudos++; enEste++
      const k = m[0].toLowerCase()
      if (!porCaja.has(k)) porCaja.set(k, new Map())
      const g = porCaja.get(k)
      g.set(m[0], (g.get(m[0]) ?? 0) + 1)
    }
    fontSizeEnLinea += [...s.matchAll(FONT_SIZE)].length
    radioEnLinea += [...s.matchAll(RADIO)].length
    espacioEnLinea += [...s.matchAll(ESPACIO)].length
    if (enEste > 0) porArchivo[f] = enEste
  }

  const enDosCajas = [...porCaja.entries()].filter(([, g]) => g.size > 1).map(([k]) => k).sort()

  return {
    hexCrudos,
    hexDistintos: porCaja.size,
    hexEnDosCajas: enDosCajas.length,
    fontSizeEnLinea,
    radioEnLinea,
    espacioEnLinea,
    /** Diagnóstico, no techo: para poder decir DÓNDE, no sólo que subió. */
    detalle: { enDosCajas, porArchivo },
  }
}

const CIFRAS = ['hexCrudos', 'hexDistintos', 'hexEnDosCajas', 'fontSizeEnLinea', 'radioEnLinea', 'espacioEnLinea']

/** Compara medición contra techo. Devuelve `{ subieron, bajaron }`, ambos arrays. */
export function comparar(medida, techo) {
  const subieron = [], bajaron = []
  for (const c of CIFRAS) {
    const hoy = medida[c], tope = techo[c]
    if (typeof tope !== 'number') continue
    if (hoy > tope) subieron.push({ cifra: c, tope, hoy })
    if (hoy < tope) bajaron.push({ cifra: c, tope, hoy })
  }
  return { subieron, bajaron }
}

// ── Ejecución directa ────────────────────────────────────────────────────────
const esPrincipal = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (esPrincipal) {
  const medida = medir()

  if (ACTUALIZAR || !existsSync(TECHO)) {
    const { detalle, ...cifras } = medida
    writeFileSync(TECHO, JSON.stringify({
      porQue: 'Techo del trinquete de diseño (V9 · DESIGN-SYSTEM-001). Sólo puede BAJAR. Ver scripts/design/trinquete-de-diseno.mjs.',
      ...cifras,
      archivosConColorAMano: Object.keys(detalle.porArchivo).length,
    }, null, 2) + '\n')
    console.log('\n  Techo de diseño fijado:')
    for (const c of CIFRAS) console.log(`     ${c.padEnd(18)} ${medida[c]}`)
    console.log()
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const { subieron, bajaron } = comparar(medida, techo)

  if (subieron.length) {
    console.error('\n  DISEÑO: se añadió deuda.\n')
    for (const s of subieron) console.error(`     ${s.cifra.padEnd(18)} techo ${s.tope} → hoy ${s.hoy}`)
    if (medida.detalle.enDosCajas.length) {
      console.error(`\n     escritos en dos mayúsculas: ${medida.detalle.enDosCajas.join(', ')}`)
    }
    console.error('\n  Usa los tokens: colores en globals.css, tamaños en `.t-*`, radio en `--r-*`, espacio en `--e-*`.\n')
    process.exit(1)
  }

  if (bajaron.length) {
    console.error('\n  DISEÑO: bajaste deuda y no apretaste el trinquete.\n')
    for (const b of bajaron) console.error(`     ${b.cifra.padEnd(18)} techo ${b.tope} → hoy ${b.hoy}`)
    console.error('\n     node scripts/design/trinquete-de-diseno.mjs --actualizar\n')
    console.error('  Si no se baja el techo, el margen ganado se lo come el siguiente descuido.\n')
    process.exit(1)
  }

  console.log('\n  DISEÑO: igual que el techo. Sin deuda nueva.\n')
}
