/**
 * UNA RESPUESTA TARDÍA DE LA IA NO CAE EN EL PACIENTE EQUIVOCADO.
 *
 * Sonda de OBSERVAR sobre el arnés con emuladores. Nació el 10-sep-2026 para
 * cerrar el pendiente que Codex dejó escrito en su checkpoint: «posible mezcla
 * de pacientes sin secuencia identificada: pendiente confirmar».
 *
 * La secuencia que se prueba:
 *   1. en /consulta/pac-001 se pide una corrección por chat a la IA;
 *   2. la respuesta se retrasa (RETRASO ms, 7 s por omisión) y trae un SENTINEL;
 *   3. ANTES de que llegue, se navega de CLIENTE a /consulta/pac-002 (mismo
 *      contexto JS: la petición sigue viva);
 *   4. se espera a la respuesta y a un ciclo de autoguardado (30 s);
 *   5. se mira pac-002 en pantalla y en Firestore, y pac-001 en Firestore.
 *
 * Control positivo (tercer argumento `0`): sin navegar, el SENTINEL SÍ aparece en pantalla
 * y SÍ se guarda en pac-001 — eso demuestra que la sonda detecta lo que busca.
 *
 * Resultado el 10-sep-2026 (v1195, Next 16.3.4): con navegación, el SENTINEL no
 * aparece en pac-002 ni en Firestore de ninguno de los dos: la pantalla se
 * desmonta al cambiar de paciente (el segmento dinámico cambia de clave) y el
 * `setState` de la instancia vieja no llega a nadie. Residual declarado: la
 * corrección pedida se PIERDE en silencio si el médico se va antes de que
 * llegue; no es mezcla, es pérdida, y se anota como tal.
 *
 *   node scripts/ausculta-transformacion/respuesta-tardia-cambio-de-paciente.mjs \
 *        [http://localhost:3200] [retraso ms = 7000] [navegar: 1 | 0]
 *
 * Necesita el arnés (`arnes:emuladores` · `arnes:sembrar` · `arnes:dev`) y por
 * eso NO corre en CI. Lee Firestore con `Bearer owner` (sólo el emulador lo
 * acepta): contra producción no funciona ni debe intentarse.
 */

import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [baseArg, retrasoArg, navegarArg] = process.argv.slice(2)
const base = baseArg || 'http://localhost:3200'
const SENT = 'SENTINEL-TARDIO-' + Date.now()
const RETRASO = Number(retrasoArg || 7000)
const NAVEGAR = navegarArg !== '0'
const H = { headers: { Authorization: 'Bearer owner' } }
const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const consola = []
p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)) })
p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 200)))
const escrituras = []
p.on('request', r => { const u = r.url(); if (/firestore|:8080/.test(u) && /Write|commit|Commit/.test(u)) escrituras.push(u.slice(0, 120)) })

await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL(u => !/\/login/.test(String(u)), { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1500)
const cerrarDialogos = async () => { for (let i = 0; i < 10; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
  await p.waitForTimeout(400) } }
await cerrarDialogos()
await p.goto(base + '/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(3500); await cerrarDialogos()

// Intercepta la corrección con retraso.
let respondida = 0
await p.route('**/api/expediente/corregir', async route => {
  await new Promise(r => setTimeout(r, RETRASO))
  respondida = Date.now()
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    ok: true, resumenEjecutivo: SENT + ' resumen', secciones: { motivo: SENT + ' motivo', plan: SENT + ' plan' },
    diagnosticos: [{ descripcion: SENT + ' dx', codigo: '' }], medicamentos: [{ nombre: SENT + ' med', dosis: '1 mg', frecuencia: 'c/24 h' }],
  }) })
})
const motivo = p.getByLabel(/Motivo de consulta/).first()
await motivo.fill('Motivo real de pac-001')
const corr = p.getByLabel('Corrección para la nota')
await corr.scrollIntoViewIfNeeded()
await corr.fill('cambia el motivo')
const t0 = Date.now()
await corr.press('Enter')
await p.waitForTimeout(300)
// Navegación de CLIENTE a pac-002 (mismo contexto JS, la petición sigue viva).
const viaRouter = !NAVEGAR ? null : await p.evaluate(() => { const r = window.next?.router; if (r?.push) { r.push('/consulta/pac-002'); return true } return false })
if (NAVEGAR && !viaRouter) { await p.locator('a[href="/pacientes"]').first().click(); await p.waitForURL('**/pacientes'); await p.locator('a[href*="pac-002"], [data-id="pac-002"]').first().click() }
if (NAVEGAR) await p.waitForURL('**/consulta/pac-002', { timeout: 15000 })
const tNav = Date.now() - t0
await p.waitForTimeout(RETRASO + 40000)
const url = p.url()
const texto = await p.locator('main').evaluate(m => { const vals = [...m.querySelectorAll('input,textarea')].map(e => e.value); return (m.innerText + '\n' + vals.join('\n')) })
const enPantalla = texto.includes(SENT)
const motivo2 = await p.getByLabel(/Motivo de consulta/).first().inputValue().catch(() => '(sin campo)')
const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-nexusmed-v10/databases/(default)/documents/clinics/consultorio-demo-v10/patients/pac-002/notas?pageSize=50`, H).then(r => r.json())
const enFirestore002 = JSON.stringify(r).includes(SENT)
const r1 = await fetch(`http://127.0.0.1:8080/v1/projects/demo-nexusmed-v10/databases/(default)/documents/clinics/consultorio-demo-v10/patients/pac-001/notas?pageSize=50`, H).then(r => r.json())
const enFirestore001 = JSON.stringify(r1).includes(SENT)
const n002 = (r.documents || []).length, n001 = (r1.documents || []).length
console.log(JSON.stringify({ url, tNavMs: tNav, respondidaMs: respondida ? respondida - t0 : null, viaRouter, enPantalla, motivo2, enFirestore002, enFirestore001, notas002: n002, notas001: n001, consola: consola.slice(0, 8) }, null, 2))
await nav.close()
