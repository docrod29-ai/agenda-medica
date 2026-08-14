/**
 * MEDICIÓN EN NAVEGADOR REAL — el objetivo táctil de los destinos del riel
 * (V15-ORIGINALITY-REDTEAM-001; deuda declarada y NO pagada por RTC-32; §24).
 *
 * ── QUÉ PREGUNTA CONTESTA, Y POR QUÉ ÉSA ────────────────────────────────────
 *
 * RTC-32 sacó del shell todo lo que flotaba y, al mudar la ayuda al pie del
 * riel, midió su disparador en 207×36 y dejó escrito:
 *
 *   «por debajo del mínimo táctil de §24. Usa `.nav-item`, que es la
 *    geometría de TODOS los destinos del riel, "Cerrar sesión" incluido. Si 36
 *    es deuda, es deuda del riel entero y se paga como unidad.»
 *
 * Esa nota se tomó en ESCRITORIO con ratón. Pero el producto ya tiene una
 * doctrina escrita sobre esto, de la 6ª rebanada de `V15-A11Y-001`: el mínimo
 * de 44px es una regla de PUNTERO GRUESO —vive dentro de
 * `@media (pointer: coarse)`— porque «en escritorio el clic fino no necesita
 * 44px y estirarlo robaría clics de selección de texto». Con ratón, 207×36 no
 * es un objetivo táctil: es un objetivo de ratón.
 *
 * La pregunta correcta, entonces, no es «¿mide 36 en mi portátil?» sino:
 *
 *   1. ¿Qué mide cada destino del riel cuando el puntero SÍ es grueso y el
 *      riel SÍ está en pantalla? Ese ancho existe: el riel enciende a ≥769px
 *      y un iPad horizontal son 1024px de puntero grueso — el mismo ancho que
 *      ya obligó a meter `.btn-icon` en el bloque coarse.
 *   2. ¿Miden todos LO MISMO? El bloque coarse cubre `button` desde hace
 *      tiempo, pero nunca cubrió `<a>` (es la causa raíz que pagó la 6ª
 *      rebanada). Los cuatro contextos clínicos del riel son `<a>`; «Ayuda» y
 *      «Cerrar sesión» son `<button>`. Si eso se cumple, el riel táctil tiene
 *      los controles de SISTEMA más grandes que los destinos CLÍNICOS — la
 *      inversión de jerarquía que RTC-32 quería evitar, ya publicada.
 *   3. ¿Cuánto crece el riel si se paga? Un riel que deja de caber en un
 *      viewport corto cambia un defecto por otro.
 *
 * ── LO QUE NO MIDE ──────────────────────────────────────────────────────────
 *
 * · No puntúa §29 ni juzga estética: mide geometría y regímenes de puntero.
 * · No mide el cajón de la ASISTENTE (≤768px) porque la siembra de capturas
 *   sólo trae cuenta de médico; el `.nav-item` es el mismo y la regla que se
 *   toque lo alcanza, pero eso queda DECLARADO, no medido aquí.
 * · No cubre pseudos estirados: aquí lo visible y el golpe coinciden (el riel
 *   no usa el truco de `a.nx-ident::before`). Si algún día lo usa, esta vara se
 *   queda ciega igual que se quedó la de la 6ª rebanada. Lo que SÍ hace es
 *   hit-testear el borde del área nueva (`elementFromPoint` a 3px del canto
 *   inferior): un `min-height` que computa 44 pero cuyo canto lo tapa el vecino
 *   no es un objetivo de 44 — un alto medido no es un golpe entregado.
 *
 * Requiere: emuladores + siembra + build + next start
 * (`bash scripts/design/arnes-breakpoints-v15.sh <este script> [carpeta]`).
 *
 * Uso:
 *   node scripts/design/medir-tactiles-del-riel-v15.mjs [antes|despues] [carpeta]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const FASE = process.argv[2] === 'despues' ? 'despues' : 'antes'
const DESTINO = process.argv[3] || 'docs/design/capturas/v15-tactiles-del-riel'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const MINIMO = 44

/**
 * Dos regímenes de puntero al MISMO lado del corte del shell (≥769px), que es
 * lo único que aísla la variable: si sólo se midiera 1440 con ratón, la
 * respuesta diría más del emulador que del producto.
 */
const REGIMENES = [
  { nombre: 'escritorio-raton-1440', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  { nombre: 'tableta-tactil-1024', viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false },
  /* Portátil corto: el riel entero tiene que caber o desplazarse, no cortarse. */
  { nombre: 'portatil-corto-1280x720', viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false },
]

const RUTAS = [
  ['hoy', '/dashboard'],
  ['configuracion', '/configuracion'],
]

fs.mkdirSync(DESTINO, { recursive: true })

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { base: BASE, fase: FASE, minimo: MINIMO, regimenes: {}, errores: [] }

for (const reg of REGIMENES) {
  const contexto = await navegador.newContext({
    viewport: reg.viewport, hasTouch: reg.hasTouch, isMobile: reg.isMobile, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => acta.errores.push(`${reg.nombre}: pageerror: ${e.message}`))

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

  const porRuta = {}
  for (const [nombre, ruta] of RUTAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2000)

    porRuta[nombre] = await page.evaluate(({ MINIMO }) => {
      const visible = el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      const texto = el => (el.textContent ?? '').trim().replace(/\s+/g, ' ')

      const medir = el => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          etiqueta: texto(el).slice(0, 28) || el.getAttribute('aria-label') || '(sin texto)',
          tag: el.tagName,
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          minHeight: cs.minHeight,
          padding: `${cs.paddingTop} ${cs.paddingBottom}`,
          cumple: r.height >= MINIMO - 0.5,
        }
      }

      /* Todos los .nav-item que se ven, vengan del riel clínico o del riel de
         secciones de /configuracion: la regla es una sola y la deuda se
         declaró «del riel entero». */
      const items = [...document.querySelectorAll('.nav-item')].filter(visible).map(medir)

      const riel = document.querySelector('.nx-flow-rail') || document.querySelector('.sidebar')
      const geometriaRiel = riel
        ? {
            alto: Math.round(riel.getBoundingClientRect().height),
            contenido: riel.scrollHeight,
            desplaza: riel.scrollHeight > riel.clientHeight + 1,
            overflowY: getComputedStyle(riel).overflowY,
          }
        : null

      const configRiel = document.querySelector('.config-sidebar')
      const geometriaConfig = configRiel
        ? {
            alto: Math.round(configRiel.getBoundingClientRect().height),
            contenido: configRiel.scrollHeight,
            excedeViewport: configRiel.getBoundingClientRect().height > window.innerHeight,
            overflowY: getComputedStyle(configRiel).overflowY,
          }
        : null

      /* ¿El canto del área NUEVA recibe el golpe, o lo tapa el vecino? Un
         `min-height` que computa 44 y cuyo borde inferior pertenece a otro
         elemento no entregó nada. Se pregunta a 3px del canto, en el centro
         horizontal, por cada .nav-item del riel clínico. */
      const golpeEnElCanto = [...document.querySelectorAll('.nx-flow-rail .nav-item')]
        .filter(visible)
        .map(el => {
          const r = el.getBoundingClientRect()
          const x = Math.round(r.left + r.width / 2)
          const y = Math.round(r.bottom - 3)
          const enElPunto = document.elementFromPoint(x, y)
          return {
            etiqueta: texto(el).slice(0, 24),
            alto: Math.round(r.height * 10) / 10,
            loRecibe: !!enElPunto && (el === enElPunto || el.contains(enElPunto)),
            quienLoRecibe: enElPunto ? `${enElPunto.tagName}.${String(enElPunto.className).slice(0, 24)}` : 'nadie',
          }
        })

      return {
        punteroGrueso: window.matchMedia('(pointer: coarse)').matches,
        golpeEnElCanto,
        cualquierPunteroGrueso: window.matchMedia('(any-pointer: coarse)').matches,
        items,
        porTag: {
          a: items.filter(i => i.tag === 'A'),
          button: items.filter(i => i.tag === 'BUTTON'),
        },
        incumplen: items.filter(i => !i.cumple).length,
        geometriaRiel,
        geometriaConfig,
      }
    }, { MINIMO })

    await page.screenshot({
      path: path.join(DESTINO, `${FASE}-${reg.nombre}-${nombre}.png`),
      clip: { x: 0, y: 0, width: Math.min(340, reg.viewport.width), height: reg.viewport.height },
    })
  }

  acta.regimenes[reg.nombre] = porRuta
  await contexto.close()

  console.log(`\n══ ${reg.nombre} ══`)
  for (const [nombre, m] of Object.entries(porRuta)) {
    console.log(`  ${nombre} · puntero grueso: ${m.punteroGrueso} (any: ${m.cualquierPunteroGrueso})`)
    console.log(`    .nav-item visibles: ${m.items.length} · por debajo de ${MINIMO}px: ${m.incumplen}`)
    const alturasA = [...new Set(m.porTag.a.map(i => i.h))]
    const alturasB = [...new Set(m.porTag.button.map(i => i.h))]
    console.log(`      <a>      ${m.porTag.a.length} ítems · alturas ${alturasA.join(', ') || '—'}`)
    console.log(`      <button> ${m.porTag.button.length} ítems · alturas ${alturasB.join(', ') || '—'}`)
    for (const i of m.items.filter(i => !i.cumple).slice(0, 8)) {
      console.log(`        · ${i.tag} «${i.etiqueta}» ${i.w}×${i.h} (min-height ${i.minHeight})`)
    }
    const sinGolpe = (m.golpeEnElCanto ?? []).filter(g => !g.loRecibe)
    console.log(`    canto inferior hit-testeado: ${m.golpeEnElCanto?.length ?? 0} ítems · sin recibir el golpe: ${sinGolpe.length}`)
    for (const g of sinGolpe) console.log(`        · «${g.etiqueta}» (${g.alto}px) lo recibe ${g.quienLoRecibe}`)
    if (m.geometriaRiel) {
      console.log(`    riel: alto ${m.geometriaRiel.alto} · contenido ${m.geometriaRiel.contenido} · desplaza ${m.geometriaRiel.desplaza} (overflow-y ${m.geometriaRiel.overflowY})`)
    }
    if (m.geometriaConfig) {
      console.log(`    riel de secciones: alto ${m.geometriaConfig.alto} · contenido ${m.geometriaConfig.contenido} · excede viewport ${m.geometriaConfig.excedeViewport} (overflow-y ${m.geometriaConfig.overflowY})`)
    }
  }
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, `acta-${FASE}.json`), JSON.stringify(acta, null, 2))
console.log(`\n${acta.errores.length} errores de página · acta en ${path.join(DESTINO, `acta-${FASE}.json`)}`)
