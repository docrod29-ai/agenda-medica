#!/usr/bin/env node
/**
 * OBJETIVOS TÁCTILES POR DEBAJO DE 44×44 — la regla propia del repositorio.
 *
 * `.claude/rules/design-system.md` la nombra entre los mínimos que FALLAN la
 * compuerta: «objetivo táctil por debajo de 44×44». axe la mira como
 * `target-size` de WCAG 2.2, pero con matices (permite separación); esto mide
 * la regla del repositorio, que es más estricta y es la que se declaró.
 *
 * Se mide a 390 px, que es donde importa: el dedo.
 *
 * Lo que NO se cuenta, y por qué:
 *  · lo invisible o fuera de pantalla (no se puede tocar);
 *  · los enlaces DENTRO de un párrafo — un enlace en mitad de una frase no
 *    puede medir 44 px de alto sin romper la línea, y la propia WCAG 2.2 los
 *    exceptúa («inline»).
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const base = process.argv[2]
const RUTAS = process.argv.slice(3)
const CON_SESION = process.env.TACTIL_SESION === '1'
const MIN = 44

const nav = await chromium.launch({ executablePath: CHROME })
const acta = []

for (const ruta of RUTAS) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const pag = await ctx.newPage()
  if (CON_SESION) {
    await pag.goto(base + '/login', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await pag.waitForTimeout(2500)
    await pag.locator('input[type=email]').first().fill('demo@nexusmed.test').catch(() => {})
    await pag.locator('input[type=password]').first().fill('demo1234').catch(() => {})
    await pag.locator('button[type=submit]').first().click().catch(() => {})
    await pag.waitForTimeout(6000)
  }
  await pag.goto(base + ruta, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await pag.waitForTimeout(3500)
  const saltar = pag.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
  if (await saltar.count().catch(() => 0)) { await saltar.click().catch(() => {}); await pag.waitForTimeout(1000) }

  const pequenos = await pag.evaluate(min => {
    const fuera = []
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button], [tabindex]:not([tabindex="-1"])')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
      // Enlace dentro de una frase: WCAG 2.2 lo exceptúa por «inline».
      if (el.tagName === 'A' && cs.display.includes('inline') && el.closest('p, li, .prosa')) continue
      /**
       * SE HIT-TESTEA, NO SE LEE EL RECT.
       *
       * `v15-a11y-tactiles-de-enlace` lo dejó escrito: el área de golpe se
       * estira con un pseudo invisible, y un pseudo **no aparece en
       * `getBoundingClientRect`**. Una radiografía que sólo lea rects vuelve a
       * ver 156×20 donde el dedo sí llega — «debe hit-testear», dice. Esto es
       * esa advertencia obedecida: se pregunta al navegador qué elemento
       * recibiría el toque a 22 px por encima y por debajo del centro.
       */
      /**
       * Y SE TRAE A LA PANTALLA ANTES DE PREGUNTAR.
       *
       * `elementFromPoint` sólo ve el viewport: un elemento por debajo del
       * pliegue devuelve `null` o lo que haya en esas coordenadas, y la medida
       * sale mal en la dirección peligrosa —parece pequeño lo que no lo es—.
       * Con `behavior: 'instant'` porque la hoja pone scroll suave y un rect
       * leído a media animación no es el del elemento.
       */
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r2 = el.getBoundingClientRect()
      const cx = r2.left + r2.width / 2
      const cy = r2.top + r2.height / 2
      const alcanza = (dy) => {
        const t = document.elementFromPoint(cx, cy + dy)
        return !!t && (t === el || el.contains(t) || t.contains(el))
      }
      /**
       * SE BUSCA EL ALCANCE REAL, NO SE SUPONE SIMÉTRICO.
       *
       * El pseudo de `globals.css` se sesga **2 px hacia abajo** a propósito
       * («hacia el pulgar, que llega desde abajo»). Probar en ±22 daba por
       * fallado un enlace que sí llega a 44: el borde de arriba queda en −20 y
       * el de abajo en +24. Se recorre hacia arriba y hacia abajo hasta perder
       * el elemento, y el alto efectivo es la suma.
       */
      let arriba = 0, abajo = 0
      while (arriba < 40 && alcanza(-(arriba + 1))) arriba++
      while (abajo < 40 && alcanza(abajo + 1)) abajo++
      const altoEfectivo = arriba + abajo
      if (r.width >= min && altoEfectivo >= min) continue
      const texto = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)
      fuera.push({ etiqueta: `${el.tagName.toLowerCase()}«${texto}»`, w: Math.round(r.width), h: Math.round(r.height), hEfectivo: Math.round(altoEfectivo) })
    }
    return fuera
  }, MIN)

  acta.push({ ruta, pequenos })
  await ctx.close()
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-tactiles.json', JSON.stringify(acta, null, 2) + '\n')
let total = 0
for (const a of acta) {
  total += a.pequenos.length
  console.log(`${a.ruta.padEnd(34)} por debajo de ${MIN}px: ${a.pequenos.length}`)
  // El recorrido cuenta píxeles enteros desde el centro, así que un objetivo
  // de exactamente 44 puede medirse 43. Se dice para no perseguir un artefacto.

  for (const p of a.pequenos.slice(0, 6)) console.log(`     ${p.w}×${p.h} (golpe ${p.hEfectivo})  ${p.etiqueta}`)
}
console.log(`\nTOTAL: ${total}`)
