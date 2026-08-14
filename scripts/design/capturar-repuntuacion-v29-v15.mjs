/**
 * CAPTURAS PARA LA RE-PUNTUACIÓN §29 — cierre de V15-ORIGINALITY-REDTEAM-001.
 *
 * La compuerta §29/§34 quedó FAIL cuando el equipo rojo puntuó las superficies
 * (Hoy 3.5-4.5 · Pacientes 6-7 · Expediente 4.5 · Consulta 3 · Pendientes 2 ·
 * Operaciones 7, sobre 10, con objetivo ≤1). Los diez P1 ya están pagados —
 * pero **el score no se hereda**: puntuar sobre las capturas que encontraron
 * los defectos sería puntuar el pasado. Este arnés toma las capturas NUEVAS
 * sobre las que se vuelve a puntuar.
 *
 * Toma cada superficie en escritorio (1440×900) y en móvil (390×844), y
 * además una pasada **LOGO-OFF** de escritorio: se oculta la marca por CSS
 * (ver `SELECTOR_DE_MARCA` abajo) para responder la pregunta de §34 —¿se
 * reconocería este producto sin su logotipo, o podría ser cualquier plantilla?
 *
 * `SOLO=logo-off` corre una sola pasada, para no repetir las tres cuando lo que
 * hay que rehacer es una.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-repuntuacion-v29-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-repuntuacion-v29'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE = 'pac-refugio-alcantara'

const SUPERFICIES = [
  ['/dashboard', 'hoy'],
  ['/pacientes', 'pacientes'],
  [`/expediente/${PACIENTE}`, 'expediente'],
  [`/consulta/${PACIENTE}`, 'consulta'],
  ['/pendientes', 'pendientes'],
  ['/operaciones', 'operaciones'],
]

fs.mkdirSync(DESTINO, { recursive: true })
const errores = []
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

async function entrar(page) {
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
}

/**
 * EL SELECTOR DE LOGO-OFF, CORREGIDO — cuarta vez que el defecto está en el
 * instrumento y no en el producto.
 *
 * La primera versión ocultaba `.nx-marca, [data-marca], svg[aria-label*=
 * "Ausculta"]`. **Ninguno de los tres existe en este repositorio**: la marca la
 * dibuja `MarcaAusculta` con `aria-hidden`, dentro de `.sidebar-logo`, y el
 * nombre del consultorio lo pinta la franja. Así que la pasada «logo-off» salió
 * con el logotipo puesto y habría contestado la pregunta de §34 sin haber
 * quitado nada. Es exactamente lo que ya pasó con `window.scrollTo` en RTC-12:
 * una condición que se cumple porque el gesto no ocurrió.
 *
 * Se comprueba que el gesto OCURRIÓ (`ocultados > 0`) y se anota en el acta.
 */
const SELECTOR_DE_MARCA = '.sidebar-logo, .nx-instrument-strip > span:first-child, .nx-ident-franja'

const PASADAS = [
  [1440, 900, 'escritorio', false],
  [390, 844, 'movil', false],
  [1440, 900, 'logo-off', true],
].filter(p => !process.env.SOLO || process.env.SOLO === p[2])

const marcasOcultadas = {}

for (const [ancho, alto, etiqueta, logoOff] of PASADAS) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))
  await entrar(page)

  for (const [ruta, nombre] of SUPERFICIES) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    if (logoOff) {
      /* LOGO-OFF (§34): sin la marca, ¿sigue siendo reconocible ESTE producto?
         Se oculta por CSS y no se toca el código — la pregunta es sobre la
         pantalla, no sobre el árbol de componentes. */
      await page.addStyleTag({ content: `${SELECTOR_DE_MARCA} { visibility: hidden !important; }` })
      const ocultados = await page.evaluate(s => document.querySelectorAll(s).length, SELECTOR_DE_MARCA)
      marcasOcultadas[nombre] = ocultados
      if (ocultados === 0) console.log(`  ⚠ ${nombre}: el selector de marca no encontró NADA — la pasada logo-off no probaría nada`)
      await page.waitForTimeout(300)
    }
    await page.screenshot({ path: path.join(DESTINO, `${nombre}-${etiqueta}.png`), fullPage: false })
    console.log(`  ✓ ${nombre}-${etiqueta}`)
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'errores-de-consola.json'), JSON.stringify(errores, null, 2))
if (Object.keys(marcasOcultadas).length > 0) {
  fs.writeFileSync(path.join(DESTINO, 'marcas-ocultadas.json'), JSON.stringify(marcasOcultadas, null, 2))
}
console.log(`\n${errores.length} errores de consola · capturas en ${DESTINO}`)
