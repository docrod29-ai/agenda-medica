#!/usr/bin/env node
/**
 * EL TRINQUETE DEL SISTEMA DE DISEÑO — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ MIDE Y POR QUÉ ──────────────────────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` encontró que la premisa de la directiva no se cumplía:
 * no hay «cara de producto generado por IA» —cero degradados morados, una sola
 * tarjeta `rounded-2xl` en toda la aplicación— sino un sistema de diseño
 * declarado, con los contrastes WCAG calculados a mano en el propio CSS.
 *
 * **El defecto es el contrario: el sistema existe y la aplicación no le
 * obedece.** Y la causa raíz es mecánica, no de disciplina: `@theme inline`
 * exponía CUATRO valores a Tailwind, así que no había utilidades que usar y el
 * código no tenía alternativa al estilo en línea.
 *
 * Este script cuenta esa deuda. No opina: cuenta.
 *
 * ── POR QUÉ UN TRINQUETE Y NO UN OBJETIVO ───────────────────────────────────
 *
 * Un objetivo («cero estilos en línea») no se cumple nunca y se ignora al mes.
 * Un trinquete sólo pide una cosa: **que hoy no sea peor que ayer**. Es el mismo
 * mecanismo que `scripts/lint-trinquete.mjs`, que lleva meses funcionando, y la
 * misma razón: la deuda grande se paga bajando el techo, no prohibiendo el
 * siguiente commit.
 *
 * Si un cambio sube una cifra, **se arregla el cambio — no se sube el techo.**
 *
 * ── LO QUE ESTE NÚMERO *NO* DICE ────────────────────────────────────────────
 *
 * Que la interfaz esté bien. Son recuentos sobre el código fuente: no miden
 * jerarquía, ni contraste real en pantalla, ni si una pantalla tiene un solo
 * propósito. La directiva V9 §4 es explícita — *no se aprueba interfaz leyendo
 * código*. Esto sólo impide que la deuda crezca mientras se arregla.
 *
 * Uso:
 *   node scripts/design/trinquete-de-diseno.mjs            → informe + código de salida
 *   node scripts/design/trinquete-de-diseno.mjs --json     → sólo el JSON de medidas
 *   node scripts/design/trinquete-de-diseno.mjs --sellar   → congela el techo actual
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TECHO = join(RAIZ, 'docs', 'design', 'trinquete-de-diseno.json')

/** Interfaz = todo `.tsx` bajo `src/`, menos las pruebas. */
export function archivosDeInterfaz(dir = join(RAIZ, 'src'), acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) {
      if (n !== '__tests__' && n !== 'node_modules') archivosDeInterfaz(p, acc)
      continue
    }
    if (n.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/**
 * Las medidas. Cada una tiene que cumplir dos cosas para servir de trinquete:
 * ser DETERMINISTA (mismo árbol → mismo número) y bajar cuando se hace lo
 * correcto. Una medida que no baja al arreglar el problema enseña a ignorarla.
 */
export function medir(archivos) {
  const m = {
    estiloEnLinea: 0,
    archivosConEstiloEnLinea: 0,
    archivosDeInterfaz: archivos.length,
    hexEnLinea: 0,
    hexDistintos: 0,
    fontSizeEnLinea: 0,
    fontSizeDistintos: 0,
    radioEnLinea: 0,
    radioDistintos: 0,
    azulDeMarcaEnMinuscula: 0,
  }
  const hex = new Set()
  const tam = new Set()
  const radio = new Set()

  for (const f of archivos) {
    const src = readFileSync(f, 'utf8')
    const enLinea = (src.match(/style=\{\{/g) ?? []).length
    m.estiloEnLinea += enLinea
    if (enLinea > 0) m.archivosConEstiloEnLinea++

    for (const h of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      m.hexEnLinea++
      hex.add(h[0].toLowerCase())
    }
    for (const t of src.matchAll(/fontSize:\s*'?([\d.]+(?:px|rem|em)?)'?/g)) {
      m.fontSizeEnLinea++
      tam.add(t[1])
    }
    for (const r of src.matchAll(/borderRadius:\s*'?([\w.%]+)'?/g)) {
      m.radioEnLinea++
      radio.add(r[1])
    }
    /**
     * El azul de marca escrito a mano, en minúscula.
     *
     * El MISMO color convive en dos mayúsculas (`#3D5AFE` y `#3d5afe`), lo cual
     * no cambia un píxel pero sí hace que una búsqueda encuentre la mitad de los
     * sitios — que es como se pierde un color al cambiarlo. Se cuenta la
     * minúscula porque es la forma que NO coincide con la del token declarado
     * en `globals.css`.
     */
    m.azulDeMarcaEnMinuscula += (src.match(/#3d5afe/g) ?? []).length
  }

  m.hexDistintos = hex.size
  m.fontSizeDistintos = tam.size
  m.radioDistintos = radio.size
  return m
}

/** Qué tan lejos está el CSS de exponer sus tokens a Tailwind. */
export function tokensQueTailwindVe(css) {
  const bloque = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
  return (bloque.match(/^\s*--[\w-]+:/gm) ?? []).length
}

function informe() {
  const archivos = archivosDeInterfaz()
  const medidas = medir(archivos)
  medidas.tokensQueTailwindVe = tokensQueTailwindVe(
    readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8'),
  )
  return medidas
}

// ── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const esCLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (esCLI) {
  const medidas = informe()

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(medidas, null, 2) + '\n')
    process.exit(0)
  }

  if (args.includes('--sellar')) {
    const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
    techo.techo = medidas
    techo.selladoEn = new Date().toISOString().slice(0, 10)
    writeFileSync(TECHO, JSON.stringify(techo, null, 2) + '\n')
    console.log(`  Techo sellado en ${relative(RAIZ, TECHO)}.`)
    process.exit(0)
  }

  const { techo, suben, bajan } = comparar(medidas)
  const ancho = Math.max(...Object.keys(medidas).map(k => k.length))
  for (const [k, v] of Object.entries(medidas)) {
    const t = techo[k]
    const signo = t === undefined ? '·' : v > t ? '▲' : v < t ? '▼' : '='
    console.log(`  ${signo} ${k.padEnd(ancho)}  ${String(v).padStart(6)}   techo ${t ?? '—'}`)
  }
  console.log('')
  if (suben.length) {
    console.error(`  DISEÑO: ${suben.length} medida(s) por encima del techo:`)
    for (const s of suben) console.error(`    · ${s}`)
    console.error('\n  Se arregla el cambio, no se sube el techo.')
    process.exit(1)
  }
  console.log(bajan.length
    ? `  DISEÑO: ${bajan.length} medida(s) BAJAN. Sella el techo con --sellar.`
    : '  DISEÑO: igual que el techo. Sin deuda nueva.')
}

/** Compara medidas contra el techo sellado. `mejorSiSube` invierte el sentido. */
export function comparar(medidas, ruta = TECHO) {
  const sello = JSON.parse(readFileSync(ruta, 'utf8'))
  const techo = sello.techo
  const mejorSiSube = new Set(sello.mejorSiSube ?? [])
  const informativas = new Set(sello.informativas ?? [])
  const suben = []
  const bajan = []
  for (const [k, v] of Object.entries(medidas)) {
    if (techo[k] === undefined || informativas.has(k)) continue
    const empeora = mejorSiSube.has(k) ? v < techo[k] : v > techo[k]
    const mejora = mejorSiSube.has(k) ? v > techo[k] : v < techo[k]
    if (empeora) suben.push(`${k}: ${v} (techo ${techo[k]})`)
    if (mejora) bajan.push(k)
  }
  return { techo, suben, bajan }
}

export { informe, TECHO }
