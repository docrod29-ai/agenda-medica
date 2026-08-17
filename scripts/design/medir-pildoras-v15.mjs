/**
 * ¿SON DEMASIADAS PÍLDORAS, O SON ÚTILES? — la medición que decide.
 *
 * La 4ª pasada de §29 dejó tres residuos con nombre, y el primero son las
 * **píldoras de filtro**. La tentación es convertirlas en frases porque
 * `/pendientes` —la superficie que puntúa 1.0— usa frases… pero eso sería
 * copiar la forma sin mirar el trabajo: las píldoras de `/pacientes` llevan
 * conteos reales («Recientes (5)», «Todos A-Z (6)») y las de `/pendientes` son
 * conmutadores de una sola cosa. No hacen el mismo trabajo.
 *
 * La regla de diseño no prohíbe las píldoras: prohíbe el **exceso** de
 * píldoras y que todo pese lo mismo. Así que lo que hay que contar es eso.
 *
 * Qué mide, por superficie y ancho:
 *   · cuántas FILAS de píldoras hay, y cuántas píldoras en total;
 *   · cuántas de esas píldoras llevan un dato (un número) y cuántas son sólo
 *     una etiqueta — un filtro que dice «cuántos hay» informa; uno que sólo
 *     se pinta, decora;
 *   · cuánto alto del primer pliegue ocupan entre todas;
 *   · cuántas van RELLENAS (el estado activo en sólido, que es lo que más
 *     grita) frente a las de trazo.
 *
 * No cambia nada: informa. La decisión se toma con el acta delante — y si el
 * acta dice que informan, se quedan y se dice por qué.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-pildoras-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-pildoras'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const CON_HISTORIA = 'pac-luzmaria-cervantes'

const RUTAS = [
  ['/pendientes', 'pendientes'],
  ['/pacientes', 'pacientes'],
  [`/expediente/${CON_HISTORIA}`, 'expediente'],
  [`/consulta/${CON_HISTORIA}`, 'consulta'],
  ['/dashboard', 'hoy'],
  ['/operaciones', 'operaciones'],
]

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const errores = []
const medidas = {}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }

  for (const [ruta, nombre] of RUTAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    const m = await page.evaluate(() => {
      const raiz = document.querySelector('main') ?? document.body
      /* Una PÍLDORA es un control con radio de píldora. Se mide el radio
         computado, no la clase: en este repositorio conviven `var(--r-pill)`,
         `9999px` y `50%`, y contar por clase dejaría fuera la mitad. */
      const esPildora = el => {
        const r = getComputedStyle(el).borderRadius
        const n = parseFloat(r)
        return r.includes('%') ? parseFloat(r) >= 40 : n >= 40
      }
      const controles = [...raiz.querySelectorAll('button, a')]
        .filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
      const pildoras = controles.filter(esPildora).filter(el => {
        const c = el.getBoundingClientRect()
        /* Los FAB circulares no son píldoras de filtro: son cromo flotante y
           tienen su propio expediente (RTC-05). Se excluyen por proporción. */
        return c.width / c.height > 1.4
      })
      const enPliegue = pildoras.filter(el => el.getBoundingClientRect().top < window.innerHeight)
      const filas = new Set(enPliegue.map(el => Math.round(el.getBoundingClientRect().top / 8)))
      const conDato = enPliegue.filter(el => /\d/.test(el.textContent ?? ''))
      const rellenas = enPliegue.filter(el => {
        const bg = getComputedStyle(el).backgroundColor
        const m2 = bg.match(/rgba?\(([^)]+)\)/)
        if (!m2) return false
        const [r, g, b, a = '1'] = m2[1].split(',').map(x => parseFloat(x))
        /* Relleno = opaco y con color propio (no un gris de superficie). */
        return parseFloat(a) > 0.6 && Math.max(r, g, b) - Math.min(r, g, b) > 24
      })
      return {
        pildorasEnElPliegue: enPliegue.length,
        filasDePildoras: filas.size,
        conDato: conDato.length,
        soloEtiqueta: enPliegue.length - conDato.length,
        rellenas: rellenas.length,
        alturaTotal: enPliegue.reduce((n, el) => n + Math.round(el.getBoundingClientRect().height), 0),
        textos: enPliegue.map(el => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28)),
        viewport: window.innerHeight,
      }
    })
    medidas[`${etiqueta}/${nombre}`] = m
    console.log(
      `  ${etiqueta.padEnd(11)} ${nombre.padEnd(12)} ${String(m.pildorasEnElPliegue).padStart(2)} píldoras en ` +
      `${m.filasDePildoras} fila(s) · con dato ${m.conDato} · sólo etiqueta ${m.soloEtiqueta} · rellenas ${m.rellenas} · ` +
      `${m.alturaTotal}px`,
    )
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de consola · acta en ${path.join(DESTINO, 'medicion.json')}`)
