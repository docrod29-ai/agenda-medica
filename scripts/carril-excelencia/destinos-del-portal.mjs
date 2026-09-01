#!/usr/bin/env node
/**
 * LOS CINCO DESTINOS DEL PORTAL DEL PACIENTE.
 *
 * ── POR QUÉ APARTE DEL TRINQUETE ────────────────────────────────────────────
 *
 * El trinquete de interfaz mide por URL, y los cinco destinos del portal viven
 * en la MISMA: son pestañas de cliente. Medir sólo la que sale al cargar dejaba
 * cuatro pantallas del paciente sin mirar, y decirlo no las mide.
 *
 * ── LO QUE COMPRUEBA, Y POR QUÉ ESO Y NO OTRA COSA ──────────────────────────
 *
 * Cada destino: axe (WCAG 2.2 AA), desborde a lo ancho, y **la huella del
 * contenido**. Lo tercero no es adorno: sin ello, pulsar cinco veces un botón
 * que no cambia nada daría cinco pantallas limpias y parecería cobertura. La
 * primera versión de esta sonda leía 50 caracteres —la cabecera, idéntica en
 * los cinco— y no habría notado la diferencia.
 *
 * ── EL TROPIEZO QUE JUSTIFICA EL CÓDIGO DE SALIDA ───────────────────────────
 *
 * Cuatro veces en este carril un `next build` de las compuertas reconstruyó
 * `.next` con OTRA configuración mientras el servidor del arnés seguía en pie,
 * y la sonda midió una pantalla que no era. Aquí, si un destino no aparece, se
 * sale con 2: **no encontrar nada no puede confundirse con no encontrar nada
 * malo**.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   (emuladores sembrados + build y servidor CON la configuración del arnés)
 *   PORTAL_PACIENTE_SECRET=... node scripts/carril-excelencia/destinos-del-portal.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { tokenDelPortal } from './token-del-portal.mjs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
/* El acuñado vive en `token-del-portal.mjs`: UNA copia. Ésta era la tercera. */
const TOKEN = tokenDelPortal()
if (!TOKEN) {
  console.error('  Falta PORTAL_PACIENTE_SECRET (16+ caracteres). Sin él se mediría la')
  console.error('  pantalla de «enlace no válido» creyendo que es el portal.')
  process.exit(2)
}

const DESTINOS = ['Hoy', 'Preguntar', 'Cuidado', 'Documentos', 'Perfil']
const nav = await chromium.launch({ executablePath: CHROME })
for (const W of [390, 1440]) {
  const ctx = await nav.newContext({ viewport: { width: W, height: W === 390 ? 844 : 900 } })
  const pag = await ctx.newPage()
  await pag.goto('http://localhost:3300/mi/' + TOKEN, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(7000)
  for (const d of DESTINOS) {
    const b = pag.locator('nav[aria-label="Secciones"] button').filter({ hasText: new RegExp(`^${d}$`) }).first()
    if (!(await b.count().catch(() => 0))) {
      console.error(`\n  ${d}@${W}: NO SE ENCONTRÓ el destino. El servidor no está sirviendo el portal`)
      console.error('  que crees. Para, borra .next, construye CON la configuración del arnés y arranca.\n')
      await nav.close()
      process.exit(2)
    }
    await b.click(); await pag.waitForTimeout(2500)
    await pag.addScriptTag({ content: AXE })
    const r = await pag.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
      return {
        total: r.violations.reduce((s, v) => s + v.nodes.length, 0),
        detalle: r.violations.flatMap(v => v.nodes.slice(0,2).map(n => {
          const el = document.querySelector(n.target.join(' '))
          const bb = el?.getBoundingClientRect()
          return `${v.id}[${v.impact}] ${Math.round(bb?.width||0)}x${Math.round(bb?.height||0)} "${el?.textContent?.trim().slice(0,25)}" ${(n.failureSummary||'').replace(/\n/g,' ').slice(0,110)}`
        })),
        desb: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        marcas: document.querySelectorAll('[aria-current="page"]').length,
        // Huella del CONTENIDO, saltándose la cabecera y la barra: si las cinco
        // dieran la misma, estaría midiendo la misma pantalla cinco veces.
        huella: (document.querySelector('main')?.innerText || document.body.innerText || '')
          .replace(/\s+/g, ' ').slice(0, 90),
        marcado: [...document.querySelectorAll('[aria-current="page"]')].map(e => e.textContent?.trim()).join(','),
      }
    })
    console.log(`  ${d}@${W}  axe ${r.total}  desb ${r.desb}  marcas ${r.marcas} (${r.marcado})\n       «${r.huella}»`)
    r.detalle.forEach(x => console.log(`       ${x}`))
  }
  await ctx.close()
}
await nav.close()
