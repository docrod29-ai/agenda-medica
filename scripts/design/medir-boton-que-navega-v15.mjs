/**
 * MEDICIÓN EN NAVEGADOR REAL — el control que NAVEGA era un botón dentro de un
 * enlace. V15-A11Y-001, rebanada «el botón que navega».
 *
 * ── QUÉ PREGUNTA CONTESTA ───────────────────────────────────────────────────
 *
 * El acta de §21 en Hoy dejó anotado, como punto 2 de «declarado y NO pagado»:
 *
 *   «`anidados: 2` en Hoy, en las DOS fases. (…) uno es el CTA del héroe NOW
 *    (`<Link><button className="prox-hero-cta">`), o sea el control primario
 *    de la pantalla. `/pacientes` tiene uno.»
 *
 * ── LA CORRECCIÓN QUE ESTA MEDICIÓN TRAE, Y ES LO PRIMERO QUE HAY QUE LEER ──
 *
 * Aquel acta llamó a esos dos nodos `nested-interactive`, la regla de axe. **No
 * lo son.** Esta corrida lo midió con axe-core de verdad, no con el nombre de
 * la regla escrito en un comentario: `nested-interactive` sólo casa con roles
 * `childrenPresentational` (botón, casilla, pestaña…), y **`link` no es uno**.
 * axe devuelve **0 nodos** sobre `<a><button></button></a>`, antes y después.
 *
 * Aquel `anidados: 2` salía de `querySelectorAll('a button, button a, a a')`,
 * que es una sonda de DOM honesta con una etiqueta prestada. La familia que sí
 * midió axe fue otra: la de `/pacientes`, donde el contenedor era
 * `role="button"` (`v15-a11y-pacientes-sin-nested-interactive.test.ts`). Un
 * enlace que envuelve a un botón es un defecto distinto, y por eso esta
 * rebanada lo mide distinto.
 *
 * ── QUÉ HACE MAL, ENTONCES, UN BOTÓN DENTRO DE UN ENLACE ────────────────────
 *
 *   1. **HTML inválido.** El modelo de contenido de `<a>` es transparente pero
 *      prohíbe contenido interactivo dentro. Ningún navegador se queja; el
 *      árbol de accesibilidad queda a interpretación de cada lector.
 *   2. **DOS paradas de teclado para UN destino.** El enlace es tabulable y el
 *      botón de dentro también. El médico tabula, cree que llegó al control,
 *      vuelve a tabular y sigue en el mismo sitio.
 *   3. **El mismo nombre accesible dos veces**, una como enlace y otra como
 *      botón, sin que nada distinga qué hace cada uno: los dos navegan, porque
 *      el clic del botón burbujea hasta el `<a>`.
 *
 * §24 llama BLOQUEANTE a un defecto de accesibilidad sobre una acción clínica
 * crítica. «Iniciar consulta» en el héroe NOW es LA acción primaria de la
 * pantalla que el médico abre a las nueve de la mañana.
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 *
 *   1. EL ÁRBOL — qué envuelve a qué en cada superficie, con las clases y el
 *      texto, para poder nombrar el sitio que cayó.
 *   2. LAS PARADAS DE TECLADO — cuántos focos tabulables hay dentro de cada
 *      envoltorio interactivo. Es el daño medible: 2 → 1.
 *   3. AXE, COMO CONTROL NEGATIVO DECLARADO — la regla `nested-interactive`,
 *      que da 0 en las dos fases. Se publica el cero para que nadie lo lea
 *      como «esto lo cubría axe»: no lo cubría, y por eso hace falta guardián.
 *   4. EQUIVALENCIA FUNCIONAL (§42) — estilo calculado del CTA del héroe
 *      (fondo, color, alto, radio, tipografía, relleno) y su destino real al
 *      pulsarlo. Una rebanada de estructura que cambie el aspecto o el destino
 *      NO es equivalente, por muy accesible que quede.
 *   5. TÁCTIL (§24) — el objetivo del CTA en el teléfono no baja de 44×44.
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · El estado vacío de Hoy («Agendar cita») y `/404`: la siembra trae citas de
 *   hoy y no produce un 404 con el chrome de la app, así que esos dos sitios
 *   no se pintan aquí. Los vigila el guardián estático
 *   `v15-el-boton-que-navega-es-un-enlace.test.ts`. Se dice para que «0 en el
 *   árbol» no se lea como «ningún sitio quedó sin arreglar».
 * · No dice si un lector de pantalla lo anuncia bien: dice que el árbol ya no
 *   tiene un control dentro de otro, que es la condición previa.
 * · No puntúa §29 ni sustituye la lectura independiente de §26.
 *
 * Requiere: emuladores + siembra + build de producción + next start
 * (`bash scripts/design/arnes-boton-que-navega-v15.sh [antes|despues]`).
 *
 * Uso:
 *   node scripts/design/medir-boton-que-navega-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-boton-que-navega'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const AXE = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const HOY = '/dashboard'
const SUPERFICIES = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
]

const VIEWPORTS = [
  { nombre: 'escritorio-1440', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  { nombre: 'movil-390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
]

fs.mkdirSync(DESTINO, { recursive: true })

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { base: BASE, fase: FASE, viewports: {}, errores: [] }

const SONDA = `
  window.__nxSonda = {
    FOCOS: 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    /* El árbol, no la regla de axe: qué envuelve a qué, y CUÁNTAS paradas de
       teclado deja ese envoltorio. Dos paradas para un destino es el daño. */
    anidados() {
      return [...document.querySelectorAll('a button, button a, a a, button button')].map(dentro => {
        const fuera = dentro.parentElement?.closest('a, button')
        return {
          fuera: fuera ? fuera.tagName.toLowerCase() : '?',
          claseFuera: (fuera?.getAttribute('class') ?? '').slice(0, 48),
          hrefFuera: fuera?.getAttribute('href') ?? null,
          dentro: dentro.tagName.toLowerCase(),
          claseDentro: (dentro.getAttribute('class') ?? '').slice(0, 48),
          texto: (dentro.textContent ?? '').trim().slice(0, 40),
          /* Paradas VISIBLES, envoltorio incluido: lo que el dedo del médico
             recorre con el tabulador, no lo que hay en el DOM. Un envoltorio
             que la hoja esconde (.hoy-accion bajo 768px) no es una parada. */
          paradas: fuera
            ? [fuera, ...fuera.querySelectorAll(window.__nxSonda.FOCOS)]
                .filter(window.__nxSonda.visible).length
            : null,
        }
      })
    },
    /* El CTA del héroe NOW: la acción primaria de Hoy. Se busca por su clase,
       que sobrevive al cambio de etiqueta — es justo lo que se está midiendo. */
    cta() { return document.querySelector('.prox-hero-cta') },
    heroe() { return document.querySelector('.prox-hero') },
    estilo(el) {
      if (!el) return null
      const c = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        etiqueta: el.tagName.toLowerCase(),
        href: el.getAttribute('href'),
        fondo: c.backgroundColor,
        color: c.color,
        radio: c.borderTopLeftRadius,
        fuente: c.fontSize + '/' + c.fontWeight,
        familia: c.fontFamily.split(',')[0],
        subrayado: c.textDecorationLine,
        display: c.display,
        relleno: c.paddingLeft + ' ' + c.paddingRight,
        w: Math.round(r.width), h: Math.round(r.height),
      }
    },
    /* Los focos tabulables DENTRO de la región del héroe: la parada de más
       vista desde el teclado del médico, no desde el DOM. */
    paradasEnElHeroe() {
      const h = window.__nxSonda.heroe()
      if (!h) return null
      return [...h.querySelectorAll(window.__nxSonda.FOCOS)].filter(window.__nxSonda.visible).map(el => ({
        etiqueta: el.tagName.toLowerCase(),
        clase: (el.getAttribute('class') ?? '').slice(0, 40),
        nombre: (el.textContent ?? '').trim().slice(0, 40),
      }))
    },
  }
`

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 40000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }
}

/** axe-core, SÓLO la regla que el acta anterior citó. Control negativo. */
async function segunAxe(page) {
  await page.addScriptTag({ content: AXE })
  return await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'rule', values: ['nested-interactive'] },
      resultTypes: ['violations'],
    })
    const v = r.violations[0]
    return {
      nodos: v ? v.nodes.length : 0,
      detalle: v ? v.nodes.map(n => ({
        selector: Array.isArray(n.target) ? String(n.target[0]).slice(0, 90) : String(n.target),
        resumen: (n.html ?? '').replace(/\s+/g, ' ').slice(0, 110),
      })) : [],
    }
  })
}

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${vp.nombre}: pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') acta.errores.push(`${vp.nombre}: consola: ${m.text().slice(0, 160)}`) })
  await page.addInitScript(SONDA)

  await entrar(page)

  /* ── 1, 2 y 3 · EL ÁRBOL, LAS PARADAS Y AXE, por superficie ────────────── */
  const superficies = {}
  for (const [nombre, ruta] of SUPERFICIES) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    const axeR = await segunAxe(page)
    const anidados = await page.evaluate(() => window.__nxSonda.anidados())
    superficies[nombre] = { axe: axeR, anidados }
    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-${nombre}.png`), fullPage: false })
  }

  /* ── 4 y 5 · EL CTA DEL HÉROE ──────────────────────────────────────────── */
  await page.goto(`${BASE}${HOY}`, { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  const cta = await page.evaluate(() => {
    const s = window.__nxSonda
    const el = s.cta()
    return {
      existe: !!el,
      estilo: s.estilo(el),
      envoltorio: (() => {
        const p = el?.parentElement
        return p ? { etiqueta: p.tagName.toLowerCase(), href: p.getAttribute('href'), clase: (p.getAttribute('class') ?? '').slice(0, 40) } : null
      })(),
      paradasEnElHeroe: s.paradasEnElHeroe(),
    }
  })

  if (cta.existe) {
    await page.locator('.prox-hero').first().screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-heroe.png`) })
  }

  /* EQUIVALENCIA FUNCIONAL — pulsarlo tiene que llevar a la consulta del
     paciente del héroe, con la coreografía de §20 intacta. Se pulsa el nodo
     que el médico ve, sea <a> o <button>. */
  let destino = null
  if (cta.existe) {
    const antesErr = acta.errores.length
    await page.locator('.prox-hero-cta').first().click()
    await page.waitForTimeout(3500)
    destino = {
      url: new URL(page.url()).pathname,
      cargó: await page.evaluate(() => (document.querySelector('main')?.scrollHeight ?? 0) > 400),
      errores: acta.errores.length - antesErr,
    }
  }

  acta.viewports[vp.nombre] = { superficies, cta, destino }
  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  for (const [n, s] of Object.entries(superficies)) {
    console.log(`${n.padEnd(10)} controles anidados: ${s.anidados.length} · axe nested-interactive: ${s.axe.nodos} (control negativo)`)
    for (const a of s.anidados) {
      console.log(`   <${a.fuera} class="${a.claseFuera}" href=${a.hrefFuera}> ⊃ <${a.dentro} class="${a.claseDentro}"> «${a.texto}»`)
      console.log(`      paradas de teclado en ese envoltorio: ${a.paradas}${a.paradas > 1 ? '  ← DOS PARADAS, UN DESTINO' : ''}`)
    }
    for (const d of s.axe.detalle) console.log(`   axe: ${d.selector} → ${d.resumen}`)
  }
  if (cta.existe) {
    const e = cta.estilo
    console.log(`\nCTA DEL HÉROE «Iniciar consulta»`)
    console.log(`  es un <${e.etiqueta}>${e.href ? ` href=${e.href}` : ''} · envoltorio: ${cta.envoltorio ? `<${cta.envoltorio.etiqueta}> ${cta.envoltorio.href ?? ''}` : '(ninguno)'}`)
    console.log(`  aspecto: fondo ${e.fondo} · color ${e.color} · radio ${e.radio} · ${e.fuente} · ${e.familia} · relleno ${e.relleno} · subrayado ${e.subrayado}`)
    console.log(`  táctil: ${e.w}×${e.h}${e.h < 44 ? '  ← POR DEBAJO DE 44' : ''}`)
    console.log(`  paradas de teclado en el héroe: ${cta.paradasEnElHeroe?.length ?? '?'}`)
    for (const p of cta.paradasEnElHeroe ?? []) console.log(`   · <${p.etiqueta}> «${p.nombre}» ${p.clase}`)
    console.log(`  al pulsarlo → ${destino?.url} · cargó: ${destino?.cargó} · errores nuevos: ${destino?.errores}`)
  } else {
    console.log('\nCTA DEL HÉROE: NO SE PINTÓ — ¿corrió la siembra de la cita por delante?')
  }
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\nerrores de consola: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log(`  ${e}`)
console.log(`acta → ${path.join(DESTINO, `acta-${FASE}.json`)}`)
