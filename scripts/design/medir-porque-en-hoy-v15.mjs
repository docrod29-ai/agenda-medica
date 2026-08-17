/**
 * MEDICIÓN EN NAVEGADOR REAL — §21 en HOY: el mismo pendiente, dos superficies,
 * y sólo una podía preguntarle nada.
 *
 * ── QUÉ PREGUNTA CONTESTA ───────────────────────────────────────────────────
 *
 * `tareasVivas()` es UNA fuente de verdad y la leen DOS pantallas: la cola de
 * cierre (`/pendientes`) y la zona CONTINUITY de Hoy (`ContinuidadPanel`, §6).
 * En la cola, cada entrada contesta las cuatro de §10 dentro de la Capa 4. En
 * Hoy —que es la pantalla que el médico abre a las nueve, o sea **donde ve el
 * pendiente por primera vez**— la misma entidad era una fila muda.
 *
 * §21 pide: «fact → inspect → source → return exactly where you were». Desde
 * Hoy no había «inspect»: había NAVEGAR a otra pantalla, que es justo la
 * pérdida de contexto que §21 existe para evitar.
 *
 * Esto mide, en el producto y no en el diff:
 *
 *   1. ALCANCE — en cuántas de las seis superficies se puede inspeccionar la
 *      fuente de un hecho. El acta de la Capa 4 lo dejó en 3 de 6.
 *   2. LA FILA MUDA — cuántas filas de continuidad hay en Hoy y cuántas
 *      pueden preguntar. Si el segundo número es menor, hay filas mudas.
 *   3. EL COSTE DE PREGUNTAR HOY — qué hay que hacer desde Hoy para llegar a
 *      las cuatro respuestas: URL que cambia, desplazamiento que se pierde.
 *   4. LAS CUATRO EN HOY — con la lente abierta desde Hoy, ¿están los cuatro
 *      rótulos con texto debajo, y la traza hacia la consulta de origen?
 *   5. SITIO Y VUELTA (§21) — ¿empuja Hoy bajo el dedo al abrir? ¿cierra con
 *      Escape? ¿vuelve el foco al control que abrió? ¿el scroll es el mismo?
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 ni sustituye la lectura independiente.
 * · No dice si el TEXTO de las respuestas es clínicamente bueno: dice que
 *   están, que no están vacías y que la traza no es un enlace roto.
 * · No mide el rol de asistente: la siembra sólo trae cuenta de médico.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-porque-en-hoy-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-porque-en-hoy'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const HOY = '/dashboard'

/**
 * Las seis superficies del acta de la Capa 4, **con las mismas rutas**
 * (`medir-lente-contextual-v15.mjs:63`). No es un detalle: tres de las seis
 * necesitan id de paciente, y medirlas por la raíz de la ruta aterriza en un
 * selector o en una lista. La primera pasada de este instrumento lo hizo y
 * declaró «1 de 6» — defecto del instrumento, no del producto: /consulta sin
 * paciente no es la nota. La vara tiene que ser la misma para que los dos
 * números se puedan comparar.
 */
const NOTA = '/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1'
const SUPERFICIES = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
  ['expediente', '/expediente/pac-aurelio-dominguez'],
  ['pendientes', '/pendientes'],
  ['operaciones', '/operaciones'],
  ['consulta', NOTA],
]

/** Los cuatro rótulos de §10, tal como la pantalla los escribe. */
const LAS_CUATRO = ['Por qué está aquí', 'Quién responde', 'Qué ha pasado', 'Qué sigue']

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
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    /* Un revelador es un control que abre la fuente de un hecho SIN navegar.
       Se buscan por su texto porque no llevan marca propia — misma vara que
       usó el acta de la Capa 4, para poder comparar los dos números. */
    reveladores(raiz) {
      const RE = /por qu[eé] est[aá] aqu[ií]|de d[oó]nde sali[oó]|procedencia de la nota/i
      return [...(raiz ?? document).querySelectorAll('button')]
        .filter(b => RE.test(b.textContent ?? '') && window.__nxSonda.visible(b))
    },
    main() { return document.querySelector('main') },
    lente() { return document.querySelector('.nx-lente[data-abierta="si"]') },
    /* La zona CONTINUITY de §6. Se localiza por su nombre accesible, que es
       lo único estable: la clase la comparte con la agenda del día. */
    continuidad() {
      return document.querySelector('section[aria-label="Continuidad entre consultas"]')
    },
    filasDeContinuidad() {
      const s = window.__nxSonda.continuidad()
      return s ? [...s.querySelectorAll('.cita-fila')] : []
    },
    respuestas() {
      const l = window.__nxSonda.lente()
      if (!l) return null
      return [...l.querySelectorAll('.nx-porque-rotulo')].map(h => {
        const sec = h.parentElement
        const cuerpo = (sec?.textContent ?? '').replace(h.textContent ?? '', '').trim()
        return { rotulo: (h.textContent ?? '').trim(), etiqueta: h.tagName, largo: cuerpo.length }
      })
    },
    traza() {
      const l = window.__nxSonda.lente()
      const a = l?.querySelector('a.nx-porque-traza')
      return a ? { href: a.getAttribute('href'), texto: (a.textContent ?? '').trim() } : null
    },
    sinTraza() {
      const l = window.__nxSonda.lente()
      return !!l && /no consta de qu[eé] consulta/i.test(l.textContent ?? '')
    },
    /* §24: el objetivo táctil de un control clínico no baja de 44×44. */
    tactil(el) {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    },
    /* axe llama a esto nested-interactive: un botón dentro de un enlace es
       dos destinos para el mismo gesto. La fila de continuidad NACIÓ siendo
       un <a> entero, así que esto se vigila en las dos fases. */
    anidados() {
      return [...document.querySelectorAll('a button, button a, a a')].length
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

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${vp.nombre}: pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') acta.errores.push(`${vp.nombre}: consola: ${m.text().slice(0, 160)}`) })
  await page.addInitScript(SONDA)

  await entrar(page)

  /* ── 1 · ALCANCE, las seis superficies ─────────────────────────────────── */
  const alcance = {}
  for (const [nombre, ruta] of SUPERFICIES) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    alcance[nombre] = await page.evaluate(() => ({
      reveladores: window.__nxSonda.reveladores().map(b => (b.textContent ?? '').trim().slice(0, 42)),
      huecoDeLente: !!document.getElementById('nx-lente-hueco'),
      anidados: window.__nxSonda.anidados(),
      altoDeLaPagina: window.__nxSonda.main()?.scrollHeight ?? null,
    }))
  }

  /* ── 2 · LA FILA MUDA, en Hoy ──────────────────────────────────────────── */
  await page.goto(`${BASE}${HOY}`, { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  const hoy = await page.evaluate(() => {
    const filas = window.__nxSonda.filasDeContinuidad()
    const s = window.__nxSonda.continuidad()
    return {
      zonaExiste: !!s,
      filas: filas.length,
      filasConRevelador: filas.filter(f => window.__nxSonda.reveladores(f).length > 0).length,
      reveladoresEnLaZona: s ? window.__nxSonda.reveladores(s).length : 0,
      /* La fila entera como enlace no admite un botón dentro sin caer en
         nested-interactive. Se anota qué es la fila en cada fase. */
      filaEsEnlaceEntero: filas.filter(f => f.tagName === 'A').length,
      tactiles: s ? window.__nxSonda.reveladores(s).map(b => window.__nxSonda.tactil(b)) : [],
    }
  })
  await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-hoy-continuidad.png`), fullPage: false })

  /* ── 3 · EL COSTE DE PREGUNTAR DESDE HOY ───────────────────────────────── */
  /* Lo que hoy hay que hacer para llegar a las cuatro respuestas: irse. Se
     mide el desplazamiento que se pierde y la URL que cambia — «context
     loss» de §30, medido y no opinado. */
  const coste = await page.evaluate(async () => {
    const m = window.__nxSonda.main()
    const s = window.__nxSonda.continuidad()
    if (!m || !s) return null
    s.scrollIntoView({ block: 'center' })
    await new Promise(r => setTimeout(r, 500))
    return { url: location.pathname, scrollTop: Math.round(m.scrollTop) }
  })
  let costeIda = null
  if (coste) {
    const verTodo = page.locator('section[aria-label="Continuidad entre consultas"] a:has-text("Ver todo")').first()
    if (await verTodo.count()) {
      await verTodo.click()
      await page.waitForTimeout(3000)
      const alLlegar = await page.evaluate(() => ({
        url: location.pathname,
        scrollTop: Math.round(window.__nxSonda.main()?.scrollTop ?? 0),
      }))
      await page.goBack({ waitUntil: 'load' })
      await page.waitForTimeout(3000)
      const alVolver = await page.evaluate(() => ({
        url: location.pathname,
        scrollTop: Math.round(window.__nxSonda.main()?.scrollTop ?? 0),
      }))
      costeIda = { desde: coste, alLlegar, alVolver }
    }
  }

  /* ── 4 y 5 · LAS CUATRO EN HOY, SITIO Y VUELTA ─────────────────────────── */
  const comportamiento = []
  const cuantos = Math.min(hoy.reveladoresEnLaZona, 2)
  for (let i = 0; i < cuantos; i++) {
    await page.goto(`${BASE}${HOY}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)

    const paso = await page.evaluate(async (idx) => {
      const s = window.__nxSonda
      const m = s.main()
      const zona = s.continuidad()
      const b = zona ? s.reveladores(zona)[idx] : null
      if (!b || !m) return null

      b.scrollIntoView({ block: 'center' })
      await new Promise(r => setTimeout(r, 500))

      const antes = {
        scrollTop: Math.round(m.scrollTop),
        alto: m.scrollHeight,
        rect: Math.round(b.getBoundingClientRect().top),
        expandido: b.getAttribute('aria-expanded'),
      }

      b.focus()
      b.click()
      await new Promise(r => setTimeout(r, 800))

      return {
        entrada: (() => {
          let n = b.parentElement
          while (n && !n.querySelector('.nx-ident')) n = n.parentElement
          return (n?.querySelector('.nx-ident')?.textContent ?? '').trim().slice(0, 40)
        })(),
        antes,
        despues: {
          url: location.pathname,
          scrollTop: Math.round(m.scrollTop),
          alto: m.scrollHeight,
          rect: Math.round(b.getBoundingClientRect().top),
          expandido: b.getAttribute('aria-expanded'),
          lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
          disparadorTapado: (() => {
            const r = b.getBoundingClientRect()
            const en = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
            return !(en && (b === en || b.contains(en) || en.contains(b)))
          })(),
          respuestas: s.respuestas(),
          traza: s.traza(),
          sinTraza: s.sinTraza(),
        },
      }
    }, i)

    if (!paso) continue

    await page.screenshot({ path: path.join(DESTINO, `${FASE}-${vp.nombre}-hoy-lente-${i}.png`), fullPage: false })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const trasEscape = await page.evaluate((idx) => {
      const s = window.__nxSonda
      const zona = s.continuidad()
      const b = zona ? s.reveladores(zona)[idx] : null
      const m = s.main()
      return {
        url: location.pathname,
        alto: m?.scrollHeight ?? null,
        scrollTop: Math.round(m?.scrollTop ?? 0),
        expandido: b?.getAttribute('aria-expanded') ?? null,
        lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
        focoEnElDisparador: !!b && document.activeElement === b,
      }
    }, i)

    comportamiento.push({ ...paso, trasEscape })
  }

  /* ── LA TRAZA, DEL OTRO LADO ───────────────────────────────────────────── */
  let traza = { href: null, cargó: null, url: null, errores: 0 }
  const conTraza = comportamiento.find(c => c.despues.traza?.href)
  if (conTraza) {
    const href = conTraza.despues.traza.href
    const antesErr = acta.errores.length
    await page.goto(`${BASE}${href}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)
    traza = {
      href,
      url: page.url().replace(BASE, ''),
      cargó: await page.evaluate(() => (document.querySelector('main')?.scrollHeight ?? 0) > 400),
      errores: acta.errores.length - antesErr,
    }
  }

  acta.viewports[vp.nombre] = { alcance, hoy, costeIda, comportamiento, traza }
  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  const conFuente = Object.entries(alcance).filter(([, a]) => a.reveladores.length > 0)
  console.log(`ALCANCE §21 — ${conFuente.length} de ${SUPERFICIES.length} superficies pueden inspeccionar la fuente de un hecho`)
  for (const [n, a] of Object.entries(alcance)) {
    const nombres = [...new Set(a.reveladores)]
    console.log(`  ${n.padEnd(12)} reveladores: ${a.reveladores.length}${nombres.length ? ' → ' + nombres.join(' | ') : ''}` +
      ` · hueco de lente: ${a.huecoDeLente} · anidados: ${a.anidados}`)
  }
  console.log(`\nHOY — zona CONTINUITY: ${hoy.zonaExiste ? 'sí' : 'NO EXISTE'} · filas: ${hoy.filas}` +
    ` · filas que pueden preguntar: ${hoy.filasConRevelador}` +
    ` · filas que son un <a> entero: ${hoy.filaEsEnlaceEntero}`)
  if (hoy.tactiles.length) {
    const chico = hoy.tactiles.filter(t => t.w < 44 || t.h < 44).length
    console.log(`  táctiles: ${hoy.tactiles.map(t => `${t.w}×${t.h}`).join(' ')} · por debajo de 44: ${chico}`)
  }
  if (costeIda) {
    console.log(`\nCOSTE DE PREGUNTAR DESDE HOY (lo que había que hacer: irse)`)
    console.log(`  ${costeIda.desde.url} (scroll ${costeIda.desde.scrollTop}) → ${costeIda.alLlegar.url} (scroll ${costeIda.alLlegar.scrollTop})` +
      ` → atrás: ${costeIda.alVolver.url} (scroll ${costeIda.alVolver.scrollTop})`)
    console.log(`  desplazamiento perdido al volver: ${costeIda.desde.scrollTop - costeIda.alVolver.scrollTop}px`)
  }
  for (const c of comportamiento) {
    console.log(`\nINSPECCIONAR DESDE HOY «${c.entrada || '(sin identidad)'}»`)
    console.log(`  la URL NO cambia: ${c.antes ? c.despues.url === HOY : '?'} (${c.despues.url})`)
    console.log(`  alto de Hoy         ${c.antes.alto} → ${c.despues.alto} (${c.despues.alto - c.antes.alto >= 0 ? '+' : ''}${c.despues.alto - c.antes.alto}px)`)
    console.log(`  el disparador se movió ${c.despues.rect - c.antes.rect}px · scroll ${c.antes.scrollTop} → ${c.despues.scrollTop}`)
    console.log(`  aria-expanded ${c.antes.expandido} → ${c.despues.expandido} · lentes abiertas ${c.despues.lentesAbiertas}`)
    console.log(`  disparador tapado por lo abierto: ${c.despues.disparadorTapado}`)
    const r = c.despues.respuestas
    if (!r) console.log('  LAS CUATRO: no se abrió la lente')
    else {
      const faltan = LAS_CUATRO.filter(x => !r.some(y => y.rotulo === x))
      const vacias = r.filter(y => y.largo < 5).map(y => y.rotulo)
      console.log(`  LAS CUATRO: ${r.length}/4 · faltan: ${faltan.length ? faltan.join(', ') : 'ninguna'}` +
        ` · sin respuesta: ${vacias.length ? vacias.join(', ') : 'ninguna'}`)
    }
    console.log(`  TRAZA: ${c.despues.traza ? c.despues.traza.href : (c.despues.sinTraza ? 'no consta (dicho)' : 'AUSENTE Y CALLADA')}`)
    console.log(`  ESCAPE → alto ${c.trasEscape.alto} · scroll ${c.trasEscape.scrollTop} · aria-expanded ${c.trasEscape.expandido}` +
      ` · lentes ${c.trasEscape.lentesAbiertas} · foco en el disparador: ${c.trasEscape.focoEnElDisparador}`)
  }
  if (traza.href) {
    console.log(`\nLA TRAZA DEL OTRO LADO — ${traza.href} → ${traza.url} · cargó: ${traza.cargó} · errores nuevos: ${traza.errores}`)
  }
}

await navegador.close()
acta.resumen = { errores: acta.errores.length }
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\nErrores de consola/página: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log(`  · ${e}`)
console.log(`Acta: ${path.join(DESTINO, `acta-${FASE}.json`)}`)
