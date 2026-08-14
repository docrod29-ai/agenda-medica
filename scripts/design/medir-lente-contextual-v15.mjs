/**
 * MEDICIÓN EN NAVEGADOR REAL — la Capa 4 de §5 (la lente contextual) y cómo se
 * revela hoy la procedencia (§21).
 *
 * ── QUÉ PREGUNTA CONTESTA, Y POR QUÉ ÉSA ────────────────────────────────────
 *
 * `V15-SHELL-GREYBOX-001` construyó tres de las cuatro capas del shell de §5:
 * franja de instrumentos, riel de flujo y lienzo clínico. La CUARTA —la lente
 * contextual— nunca se construyó, y RTC-12(a) lo dejó escrito al unificar el
 * lienzo: «no decide qué vive en el ancho que queda a la derecha; el lienzo lo
 * reserva, hoy está vacío».
 *
 * Antes de construirla, el estado de V15 mandó medir lo que §21 YA tiene:
 *
 *   «cómo se revela hoy la procedencia (`SelloProcedencia`, REG-213/REG-250) y
 *    si sale de la pantalla, abre modal o pierde el sitio — fact → inspect →
 *    source → return exactly where you were. Si la medición dice que el patrón
 *    actual ya cumple, se declara.»
 *
 * Esto es esa medición. No juzga estética: mide geometría, desplazamiento y
 * foco.
 *
 * ── LAS CUATRO CONDICIONES DE §21, TRADUCIDAS A ALGO QUE SE PUEDE MEDIR ─────
 *
 *   1. ALCANCE — ¿en cuántas de las superficies que puntúa §29 existe alguna
 *      forma de inspeccionar la fuente de un hecho?
 *   2. DISTANCIA — desde el hecho (la nota, los diagnósticos) hasta el control
 *      que revela su fuente: ¿cuánto hay que desplazarse?
 *   3. SITIO — al inspeccionar, ¿se mueve la página bajo el dedo? Se mide el
 *      alto del contenedor antes y después y la posición del PROPIO control:
 *      si el control se queda quieto pero el resto crece 900px, el sitio se
 *      perdió para todo lo que estaba debajo.
 *   4. VUELTA — ¿se cierra con Escape? ¿vuelve el foco a donde estaba?
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 y no sustituye la lectura independiente que la iteración
 *   sigue debiendo.
 * · No mide el rol de ASISTENTE: la siembra sólo trae cuenta de médico.
 * · No mide la consulta EN CURSO (grabando): mide la nota ya escrita, que es
 *   donde vive hoy la procedencia.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-lente-contextual-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-lente-contextual'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/** La nota firmada CON dictado sembrado: sin ella, §21 no se puede ver. */
const NOTA = '/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1'

/* Las seis que puntúa §29, para el alcance (condición 1). */
const SUPERFICIES = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
  ['expediente', '/expediente/pac-aurelio-dominguez'],
  ['pendientes', '/pendientes'],
  ['operaciones', '/operaciones'],
  ['consulta', NOTA],
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

/** Se inyecta en la página: localizar los reveladores de procedencia. */
const SONDA = `
  window.__nxSonda = {
    visible(el) {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    },
    /* Los controles que INSPECCIONAN la fuente de un hecho clínico. Se buscan
       por su texto porque no llevan marca propia — que es, en sí, parte del
       hallazgo: no existe una pieza compartida detrás de ellos. */
    reveladores() {
      const RE = /de d[oó]nde sali[oó]|procedencia de la nota/i
      return [...document.querySelectorAll('button')]
        .filter(b => RE.test((b.textContent ?? '')) && window.__nxSonda.visible(b))
    },
    main() { return document.querySelector('main') },
    /* Un hecho clínico anclado y estable en la nota: el encabezado de la
       sección de Diagnósticos. Es lo que la procedencia explica.
       NO se busca por h2/h3 — la primera versión de esta sonda lo hizo y
       devolvió null en las cuatro pasadas: el componente Section de la consulta
       rotula con un span, no con un encabezado. (Que no sea un encabezado es a
       su vez un hallazgo de §24, anotado y fuera del alcance de esta rebanada.)
       Sin acentos graves aquí dentro: esta sonda vive en una plantilla. */
    hecho() {
      const h = [...document.querySelectorAll('span, h2, h3')]
        .find(e => /^diagn[oó]sticos$/i.test((e.textContent ?? '').trim()) && window.__nxSonda.visible(e))
      return h ?? null
    },
    y(el) {
      const m = window.__nxSonda.main()
      if (!el || !m) return null
      return Math.round(el.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop)
    },
  }
`

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: vp.viewport, hasTouch: vp.hasTouch, isMobile: vp.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${vp.nombre}: pageerror: ${e.message}`))
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

  /* ── 1. ALCANCE + presencia de la Capa 4 en las seis superficies ───────── */
  const alcance = {}
  for (const [nombre, ruta] of SUPERFICIES) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    alcance[nombre] = await page.evaluate(() => ({
      reveladores: window.__nxSonda.reveladores().map(b => (b.textContent ?? '').trim().slice(0, 40)),
      /* La Capa 4 como PIEZA: o existe en el shell, o no existe. */
      lentesEnElShell: document.querySelectorAll('.nx-lente').length,
      huecoDeLente: !!document.getElementById('nx-lente-hueco'),
      altoDeLaPagina: window.__nxSonda.main()?.scrollHeight ?? null,
    }))
  }

  /* ── 2/3/4. El comportamiento, sobre la nota firmada con dictado ───────── */
  await page.goto(`${BASE}${NOTA}`, { waitUntil: 'load' })
  await page.waitForTimeout(3500)

  const antesDeAbrir = await page.evaluate(() => {
    const s = window.__nxSonda
    const m = s.main()
    return {
      altoDeLaPagina: m?.scrollHeight ?? null,
      viewport: m?.clientHeight ?? null,
      hecho: s.y(s.hecho()),
      reveladores: s.reveladores().map(b => ({ texto: (b.textContent ?? '').trim().slice(0, 40), y: s.y(b) })),
    }
  })

  const comportamiento = []
  const cuantos = antesDeAbrir.reveladores.length
  for (let i = 0; i < cuantos; i++) {
    /* Se vuelve a cargar entre uno y otro: abrir el primero mueve al segundo,
       y medir el segundo ya desplazado sería medir el efecto del primero. */
    if (i > 0) { await page.goto(`${BASE}${NOTA}`, { waitUntil: 'load' }); await page.waitForTimeout(3500) }

    const paso = await page.evaluate(async (idx) => {
      const s = window.__nxSonda
      const m = s.main()
      const b = s.reveladores()[idx]
      if (!b || !m) return null
      const texto = (b.textContent ?? '').trim().slice(0, 40)

      b.scrollIntoView({ block: 'center' })
      await new Promise(r => setTimeout(r, 500))

      const antes = {
        scrollTop: Math.round(m.scrollTop),
        alto: m.scrollHeight,
        rect: b.getBoundingClientRect().top,
        /* El hecho que explica: ¿se ve mientras se inspecciona su fuente? */
        hechoVisible: (() => {
          const h = s.hecho()
          if (!h) return null
          const r = h.getBoundingClientRect()
          return r.bottom > 0 && r.top < m.clientHeight
        })(),
      }

      b.focus()
      b.click()
      await new Promise(r => setTimeout(r, 700))

      const despues = {
        scrollTop: Math.round(m.scrollTop),
        alto: m.scrollHeight,
        rect: b.getBoundingClientRect().top,
        hechoVisible: (() => {
          const h = s.hecho()
          if (!h) return null
          const r = h.getBoundingClientRect()
          return r.bottom > 0 && r.top < m.clientHeight
        })(),
        /* ¿El control que se pulsó sigue recibiendo el puntero, o lo tapó lo
           que se abrió? Un panel que cubre su propio disparador perdió el
           sitio aunque no haya movido un píxel. */
        disparadorTapado: (() => {
          const r = b.getBoundingClientRect()
          const en = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
          return !(en && (b === en || b.contains(en) || en.contains(b)))
        })(),
        foco: document.activeElement === b ? 'el disparador'
          : document.activeElement?.tagName === 'BODY' ? 'body'
          : `${document.activeElement?.tagName}.${String(document.activeElement?.className ?? '').slice(0, 30)}`,
        lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
      }
      return { texto, antes, despues }
    }, i)

    if (!paso) continue

    /* La foto va AQUÍ, con lo inspeccionado ABIERTO. La primera versión de este
       arnés la tomaba después de pulsar Escape y las seis capturas salían del
       estado cerrado: habrían ilustrado el §36 sin enseñar nada de lo medido.
       Undécimo defecto de instrumento de esta fase. */
    await page.screenshot({
      path: path.join(DESTINO, `${FASE}-${vp.nombre}-revelador-${i}-abierto.png`),
      fullPage: false,
    })

    /* ESCAPE — y después, ¿dónde quedó el foco? */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const trasEscape = await page.evaluate((idx) => {
      const s = window.__nxSonda
      const b = s.reveladores()[idx]
      const m = s.main()
      return {
        alto: m?.scrollHeight ?? null,
        scrollTop: Math.round(m?.scrollTop ?? 0),
        expandido: b?.getAttribute('aria-expanded') ?? null,
        lentesAbiertas: document.querySelectorAll('.nx-lente[data-abierta="si"]').length,
        focoEnElDisparador: !!b && document.activeElement === b,
      }
    }, i)

    comportamiento.push({ ...paso, trasEscape })

    await page.screenshot({
      path: path.join(DESTINO, `${FASE}-${vp.nombre}-revelador-${i}-cerrado.png`),
      fullPage: false,
    })
  }

  acta.viewports[vp.nombre] = { alcance, antesDeAbrir, comportamiento }
  await contexto.close()

  /* ── Informe legible ───────────────────────────────────────────────────── */
  console.log(`\n══════ ${vp.nombre} (${FASE}) ══════`)
  const conRevelador = Object.entries(alcance).filter(([, a]) => a.reveladores.length > 0)
  console.log(`ALCANCE — superficies con algún revelador de fuente: ${conRevelador.length}/${SUPERFICIES.length}` +
    (conRevelador.length ? ` (${conRevelador.map(([n]) => n).join(', ')})` : ''))
  const conLente = Object.entries(alcance).filter(([, a]) => a.lentesEnElShell > 0 || a.huecoDeLente)
  console.log(`CAPA 4 — superficies con la lente montada en el shell: ${conLente.length}/${SUPERFICIES.length}`)
  console.log(`\nLA NOTA — alto ${antesDeAbrir.altoDeLaPagina}px en un viewport de ${antesDeAbrir.viewport}px` +
    ` · «Diagnósticos» a ${antesDeAbrir.hecho}px`)
  for (const r of antesDeAbrir.reveladores) {
    const d = antesDeAbrir.hecho != null && r.y != null ? r.y - antesDeAbrir.hecho : null
    console.log(`  · «${r.texto}» a ${r.y}px` + (d != null ? ` — ${d}px por debajo del hecho que explica` : ''))
  }
  for (const c of comportamiento) {
    console.log(`\nINSPECCIONAR «${c.texto}»`)
    console.log(`  alto de la página   ${c.antes.alto} → ${c.despues.alto} (${c.despues.alto - c.antes.alto >= 0 ? '+' : ''}${c.despues.alto - c.antes.alto}px)`)
    console.log(`  el disparador se movió ${Math.round(c.despues.rect - c.antes.rect)}px · scroll ${c.antes.scrollTop} → ${c.despues.scrollTop}`)
    console.log(`  el hecho («Diagnósticos») visible: ${c.antes.hechoVisible} → ${c.despues.hechoVisible}`)
    console.log(`  disparador tapado por lo abierto: ${c.despues.disparadorTapado} · foco: ${c.despues.foco}`)
    console.log(`  lentes abiertas: ${c.despues.lentesAbiertas}`)
    console.log(`  ESCAPE → alto ${c.trasEscape.alto} · aria-expanded ${c.trasEscape.expandido} · lentes ${c.trasEscape.lentesAbiertas} · foco en el disparador: ${c.trasEscape.focoEnElDisparador}`)
  }
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\n${acta.errores.length} errores de página · acta en ${path.join(DESTINO, `acta-${FASE}.json`)}`)
for (const e of acta.errores) console.log(`  · ${e}`)
