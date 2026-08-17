/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-A11Y-001, segunda rebanada (§40/§36).
 *
 * El formulario de /referencia era la única deuda axe CRÍTICA del inventario:
 * nueve controles sin nombre accesible (`label` crítico + `select-name`).
 * Ahora habla `.label`/`.input` con htmlFor/id. Este arnés mide:
 *
 *   1. los NUEVE controles tienen su <label> asociado DE VERDAD
 *      (el.labels.length === 1, con texto), medido en DOM real;
 *   2. axe: cero `label`, cero `select-name` — y el reporte completo por si
 *      el cambio rompió otra regla; en los dos temas y en móvil 390;
 *   3. equivalencia funcional: la carta se prellena de la nota firmada
 *      sembrada (resumen, diagnósticos CIE-10, tratamiento) y teclear en
 *      «Motivo» aparece en la hoja impresa (#doc) — el dato LLEGA;
 *   4. §24: «Atrás» ≥44px; móvil sin desborde horizontal.
 *
 * Uso (emuladores 8080/9099 arriba, app en :3000 con .env.local demo):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-referencia-formulario-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-referencia-formulario'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const CLINIC_ID = 'clinica-capturas-v10'
const PATIENT_ID = 'pac-aurelio-dominguez'
const NOTA_ID = 'nota-referencia-v15'
const PROJECT_ID = 'demo-nexusmed-test'

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const IDS = [
  'ref-tipo', 'ref-urgencia', 'ref-destino', 'ref-institucion',
  'ref-motivo', 'ref-resumen', 'ref-diagnosticos', 'ref-tratamiento', 'ref-estudios',
]

/** Nota firmada sintética: el prellenado es la equivalencia funcional a medir. */
async function sembrarNotaFirmada() {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('candado anti-producción')
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
  const db = getFirestore(app)
  const ISO = new Date().toISOString()
  await db.doc(`clinics/${CLINIC_ID}/patients/${PATIENT_ID}/notas/${NOTA_ID}`).set({
    id: NOTA_ID,
    clinicId: CLINIC_ID,
    pacienteId: PATIENT_ID,
    pacienteNombre: 'Aurelio Domínguez Peña',
    tipo: 'seguimiento',
    metadata: { establecimiento: 'Consultorio de Medicina Interna Reforma', medicoId: 'medico-capturas' },
    resumenEjecutivo: 'Seguimiento de DM2; ajuste de metformina.',
    secciones: [
      { key: 'plan', label: 'Plan', value: 'Ajuste de metformina. HbA1c de control en 3 meses.' },
    ],
    signosVitales: { ta: '128/78', fc: '72' },
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11.9' }],
    medicamentos: [
      { nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 h', duracion: '90 días' },
    ],
    alergias: [],
    estado: 'firmada',
    firma: { nombreMedico: 'Dra. Elena Sandoval Rivas', cedulaProfesional: '12345678', timestamp: ISO },
    fechaConsulta: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    creadoPor: 'arnes-capturas',
  })
}

async function uidDelMedico() {
  const r = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  )
  const j = await r.json()
  if (!j.localId) throw new Error(`No se pudo resolver el uid: ${JSON.stringify(j)}`)
  return j.localId
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

async function correrAxe(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodos: v.nodes.length,
      targets: v.nodes.map(n => n.target.join(' ')).slice(0, 8),
    }))
  })
}

/** Los nueve controles y su asociación label↔control, del DOM real. */
async function medirFormulario(page, ids) {
  return page.evaluate((IDS2) => {
    const controles = IDS2.map((id) => {
      const el = document.getElementById(id)
      if (!el) return { id, enDOM: false }
      const labels = el.labels ? [...el.labels] : []
      return {
        id,
        enDOM: true,
        tag: el.tagName.toLowerCase(),
        clase: el.className,
        etiquetas: labels.length,
        texto: labels[0] ? labels[0].textContent.trim().slice(0, 50) : null,
      }
    })
    const atras = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('Atrás'))
    return {
      controles,
      sinNombre: controles.filter(c => !c.enDOM || c.etiquetas !== 1).map(c => c.id),
      atrasAlto: atras ? Math.round(atras.getBoundingClientRect().height) : null,
      anchoDocumento: document.documentElement.scrollWidth,
      url: location.pathname,
    }
  }, ids)
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  await sembrarNotaFirmada()
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const uid = await uidDelMedico()
  const resultado = {}
  const erroresConsola = []

  // ── Escritorio 1440 ─────────────────────────────────────────────────────
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  await desk.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await desk.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.goto(`${BASE}/referencia/${PATIENT_ID}?nota=${NOTA_ID}`, { waitUntil: 'load' })
  await page.waitForSelector('#ref-motivo', { timeout: 20000 })
  await page.waitForTimeout(600)

  resultado.oscuro = await medirFormulario(page, IDS)
  // Equivalencia funcional 1: el prellenado de la nota firmada LLEGÓ.
  resultado.prellenado = await page.evaluate(() => ({
    resumen: document.getElementById('ref-resumen')?.value ?? '',
    diagnosticos: document.getElementById('ref-diagnosticos')?.value ?? '',
    tratamiento: document.getElementById('ref-tratamiento')?.value ?? '',
  }))
  // Equivalencia funcional 2: teclear el motivo aparece en la hoja (#doc).
  await page.fill('#ref-motivo', 'Valoración por descontrol glucémico.')
  await page.waitForTimeout(200)
  resultado.motivoEnHoja = await page.evaluate(() =>
    (document.getElementById('doc')?.textContent ?? '').includes('Valoración por descontrol glucémico.'))
  resultado.axeOscuro = await correrAxe(page)
  await page.screenshot({ path: path.join(DESTINO, '01-escritorio-oscuro.png'), fullPage: false })

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(300)
  resultado.axeClaro = await correrAxe(page)
  await page.screenshot({ path: path.join(DESTINO, '02-escritorio-claro.png'), fullPage: false })
  await desk.close()

  // ── Móvil 390×844 ───────────────────────────────────────────────────────
  const movil = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await movil.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const mpage = await movil.newPage()
  mpage.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(mpage)
  await mpage.goto(`${BASE}/referencia/${PATIENT_ID}?nota=${NOTA_ID}`, { waitUntil: 'load' })
  await mpage.waitForSelector('#ref-motivo', { timeout: 20000 })
  await mpage.waitForTimeout(600)
  resultado.movil = await medirFormulario(mpage, IDS)
  resultado.axeMovil = await correrAxe(mpage)
  await mpage.screenshot({ path: path.join(DESTINO, '03-movil.png') })
  await movil.close()
  await browser.close()

  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))

  const criticos = (v) => v.filter(x => x.id === 'label' || x.id === 'select-name')
  console.log('\n── /referencia: formulario con nombre, medido en navegador real ──')
  console.log('sinNombre (escritorio):', JSON.stringify(resultado.oscuro.sinNombre), '(esperado [])')
  console.log('sinNombre (móvil):', JSON.stringify(resultado.movil.sinNombre), '(esperado [])')
  console.log('controles:', resultado.oscuro.controles.map(c => `${c.id}:${c.etiquetas}`).join(' '))
  console.log('prellenado → resumen:', JSON.stringify(resultado.prellenado.resumen.slice(0, 40)))
  console.log('  diagnósticos:', JSON.stringify(resultado.prellenado.diagnosticos.slice(0, 50)))
  console.log('  tratamiento:', JSON.stringify(resultado.prellenado.tratamiento.slice(0, 50)))
  console.log('motivo tecleado aparece en #doc:', resultado.motivoEnHoja)
  console.log('«Atrás» alto:', resultado.oscuro.atrasAlto, '(≥44)')
  console.log('móvil anchoDocumento:', resultado.movil.anchoDocumento, '(esperado 390)')
  console.log('axe oscuro:', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro:', JSON.stringify(resultado.axeClaro))
  console.log('axe móvil:', JSON.stringify(resultado.axeMovil))
  console.log('errores consola:', erroresConsola.length)

  const quedan = [
    ...criticos(resultado.axeOscuro), ...criticos(resultado.axeClaro), ...criticos(resultado.axeMovil),
  ]
  if (quedan.length || resultado.oscuro.sinNombre.length || resultado.movil.sinNombre.length) {
    console.error('\n✗ QUEDAN controles sin nombre — la rebanada no está pagada.')
    process.exit(2)
  }
  console.log('\n✓ Los nueve controles tienen nombre y axe no ve label/select-name.')
}

main().catch(e => { console.error(e); process.exit(1) })
