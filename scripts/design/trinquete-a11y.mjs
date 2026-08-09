#!/usr/bin/env node
/**
 * TRINQUETE DE ACCESIBILIDAD — V9 · DESIGN-SYSTEM-001 · A11Y-GATE-001.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * La auditoría de V9 lo midió: **1** prueba de accesibilidad entre 566, y es una
 * expresión regular sobre `layout.tsx`. `next/core-web-vitals` enciende seis
 * reglas, todas sobre atributos ARIA; ninguna mira lo que
 * `.claude/rules/design-system.md` nombra como mínimos que fallan la compuerta:
 * un control interactivo que no es `<button>`, un campo sin etiqueta.
 *
 * ── POR QUÉ UN TRINQUETE APARTE, Y NO SUBIR EL DE LINT ──────────────────────
 *
 * `lint-trinquete.mjs` cuenta ERRORES contra un techo de 96 que lleva meses
 * funcionando. Meter aquí 211 hallazgos nuevos como errores lo reventaría, y un
 * gate que nace en rojo se marca `continue-on-error` y deja de proteger — es
 * como murió el de ADRs. Las reglas de accesibilidad van en **aviso**
 * (`eslint.config.mjs`) y se cuentan aquí, con su propio techo.
 *
 * ── EL TECHO ES POR REGLA, NO UN TOTAL ──────────────────────────────────────
 *
 * Un total deja pasar el peor caso: alguien arregla 20 etiquetas y mete 15
 * `<div onClick>`, el número baja y la aplicación es menos accesible. Un
 * `<div onClick>` no lo puede pulsar quien navega con teclado; una etiqueta
 * suelta se lee mal pero se pulsa. No son intercambiables, así que no se suman.
 *
 * ── LO QUE ESTO NO PUEDE VER ────────────────────────────────────────────────
 *
 * Es análisis estático de JSX. **No mide** contraste real, foco visible, orden
 * de tabulación, atrapado de foco en un modal, cierre con Escape ni objetivo
 * táctil de 44×44 — los cinco mínimos restantes de la regla de diseño. Eso pide
 * `axe` sobre el producto corriendo, y ésa es la otra mitad de `A11Y-GATE-001`.
 *
 * Tampoco mide si la etiqueta DICE algo útil. `aria-label="botón"` pasa.
 *
 * Uso:
 *   node scripts/design/trinquete-a11y.mjs
 *   node scripts/design/trinquete-a11y.mjs --actualizar   ← aprieta el trinquete
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const TECHO = 'docs/design/trinquete-a11y.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

/** Cuenta los avisos `jsx-a11y/*`, agrupados por regla y por archivo. */
export function medir(informeJson) {
  const informe = informeJson ?? correrEslint()
  const porRegla = {}
  const porArchivo = {}
  let total = 0

  for (const f of informe) {
    const ruta = f.filePath.replace(process.cwd() + '/', '')
    for (const m of f.messages) {
      if (!m.ruleId?.startsWith('jsx-a11y/')) continue
      total++
      porRegla[m.ruleId] = (porRegla[m.ruleId] ?? 0) + 1
      porArchivo[ruta] = (porArchivo[ruta] ?? 0) + 1
    }
  }
  return { total, porRegla, porArchivo }
}

function correrEslint() {
  let salida = ''
  try {
    salida = execSync('npx eslint src -f json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    // eslint sale con 1 cuando hay ERRORES; la salida sigue siendo válida.
    salida = e.stdout ?? ''
  }
  if (!salida.trim()) {
    throw new Error('El analizador no devolvió nada. Un gate que no mide no protege.')
  }
  return JSON.parse(salida)
}

/**
 * Compara por REGLA. Una regla que desaparece del informe cuenta como 0, no como
 * ausente: si no, borrar la regla del config pasaría por «arreglado».
 */
export function comparar(medida, techo) {
  const reglas = new Set([...Object.keys(medida.porRegla), ...Object.keys(techo.porRegla ?? {})])
  const subieron = [], bajaron = []
  for (const r of [...reglas].sort()) {
    const hoy = medida.porRegla[r] ?? 0
    const tope = techo.porRegla?.[r] ?? 0
    if (hoy > tope) subieron.push({ regla: r, tope, hoy })
    if (hoy < tope) bajaron.push({ regla: r, tope, hoy })
  }
  return { subieron, bajaron }
}

// ── Ejecución directa ────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const medida = medir()

  if (ACTUALIZAR || !existsSync(TECHO)) {
    writeFileSync(TECHO, JSON.stringify({
      porQue: 'Techo de accesibilidad (V9 · A11Y-GATE-001). POR REGLA, y sólo puede BAJAR. Ver scripts/design/trinquete-a11y.mjs.',
      total: medida.total,
      porRegla: Object.fromEntries(Object.entries(medida.porRegla).sort((a, b) => b[1] - a[1])),
      archivosConHallazgos: Object.keys(medida.porArchivo).length,
    }, null, 2) + '\n')
    console.log(`\n  Techo de accesibilidad fijado: ${medida.total} avisos en ${Object.keys(medida.porArchivo).length} archivos.`)
    for (const [r, n] of Object.entries(medida.porRegla).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(4)}  ${r}`)
    }
    console.log()
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const { subieron, bajaron } = comparar(medida, techo)

  if (subieron.length) {
    console.error('\n  ACCESIBILIDAD: se añadió deuda.\n')
    for (const s of subieron) console.error(`     ${s.regla.padEnd(46)} techo ${s.tope} → hoy ${s.hoy}`)
    console.error('\n  Un control que se pulsa es un <button>. Un campo lleva etiqueta. WCAG 2.2 AA.\n')
    process.exit(1)
  }

  if (bajaron.length) {
    console.error('\n  ACCESIBILIDAD: bajaste deuda y no apretaste el trinquete.\n')
    for (const b of bajaron) console.error(`     ${b.regla.padEnd(46)} techo ${b.tope} → hoy ${b.hoy}`)
    console.error('\n     node scripts/design/trinquete-a11y.mjs --actualizar\n')
    process.exit(1)
  }

  console.log(`\n  ACCESIBILIDAD: ${medida.total} avisos, igual que el techo. Sin deuda nueva.\n`)
}
