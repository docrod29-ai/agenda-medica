/**
 * MEDICIÓN — ¿QUÉ SE QUEDA FUERA DE LA PANTALLA DE UN TELÉFONO?
 *
 * ── QUÉ MIDE Y POR QUÉ ───────────────────────────────────────────────────────
 *
 * Los arneses anteriores de móvil miden el ANCHO (desbordamiento horizontal,
 * objetivo táctil, contraste). Nadie ha medido el ALTO, y el alto es donde vive
 * la familia de defectos que sólo aparece en un teléfono:
 *
 *  · un contenedor con `height: 100vh` es más alto que el viewport VISIBLE en
 *    cuanto hay barra de navegador, y en iOS Safari `100vh` es literalmente la
 *    altura CON LA BARRA OCULTA — siempre mayor que lo que se ve;
 *  · debajo hay una barra de navegación fija de ~53px más el área segura del
 *    «home indicator», que TAPA lo que caiga ahí;
 *  · un `height` fijo (no `min-height`) no crece ni encoge: si la resta está
 *    calculada para el escritorio, en el teléfono sobra o falta exactamente esa
 *    diferencia, y lo que quede debajo puede no alcanzarse.
 *
 * Para cada ruta se mide, en un viewport de teléfono:
 *
 *  · `docAlto` vs `visualAlto`: cuánto sobra por debajo del viewport visible;
 *  · por cada elemento con altura en `vh` SIN `dvh` de respaldo: su alto real
 *    contra el visible, que es la diferencia que sólo se ve en un teléfono;
 *  · qué controles interactivos quedan TAPADOS por la barra inferior fija —
 *    medido con `elementFromPoint` en su propio centro, no calculando
 *    rectángulos: si en su centro responde otro elemento, ese control no se
 *    puede pulsar;
 *  · si el documento entero scrollea en horizontal.
 *
 * ── LO QUE ESTO NO ES ────────────────────────────────────────────────────────
 *
 * **No es un iPhone.** Corre en Chromium con el TAMAÑO de un teléfono. El rebote
 * elástico y `overflow-anchor` son de WebKit y aquí no existen: esto no puede
 * poner WS-05 en `PROVEN` y no debe usarse para eso. Lo que sí cierra es el alto,
 * que se puede medir en cualquier motor y hasta hoy no se medía en ninguno.
 *
 * Uso: node scripts/design/medir-el-alto-del-telefono.mjs [destino]
 * (emuladores 8080/9099 arriba, app en :3000, siembra de sembrar-capturas.mjs)
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/alto-del-telefono'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/** iPhone 14: 390×844 CSS px. El teléfono que la regla de diseño nombra. */
const TELEFONO = { width: 390, height: 844 }

const RUTAS = [
  '/dashboard', '/calendario', '/citas', '/pacientes', '/pendientes',
  '/lista-espera', '/finanzas', '/configuracion',
]

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 45000 })
}

async function medir(page, ruta) {
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(3500)
  const saltar = page.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
  if (await saltar.count().catch(() => 0)) { await saltar.click().catch(() => {}); await page.waitForTimeout(900) }

  return page.evaluate(() => {
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    /**
     * Elementos cuya ALTURA está fijada en `vh` por un estilo EN LÍNEA.
     *
     * En línea a propósito: una hoja de estilos puede declarar `100vh` y luego
     * `100dvh`, y el navegador se queda con la segunda. Un estilo en línea NO
     * puede hacer eso —una propiedad, un valor— así que ahí `vh` es `vh` y nada
     * lo corrige.
     */
    const enVh = [...document.querySelectorAll('[style]')]
      .filter(el => /(^|;)\s*height\s*:[^;]*vh/i.test(el.getAttribute('style') || ''))
      .filter(visible)
      .map(el => {
        const r = el.getBoundingClientRect()
        return {
          etiqueta: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
          estilo: (el.getAttribute('style') || '').match(/height\s*:[^;]*/i)?.[0]?.trim() ?? '',
          alto: Math.round(r.height),
          sobraPorDebajo: Math.round(r.bottom - window.innerHeight),
        }
      })

    /** La barra inferior fija, si la hay. */
    const barra = document.querySelector('.bottom-nav-wrap')
    const barraRect = barra && visible(barra) ? barra.getBoundingClientRect() : null

    /**
     * CONTROLES QUE NO SE PUEDEN PULSAR — y la corrección que hace que esto
     * signifique algo.
     *
     * Se mide preguntándole al navegador quién responde en el centro del control
     * (`elementFromPoint`), no comparando rectángulos: un control que existe, se
     * ve y no recibe el toque es peor que uno ausente, porque el médico cree que
     * pulsó.
     *
     * ── LA PRIMERA VERSIÓN SOBRE-REPORTABA, Y HABRÍA SIDO UN GUARDIÁN INÚTIL ──
     *
     * Marcaba **cualquier** control que en ESTE momento cayera bajo la barra
     * inferior. Pero un control bajo la barra normalmente **se destapa
     * scrolleando** — para eso `main` reserva 72px + área segura. Un aviso que
     * salta donde no hay nada se aprende a ignorar en una semana, y entonces
     * tampoco se ve el que sí importaba.
     *
     * Así que un control sólo cuenta como INALCANZABLE si sigue tapado
     * **después de intentar traerlo al centro**. Eso separa las dos cosas:
     *
     *  · «está más abajo» → se scrollea, no es defecto;
     *  · «no hay scroll que lo saque de debajo de la barra» → sí lo es, y es el
     *    caso de un contenedor de alto FIJO que no cabe.
     */
    /**
     * OCULTO A PROPÓSITO PERO ENFOCABLE — no es un control tapado.
     *
     * El patrón `position:absolute; width:1px; height:1px; clip-path:inset(50%)`
     * deja un control fuera de la vista y dentro del orden de tabulación. Se usa
     * a posta: en `/citas` el `<input type="date">` vive así porque enseñaría
     * «08/09/2026» en formato US, y un botón visible le llama a `showPicker()`.
     *
     * La primera versión lo marcaba como «tapado por btn». Era verdad y no era
     * un defecto, y ésa es la peor clase de aviso: correcto, inútil, y enseña a
     * ignorar la lista. Un control de 1px no se toca con el dedo — se alcanza
     * con el teclado, y de su tamaño ya se ocupa el guardián de 44×44.
     */
    const ocultoAProposito = (el) => {
      const r = el.getBoundingClientRect()
      return r.width < 4 || r.height < 4
    }

    const candidatos = []
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
      if (!visible(el)) continue
      if (ocultoAProposito(el)) continue
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (x < 0 || x > window.innerWidth) continue
      if (y >= 0 && y <= window.innerHeight) {
        const enCima = document.elementFromPoint(x, y)
        if (enCima && el !== enCima && !el.contains(enCima) && !enCima.contains(el)) candidatos.push(el)
      } else {
        candidatos.push(el)   // fuera de la ventana ahora mismo: hay que intentar traerlo
      }
    }

    const tapados = []
    for (const el of candidatos) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        tapados.push({
          control: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 44),
          loTapa: 'FUERA DE LA VENTANA — no hay scroll que lo traiga',
          porLaBarra: false,
        })
        continue
      }
      const enCima = document.elementFromPoint(x, y)
      if (!enCima || el === enCima || el.contains(enCima) || enCima.contains(el)) continue
      tapados.push({
        control: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 44),
        loTapa: (enCima.className && typeof enCima.className === 'string' ? enCima.className.split(' ')[0] : enCima.tagName),
        porLaBarra: !!(barraRect && y >= barraRect.top),
      })
    }

    return {
      visualAlto: window.innerHeight,
      docAlto: document.documentElement.scrollHeight,
      desbordaHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
      alturasEnVh: enVh,
      barraInferiorAlto: barraRect ? Math.round(barraRect.height) : 0,
      controlesTapados: tapados,
    }
  })
}

const nav = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium' })
const ctx = await nav.newContext({ viewport: TELEFONO, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await login(page)

const acta = []
for (const ruta of RUTAS) {
  const m = await medir(page, ruta)
  acta.push({ ruta, ...m })
  const vh = m.alturasEnVh.length
    ? m.alturasEnVh.map(a => `${a.etiqueta} ${a.estilo} → ${a.alto}px, sobra ${a.sobraPorDebajo}px`).join(' | ')
    : '—'
  console.log(`${ruta.padEnd(16)} vh:${vh}`)
  if (m.controlesTapados.length) {
    console.log(`${' '.repeat(16)} TAPADOS: ${m.controlesTapados.map(t => `«${t.control}» por ${t.loTapa}${t.porLaBarra ? ' (barra inferior)' : ''}`).join(' | ')}`)
  }
  if (m.desbordaHorizontal) console.log(`${' '.repeat(16)} DESBORDA A LO ANCHO`)
}

fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(path.join(DESTINO, 'acta.json'), JSON.stringify({
  medidoEn: new Date().toISOString(),
  viewport: TELEFONO,
  motor: 'chromium (NO es WebKit: el rebote de iPhone no se mide aquí)',
  rutas: acta,
}, null, 2))
console.log(`\nActa en ${path.join(DESTINO, 'acta.json')}`)

await nav.close()
