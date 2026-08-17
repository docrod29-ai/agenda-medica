/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-REMAINING-SCREENS-001 (tercera
 * rebanada: EL CROMO DE /orden HABLA EL SISTEMA). §40 Real Browser Requirement.
 *
 * Hermano de `capturar-receta-cromo-v15.mjs`. Siembra su propia nota FIRMADA
 * sintética (data-privacy: cero pacientes reales) — con `estudiosOrden`
 * pre-poblado para que los CHIPS y la selección del catálogo se PINTEN y sus
 * colores se puedan medir por tema: el chip pintaba teal COMO TEXTO sobre su
 * propio tinte y la casilla marcada un Check #000 sobre var(--teal) (2.99:1
 * en claro — el mismo defecto ya pagado en el chip del directorio).
 *
 * Mide — con getComputedStyle y clic real, no leyendo JSX:
 *
 *   1. JERARQUÍA §16: la toolbar tiene EXACTAMENTE UNA `.btn-primary`
 *      (Descargar PDF) y va PRIMERO; Atrás es botón del sistema; cero
 *      botones a mano; el «Agregar» del estudio personalizado dejó de ser
 *      una segunda primaria.
 *   2. TEMA (la deuda que el trinquete de color no ve — archivo PAPEL): el
 *      texto del chip computa var(--text) POR TEMA (distinto en oscuro y
 *      claro) y la casilla marcada computa --nexus-solido de fondo con
 *      check blanco.
 *   3. INTERACCIÓN/§24: TODOS los campos del editor (fuera del papel)
 *      tienen nombre accesible; el quitar de cada chip dice QUÉ quita;
 *      categorías con aria-expanded, estudios con aria-pressed.
 *   4. ROLES §2: «Vista previa …» computa 12.5px (.nx-meta).
 *   5. PAPEL intacto: la vista previa de la orden se pinta (#receta-doc).
 *   6. MÓVIL 390: primaria a fila completa, táctiles ≥ 44px en la toolbar,
 *      sin desborde horizontal.
 *   7. AXE en oscuro, claro y móvil (primera medición axe de /orden en V15),
 *      con failureSummary completo.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-orden-cromo-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-orden-cromo'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const CLINIC_ID = 'clinica-capturas-v10'
const PATIENT_ID = 'pac-aurelio-dominguez'
const NOTA_ID = 'nota-orden-cromo-v15'
const PROJECT_ID = 'demo-nexusmed-test'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

/** Nota firmada sintética con estudiosOrden para PINTAR chips y selección. */
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
    resumenEjecutivo: 'Seguimiento de DM2; solicitud de laboratorios de control.',
    secciones: [
      { key: 'plan', label: 'Plan', value: 'Laboratorios de control y cita en 4 semanas.' },
    ],
    signosVitales: { ta: '128/78', fc: '72' },
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11.9' }],
    // Pre-pobla el editor: los chips se pintan al cargar y el primer estudio
    // coincide con un item de «Laboratorio general» (abierta por defecto),
    // así la casilla marcada del catálogo también se puede MEDIR.
    estudiosOrden: ['Biometría hemática completa', 'Hemoglobina glucosilada (HbA1c)'],
    medicamentos: [],
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

/** Radiografía de la toolbar: primaria única y PRIMERA, cero botones a mano. */
async function medirToolbar(page) {
  return page.evaluate(() => {
    const barra = document.querySelector('.orden-toolbar')
    if (!barra) return { encontrada: false }
    const fila = barra.querySelector('.actions-row')
    const botones = fila ? [...fila.querySelectorAll('button')] : []
    const primarias = botones.filter(b => b.classList.contains('btn-primary'))
    const est = el => {
      const c = getComputedStyle(el)
      return { bg: c.backgroundColor, color: c.color, peso: c.fontWeight, fs: c.fontSize }
    }
    const atras = barra.querySelector('button.btn-ghost')
    // «Agregar» ya no puede ser primaria: se cuenta TODA primaria de la página
    // fuera del estado de error (la pantalla entera es el lienzo §16).
    const primariasEnPagina = [...document.querySelectorAll('.btn-primary')].map(b => b.textContent.trim())
    return {
      encontrada: true,
      total: botones.length,
      primariaEsLaPrimera: botones[0]?.classList.contains('btn-primary') ?? false,
      primarias: primarias.map(b => ({ texto: b.textContent.trim(), ...est(b) })),
      secundariasN: botones.filter(b => b.classList.contains('btn-secondary')).length,
      botonesAManoQueQuedan: [...barra.querySelectorAll('button')].filter(b => !b.classList.contains('btn')).map(b => b.textContent.trim()),
      atrasEsDelSistema: !!atras && atras.textContent.includes('Atrás'),
      primariasEnPagina,
    }
  })
}

/** Chip de estudio + casilla marcada del catálogo: los ex-teal-crudos. */
async function medirChipsYCasilla(page) {
  return page.evaluate(() => {
    // El chip: span con el nombre del estudio y su botón de quitar.
    const chips = [...document.querySelectorAll('span')]
      .filter(s => (s.textContent || '').includes('Biometría hemática completa') && s.querySelector('button'))
    const chip = chips[0]
    // La casilla marcada: botón aria-pressed=true en el catálogo.
    const marcado = document.querySelector('button[aria-pressed="true"]')
    const casilla = marcado?.querySelector('span')
    const check = casilla?.querySelector('svg')
    return {
      chip: chip ? {
        color: getComputedStyle(chip).color,
        fondo: getComputedStyle(chip).backgroundColor,
        borde: getComputedStyle(chip).borderColor,
        quitarConNombre: chip.querySelector('button')?.getAttribute('aria-label') ?? null,
      } : null,
      casillaMarcada: casilla ? {
        fondo: getComputedStyle(casilla).backgroundColor,
        // Lucide pinta con STROKE (el prop `color` va a stroke=), no con la
        // propiedad CSS `color` — la primera corrida midió `color` y devolvió
        // el texto heredado del botón, no lo que se ve.
        checkStroke: check ? getComputedStyle(check).stroke : null,
        textoDelItem: marcado ? getComputedStyle(marcado).color : null,
        ariaPressed: marcado?.getAttribute('aria-pressed') ?? null,
      } : null,
      categoriaConEstado: document.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded') ?? null,
    }
  })
}

/** Nombre accesible de TODOS los campos del editor (fuera del papel). */
async function medirNombresDeCampos(page) {
  return page.evaluate(() => {
    const doc = document.getElementById('receta-doc')
    const campos = [...document.querySelectorAll('input, select, textarea')]
      .filter(el => !doc || !doc.contains(el))
      .filter(el => el.type !== 'hidden' && el.getBoundingClientRect().width > 0)
    const sinNombre = campos.filter(el => {
      const porLabel = el.id && document.querySelector(`label[for="${el.id}"]`)
      const porAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      return !porLabel && !porAria
    })
    return {
      total: campos.length,
      sinNombre: sinNombre.map(el => `${el.tagName.toLowerCase()}[placeholder="${el.getAttribute('placeholder') ?? ''}"]`),
    }
  })
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

  await page.goto(`${BASE}/orden/${PATIENT_ID}/${NOTA_ID}`, { waitUntil: 'load' })
  await page.waitForSelector('.orden-toolbar', { timeout: 20000 })
  await page.waitForTimeout(1500)

  resultado.toolbarOscuro = await medirToolbar(page)
  resultado.chipsOscuro = await medirChipsYCasilla(page)
  resultado.camposConNombre = await medirNombresDeCampos(page)
  resultado.nxMeta = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.nx-meta')].find(e => (e.textContent || '').includes('Vista previa'))
    return el ? { fs: getComputedStyle(el).fontSize, texto: el.textContent.trim().slice(0, 40) } : null
  })
  resultado.papel = await page.evaluate(() => {
    const doc = document.getElementById('receta-doc')
    return { encontrado: !!doc, hojas: doc ? doc.querySelectorAll('.receta-sheet-wrap').length : 0 }
  })
  await page.screenshot({ path: path.join(DESTINO, 'orden-oscuro-1440.png'), fullPage: false })
  resultado.axeOscuro = await correrAxe(page)

  // Tema claro — el punto de la medición: los tokens DEBEN cambiar de color.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.toolbarClaro = await medirToolbar(page)
  resultado.chipsClaro = await medirChipsYCasilla(page)
  resultado.axeClaro = await correrAxe(page)
  await page.screenshot({ path: path.join(DESTINO, 'orden-claro-1440.png') })
  resultado.chipCambiaDeTema =
    !!resultado.chipsOscuro?.chip && !!resultado.chipsClaro?.chip &&
    resultado.chipsOscuro.chip.color !== resultado.chipsClaro.chip.color
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(200)

  // Equivalencia funcional: Template navega de verdad a configuración.
  await page.locator('.orden-toolbar button', { hasText: 'Template' }).click()
  await page.waitForURL('**/configuracion**', { timeout: 20000 })
  resultado.templateNavega = { llega: true, url: page.url() }
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
  await pm.goto(`${BASE}/orden/${PATIENT_ID}/${NOTA_ID}`, { waitUntil: 'load' })
  await pm.waitForSelector('.orden-toolbar', { timeout: 20000 })
  await pm.waitForTimeout(1500)

  resultado.movil = await pm.evaluate(() => {
    const vw = window.innerWidth
    const barra = document.querySelector('.orden-toolbar')
    const fila = barra?.querySelector('.actions-row')
    const botones = fila ? [...fila.querySelectorAll('button')] : []
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
  await pm.screenshot({ path: path.join(DESTINO, 'orden-movil-390.png') })
  resultado.axeMovil = await correrAxe(pm)
  await ctxM.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
