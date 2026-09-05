/**
 * GRABA LAS PANTALLAS REALES DEL VIDEO DE DEMOSTRACIÓN.
 *
 * Recorre la aplicación en el arnés local (emuladores + `npm run arnes:dev`)
 * con Chromium, grabando un video por bloque y escribiendo un archivo de
 * MARCAS (instante en que empieza cada escena) que Remotion usa para alinear
 * narración, subtítulos y acercamientos.
 *
 * Requisitos: `scripts/design/sembrar-emulador.mjs`,
 * `scripts/carril-excelencia/sembrar-reserva.mjs`, `scripts/demo-video/sembrar-extra.ts`
 * y `tts.py` (que deja `remotion/public/duraciones.json` y el diálogo en WAV).
 *
 * Uso:
 *   node scripts/demo-video/grabar.mjs               # todos los bloques
 *   node scripts/demo-video/grabar.mjs consulta      # uno solo
 *
 * Cero pacientes reales: el consultorio, la médica y las pacientes son inventados.
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESCENAS, DIALOGO } from './guion.mjs'
import { mocksConsulta } from './mocks-consulta.mjs'
import { cursorOverlay } from './cursor.mjs'
import QRCode from 'qrcode'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3200'
const PUB = path.join(AQUI, 'remotion', 'public')
const CLIPS = path.join(PUB, 'clips')
const MARCAS = path.join(AQUI, 'marcas')
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const CORREO = 'demo@nexusmed.test'
const CLAVE = 'demo1234'
const CLINICA = 'consultorio-demo-v10'
const PAC = 'pac-001'
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const PROYECTO = 'demo-nexusmed-v10'

fs.mkdirSync(CLIPS, { recursive: true })
fs.mkdirSync(MARCAS, { recursive: true })

const DUR = JSON.parse(fs.readFileSync(path.join(PUB, 'duraciones.json'), 'utf8'))
const DIALOGO_JSON = JSON.parse(fs.readFileSync(path.join(PUB, 'dialogo', 'dialogo.json'), 'utf8'))
const MIC_WAV = process.env.DEMO_MIC_WAV || path.join(PUB, 'dialogo', 'mic-48k.wav')
const TOKENS = fs.existsSync(path.join(AQUI, 'marcas', 'tokens.json'))
  ? JSON.parse(fs.readFileSync(path.join(AQUI, 'marcas', 'tokens.json'), 'utf8'))
  : null

const dur = id => DUR[id] ?? 0
const dormir = ms => new Promise(r => setTimeout(r, ms))

/** Fechas del consultorio (para elegir días de la semana que viene). */
const TZ = 'America/Mexico_City'
const enZona = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
function proximo(diaSemana) { // 1 = lunes … 6 = sábado
  const d = new Date()
  for (let i = 1; i <= 8; i++) {
    const c = new Date(d); c.setUTCDate(c.getUTCDate() + i)
    const iso = enZona(c)
    const dow = new Date(iso + 'T12:00:00Z').getUTCDay()
    if (dow === diaSemana) return iso
  }
  throw new Error('sin día')
}
const LUNES = proximo(1)
const MARTES = proximo(2)
const HOY = enZona(new Date())

// ── Utilidades de interacción «humana» ───────────────────────────────────────
class Toma {
  constructor(nombre, page, t0) { this.nombre = nombre; this.page = page; this.t0 = t0; this.marcas = []; this.pos = { x: 20, y: 20 } }
  ahora() { return (Date.now() - this.t0) / 1000 }
  marca(n) { const t = this.ahora(); this.marcas.push({ n, t: Math.round(t * 100) / 100 }); console.log(`  ◆ ${this.nombre} · ${n} @ ${t.toFixed(1)}s`); return t }
  tiempoDe(n) { return this.marcas.find(m => m.n === n)?.t }
  /** Espera hasta que hayan pasado `seg` segundos desde la marca `n`. */
  async hastaDesde(n, seg) { const t = this.tiempoDe(n); if (t == null) return; const falta = t + seg - this.ahora(); if (falta > 0) await dormir(falta * 1000) }
  async mover(x, y, ms = 550) {
    const pasos = Math.max(8, Math.round(ms / 16))
    const { x: x0, y: y0 } = this.pos
    for (let i = 1; i <= pasos; i++) {
      const k = i / pasos; const e = 1 - Math.pow(1 - k, 3) // ease-out
      await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e)
      await dormir(ms / pasos)
    }
    this.pos = { x, y }
  }
  async a(loc, { dx = 0, dy = 0, ms } = {}) {
    await loc.first().scrollIntoViewIfNeeded().catch(() => {})
    await dormir(150)
    const box = await loc.first().boundingBox()
    if (!box) throw new Error('sin caja para ' + String(loc))
    await this.mover(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, ms)
    return box
  }
  async clic(loc, opts = {}) {
    await this.a(loc, opts)
    await dormir(opts.antes ?? 220)
    await this.page.mouse.down(); await dormir(70); await this.page.mouse.up()
    await dormir(opts.despues ?? 500)
  }
  async teclear(loc, texto, opts = {}) {
    await this.clic(loc, { despues: 200, ...opts })
    await this.page.keyboard.type(texto, { delay: opts.delay ?? 42 })
    await dormir(opts.despues ?? 400)
  }
  async rueda(dy, pasos = 8, ms = 700) {
    for (let i = 0; i < pasos; i++) { await this.page.mouse.wheel(0, dy / pasos); await dormir(ms / pasos) }
  }
  async pausa(ms) { await dormir(ms) }
}

async function uidDemo() {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO, password: CLAVE, returnSecureToken: true }),
  })
  const j = await r.json(); if (!j.localId) throw new Error('sin uid'); return j.localId
}

async function entrar(t) {
  await t.page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await t.page.fill('input[type="email"]', CORREO)
  await t.page.fill('input[type="password"]', CLAVE)
  await t.page.click('button[type="submit"]')
  await t.page.waitForURL('**/dashboard**', { timeout: 60000 })
  await t.page.waitForTimeout(1500)
}

/** Escritura directa al emulador (lo que haría el servidor cuando WhatsApp sí está conectado). */
async function patchFirestore(ruta, campos) {
  const url = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/${ruta}?` +
    Object.keys(campos).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const fields = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, typeof v === 'string' ? { stringValue: v } : { integerValue: String(v) }]))
  const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ fields }) })
  if (!r.ok) console.warn('patch', ruta, r.status)
}

async function abrirToma(browser, nombre, { telefono = false, mocks } = {}) {
  const uid = await uidDemo()
  const ctx = await browser.newContext({
    viewport: telefono ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
    deviceScaleFactor: telefono ? 2 : 1,
    ...(telefono ? { isMobile: true, hasTouch: true } : {}),
    locale: 'es-MX', timezoneId: TZ, colorScheme: 'dark',
    recordVideo: { dir: CLIPS, size: telefono ? { width: 780, height: 1688 } : { width: 1920, height: 1080 } },
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  })
  let principal = null
  ctx.on('page', async p => { if (principal && p !== principal) { await dormir(300); await p.close().catch(() => {}) } }) // wa.me y similares
  await ctx.addInitScript((u) => { try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch {} }, uid)
  await ctx.addInitScript(cursorOverlay, telefono)
  // Los códigos QR se piden a un servicio externo que esta máquina no alcanza:
  // se generan aquí con la misma librería `qrcode` del proyecto.
  await ctx.route('**/api.qrserver.com/**', async route => {
    const dato = new URL(route.request().url()).searchParams.get('data') || 'https://ausculta.mx'
    const png = await QRCode.toBuffer(dato, { width: 240, margin: 1 })
    await route.fulfill({ status: 200, contentType: 'image/png', body: png })
  })
  if (mocks) await mocks(ctx)
  const page = await ctx.newPage()
  principal = page
  page.on('download', d => d.delete().catch(() => {}))
  const t = new Toma(nombre, page, Date.now())
  return { ctx, page, t }
}

async function cerrarToma({ ctx, page, t }) {
  t.marca('fin')
  const video = page.video()
  await ctx.close()
  const origen = await video.path()
  const destino = path.join(CLIPS, `${t.nombre}.webm`)
  fs.renameSync(origen, destino)
  fs.writeFileSync(path.join(MARCAS, `${t.nombre}.json`), JSON.stringify({ toma: t.nombre, marcas: t.marcas }, null, 2))
  console.log(`  ✓ ${destino}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUE 0 · Landing (escena 00)
// ═════════════════════════════════════════════════════════════════════════════
async function tomaLanding(browser) {
  const toma = await abrirToma(browser, 'landing')
  const { page, t } = toma
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  t.marca('00-intro')
  await t.mover(1000, 600, 900)
  await t.pausa(4000)
  await t.rueda(900, 30, 5000)
  await t.pausa(2500)
  await t.rueda(900, 30, 5000)
  await t.pausa(2000)
  await t.rueda(700, 20, 3500)
  await t.hastaDesde('00-intro', dur('00-intro') + 2)
  await cerrarToma(toma)
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUE A · Agenda (escenas 01, 03, 04, 05)
// ═════════════════════════════════════════════════════════════════════════════
async function tomaAgenda(browser) {
  const toma = await abrirToma(browser, 'agenda', {
    mocks: async ctx => {
      // WhatsApp no está conectado en el arnés: la oferta del hueco se da por enviada.
      await ctx.route('**/api/whatsapp/waitlist-notify', route => route.fulfill({ json: { ok: true, notified: 1, omitidos: [] } }))
    },
  })
  const { page, t } = toma
  await entrar(t)

  // ── 01 · El paciente reserva desde el perfil público ──────────────────────
  await page.goto(`${BASE}/dr/${CLINICA}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  t.marca('01-paciente-reserva')
  await t.mover(960, 500, 800)
  await t.pausa(2500)
  const reservar = page.getByRole('link', { name: /Reservar|Agendar/i }).first()
  await t.clic(reservar, { despues: 1500 })
  await page.waitForURL('**/reservar/**', { timeout: 30000 })
  await page.getByRole('button', { name: /Seguimiento|Primera vez/i }).first().waitFor({ timeout: 30000 })
  await t.pausa(1200)
  await t.clic(page.getByRole('button', { name: /Primera vez/i }).first(), { despues: 1200 })
  // Día: el lunes que viene
  const dia = page.locator('button').filter({ hasText: /^Lun/ }).first()
  await dia.waitFor({ timeout: 30000 })
  await t.pausa(800)
  await t.clic(dia, { despues: 1200 })
  // El tercer hueco libre del día, sea cual sea: así la toma se puede repetir sin resembrar.
  const hora = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).nth(2)
  await hora.waitFor({ timeout: 30000 })
  await t.pausa(900)
  await t.clic(hora, { despues: 900 })
  await t.teclear(page.locator('#reservar-nombre'), 'Leonor Castañeda Vidal')
  await t.teclear(page.locator('#reservar-telefono'), '5555010909')
  await t.teclear(page.locator('#reservar-email'), 'leonor.demo@example.com', { delay: 30 })
  await t.teclear(page.locator('#reservar-motivo'), 'Dolor de cabeza frecuente desde hace dos semanas', { delay: 28 })
  await t.clic(page.getByRole('button', { name: /Continuar/ }), { despues: 1000 })
  const cajas = page.locator('input[type="checkbox"]')
  await t.clic(cajas.nth(0), { despues: 400 })
  await t.clic(cajas.nth(1), { despues: 600 })
  await t.clic(page.getByRole('button', { name: /Confirmar|Agendar|Reservar/i }).last(), { despues: 2500 })
  await page.getByText(/¡Listo|Cita solicitada|solicitud|recibimos/i).first().waitFor({ timeout: 30000 }).catch(() => {})
  await t.hastaDesde('01-paciente-reserva', dur('01-paciente-reserva') + 2)

  // ── 03 · La recepción agenda desde el portal del asistente ────────────────
  await page.goto(`${BASE}/asistente`, { waitUntil: 'load' })
  await page.getByPlaceholder(/Escribe para buscar/).waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)
  t.marca('03-asistente-agenda')
  await t.pausa(1500)
  await t.teclear(page.getByPlaceholder(/Escribe para buscar/), 'Aure', { delay: 90 })
  const sugerencia = page.getByRole('button', { name: /Aurelio Barquín/ }).first()
  await sugerencia.waitFor({ timeout: 15000 })
  await t.clic(sugerencia, { despues: 900 })
  await t.clic(page.getByRole('radio', { name: /^Seguimiento/ }).first(), { despues: 900 })
  await t.clic(page.getByRole('button', { name: /Martes, \d+ de/ }).first(), { despues: 1200 })
  const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).nth(1)
  await slot.waitFor({ timeout: 20000 })
  await t.clic(slot, { despues: 900 })
  await t.pausa(800)
  await t.clic(page.getByRole('button', { name: /Agendar|Guardar|Crear/i }).last(), { despues: 2500 })
  await page.getByText(/Cita agendada/).first().waitFor({ timeout: 20000 }).catch(() => {})
  await t.pausa(1500)
  // El calendario semanal y la ficha completa de una cita existente
  await page.goto(`${BASE}/calendario`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  await t.mover(1100, 500, 900)
  await t.pausa(1200)
  // En la rejilla semanal cada cita lleva el nombre completo en `title`.
  const citaEnRejilla = page.locator('[title*="Rosalía Mendieta"]').first()
  if (await citaEnRejilla.isVisible().catch(() => false)) {
    await t.clic(citaEnRejilla, { despues: 1500 })
    await t.mover(1200, 640, 900)
  }
  await t.hastaDesde('03-asistente-agenda', dur('03-asistente-agenda') + 1.5)
  await page.keyboard.press('Escape')
  await t.pausa(600)

  // ── 04 · Se guarda y se confirma ──────────────────────────────────────────
  await page.goto(`${BASE}/citas`, { waitUntil: 'load' })
  await page.getByText(/por confirmar/).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)
  t.marca('04-confirmar')
  await t.mover(700, 300, 900)
  await t.pausa(2200)
  await t.a(page.getByText(/por confirmar/).first())
  await t.pausa(1500)
  // «Confirmar» abre WhatsApp con el mensaje listo (la pestaña se cierra sola en la grabación).
  await t.clic(page.getByRole('button', { name: /^Confirmar$/ }).first(), { despues: 1800 })
  // El paciente llegó: cambio de estado desde el menú de la fila.
  await t.clic(page.getByRole('button', { name: /Más acciones para Tadeo/ }), { despues: 900 })
  await t.clic(page.getByRole('menuitem', { name: /^En sala/i }).first(), { despues: 1800 })
  await t.mover(900, 560, 800)
  await t.pausa(2500)
  // Lo que entró esta semana: la solicitud del portal y la cita de recepción
  const siguiente = page.getByRole('button', { name: /siguiente|Día siguiente/i }).first().or(page.locator('button:has(svg.lucide-chevron-right)').first())
  await t.clic(siguiente, { despues: 700 })
  await t.clic(siguiente, { despues: 1500 })
  await t.mover(800, 400, 700)
  await t.pausa(2500)
  await t.clic(siguiente, { despues: 1500 })
  await t.pausa(2200)
  // Recordatorios automáticos: dónde se configuran
  await page.goto(`${BASE}/configuracion`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  const pestNotif = page.getByRole('button', { name: /Notificaciones|Recordatorios/i }).first().or(page.getByText(/Notificaciones|Recordatorios/i).first())
  await t.clic(pestNotif, { despues: 1500 })
  await t.rueda(300, 6, 900)
  await t.hastaDesde('04-confirmar', dur('04-confirmar') + 1.5)

  // ── 05 · Lista de espera ──────────────────────────────────────────────────
  await page.goto(`${BASE}/lista-espera`, { waitUntil: 'load' })
  await page.getByRole('button', { name: /Agregar/ }).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)
  t.marca('05-lista-espera')
  await t.mover(800, 140, 800)
  await t.pausa(1500)
  await t.clic(page.getByRole('button', { name: /Agregar/ }).first(), { despues: 900 })
  await t.teclear(page.getByPlaceholder('Nombre completo'), 'Guadalupe Sandoval Mora')
  await t.teclear(page.getByPlaceholder('6641234567'), '5555010808')
  await t.teclear(page.getByPlaceholder(/Mañana, 9-12/), 'Tardes, martes o jueves', { delay: 30 })
  const prioridad = page.getByLabel(/Prioridad/)
  await t.clic(prioridad, { despues: 200 }); await page.keyboard.press('Control+A'); await page.keyboard.type('1', { delay: 80 })
  await t.clic(page.locator('button').filter({ hasText: /^(Agregar|Guardar)/ }).last(), { despues: 1800 })
  await t.pausa(1200)
  // Alguien cancela una cita futura → se ofrece el hueco solo
  await page.goto(`${BASE}/citas?d=${MARTES}`, { waitUntil: 'load' })
  await page.getByText(/Aurelio Barquín/).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1000)
  const masAurelio = page.getByRole('button', { name: /Más acciones para Aurelio/ }).last()
  await t.clic(masAurelio, { despues: 900 })
  await t.clic(page.locator('[role="menu"]').getByText(/^Cancelada/i).first(), { despues: 1800 })
  await t.pausa(1500)
  await page.goto(`${BASE}/lista-espera`, { waitUntil: 'load' })
  await page.getByText(/Fermín Olvera/).first().waitFor({ timeout: 30000 })
  await t.mover(700, 130, 800)
  await t.pausa(1000)
  await t.a(page.getByText(/Fermín Olvera/).first())
  await t.hastaDesde('05-lista-espera', dur('05-lista-espera') + 2)
  await cerrarToma(toma)
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUE B · Consulta (escenas 06 → 11): un solo recorrido, sin cortes
// ═════════════════════════════════════════════════════════════════════════════
async function firmarConDialogos(t, page) {
  await t.clic(page.getByRole('button', { name: /Firmar y cerrar nota/ }), { despues: 1200 })
  for (let i = 0; i < 5; i++) {
    const dialogo = page.getByRole('dialog')
    if (!(await dialogo.isVisible().catch(() => false))) break
    const boton = dialogo.getByRole('button', { name: /Los revisé, firmar|Firmar así|Los reviso y los asumo|Firmar/ }).first()
    if (await boton.isVisible().catch(() => false)) { await t.clic(boton, { despues: 1500 }); continue }
    break
  }
}

async function tomaConsulta(browser) {
  const estado = { diarizada: false }
  const toma = await abrirToma(browser, 'consulta', { mocks: mocksConsulta({ turnos: DIALOGO_JSON.turnos, micWav: MIC_WAV, registro: (...a) => {
    console.log('    ↳', ...a)
    if (a[0] === 'storage' && a[1] === 'POST') estado.diarizada = true
  } }) })
  const { page, t } = toma
  await entrar(t)

  // ── 06 · Abrir el encuentro desde la agenda y grabar ──────────────────────
  await page.goto(`${BASE}/citas`, { waitUntil: 'load' })
  await page.getByText(/Rosalía Mendieta/).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  t.marca('06-consulta-escucha')
  await t.mover(900, 500, 900)
  await t.pausa(2000)
  // La fila de las 09:00 de Rosalía: el primer «Iniciar consulta» del día. Si la
  // hora del consultorio ya no lo ofrece, se abre el encuentro directo.
  const iniciar = page.getByRole('button', { name: /Iniciar consulta|Continuar consulta/ }).first()
  if (await iniciar.isVisible().catch(() => false)) {
    await t.clic(iniciar, { despues: 2500 })
    await page.waitForURL('**/consulta/**', { timeout: 30000 })
  } else {
    await page.goto(`${BASE}/consulta/${PAC}`, { waitUntil: 'load' })
  }
  await page.getByRole('button', { name: /Grabar la consulta/ }).waitFor({ timeout: 60000 })
  await t.pausa(800)
  // Tipo de nota: seguimiento (esta paciente ya tiene expediente)
  await t.clic(page.getByRole('button', { name: /Tipo de nota:/ }), { despues: 900 })
  await t.clic(page.getByRole('button', { name: /^Nota de Seguimiento$/ }), { despues: 700 })
  const listo = page.getByRole('button', { name: /Listo/ })
  if (await listo.isVisible().catch(() => false)) await t.clic(listo, { despues: 900 })
  const confirmarTipo = page.getByRole('dialog').getByRole('button').first()
  if (await page.getByRole('dialog').isVisible().catch(() => false)) await t.clic(confirmarTipo, { despues: 700 })
  // Signos vitales que la asistente tomó en el mostrador
  // Los campos de signos formatean al teclear (la TA se comía un dígito): se fija el valor entero.
  for (const [id, v] of [['#signo-ta', '128/78'], ['#signo-fc', '76'], ['#signo-fr', '16'], ['#signo-temperatura', '36.5'], ['#signo-spo2', '97'], ['#signo-peso', '70']]) {
    await t.clic(page.locator(id), { despues: 150 })
    await page.locator(id).fill(v)
    await t.pausa(350)
  }
  await t.hastaDesde('06-consulta-escucha', dur('06-consulta-escucha') - 1.2)
  await t.clic(page.getByRole('button', { name: /Grabar la consulta/ }), { despues: 1200 })
  // Consentimiento informado antes de grabar: es parte del producto, y se enseña.
  const consentir = page.getByRole('button', { name: /Confirmo el consentimiento/ })
  if (await consentir.isVisible().catch(() => false)) { await t.pausa(1500); await t.clic(consentir, { despues: 300 }) }
  t.marca('grabando')
  await page.getByRole('button', { name: /Terminar la grabación/ }).waitFor({ timeout: 20000 })
  await t.mover(1200, 300, 1200)
  await t.pausa(DIALOGO_JSON.duracionMs + 1500)
  await t.clic(page.getByRole('button', { name: /Terminar la grabación/ }), { despues: 500 })
  t.marca('terminar')
  // La transcripción «llega» cuando la diarización termina y el audio queda guardado.
  for (let i = 0; i < 400 && !estado.diarizada; i++) await dormir(300)
  await page.getByRole('button', { name: /Material de origen/ }).waitFor({ timeout: 90000 })
  await t.pausa(1200)
  t.marca('transcripcion')
  await t.clic(page.getByRole('button', { name: /Material de origen/ }), { despues: 1200 })
  await t.pausa(1500)
  await t.a(page.getByText(/Hablante|Médico y paciente asignados/).first()).catch(() => {})
  await t.pausa(2000)
  await t.rueda(260, 6, 1200)
  await t.hastaDesde('transcripcion', dur('06-consulta-escucha-despues') + 0.8)

  // ── 07 · La nota ──────────────────────────────────────────────────────────
  await page.waitForFunction(() => Array.from(document.querySelectorAll('textarea')).some(t => /Nefropatía diabética incipiente conocida/.test(t.value)), null, { timeout: 150000 })
  await t.pausa(600)
  t.marca('07-nota')
  await t.rueda(420, 10, 2200)
  await t.pausa(3500)
  await t.rueda(520, 12, 2600)
  await t.pausa(4000)
  await t.a(page.locator('textarea[aria-label^="Subjetivo"]').first(), { dy: 30 }).catch(() => {})
  await t.pausa(4500)
  await t.a(page.getByText(/^Metformina$/).first().or(page.getByLabel('Medicamento (DCI)').first())).catch(() => {})
  await t.pausa(4500)
  await t.a(page.locator('textarea[aria-label^="Plan"]').first(), { dy: 40 }).catch(() => {})
  await t.pausa(4000)
  await t.hastaDesde('07-nota', dur('07-nota') + 1)

  // ── 08 · Procedencia y firma ──────────────────────────────────────────────
  const deDonde = page.getByRole('button', { name: /¿De dónde salió esto\?/ }).first()
  await deDonde.scrollIntoViewIfNeeded().catch(() => {})
  await t.pausa(500)
  t.marca('08-procedencia-firma')
  await t.clic(deDonde, { despues: 1800 })
  const escuchar = page.getByRole('button', { name: /^Escuchar «/ }).first()
  if (await escuchar.isVisible().catch(() => false)) { await t.clic(escuchar, { despues: 3000 }) }
  await t.rueda(200, 5, 1200)
  await t.pausa(2500)
  const cerrarLente = page.getByRole('button', { name: /Cerrar el detalle/ })
  if (await cerrarLente.isVisible().catch(() => false)) await t.clic(cerrarLente, { despues: 800 })
  // Lo que bloquea vs lo que se revisa
  const antes = page.getByText(/nada te impide firmar|bloquea/).first()
  if (await antes.isVisible().catch(() => false)) { await t.a(antes); await t.pausa(3000) }
  const yaLoRevise = page.getByRole('button', { name: /Ya lo revisé/ })
  for (let i = 0; i < 3 && await yaLoRevise.first().isVisible().catch(() => false); i++) await t.clic(yaLoRevise.first(), { despues: 800 })
  await t.hastaDesde('08-procedencia-firma', 20)
  await firmarConDialogos(t, page)
  // Al firmar, el producto lleva directo a la receta de esa nota.
  await page.waitForURL(/\/receta\/|[?&]nota=/, { timeout: 90000 })
  t.marca('firmada')
  const url = new URL(page.url())
  const notaId = url.pathname.includes('/receta/') ? url.pathname.split('/').pop() : url.searchParams.get('nota')
  console.log('  nota firmada:', notaId)
  await t.pausa(1500)
  await t.hastaDesde('08-procedencia-firma', dur('08-procedencia-firma') + 1.5)

  // ── 09 · Receta ───────────────────────────────────────────────────────────
  if (!url.pathname.includes('/receta/')) await page.goto(`${BASE}/receta/${PAC}/${notaId}`, { waitUntil: 'load' })
  await page.getByRole('button', { name: /^Agregar$/ }).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  t.marca('09-receta')
  await t.mover(1150, 420, 900)
  await t.pausa(4500)
  await t.a(page.getByLabel('Medicamento (DCI)').first())
  await t.pausa(4000)
  await t.clic(page.getByRole('button', { name: /^Agregar$/ }), { despues: 800 })
  await t.teclear(page.getByPlaceholder('Medicamento (DCI)').last(), 'Amoxicilina', { delay: 70 })
  await page.getByText(/Alerta de alergia/).first().waitFor({ timeout: 15000 }).catch(() => {})
  await t.a(page.getByText(/Alerta de alergia/).first()).catch(() => {})
  t.marca('alergia')
  await t.pausa(5500)
  await t.clic(page.getByRole('button', { name: /Quitar medicamento/ }).last(), { despues: 1200 })
  await t.a(page.locator('#receta-doc').first(), { dy: -120 }).catch(() => {})
  await t.pausa(2500)
  await t.clic(page.getByRole('button', { name: /Descargar PDF/ }), { despues: 2500 })
  await t.hastaDesde('09-receta', dur('09-receta') + 1.5)

  // ── 10 · Órdenes y resultados ─────────────────────────────────────────────
  await page.goto(`${BASE}/orden/${PAC}/${notaId}`, { waitUntil: 'load' })
  await page.locator('#om-diagnostico').waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  t.marca('10-ordenes')
  await t.mover(700, 300, 900)
  await t.pausa(2500)
  for (const nombre of [/Hemoglobina glucosilada/, /Examen general de orina|EGO/, /Química sanguínea de 6|Creatinina/]) {
    const b = page.locator('button').filter({ hasText: nombre }).first()
    if (await b.isVisible().catch(() => false)) await t.clic(b, { despues: 700 })
  }
  await t.a(page.locator('#receta-doc').first(), { dy: -140 }).catch(() => {})
  await t.pausa(3500)
  // Los resultados, cuando llegan: la trayectoria en el expediente
  await page.goto(`${BASE}/expediente/${PAC}`, { waitUntil: 'load' })
  await page.locator('nav.nx-clinical-spine').waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
  await t.clic(page.locator('nav.nx-clinical-spine').getByText(/Laboratorios/).first(), { despues: 1800 })
  t.marca('labs')
  await t.rueda(240, 6, 1500)
  await t.pausa(2500)
  await t.hastaDesde('10-ordenes', dur('10-ordenes') + 1.5)

  // ── 11 · Entregar al paciente ─────────────────────────────────────────────
  await page.goto(`${BASE}/consulta/${PAC}?nota=${notaId}`, { waitUntil: 'load' })
  const seccion = page.locator('#entregar-al-paciente')
  await seccion.waitFor({ timeout: 60000 })
  await seccion.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  t.marca('11-entregar-portal')
  await t.mover(900, 500, 900)
  await t.pausa(3500)
  await t.rueda(120, 4, 900)
  await t.pausa(2500)
  await t.clic(page.getByRole('button', { name: /Liberar al paciente/ }), { despues: 2500 })
  await page.getByText(/Liberado · versión/).first().waitFor({ timeout: 30000 }).catch(() => {})
  t.marca('liberado')
  await t.a(page.getByRole('button', { name: /Mandar por WhatsApp/ }).first()).catch(() => {})
  await t.pausa(2500)
  await t.clic(page.getByRole('button', { name: /Copiar el mensaje/ }).first(), { despues: 2000 }).catch(() => {})
  await t.hastaDesde('11-entregar-portal', dur('11-entregar-portal') + 2)
  await cerrarToma(toma)
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUE C · Portal del paciente en el teléfono (escenas 12 y 13)
// ═════════════════════════════════════════════════════════════════════════════
async function tomaPortal(browser) {
  if (!TOKENS?.clinico) throw new Error('Falta marcas/tokens.json con el token clínico del portal')
  const toma = await abrirToma(browser, 'portal', { telefono: true })
  const { page, t } = toma
  const destino = n => page.locator('nav[aria-label="Secciones"]').getByText(n, { exact: true })
  await page.goto(`${BASE}/mi/${TOKENS.clinico}`, { waitUntil: 'load' })
  await page.locator('nav[aria-label="Secciones"]').waitFor({ timeout: 60000 })
  await page.getByText(/Hola, Rosalía/).first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // ── 12 · Hoy · Cuidado · Documentos ───────────────────────────────────────
  t.marca('12-portal')
  await t.mover(195, 500, 900)
  await t.pausa(3500)
  const confirmar = page.getByRole('button', { name: /^Confirmar$/ }).first()
  if (await confirmar.isVisible().catch(() => false)) await t.clic(confirmar, { despues: 2000 })
  const reagendar = page.getByRole('button', { name: /^Reagendar$/ }).first()
  if (await reagendar.isVisible().catch(() => false)) {
    await t.clic(reagendar, { despues: 1200 })
    const fecha = page.getByLabel(/Elige un nuevo horario/)
    if (await fecha.isVisible().catch(() => false)) {
      await fecha.fill(MARTES)
      await t.pausa(2500)
      const hueco = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
      if (await hueco.isVisible().catch(() => false)) { await t.a(hueco); await t.pausa(1500) }
    }
  }
  await t.hastaDesde('12-portal', 10)
  await t.clic(destino('Cuidado'), { despues: 1800 })
  await t.rueda(500, 8, 2500)
  await t.pausa(1500)
  await t.hastaDesde('12-portal', 16.5)
  await t.clic(destino('Documentos'), { despues: 1800 })
  await t.a(page.getByRole('button', { name: /Descargar/ }).first()).catch(() => {})
  await t.hastaDesde('12-portal', dur('12-portal') + 1.5)

  // ── 13 · Preguntar ────────────────────────────────────────────────────────
  await t.clic(destino('Preguntar'), { despues: 1500 })
  t.marca('13-preguntar')
  const caja = page.getByPlaceholder(/Por ejemplo/)
  const enviar = page.getByRole('button', { name: /^Enviar$/ })
  const preguntar = async (texto, marca) => {
    await t.clic(caja, { despues: 300 }); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace')
    await page.keyboard.type(texto, { delay: 38 })
    await t.clic(enviar, { despues: 2500 })
    t.marca(marca)
    await t.rueda(180, 4, 800)
  }
  await preguntar('¿Cada cuánto tomo la metformina?', 'pregunta-plan')
  await t.hastaDesde('13-preguntar', 10.5)
  await preguntar('¿Puedo tomar el doble de metformina si me sale alta la glucosa?', 'pregunta-dosis')
  await t.hastaDesde('13-preguntar', 19.5)
  await preguntar('Tengo dolor en el pecho y me falta el aire', 'pregunta-urgencia')
  await t.hastaDesde('13-preguntar', dur('13-preguntar') + 2)
  await cerrarToma(toma)
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUE D · Seguimiento del médico y configuración (escenas 14 y 15)
// ═════════════════════════════════════════════════════════════════════════════
async function tomaSeguimiento(browser) {
  const toma = await abrirToma(browser, 'seguimiento')
  const { page, t } = toma
  await entrar(t)
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.getByText(/Pendientes/).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  t.marca('14-seguimiento')
  await t.mover(900, 400, 900)
  await t.pausa(3000)
  await t.rueda(200, 5, 1200)
  await t.pausa(3000)
  await page.goto(`${BASE}/expediente/${PAC}`, { waitUntil: 'load' })
  await page.locator('nav.nx-clinical-spine').waitFor({ timeout: 60000 })
  await page.waitForTimeout(1000)
  t.marca('expediente')
  await t.clic(page.locator('nav.nx-clinical-spine').getByText(/Encuentros/).first(), { despues: 1500 })
  await t.rueda(300, 8, 2000)
  await t.pausa(2500)
  await page.goto(`${BASE}/cumplimiento`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  t.marca('bitacora')
  await t.mover(900, 500, 900)
  await t.rueda(250, 6, 1500)
  await t.hastaDesde('14-seguimiento', dur('14-seguimiento') + 1.5)

  await page.goto(`${BASE}/configuracion`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  t.marca('15-configuracion-cierre')
  await t.mover(900, 450, 900)
  await t.rueda(300, 6, 1500)
  await t.pausa(2000)
  const portal = page.getByRole('button', { name: /Portal público|Portal/ }).first()
  if (await portal.isVisible().catch(() => false)) { await t.clic(portal, { despues: 1500 }); await t.rueda(200, 5, 1200) }
  await t.hastaDesde('15-configuracion-cierre', dur('15-configuracion-cierre') + 2)
  await cerrarToma(toma)
}

// ═════════════════════════════════════════════════════════════════════════════
const BLOQUES = { landing: tomaLanding, agenda: tomaAgenda, consulta: tomaConsulta, portal: tomaPortal, seguimiento: tomaSeguimiento }
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BLOQUES)

const browser = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${MIC_WAV}`,
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars=false', '--font-render-hinting=none',
  ],
})
try {
  for (const b of pedidos) {
    if (!BLOQUES[b]) throw new Error(`bloque desconocido: ${b}`)
    console.log(`▶ ${b}`)
    await BLOQUES[b](browser)
  }
} finally {
  await browser.close()
}
console.log('Listo. Clips en', CLIPS, '· marcas en', MARCAS)
