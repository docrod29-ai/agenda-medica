/**
 * ARNÉS RTC-12(a) / RTC-16 — EL LIENZO DE PÁGINA, MEDIDO POR SU CONSECUENCIA.
 *
 * ── Qué se está discutiendo ─────────────────────────────────────────────────
 *
 * El registro canónico dejó abierta la mitad (a) de RTC-12: «ninguna superficie
 * usa el lienzo de escritorio: columna única 880–1100px en todas». Se dimensionó
 * (900 · 1100 · 880 · 980 de 1440) y se aparcó como deuda del monolito.
 *
 * Ese enunciado da por hecho que el defecto es **el ancho sobrante**. Este arnés
 * no lo presupone: un ancho de lectura de 880px no es un defecto, es tipografía
 * —y ensancharlo para llenar píxeles sería el error contrario—. Lo que sí es un
 * defecto medible es que **no hay UNA regla**: cada pantalla eligió su número.
 *
 * Por eso aquí no se mide «cuánto sobra». Se mide **la consecuencia**:
 *
 *   · `bordeIzquierdoDelContenido` — dónde empieza a leerse cada pantalla.
 *   · `saltoAlNavegar` — cuántos píxeles se desplaza ese borde al pasar de una
 *     pantalla a la siguiente. §20 pide que navegar se sienta como el mismo
 *     objeto haciéndose más detallado; si el contenido brinca de lado al
 *     cambiar de destino, la continuidad la rompe el marco, no el contenido.
 *   · `anchoDeclarado` — el `max-width` computado del contenedor de página.
 *   · `medidaEnCaracteres` — para las superficies con prosa: un renglón de 45–85
 *     caracteres es el rango legible; un número fuera de ahí es un dato para la
 *     decisión, no una opinión.
 *
 * ── Qué NO mide ─────────────────────────────────────────────────────────────
 *
 * No puntúa estética, no decide cuál ancho es «bonito» y no mira móvil (a 390px
 * no hay lienzo que repartir: todas las medidas colapsan al ancho del teléfono,
 * que es justo por lo que este defecto es de escritorio).
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-canvas-de-pagina-v15.mjs [destino]"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-canvas'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE = 'pac-refugio-alcantara'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

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

/** Las seis que puntúa §29, en el orden en que un médico las recorre. */
const RUTAS = [
  ['/dashboard', 'hoy'],
  ['/pendientes', 'pendientes'],
  ['/pacientes', 'pacientes'],
  [`/expediente/${PACIENTE}`, 'expediente'],
  [`/consulta/${PACIENTE}`, 'consulta'],
  ['/operaciones', 'operaciones'],
]

const medidas = {}
for (const [ruta, etiqueta] of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)

  const m = await page.evaluate(() => {
    const principal = document.querySelector('main')
    if (!principal) return { error: 'sin <main>' }

    /**
     * EL CONTENEDOR DE PÁGINA es el primer descendiente que acota el ancho.
     * Se busca por lo que HACE (limitar) y no por su clase, porque hoy son
     * cuatro contenedores distintos y ninguno comparte nombre — que es
     * exactamente el defecto que se viene a medir. Buscarlo por una clase que
     * aún no existe habría devuelto `null` en las seis y el arnés informaría
     * un empate perfecto: un aprobado vacío (la lección de RTC-23).
     */
    const contenedor = [...principal.querySelectorAll('div')].find(d => {
      const mw = getComputedStyle(d).maxWidth
      return mw && mw !== 'none' && parseFloat(mw) > 400
    }) ?? null

    /**
     * EL BORDE IZQUIERDO DEL MARCO — y por qué NO se toma del `<h1>`.
     *
     * La primera versión de este arnés medía el `<h1>`, razonando que es donde
     * el ojo empieza a leer. Con los cuatro anchos viejos daba la respuesta
     * correcta por casualidad, y en cuanto el lienzo se unificó siguió
     * informando **56px de salto** en `/expediente`: ahí el `<h1>` es el nombre
     * del paciente y va DESPUÉS del disco del avatar (44px + 12 de hueco).
     *
     * O sea, el número no medía el marco: medía la sangría interna de un
     * componente. Se mide el contenedor, que es lo que el lienzo decide, y el
     * desplazamiento del `<h1>` se anota aparte como lo que es —composición
     * dentro de la pantalla, no el marco de la pantalla—.
     */
    const caja = contenedor?.getBoundingClientRect() ?? null
    const encabezado = principal.querySelector('h1')
    const cajaH1 = encabezado?.getBoundingClientRect() ?? null

    /** Medida en caracteres del párrafo de prosa más ancho (45–85 es el rango legible). */
    const parrafos = [...principal.querySelectorAll('p')]
      .filter(p => (p.textContent ?? '').trim().length > 80)
      .map(p => {
        const cs = getComputedStyle(p)
        const anchoDeCaracter = parseFloat(cs.fontSize) * 0.5 // aproximación estándar de 1ch en una humanista
        return Math.round(p.getBoundingClientRect().width / anchoDeCaracter)
      })

    return {
      anchoDelViewport: window.innerWidth,
      anchoDelMain: Math.round(principal.getBoundingClientRect().width),
      anchoDeclarado: contenedor ? getComputedStyle(contenedor).maxWidth : null,
      claseDelContenedor: contenedor ? (contenedor.className || '(sin clase)') : null,
      anchoRenderizado: contenedor ? Math.round(contenedor.getBoundingClientRect().width) : null,
      bordeIzquierdoDelContenido: caja ? Math.round(caja.left) : null,
      /* Sangría del primer titular DENTRO del marco (avatar, iconos…). No es
         el marco; se anota para que nadie vuelva a confundir las dos cosas. */
      sangriaDelTitular: caja && cajaH1 ? Math.round(cajaH1.left - caja.left) : null,
      medidaEnCaracteres: parrafos.length ? Math.max(...parrafos) : null,
    }
  })

  medidas[etiqueta] = { ruta, ...m }
  console.log(
    `  ${etiqueta.padEnd(12)} declarado ${String(m.anchoDeclarado).padStart(7)} · ` +
    `marco izq ${String(m.bordeIzquierdoDelContenido).padStart(4)}px · ` +
    `sangría del titular ${String(m.sangriaDelTitular ?? '—').padStart(3)}px · ` +
    `medida ${m.medidaEnCaracteres ?? '—'}ch · clase «${m.claseDelContenedor}»`,
  )
  await page.screenshot({ path: path.join(DESTINO, `${etiqueta}-1440.png`) })
}

/**
 * EL SALTO — el número que decide. Se recorre la lista en el orden real de un
 * turno de consulta y se resta el borde izquierdo de cada pantalla al de la
 * anterior. Cero significa que el marco desaparece al navegar, que es lo que
 * §20 pide; cualquier otra cosa es el contenido brincando de lado.
 */
const orden = RUTAS.map(([, e]) => e)
const saltos = []
for (let i = 1; i < orden.length; i++) {
  const de = medidas[orden[i - 1]], a = medidas[orden[i]]
  if (de?.bordeIzquierdoDelContenido == null || a?.bordeIzquierdoDelContenido == null) continue
  const salto = Math.abs(a.bordeIzquierdoDelContenido - de.bordeIzquierdoDelContenido)
  saltos.push({ de: orden[i - 1], a: orden[i], salto })
}

/**
 * MÓVIL — lo único que este cambio puede romper en el teléfono.
 *
 * A 390px no hay lienzo que repartir: todas las medidas colapsan al ancho del
 * aparato, y por eso el defecto es de escritorio. Pero convertir una pantalla
 * le quita su `padding` escrito a mano y le pone el de la hoja, así que hay
 * DOS cosas que comprobar del otro lado (§40, y «el dato tiene que llegar»):
 *
 *   · que el recorte de teléfono pequeño llegue de verdad (16px, no 24);
 *   · que nada se salga de lado — un `padding` perdido se ve primero como
 *     desbordamiento horizontal, y en el teléfono de alguien, no aquí.
 */
await page.setViewportSize({ width: 390, height: 844 })
const movil = {}
for (const [ruta, etiqueta] of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  const m = await page.evaluate(() => {
    const lienzo = document.querySelector('main .nx-canvas') ?? document.querySelector('main > div')
    const doc = document.documentElement
    return {
      recorte: lienzo ? getComputedStyle(lienzo).paddingLeft : null,
      anchoDelLienzo: lienzo ? Math.round(lienzo.getBoundingClientRect().width) : null,
      desbordaDeLado: Math.round(doc.scrollWidth) > Math.round(window.innerWidth),
      scrollWidth: Math.round(doc.scrollWidth),
      innerWidth: window.innerWidth,
    }
  })
  movil[etiqueta] = m
  console.log(`  [390px] ${etiqueta.padEnd(12)} recorte ${m.recorte} · lienzo ${m.anchoDelLienzo}px · desborda: ${m.desbordaDeLado ? 'SÍ ✗' : 'no ✓'}`)
  await page.screenshot({ path: path.join(DESTINO, `${etiqueta}-390.png`) })
}

const anchosDistintos = [...new Set(Object.values(medidas).map(v => v.anchoDeclarado).filter(Boolean))]
const acta = {
  fecha: new Date().toISOString(),
  viewport: '1440×900',
  medidas,
  movil,
  saltosAlNavegar: saltos,
  saltoMaximo: saltos.length ? Math.max(...saltos.map(s => s.salto)) : null,
  anchosDeclaradosDistintos: anchosDistintos,
  erroresDeConsola: errores,
}
fs.writeFileSync(path.join(DESTINO, 'acta-canvas.json'), JSON.stringify(acta, null, 2))

console.log('')
console.log(`  anchos declarados distintos en 6 pantallas: ${anchosDistintos.length} → ${anchosDistintos.join(' · ')}`)
for (const s of saltos) console.log(`  ${s.de} → ${s.a}: el contenido salta ${s.salto}px de lado`)
console.log(`  SALTO MÁXIMO: ${acta.saltoMaximo}px`)
console.log(`  errores de consola: ${errores.length}`)
console.log(`  acta → ${path.join(DESTINO, 'acta-canvas.json')}`)

await contexto.close()
await navegador.close()
