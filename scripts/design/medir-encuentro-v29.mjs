/**
 * LA MEDICIÓN CORREGIDA DE §29 — el encuentro SIN FIRMAR, y el esqueleto de
 * las tres superficies que quedan.
 *
 * ── POR QUÉ EXISTE ESTE MEDIDOR, HABIENDO YA UNO ────────────────────────────
 *
 * `medir-anatomia-v29.mjs` midió Consulta en
 * `/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1`. Esa nota está
 * **firmada** en la siembra (`sembrar-capturas.mjs`, `estado: 'firmada'`), y en
 * estado firmado la consulta NO pinta el bloque de grabación: pinta una nota
 * cerrada en modo revisión. Es decir: el diagnóstico «Consulta es un catálogo
 * de herramientas de IA» se midió sobre una pantalla **donde el instrumento
 * principal del encuentro no está**.
 *
 * Eso no refuta el diagnóstico: lo deja SIN MEDIR. Por eso este arnés entra por
 * `/consulta/pac-aurelio-dominguez` **sin `?nota=`**, que es el encuentro nuevo
 * y sin firmar — el estado en el que el médico entra con el paciente delante.
 * Mide los dos estados para poder decir en qué se diferencian.
 *
 * Es la familia RTC-02 / INS-01 otra vez: el instrumento que mide otra cosa de
 * la que dice medir. Aquí se caza declarándolo, no borrando la lectura vieja.
 *
 * ── QUÉ AÑADE SOBRE LOS RECUENTOS ──────────────────────────────────────────
 *
 * El diagnóstico ya demostró que contar cajas no rankea genericidad
 * (`/pendientes` puntúa 1.0 con los peores recuentos de la tabla). Lo que sí
 * distingue a `/pendientes` es el MODELO DE INTERACCIÓN, y eso se mide con el
 * **esqueleto**: la secuencia de bloques de primer nivel dentro de `<main>`,
 * con su encabezado, su altura y su primer control. Un catálogo de herramientas
 * y un encuentro clínico tienen el mismo número de cajas y esqueletos
 * distintos.
 *
 * NO puntúa §29. Da materia prima. El juicio es del revisor independiente.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-encuentro-v29.mjs <fase>"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.env.DESTINO_ENCUENTRO || 'docs/design/capturas/v15-encuentro-v29'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const SUPERFICIES = [
  // El encuentro SIN FIRMAR: sin `?nota=`. Es la corrección de esta corrida.
  ['consulta-sin-firmar', '/consulta/pac-aurelio-dominguez'],
  // El BORRADOR ya sembrado (`nota-luzmaria-borrador`, `estado: 'borrador'`):
  // un encuentro sin firmar que además ya tiene contenido. Los dos hacen falta:
  // el vacío enseña con qué se entra, el borrador con qué se vuelve.
  ['consulta-borrador', '/consulta/pac-luzmaria-cervantes?nota=nota-luzmaria-borrador'],
  // El mismo paciente en nota FIRMADA: la lectura que se tomó antes, para
  // poder decir en qué se diferencian sin borrar la anterior.
  ['consulta-firmada', '/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1'],
  ['expediente', '/expediente/pac-aurelio-dominguez'],
  ['operaciones', '/operaciones'],
  ['pendientes', '/pendientes'],   // PATRÓN 1.0 — no se toca, sirve de vara
]

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const SONDA = `
window.__nxe = {
  visible(el) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  },
  main() { return document.querySelector('main') },
  texto(el) { return (el.textContent ?? '').replace(/\\s+/g, ' ').trim() },

  /* EL ESQUELETO: los bloques de primer nivel de <main>, en orden de lectura.
     Un bloque es un hijo visible con altura real. De cada uno se apunta su
     encabezado (si lo tiene), dónde empieza, cuánto ocupa y cuál es su primer
     control. Eso es lo que se lee al entrar, en el orden en que se lee. */
  esqueleto() {
    const m = this.main(); if (!m) return []
    const base = m.getBoundingClientRect().top - m.scrollTop
    const fuera = []
    const altoMain = m.scrollHeight || 1
    const recorrer = (padre, prof) => {
      for (const hijo of padre.children) {
        if (!this.visible(hijo)) continue
        const r = hijo.getBoundingClientRect()
        if (r.height < 24) continue
        const hijosVisibles = [...hijo.children].filter(c => this.visible(c))
        // Un envoltorio de un solo hijo no es un bloque: es un envoltorio.
        // Y un hijo que ocupa CASI TODO <main> tampoco es un bloque de lectura:
        // es la columna. En los dos casos hay que bajar un nivel más, o el
        // esqueleto sale con una sola fila y no dice nada — que es justo lo
        // que pasó en la primera corrida de este medidor.
        const esEnvoltorio = hijosVisibles.length === 1 || r.height >= altoMain * 0.72
        if (esEnvoltorio && prof < 6 && r.height > 120) { recorrer(hijo, prof + 1); continue }
        const enc = hijo.querySelector('h1, h2, h3, [class*=overline], legend')
        const ctrl = [...hijo.querySelectorAll('button, a, input, select, textarea')].filter(e => this.visible(e))[0]
        fuera.push({
          tag: hijo.tagName.toLowerCase(),
          clase: (hijo.className || '').toString().slice(0, 46),
          y: Math.round(r.top - base),
          alto: Math.round(r.height),
          encabezado: enc ? this.texto(enc).slice(0, 52) : null,
          controles: [...hijo.querySelectorAll('button, a, input, select, textarea')].filter(e => this.visible(e)).length,
          primerControl: ctrl ? (this.texto(ctrl) || ctrl.getAttribute('aria-label') || ctrl.tagName).slice(0, 34) : null,
        })
      }
    }
    recorrer(m, 0)
    return fuera
  },

  /* ¿Existe el instrumento del encuentro, y a qué altura? Se busca por lo que
     HACE (grabar/dictar/escuchar), no por una clase concreta: si el bloque se
     renombra, la medición sigue valiendo. */
  instrumento() {
    const m = this.main(); if (!m) return null
    const RE = /grabar|grabaci[oó]n|dictar|dictado|escuchar|micr[oó]fono|transcri/i
    const base = m.getBoundingClientRect().top - m.scrollTop
    const cand = [...m.querySelectorAll('button, [role=button]')].filter(e => {
      if (!this.visible(e)) return false
      return RE.test(this.texto(e) + ' ' + (e.getAttribute('aria-label') || ''))
    })
    if (!cand.length) return null
    const el = cand[0]
    const r = el.getBoundingClientRect()
    return {
      texto: (this.texto(el) || el.getAttribute('aria-label') || '').slice(0, 40),
      y: Math.round(r.top - base),
      ancho: Math.round(r.width), alto: Math.round(r.height),
      total: cand.length,
    }
  },

  /* Campos de formulario visibles en <main>: el número que el diagnóstico
     llamó «12 campos» en Consulta. */
  campos() {
    const m = this.main(); if (!m) return 0
    return [...m.querySelectorAll('input, select, textarea')].filter(e => this.visible(e)).length
  },

  /* Controles que abren OTRA capacidad (una herramienta) frente a controles
     que hacen avanzar ESTE encuentro. La distinción es el corazón de §29:
     catálogo de módulos contra siguiente acción segura. */
  altoTotal() { return this.main()?.scrollHeight ?? null },
  encabezados() {
    const m = this.main(); if (!m) return []
    return [...m.querySelectorAll('h1, h2, h3')].filter(e => this.visible(e)).map(e => this.texto(e).slice(0, 46))
  },
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
    await page.waitForTimeout(3200)
    medidas[sup] = await page.evaluate(() => ({
      esqueleto: window.__nxe.esqueleto(),
      instrumento: window.__nxe.instrumento(),
      campos: window.__nxe.campos(),
      encabezados: window.__nxe.encabezados(),
      altoTotal: window.__nxe.altoTotal(),
    }))
    /**
     * POR QUÉ NO VALE `fullPage: true` AQUÍ.
     *
     * El shell de la app da a `<main>` su propio scroll: el DOCUMENTO no crece,
     * así que `fullPage` devuelve exactamente el viewport y la mitad de abajo de
     * cada pantalla queda SIN MIRAR. La primera corrida de este medidor guardó
     * seis capturas de 1440×900 creyendo que eran páginas enteras.
     *
     * Se recorre `<main>` a pantallas, y cada tramo se guarda con su índice.
     */
    const paginaAlta = medidas[sup].altoTotal ?? alto
    const paso = Math.max(240, Math.round(alto * 0.86))
    let i = 0
    for (let y = 0; y === 0 || y < paginaAlta - 80; y += paso, i++) {
      await page.evaluate(v => { const m = document.querySelector('main'); if (m) m.scrollTop = v }, y)
      await page.waitForTimeout(320)
      await page.screenshot({ path: path.join(DESTINO, `${FASE}-${nombre}-${sup}${i ? `-${i}` : ''}.png`) })
      if (i > 6) break
    }
    await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })
  }
  acta.viewports[nombre] = medidas
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))

for (const [vp, m] of Object.entries(acta.viewports)) {
  console.log(`\n══════════ ${vp} ══════════`)
  for (const [sup, d] of Object.entries(m)) {
    console.log(`\n── ${sup} — alto ${d.altoTotal}px · campos ${d.campos} · instrumento ${d.instrumento ? `«${d.instrumento.texto}» y=${d.instrumento.y}` : 'NINGUNO'}`)
    for (const b of d.esqueleto) {
      console.log(`   y=${String(b.y).padStart(5)} h=${String(b.alto).padStart(5)} ctrl=${String(b.controles).padStart(3)}  ${b.encabezado ? `«${b.encabezado}»` : `(${b.tag}.${b.clase})`}${b.primerControl ? ` → ${b.primerControl}` : ''}`)
    }
  }
}
console.log(`\nerrores de consola: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 12)) console.log('  ' + e)
