#!/usr/bin/env node
/**
 * MIRAR LA RECETA CON EL EXPEDIENTE DETRÁS — REG-524 · 520 · 521.
 *
 * Sonda de OBSERVAR: abre `/receta/pac-006/nota-hoy-006` sobre el arnés de
 * emuladores y comprueba, en el DOM que el médico ve, que los tres avisos
 * nuevos de la receta están pintados y dicen lo que dicen sus pruebas:
 *
 *   · «Falta la edad» y el aviso de dosificación sin edad (REG-524);
 *   · la creatinina del expediente con su fecha y la marca de caducidad (REG-527);
 *   · la interacción con la warfarina VIGENTE y «ya existía antes de hoy» no
 *     (la introduce el ketorolaco de hoy) (REG-527);
 *   · «Paracetamol aparece 2 veces» con la suma contra el techo (REG-528).
 *
 * `design-system.md`: «No se aprueba una interfaz leyendo el código». Esto es
 * mirarla. Guarda una captura a 390 y a 1440 y publica lo que encontró en JSON.
 *
 *   npm run arnes:emuladores · arnes:sembrar · arnes:dev
 *   node scripts/ausculta-transformacion/mirar-la-receta-con-expediente.mjs \
 *        http://localhost:3200 <carpeta de salida>
 *
 * NO corre en CI: necesita emuladores y navegador.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base = 'http://localhost:3200', salida = '/tmp/receta-expediente'] = process.argv.slice(2)
const RUTA = '/receta/pac-006/nota-hoy-006'
mkdirSync(salida, { recursive: true })

const ESPERADO = [
  { clave: 'edad_falta', re: /Falta la edad del paciente/ },
  { clave: 'edad_aviso_dosis', re: /pediátricos/ },
  { clave: 'creatinina_expediente', re: /Creatinina 2\.1 mg\/dL del expediente \(\d{4}-\d{2}-\d{2}\)/ },
  { clave: 'creatinina_caduca', re: /STALE_RENAL_FUNCTION/ },
  { clave: 'interaccion_anticoagulante_aine', re: /Anticoagulante o antiagregante \+ AINE/ },
  { clave: 'interaccion_es_de_hoy', re: /Anticoagulante o antiagregante \+ AINE(?![^\n]*ya existía antes de hoy)/ },
  { clave: 'cruza_con_expediente', re: /Cruza lo de hoy con lo que el paciente ya toma/ },
  { clave: 'duplicado_ya_vigente', re: /Paracetamol ya figura como vigente en el expediente \(«Tempra 500 mg cada 8 horas»\)/ },
  /* REG-535: la nota que se imprime NO puede contarse como «ya lo toma». */
  { clave: 'no_se_cruza_consigo_misma', re: /^(?![\s\S]*Ketorolaco ya figura como vigente)/ },
]

const nav = await chromium.launch({ executablePath: CHROME })
const resultado = { ruta: RUTA, anchos: {} }
for (const w of [390, 1440]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 })
  const p = await ctx.newPage()
  const consola = []
  p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
  p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))

  await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type=email]', 'demo@nexusmed.test')
  await p.fill('input[type=password]', 'demo1234')
  await p.click('button[type=submit]')
  await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(1500)
  for (let i = 0; i < 15; i++) {
    const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
    if (!(await d.count()) || !(await d.first().isVisible())) break
    const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
    if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
    await p.waitForTimeout(500)
  }
  await p.goto(base + RUTA, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  /* El tour de bienvenida vuelve a abrirse en la primera pantalla de trabajo
     de la sesión; a 390 tapaba la captura entera. Misma maniobra que
     `mirar-la-consulta.mjs`. */
  for (let i = 0; i < 8; i++) {
    const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
    if (!(await d.count()) || !(await d.first().isVisible())) break
    await d.locator('button').last().click({ force: true }).catch(() => {})
    await p.waitForTimeout(400)
  }
  /* Los avisos dependen de DOS lecturas más (paneles y notas firmadas): se
     espera a que el texto de la creatinina aparezca, con tope, en vez de dormir. */
  await p.waitForFunction(() => /del expediente/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(800)
  const texto = await p.evaluate(() => document.body.innerText)
  const hallado = Object.fromEntries(ESPERADO.map(e => [e.clave, e.re.test(texto)]))
  await p.screenshot({ path: `${salida}/receta-pac-006-${w}.png`, fullPage: false })
  resultado.anchos[w] = { hallado, faltan: ESPERADO.filter(e => !e.re.test(texto)).map(e => e.clave), erroresDeConsola: consola.slice(0, 8) }
  await ctx.close()
}
await nav.close()
console.log(JSON.stringify(resultado, null, 2))
