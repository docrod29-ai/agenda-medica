/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-REMAINING-SCREENS-001 (primera
 * rebanada: EL CROMO DE /nota HABLA EL SISTEMA). §40 Real Browser Requirement.
 *
 * La siembra estándar NO crea documentos `NotaMedica` (nota de honestidad ya
 * escrita por rebanadas anteriores), así que este arnés siembra la suya:
 * una nota FIRMADA sintética (paciente inventado de la siembra estándar,
 * regla data-privacy: cero pacientes reales) vía firebase-admin contra el
 * emulador, y navega a /nota/[pid]/[notaId] de verdad.
 *
 * Mide — con getComputedStyle, foco real y teclas reales, no leyendo JSX:
 *
 *   1. JERARQUÍA §16: la toolbar tiene EXACTAMENTE UN `.btn-primary`
 *      (Descargar PDF) con el relleno sólido del sistema; Imprimir/Word/
 *      Receta/Orden/Adenda son secundarias transparentes. Antes: siete
 *      rellenos a mano, teal/violeta crudos incluidos.
 *   2. INTERACCIÓN (la razón de ser de la rebanada): el modal de adenda es
 *      role="dialog" real — al abrirlo el foco ENTRA al diálogo, Tab no se
 *      escapa (se muestrea activeElement tras varios Tab), Escape lo CIERRA
 *      y el foco VUELVE al botón que lo abrió. El overlay viejo no hacía
 *      ninguna de las cuatro.
 *   3. FREEZE FUNCIONAL: Receta navega de verdad a /receta/[pid]/[notaId]
 *      (clic real, waitForURL); el documento #doc sigue pintando el papel
 *      (Times New Roman computado en el cuerpo).
 *   4. ROLES §2: «compara con la nota» computa 12.5px (.nx-meta).
 *   5. AXE en oscuro, claro Y móvil, con failureSummary completo (primera
 *      medición axe de /nota en V15 — hallazgos preexistentes se anotan,
 *      no se ocultan).
 *   6. MÓVIL 390: la rejilla DEBT-009 sigue viva (primaria a fila completa),
 *      táctiles >= 44px en la toolbar, sin desborde horizontal.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-nota-cromo-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-nota-cromo'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const CLINIC_ID = 'clinica-capturas-v10'
const PATIENT_ID = 'pac-aurelio-dominguez'
const NOTA_ID = 'nota-cromo-v15-firmada'
const PROJECT_ID = 'demo-nexusmed-test'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

/** Nota firmada sintética — todos los datos inventados (data-privacy.md). */
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
    resumenEjecutivo: 'Seguimiento de DM2; ajuste de metformina y solicitud de HbA1c de control.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: 'Paciente refiere apego al tratamiento. Niega hipoglucemias.' },
      { key: 'plan', label: 'Plan', value: 'Continuar metformina. HbA1c de control en 3 meses.' },
    ],
    signosVitales: { ta: '128/78', fc: '72' },
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11.9' }],
    medicamentos: [{ nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 h', duracion: '90 días' }],
    alergias: [],
    // Con transcripción: sin ella el bloque «Lo que se dijo» no se pinta y el
    // rol .nx-meta del cromo no se puede MEDIR (la primera corrida devolvió
    // null y midió de menos — se siembra el dato para medir de verdad).
    transcripcionCruda: 'Doctor: ¿cómo ha estado de sus niveles? Paciente: bien, sin bajones de azúcar.',
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
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodos: v.nodes.length,
      targets: v.nodes.map(n => n.target.join(' ')).slice(0, 8),
      resumen: v.nodes.map(n => n.failureSummary ?? '').slice(0, 5),
    }))
  })
}

/** Radiografía de la toolbar: quién es primaria, quién secundaria. */
async function medirToolbar(page) {
  return page.evaluate(() => {
    const barra = document.querySelector('.nota-toolbar')
    if (!barra) return { encontrada: false }
    const botones = [...barra.querySelectorAll('button')]
    const primarias = botones.filter(b => b.classList.contains('btn-primary'))
    const secundarias = botones.filter(b => b.classList.contains('btn-secondary'))
    const aMano = botones.filter(b => !b.classList.contains('btn'))
    const est = el => {
      const c = getComputedStyle(el)
      return { bg: c.backgroundColor, color: c.color, peso: c.fontWeight, fs: c.fontSize }
    }
    return {
      encontrada: true,
      total: botones.length,
      primarias: primarias.map(b => ({ texto: b.textContent.trim(), ...est(b) })),
      secundariasN: secundarias.length,
      secundariaEjemplo: secundarias[0] ? { texto: secundarias[0].textContent.trim(), ...est(secundarias[0]) } : null,
      botonesAManoQueQuedan: aMano.map(b => b.textContent.trim()),
    }
  })
}

/** El diálogo de adenda: foco, trampa, Escape, foco devuelto. */
async function medirModal(page) {
  const abrir = page.locator('.nota-toolbar button', { hasText: 'Adenda' })
  await abrir.click()
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
  const focoDentroAlAbrir = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return !!d && d.contains(document.activeElement)
  })
  // Tab ×8: con ~6 enfocables dentro, si la trampa fallara el foco saldría.
  let focoSiempreDentro = true
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const dentro = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return !!d && d.contains(document.activeElement)
    })
    if (!dentro) { focoSiempreDentro = false; break }
  }
  const aria = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? { ariaModal: d.getAttribute('aria-modal'), etiquetado: !!d.getAttribute('aria-labelledby') } : null
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const cerradoConEscape = await page.evaluate(() => !document.querySelector('[role="dialog"]'))
  const focoDevuelto = await page.evaluate(() => {
    const a = document.activeElement
    return !!a && (a.textContent || '').includes('Adenda')
  })
  return { focoDentroAlAbrir, focoSiempreDentro, aria, cerradoConEscape, focoDevuelto }
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

  // ── ESCRITORIO 1440 ──────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctx.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  await page.goto(`${BASE}/nota/${PATIENT_ID}/${NOTA_ID}`, { waitUntil: 'load' })
  await page.waitForSelector('#doc', { timeout: 20000 })
  await page.waitForTimeout(1200)

  resultado.toolbarOscuro = await medirToolbar(page)
  // El papel sigue siendo papel: serif computada dentro de #doc.
  resultado.papel = await page.evaluate(() => {
    const doc = document.getElementById('doc')
    if (!doc) return { encontrado: false }
    return { encontrado: true, fuente: getComputedStyle(doc).fontFamily }
  })
  // Rol §2 del metadato de transcripción (si la nota trae transcripción; si
  // no, se mide la clase en cualquier .nx-meta presente y se declara).
  resultado.nxMeta = await page.evaluate(() => {
    const el = document.querySelector('.nx-meta')
    return el ? { fs: getComputedStyle(el).fontSize, texto: el.textContent.trim().slice(0, 40) } : null
  })
  await page.screenshot({ path: path.join(DESTINO, 'nota-oscuro-1440.png'), fullPage: false })

  resultado.modal = await medirModal(page)
  // Recapturar con el modal abierto para la evidencia visual.
  await page.locator('.nota-toolbar button', { hasText: 'Adenda' }).click()
  await page.waitForSelector('[role="dialog"]')
  await page.screenshot({ path: path.join(DESTINO, 'nota-modal-adenda-1440.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  resultado.axeOscuro = await correrAxe(page)

  // Tema claro
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.toolbarClaro = await medirToolbar(page)
  resultado.axeClaro = await correrAxe(page)
  await page.screenshot({ path: path.join(DESTINO, 'nota-claro-1440.png') })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(200)

  // Equivalencia funcional: Receta navega de verdad.
  await page.locator('.nota-toolbar button', { hasText: 'Receta' }).click()
  await page.waitForURL(`**/receta/${PATIENT_ID}/${NOTA_ID}**`, { timeout: 20000 })
  resultado.recetaNavega = { llega: true, url: page.url() }
  await ctx.close()

  // ── MÓVIL 390 ────────────────────────────────────────────────────────
  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctxM.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const pm = await ctxM.newPage()
  pm.on('console', m => { if (m.type() === 'error') erroresConsola.push(`[móvil] ${m.text()}`) })
  await login(pm)
  await pm.goto(`${BASE}/nota/${PATIENT_ID}/${NOTA_ID}`, { waitUntil: 'load' })
  await pm.waitForSelector('#doc', { timeout: 20000 })
  await pm.waitForTimeout(1200)

  resultado.movil = await pm.evaluate(() => {
    const vw = window.innerWidth
    const barra = document.querySelector('.nota-toolbar')
    const botones = barra ? [...barra.querySelectorAll('button')] : []
    const primaria = botones.find(b => b.classList.contains('btn-primary'))
    const rp = primaria?.getBoundingClientRect()
    const chicos = botones.filter(b => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && (r.height < 44)
    }).map(b => `${b.textContent.trim().slice(0, 18)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`)
    return {
      anchoDocumento: document.documentElement.scrollWidth,
      desborda: document.documentElement.scrollWidth > vw + 1,
      primariaFilaCompleta: rp ? rp.width > vw * 0.85 : null,
      tactilesChicosEnToolbar: chicos,
    }
  })
  await pm.screenshot({ path: path.join(DESTINO, 'nota-movil-390.png') })
  resultado.axeMovil = await correrAxe(pm)
  await ctxM.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
