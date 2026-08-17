/**
 * RTC-21 — ¿QUÉ CUESTA EXPORTAR DESDE UN TELÉFONO, Y QUÉ SE LEE EN EL BOTÓN?
 *
 * El equipo rojo (RT-16) escribió dos cosas sobre el expediente en móvil:
 * que las exportaciones piden más gestos de los que merecen (§22: exportar no
 * es trabajo de teléfono) y que «FHIR» le habla al médico en jerga de
 * interoperabilidad (§25).
 *
 * RTC-10 ya bajó el bloque entero al pie con su rótulo. Lo que este arnés
 * mide, ANTES de tocar nada, es lo que queda:
 *
 *   · cuántos controles hay visibles en «Documentos y exportación» por ancho;
 *   · el nombre accesible de cada uno —la jerga se mide leyendo, no opinando—;
 *   · a qué altura empieza el bloque y cuánto hay que bajar para alcanzarlo;
 *   · si el bloque queda DESPUÉS de la historia clínica (que es lo que §22
 *     pide: primero el paciente, después el archivo);
 *   · el objetivo táctil de cada control (§24: 44px).
 *
 * No cambia nada: informa. La decisión se toma con el acta delante — la misma
 * disciplina que evitó convertir en frases los filtros de `/pacientes`, que
 * resultaron informar.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc21-exportar-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc21-exportar'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTES = ['pac-refugio-alcantara', 'pac-luzmaria-cervantes']

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

  for (const pid of PACIENTES) {
    await page.goto(`${BASE}/expediente/${pid}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    const m = await page.evaluate(() => {
      const visible = el => {
        if (!el) return false
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      /* EL BLOQUE, POR SU RÓTULO. Buscarlo por clase ataría el instrumento a
         la implementación que este mismo arnés puede acabar cambiando. */
      const rotulo = [...document.querySelectorAll('h2')]
        .find(h => (h.textContent ?? '').trim().startsWith('Documentos y exportación'))
      const bloque = rotulo?.closest('section') ?? null
      const controles = bloque
        ? [...bloque.querySelectorAll('button, a[href]')].filter(visible)
        : []
      const historia = document.querySelector('#spine-encuentros')
      const doc = document.documentElement
      return {
        bloqueExiste: !!bloque,
        /* Altura ABSOLUTA en el documento: en el teléfono lo que cuenta es
           cuánto hay que desplazar, no dónde cae en el viewport. */
        empiezaEn: bloque ? Math.round(bloque.getBoundingClientRect().top + window.scrollY) : null,
        altoDelDocumento: doc.scrollHeight,
        viewport: window.innerHeight,
        /* ¿El archivo va DESPUÉS del paciente? §22. */
        despuesDeLaHistoria: (() => {
          if (!bloque || !historia) return null
          return bloque.getBoundingClientRect().top > historia.getBoundingClientRect().top
        })(),
        /* Un gesto por control: esto ES el número que RT-16 llamó «gestos». */
        controlesVisibles: controles.length,
        controles: controles.map(c => {
          const r = c.getBoundingClientRect()
          return {
            nombre: (c.getAttribute('aria-label') ?? c.textContent ?? '').trim().replace(/\s+/g, ' '),
            w: Math.round(r.width), h: Math.round(r.height),
            /* §24 — un control de 40px de alto se falla con el pulgar. */
            tactilOk: Math.round(r.height) >= 44,
          }
        }),
        /* LA JERGA, LEÍDA. Un nombre accesible que es sólo una sigla de
           interoperabilidad no le dice nada al médico que lo mira. */
        nombresQueSonSiglas: controles
          .map(c => (c.textContent ?? '').trim().replace(/\s+/g, ' '))
          .filter(n => /^(FHIR|HL7|CDA|JSON|XML|CSV)(\s|$)/i.test(n)),
      }
    })
    medidas[`${etiqueta}/${pid}`] = m
    console.log(
      `  ${etiqueta.padEnd(11)} ${pid.padEnd(24)} ${m.controlesVisibles} control(es) · ` +
      `${m.controles.filter(c => !c.tactilOk).length} bajo 44px · siglas: ${m.nombresQueSonSiglas.join(', ') || 'ninguna'} · ` +
      `empieza a ${m.empiezaEn ?? '?'}px de ${m.altoDelDocumento}px · después de la historia: ${m.despuesDeLaHistoria}`,
    )
    for (const c of m.controles) console.log(`      · «${c.nombre}» ${c.w}×${c.h}${c.tactilOk ? '' : '  ← táctil corto'}`)
    await page.screenshot({ path: path.join(DESTINO, `${pid}-${etiqueta}.png`), fullPage: true })
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de consola · acta en ${path.join(DESTINO, 'medicion.json')}`)
