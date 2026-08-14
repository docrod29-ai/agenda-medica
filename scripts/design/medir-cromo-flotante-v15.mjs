/**
 * MEDICIÓN EN NAVEGADOR REAL — el cromo FLOTANTE del escritorio
 * (V15-ORIGINALITY-REDTEAM-001; tercer residuo de la 4ª pasada de §29; §5, §16,
 * §29, §41).
 *
 * ── QUÉ PREGUNTA CONTESTA, Y POR QUÉ ÉSA ────────────────────────────────────
 *
 * La 4ª pasada de §29 dejó nombrados tres residuos. Dos se pagaron (las
 * píldoras → RTC-18; la fila de KPIs del expediente → 7ª rebanada). El tercero
 * —«los dos FAB de escritorio (6/6): ahora que no quedan defectos mayores, son
 * lo que más se parece a otro producto»— sigue sin pagar.
 *
 * RTC-05 los sacó del arco del pulgar en MÓVIL y dejó escrito el hueco: «no
 * juzga si la ayuda merece FAB en escritorio (el arco del pulgar es un
 * argumento móvil; en escritorio la esquina no ocluye la columna clínica)».
 *
 * Así que la pregunta NO es la oclusión —eso ya se sabe que en escritorio no
 * pasa, y este arnés lo comprueba en vez de suponerlo— sino:
 *
 *   1. ¿en cuántas de las seis superficies flota cromo de sistema? (§29: la
 *      burbuja redonda abajo-derecha es la firma del SaaS genérico);
 *   2. ¿con cuánto PESO? Un círculo relleno con el color de marca compite por
 *      el énfasis con el trabajo clínico. Si en una pantalla el único relleno
 *      de marca es la AYUDA, la jerarquía de §16 la está poniendo primera
 *      —y RTC-06 pagó justo eso en Hoy, dentro del contenido, mientras el
 *      cromo seguía haciéndolo por encima de todas;
 *   3. ¿cuánto cuesta la capacidad HOY, en gestos? Es la vara contra la que se
 *      juzga cualquier mudanza: si el destino cuesta más, no se muda (lección
 *      de RTC-21, donde medir refutó la mitad del pago propuesto).
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 (eso es juicio de panel, y quien implementa no puede ser el
 *   juez — lección de la 5ª pasada).
 * · No mide el tema claro: el cromo flotante no cambia de sitio por tema.
 * · No cubre login/marketing, que quedan FUERA del shell a propósito: ahí no
 *   hay columna clínica ni barra del pulgar, y el toggle flotante se queda.
 *
 * Requiere: emuladores + siembra + build + next start (método hermano de
 * `arnes-breakpoints-v15.sh`).
 *
 * Uso:
 *   node scripts/design/medir-cromo-flotante-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-cromo-flotante'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

/** Las seis superficies que puntúa §29 en esta rama. */
const SUPERFICIES = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
  ['expediente', `/expediente/${PATIENT_ID}`],
  ['consulta', `/consulta/${PATIENT_ID}`],
  ['pendientes', '/pendientes'],
  ['operaciones', '/operaciones'],
]

async function uidDelMedico() {
  const r = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  )
  const j = await r.json()
  if (!j.localId) throw new Error(`No se pudo resolver el uid: ${JSON.stringify(j)}`)
  return j.localId
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

/**
 * Radiografía del cromo de sistema de UNA superficie.
 *
 * `rellenoDeMarca` cuenta elementos PINTADOS con el fondo sólido del acento
 * (el mismo criterio que usó RTC-06 para «una sola primaria»): así se ve si
 * la ayuda compite con la acción clínica por el énfasis máximo. Se compara el
 * color RESUELTO de `--nexus-solido`, no el literal, porque el token cambia
 * con el tema.
 */
async function radiografia(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0
    }
    const rect = (el) => {
      if (!visible(el)) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    /** Qué hay JUSTO debajo de un elemento fijo, en su centro. */
    const debajoDe = (el) => {
      if (!visible(el)) return null
      const r = el.getBoundingClientRect()
      const pila = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      const i = pila.indexOf(el)
      const abajo = pila.slice(i + 1).find(e => e !== document.body && e !== document.documentElement)
      if (!abajo) return { tag: null, dentroDeMain: false, texto: '' }
      return {
        tag: abajo.tagName.toLowerCase(),
        dentroDeMain: !!abajo.closest('main'),
        texto: (abajo.textContent || '').trim().slice(0, 60),
      }
    }

    const sonda = document.createElement('div')
    sonda.style.background = 'var(--nexus-solido)'
    document.body.appendChild(sonda)
    const marca = getComputedStyle(sonda).backgroundColor
    sonda.remove()

    const conRellenoDeMarca = [...document.querySelectorAll('button, a, [role="button"]')]
      .filter(el => visible(el) && getComputedStyle(el).backgroundColor === marca)
      .map(el => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40))

    const fab = document.querySelector('.boton-ayuda-fab')
    const toggle = document.querySelector('.theme-toggle')
    const flotantes = [['ayuda', fab], ['tema', toggle]]
      .filter(([, el]) => visible(el))
      .map(([nombre, el]) => ({
        nombre,
        rect: rect(el),
        posicion: getComputedStyle(el).position,
        debajo: debajoDe(el),
        rellenoDeMarca: getComputedStyle(el).backgroundColor === marca,
      }))

    // La ayuda, la busque donde la busque el médico: FAB, topbar o riel.
    const disparadores = [...document.querySelectorAll('[aria-label="Abrir ayuda"], [aria-label="Cerrar ayuda"]')]
      .filter(visible)
      .map(el => ({
        rect: rect(el),
        enElRiel: !!el.closest('.sidebar'),
        enLaTopbar: !!el.closest('.mobile-topbar'),
        flotante: getComputedStyle(el).position === 'fixed',
      }))

    return {
      marcaResuelta: marca,
      flotantes,
      cuantosFlotan: flotantes.length,
      rellenosDeMarca: conRellenoDeMarca,
      disparadoresDeAyuda: disparadores,
    }
  })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const uid = await uidDelMedico()
  const resultado = { fase: FASE, viewports: {} }
  const erroresConsola = []

  for (const [nombreVp, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    })
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`${nombreVp}: ${m.text()}`) })
    await login(page)
    await page.waitForTimeout(1500)

    const porSuperficie = {}
    for (const [nombre, ruta] of SUPERFICIES) {
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
      await page.waitForTimeout(1400)
      porSuperficie[nombre] = await radiografia(page)
      if (nombre === 'hoy' || nombre === 'consulta') {
        await page.screenshot({ path: path.join(DESTINO, `${nombre}-${nombreVp}--${FASE}.png`) })
      }
    }

    // ¿Cuánto cuesta la ayuda, en gestos, desde Hoy? Se PULSA de verdad.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
    await page.waitForTimeout(1400)
    let ayuda = { disparadorEncontrado: false, panelAbierto: false, gestos: null }
    /* El PINTADO, no el primero del DOM: en escritorio el disparador de la
       topbar existe pero está oculto por CSS, y `.first()` devolvía ése — la
       pasada «antes» informó «ayuda inalcanzable en escritorio» cuando el FAB
       estaba ahí a la vista. Fallo del instrumento, corregido y anotado. */
    const disparador = page.locator('[aria-label="Abrir ayuda"]:visible').first()
    if (await disparador.count() > 0 && await disparador.isVisible()) {
      ayuda.disparadorEncontrado = true
      await disparador.click()
      await page.waitForTimeout(500)
      ayuda.panelAbierto = await page.locator('.boton-ayuda-panel').isVisible().catch(() => false)
      ayuda.gestos = ayuda.panelAbierto ? 1 : null
      ayuda.rectPanel = await page.evaluate(() => {
        const p = document.querySelector('.boton-ayuda-panel')
        if (!p) return null
        const r = p.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      })
      await page.screenshot({ path: path.join(DESTINO, `panel-ayuda-${nombreVp}--${FASE}.png`) })
      await page.keyboard.press('Escape').catch(() => {})
    }

    // El tema: su casa de §11 responde en los dos anchos.
    await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
    await page.waitForTimeout(1300)
    const tema = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /^Tema:/.test((b.textContent || '').trim()))
      if (!btn) return null
      const r = btn.getBoundingClientRect()
      return { texto: btn.textContent.trim().slice(0, 40), alto: Math.round(r.height) }
    })

    resultado.viewports[nombreVp] = { porSuperficie, ayudaDesdeHoy: ayuda, temaEnOperaciones: tema }
    await context.close()
  }

  resultado.erroresConsola = erroresConsola
  const d = resultado.viewports.desktop.porSuperficie
  resultado.resumen = {
    superficiesConCromoFlotante_desktop:
      Object.entries(d).filter(([, s]) => s.cuantosFlotan > 0).map(([n]) => n),
    superficiesDondeLaAyudaEsElUnicoRellenoDeMarca_desktop:
      Object.entries(d)
        .filter(([, s]) => s.rellenosDeMarca.length === 1 && /ayuda/i.test(s.rellenosDeMarca[0]))
        .map(([n]) => n),
    superficiesConCromoFlotante_mobile:
      Object.entries(resultado.viewports.mobile.porSuperficie)
        .filter(([, s]) => s.cuantosFlotan > 0).map(([n]) => n),
  }

  const salida = path.join(DESTINO, `medicion-${FASE}.json`)
  fs.writeFileSync(salida, JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado.resumen, null, 2))
  console.log(`\nerrores de consola: ${erroresConsola.length}`)
  console.log(`acta: ${salida}`)
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
