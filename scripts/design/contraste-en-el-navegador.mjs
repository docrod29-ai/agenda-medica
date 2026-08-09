#!/usr/bin/env node
/**
 * CONTRASTE MEDIDO EN EL NAVEGADOR — V9 · DESIGN-SYSTEM-001 · REG-289.
 *
 * ── PARA QUÉ ────────────────────────────────────────────────────────────────
 *
 * `el-relleno-y-su-texto-se-miden-juntos.test.ts` mide leyendo el código, y por
 * eso corre en CI y es barato. Pero sólo ve pares que están **en el mismo
 * ámbito**: un texto que hereda su color de un ancestro y un fondo puesto en el
 * hijo le son invisibles.
 *
 * Esto es el otro lado. Levanta la aplicación de verdad, recorre las pantallas
 * públicas en los dos temas y lee `getComputedStyle` del DOM ya pintado. Es la
 * regla de V9 §4 —*no se aprueba UI leyendo el código*— aplicada a lo único de
 * la interfaz que se puede comprobar con aritmética en vez de con criterio.
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 *
 *   npx next dev -p 3111        (con las variables de Firebase, aunque sean de
 *                                relleno: estas pantallas no consultan datos)
 *   node scripts/design/contraste-en-el-navegador.mjs
 *
 * Sale con código ≠0 si algo reprueba, para que pueda colgar de una compuerta
 * el día que haya un entorno con credenciales.
 *
 * ── LAS DOS DECISIONES QUE EVITAN EL RUIDO ──────────────────────────────────
 *
 * 1. **Sólo rellenos OPACOS.** La primera versión contaba `rgba(61,90,254,0.1)`
 *    como si fuera un relleno y sacaba 1,56 en cuatro sitios de la portada. Un
 *    tinte translúcido se **compone con el lienzo**: medirlo como opaco da una
 *    cifra que no existe. Los tintes necesitan componer alfa contra el fondo
 *    real, y eso es otra unidad de trabajo.
 *
 * 2. **Sólo elementos con texto PROPIO** (un nodo de texto directo). Un
 *    contenedor azul cuyo texto lo pinta un hijo con otro color daba pares que
 *    nadie ve.
 *
 * Las dos salieron de mirar los hallazgos uno por uno antes de creérselos. Un
 * medidor de accesibilidad que grita de más se silencia (REG-245).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Sólo lo público.** La consulta, la UCI y el hospital viven detrás del
 *   login: hacen falta credenciales (B-10).
 * - **Sólo la familia azul.** El barrido descarta cualquier fondo que no sea
 *   azul saturado, igual que la prueba de código.
 * - **Sólo el estado en reposo.** Un botón que sólo existe al pasar el ratón,
 *   al enfocarlo o cuando el formulario es válido no se pinta y no se mide. En
 *   `/registro` el botón nace `var(--s3)` y por eso no aparece en la lista.
 * - **Tintes translúcidos**, por lo dicho arriba.
 * - **No aprueba una pantalla.** Mide un cociente. El foco, el orden de
 *   tabulación y los nombres accesibles siguen sin cubrirse (`A11Y-GATE-001`).
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3111'
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'

/** Pantallas sin sesión. Las de detrás del login necesitan B-10. */
const RUTAS = ['/', '/registro', '/login', '/precios', '/paquetes', '/setup', '/legal', '/demo/interactivo']

const lum = (r, g, b) => {
  const c = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const nums = (s) => (s.match(/[\d.]+/g) || []).map(Number)
const contraste = (fg, bg) => {
  const a = lum(...nums(fg).slice(0, 3))
  const b = lum(...nums(bg).slice(0, 3))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Se ejecuta DENTRO de la página. Devuelve los rellenos azules opacos con texto propio. */
function recolectar() {
  const out = []
  for (const e of document.querySelectorAll('*')) {
    const s = getComputedStyle(e)
    const m = (s.backgroundColor.match(/[\d.]+/g) || []).map(Number)
    if (m.length < 3) continue
    if ((m.length > 3 ? m[3] : 1) < 0.999) continue      // translúcido: se compone, no se mide así
    const [r, g, b] = m
    if (!(b > 140 && b > r + 40 && b > g + 40)) continue // azul saturado
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const caja = e.getBoundingClientRect()
    if (caja.width < 8 || caja.height < 8) continue
    out.push({
      texto: (e.textContent || '').trim().slice(0, 40),
      bg: s.backgroundColor,
      fg: s.color,
      fs: parseFloat(s.fontSize),
      fw: parseInt(s.fontWeight) || 400,
    })
  }
  return out
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })
let medidos = 0
const repruebas = []

for (const tema of ['dark', 'light']) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } })
  // El script anti-parpadeo de layout.tsx lee esta clave: se usa su mecanismo,
  // no un setAttribute por fuera que la aplicación podría revertir.
  await ctx.addInitScript((t) => { try { localStorage.setItem('nexusmed.theme', t) } catch { /* modo privado */ } }, tema)

  for (const ruta of RUTAS) {
    const p = await ctx.newPage()
    try {
      await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 })
      await p.reload({ waitUntil: 'networkidle' })  // 2ª carga: ya hay tema en localStorage
      await p.waitForTimeout(700)
      const temaReal = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
      const vistos = new Set()
      for (const h of await p.evaluate(recolectar)) {
        const clave = h.texto + h.bg + h.fg
        if (vistos.has(clave)) continue
        vistos.add(clave)
        medidos++
        // WCAG 2.2: 3:1 basta en texto grande (≥24 px, o ≥18,66 px en negrita).
        const minimo = h.fs >= 24 || (h.fs >= 18.66 && h.fw >= 700) ? 3 : 4.5
        const r = contraste(h.fg, h.bg)
        const linea = `${temaReal} · ${ruta} · «${h.texto}» · ${h.fg} sobre ${h.bg} = ${r.toFixed(2)} (mín ${minimo})`
        if (r < minimo) repruebas.push(linea)
        else console.log('  ' + linea)
      }
    } catch (e) {
      console.log(`! ${tema} ${ruta} — ${e.message.split('\n')[0]}`)
    }
    await p.close()
  }
  await ctx.close()
}
await navegador.close()

for (const r of repruebas) console.log('✗ ' + r)

// Un barrido que no encuentra nada que medir pasa igual que uno limpio: si no
// hay rellenos, es que la aplicación no cargó o el selector dejó de valer.
if (medidos === 0) {
  console.error('\n[contraste] Cero rellenos medidos. ¿Está levantada la aplicación en ' + BASE + '?')
  process.exit(2)
}

console.log(`\n${medidos} rellenos azules opacos medidos en el navegador · ${repruebas.length} reprueban`)
process.exit(repruebas.length ? 1 : 0)
