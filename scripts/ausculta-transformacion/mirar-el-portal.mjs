#!/usr/bin/env node
/**
 * MIRAR EL PORTAL DEL PACIENTE — los cinco destinos, dos anchos, dos temas.
 *
 * `destinos-del-portal.mjs` ya recorre las cinco pestañas y les pasa axe. Esto
 * no lo repite: **captura**, y mide las tres cosas que una captura sola no
 * dice y que aquí importan más que en el resto del producto —
 *
 *   · qué CABECERA se lee en cada destino (la subtítulo puede mentir)
 *   · qué landmarks y encabezados hay (el paciente puede llegar con lector)
 *   · qué controles nativos del navegador se usan (`alert`/`confirm`)
 *
 * Se mide con el token de alcance CLÍNICO, que es el que abre recetas y
 * paquetes: con el de mostrador media pantalla es un muro y se estaría
 * juzgando el muro.
 *
 *   PORTAL_PACIENTE_SECRET=… node scripts/ausculta-transformacion/mirar-el-portal.mjs <base> <salida>
 */
import { chromium } from 'playwright'
import { tokenDelPortal } from '../carril-excelencia/token-del-portal.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3200'
const SALIDA = process.argv[3] ?? 'docs/audit/ausculta-transformacion/portal'
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const TOKEN = tokenDelPortal('clinico')
if (!TOKEN) { console.error('Falta PORTAL_PACIENTE_SECRET'); process.exit(2) }

const DESTINOS = ['Hoy', 'Preguntar', 'Cuidado', 'Documentos', 'Perfil']
const nav = await chromium.launch({ executablePath: CHROME })

/*
 * Los temas y los anchos se piden por argumento, y el motivo es de MEDICIÓN, no
 * de comodidad: cada carga de esta pantalla gasta DOS peticiones de alcance
 * clínico, y la ruta permite 15 cada diez minutos. Un barrido de 2 temas × 2
 * anchos agota la cuenta, y a partir de ahí el arnés fotografía los estados de
 * error creyendo que fotografía el portal. Ya pasó una vez en esta unidad.
 */
const TEMAS = (process.env.TEMAS ?? 'dark,light').split(',')
const ANCHOS = (process.env.ANCHOS ?? '390,1440').split(',').map(Number)
for (const tema of TEMAS) {
  for (const W of ANCHOS) {
    const ctx = await nav.newContext({
      viewport: { width: W, height: W === 390 ? 844 : 900 },
      colorScheme: tema,
    })
    const pag = await ctx.newPage()
    /* Se cuentan los diálogos NATIVOS: en el producto del paciente un
       `confirm()` del navegador no se puede rotular, ni traducir, ni estilar. */
    const enConsola = []
    /*
     * EL 429 NO SE MIDE, SE DENUNCIA.
     *
     * Cada carga gasta dos peticiones de alcance clínico y la ruta permite 15
     * cada diez minutos. Pasado el tope, «Cuidado» y «Documentos» pintan sus
     * estados de error —que son correctos y NO son el portal— y una captura de
     * eso se ve perfectamente sana. Ya midió un barrido entero así en esta
     * unidad. Se aborta con 3: un cero tranquilizador es peor que un fallo.
     */
    let limitado = false
    pag.on('response', r => { if (r.status() === 429) limitado = true })
    pag.on('pageerror', e => enConsola.push('ERROR ' + String(e).slice(0, 120)))
    pag.on('console', c => { if (c.type() === 'error') enConsola.push('consola ' + c.text().slice(0, 120)) })
    let nativos = 0
    pag.on('dialog', d => { nativos++; d.dismiss() })
    await pag.goto(`${BASE}/mi/${TOKEN}`, { waitUntil: 'domcontentloaded' })
    await pag.waitForSelector('nav[aria-label="Secciones"]', { timeout: 60000 })
    await pag.waitForTimeout(2500)
    /* El indicador del modo desarrollo de Next se posa justo encima de la barra
       de destinos, que va fija abajo. Es del arnés, no del producto: se retira
       para poder pulsar, y se DICE que se retiró. */
    await pag.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
    if (tema === 'light') await pag.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))

    for (const d of DESTINOS) {
      const b = pag.locator('nav[aria-label="Secciones"] button').filter({ hasText: new RegExp(`^${d}$`) }).first()
      if (!(await b.count().catch(() => 0))) { console.error(`  ${d}@${W}/${tema}: NO ESTÁ`); await nav.close(); process.exit(2) }
      await b.click(); await pag.waitForTimeout(1200)
      /* Si la ruta contestó 429, lo que hay en pantalla es el estado de error y
         NO el portal: se dice en voz alta en vez de medirlo como si fuera bueno. */
      const m = await pag.evaluate(() => {
        const main = document.querySelector('main')
        const t = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim()
        return {
          h1: t(document.querySelector('h1')),
          sub: t(document.querySelector('main > div:first-child > p')),
          enc: [...document.querySelectorAll('h1,h2,h3')].map(e => `${e.tagName}:${t(e).slice(0, 34)}`),
          anchoMain: Math.round(main?.getBoundingClientRect().width ?? 0),
          altoDoc: Math.round(document.documentElement.scrollHeight),
          desb: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          barra: (() => { const n = document.querySelector('nav[aria-label="Secciones"]'); const r = n?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)}` : 'no' })(),
          keyframesEnPagina: document.querySelectorAll('style').length,
          botones: document.querySelectorAll('main button, main a').length,
        }
      })
      console.log(`  ${d} ${W}/${tema}  main ${m.anchoMain}  alto ${m.altoDoc}  barra ${m.barra}  ctrl ${m.botones}  <style> ${m.keyframesEnPagina}  desb ${m.desb}`)
      console.log(`      h1 «${m.h1}» · sub «${m.sub}»`)
      console.log(`      ${m.enc.join(' | ')}`)
      await pag.screenshot({ path: `${SALIDA}/${d.toLowerCase()}-${W}-${tema}.png`, fullPage: true })
    }
    if (limitado) {
      console.error(`\n  ${W}/${tema}: la ruta del portal contestó 429. Lo capturado son los`)
      console.error('  ESTADOS DE ERROR, no el portal. Espera diez minutos y repite.\n')
      await nav.close()
      process.exit(3)
    }
    console.log(`  → diálogos nativos disparados sin pedirlos: ${nativos}`)
    console.log(`  → consola: ${enConsola.length ? enConsola.join(' / ') : 'limpia'}\n`)
    await ctx.close()
  }
}
await nav.close()
