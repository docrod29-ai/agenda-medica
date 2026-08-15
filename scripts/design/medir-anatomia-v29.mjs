/**
 * LA ANATOMÍA DE §29 — qué forma tiene cada superficie, contada.
 *
 * ── PARA QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * La re-auditoría independiente dejó cinco superficies en 1.5 y una en 1.0, y
 * describió el defecto con palabras de anatomía: «worklist convencional»,
 * «directorio CRUD», «índice de ajustes», «panel de aplicación genérico». Esas
 * palabras se pueden CONTAR, y hay que contarlas antes de tocar nada: un
 * rediseño que empieza sin números acaba siendo el repintado que §29 castiga.
 *
 * `/pendientes` puntúa 1.0 y **no se toca**. Aquí sirve de PATRÓN: es la misma
 * aplicación, el mismo shell y los mismos tokens, así que la diferencia entre
 * su anatomía y la de las otras cinco es exactamente lo que hay que pagar.
 *
 * ── QUÉ CUENTA CADA MÉTRICA, Y POR QUÉ ESA DEFINICIÓN ───────────────────────
 *
 *  · **cajasDelimitadas** — elementos DENTRO de `<main>` con borde visible o
 *    fondo propio, radio ≥ 6 y contenido dentro. Es «la tarjeta» medida sin
 *    depender de que alguien la llame `card`: lo que hace card-soup no es el
 *    nombre de la clase, es la frontera dibujada alrededor de cosas que ya
 *    estaban agrupadas por posición.
 *  · **rellenosDeMarca** — controles con fondo de acento. Más de uno por
 *    pantalla es competencia de acciones primarias (RTC-06).
 *  · **primitivasDeLista** — `ul/ol/table` + bloques hermanos repetidos (≥3 con
 *    la misma firma de clase). Un directorio es esto y poco más.
 *  · **filtrosYBusqueda** — campos de búsqueda y píldoras de filtro. La
 *    anatomía «título + buscador + filtros + filas» es literalmente lo que el
 *    auditor llamó CRUD genérico.
 *  · **cromoPersistente** — píxeles de shell fijo/pegajoso frente al alto del
 *    viewport. Si el shell se come un tercio de la pantalla, el contenido
 *    clínico compite con la aplicación que lo contiene.
 *  · **primeraAccionConsecuente** — a qué altura aparece el primer control que
 *    hace algo clínico (no navegar, no filtrar). Es la distancia entre entrar y
 *    poder trabajar.
 *  · **encabezadosQueSoloTitulan** — encabezados cuyo texto repite el nombre de
 *    la pantalla. El riel ya dice dónde estás; repetirlo en 20px es decorar.
 *
 * NO puntúa §29. Da la materia prima con la que se juzga, y el juicio final es
 * del revisor independiente.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-anatomia-v29.mjs <antes|despues>"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || `docs/design/capturas/v15-anatomia-v29`
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const SUPERFICIES = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
  ['expediente', '/expediente/pac-aurelio-dominguez'],
  ['consulta', '/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1'],
  ['operaciones', '/operaciones'],
  ['pendientes', '/pendientes'],   // PATRÓN: 1.0, no se toca
]

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const SONDA = `
window.__nx = {
  visible(el) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  },
  opaco(c) { return !!c && c !== 'transparent' && !/rgba\\(0,\\s*0,\\s*0,\\s*0\\)/.test(c) },
  main() { return document.querySelector('main') },

  /* Una CAJA DELIMITADA: frontera dibujada alrededor de contenido. No se busca
     por nombre de clase — lo genérico no depende de cómo se llame la clase. */
  cajas() {
    const m = this.main(); if (!m) return []
    return [...m.querySelectorAll('*')].filter(el => {
      if (!this.visible(el)) return false
      const s = getComputedStyle(el)
      const radio = parseFloat(s.borderTopLeftRadius) || 0
      const borde = (parseFloat(s.borderTopWidth) || 0) > 0 && this.opaco(s.borderTopColor)
      const fondo = this.opaco(s.backgroundColor)
      const r = el.getBoundingClientRect()
      return (borde || fondo) && radio >= 6 && r.height >= 48 && r.width >= 160
        && el.children.length >= 2
    })
  },

  /* Relleno de marca: el acento como FONDO de un control. */
  rellenosDeMarca() {
    const m = this.main(); if (!m) return []
    const acento = getComputedStyle(document.documentElement).getPropertyValue('--nexus-solido').trim()
      || getComputedStyle(document.documentElement).getPropertyValue('--nexus').trim()
    return [...m.querySelectorAll('button, a')].filter(el => {
      if (!this.visible(el)) return false
      const bg = getComputedStyle(el).backgroundColor
      if (!this.opaco(bg)) return false
      const [r, g, b] = (bg.match(/\\d+/g) ?? []).map(Number)
      if (r === undefined) return false
      // Un fondo con croma (no gris) y no casi-transparente: es acento.
      return Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > 18
    }).map(el => (el.textContent ?? '').trim().slice(0, 30))
  },

  primitivasDeLista() {
    const m = this.main(); if (!m) return { semanticas: 0, repeticiones: 0 }
    const semanticas = [...m.querySelectorAll('ul, ol, table')].filter(e => this.visible(e)).length
    let repeticiones = 0
    for (const padre of m.querySelectorAll('*')) {
      const hijos = [...padre.children].filter(c => this.visible(c))
      if (hijos.length < 3) continue
      const firma = c => c.tagName + '|' + (c.className || '').toString().slice(0, 40)
      const f = firma(hijos[0])
      if (hijos.filter(c => firma(c) === f).length >= 3) repeticiones++
    }
    return { semanticas, repeticiones }
  },

  filtrosYBusqueda() {
    const m = this.main(); if (!m) return { campos: 0, pildoras: 0 }
    const campos = [...m.querySelectorAll('input[type=search], input[type=text], input:not([type])')]
      .filter(e => this.visible(e)).length
    const pildoras = [...m.querySelectorAll('button, a')].filter(el => {
      if (!this.visible(el)) return false
      const s = getComputedStyle(el)
      const radio = parseFloat(s.borderTopLeftRadius) || 0
      const r = el.getBoundingClientRect()
      return radio >= 999 || (radio >= r.height / 2 - 1 && r.height <= 44)
    }).length
    return { campos, pildoras }
  },

  cromoPersistente() {
    let px = 0
    const vistos = new Set()
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el)
      if (s.position !== 'fixed' && s.position !== 'sticky') continue
      if (!this.visible(el)) continue
      if (el.closest('main')) continue          // sticky DENTRO del trabajo no es cromo
      const r = el.getBoundingClientRect()
      const clave = Math.round(r.top) + ':' + Math.round(r.height)
      if (vistos.has(clave)) continue
      vistos.add(clave)
      // Sólo lo que come alto vertical del área de trabajo.
      if (r.width > window.innerWidth * 0.5) px += Math.round(r.height)
    }
    return { px, viewport: window.innerHeight, fraccion: +(px / window.innerHeight).toFixed(3) }
  },

  /* El primer control que HACE algo clínico: ni navegar ni filtrar. */
  primeraAccionConsecuente() {
    const m = this.main(); if (!m) return null
    const NAV = /volver|expediente|inicio|hoy|buscar|filtrar|ver s[oó]lo|actualizar|todos|recientes|alerta/i
    const cand = [...m.querySelectorAll('button, a')].filter(el => {
      if (!this.visible(el)) return false
      const t = (el.textContent ?? '').trim()
      return t.length > 2 && !NAV.test(t)
    })
    if (!cand.length) return null
    const el = cand[0]
    const r = el.getBoundingClientRect()
    return {
      texto: (el.textContent ?? '').trim().slice(0, 34),
      y: Math.round(r.top - m.getBoundingClientRect().top + m.scrollTop),
    }
  },

  encabezados() {
    const m = this.main(); if (!m) return []
    return [...m.querySelectorAll('h1, h2')].filter(e => this.visible(e))
      .map(e => (e.textContent ?? '').trim().slice(0, 40))
  },

  altoTotal() { return this.main()?.scrollHeight ?? null },
}
`

const acta = { fase: FASE, base: BASE, fecha: new Date().toISOString(), viewports: {}, errores: [] }

for (const [nombre, ancho, alto] of [['escritorio', 1440, 900], ['movil', 390, 844]]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto }, isMobile: ancho < 700, hasTouch: ancho < 700,
    serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') acta.errores.push(`[${nombre}] ${m.text().slice(0, 160)}`) })
  page.on('pageerror', e => acta.errores.push(`[${nombre}] pageerror: ${e.message.slice(0, 160)}`))
  await page.addInitScript(SONDA)

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

  const medidas = {}
  for (const [sup, ruta] of SUPERFICIES) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2800)
    medidas[sup] = await page.evaluate(() => ({
      cajasDelimitadas: window.__nx.cajas().length,
      rellenosDeMarca: window.__nx.rellenosDeMarca(),
      primitivasDeLista: window.__nx.primitivasDeLista(),
      filtrosYBusqueda: window.__nx.filtrosYBusqueda(),
      cromoPersistente: window.__nx.cromoPersistente(),
      primeraAccionConsecuente: window.__nx.primeraAccionConsecuente(),
      encabezados: window.__nx.encabezados(),
      altoTotal: window.__nx.altoTotal(),
    }))
    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${nombre}-${sup}.png`) })
  }
  acta.viewports[nombre] = medidas
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))

for (const [vp, m] of Object.entries(acta.viewports)) {
  console.log(`\n══ ${vp} ══`)
  console.log('superficie    cajas  marca  listas/rep  campos/píld  cromo  1ª acción')
  for (const [sup, d] of Object.entries(m)) {
    const marca = d.rellenosDeMarca.length
    const l = d.primitivasDeLista, f = d.filtrosYBusqueda
    const a = d.primeraAccionConsecuente
    console.log(
      `${sup.padEnd(13)} ${String(d.cajasDelimitadas).padStart(4)}  ${String(marca).padStart(5)}` +
      `  ${String(l.semanticas).padStart(3)}/${String(l.repeticiones).padEnd(4)}` +
      `  ${String(f.campos).padStart(3)}/${String(f.pildoras).padEnd(6)}` +
      `  ${String(d.cromoPersistente.fraccion).padStart(5)}  ${a ? a.y + 'px «' + a.texto + '»' : '—'}`)
  }
}
console.log(`\nerrores de consola: ${acta.errores.length}`)
if (acta.errores.length) acta.errores.slice(0, 8).forEach(e => console.log('  · ' + e))
