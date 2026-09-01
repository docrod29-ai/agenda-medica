/**
 * GP-FINAL — piezas comunes del recorrido.
 *
 * Un recorrido que no deja acta no es reproducible: si el resultado sólo existe
 * en la terminal de quien lo corrió, la siguiente sesión vuelve a empezar. Aquí
 * viven el arranque del navegador, la sesión del médico y el acta.
 *
 * NO se aprueba nada leyendo el JSX (`design-system.md`): todo lo que este
 * módulo ofrece opera sobre un Chromium de verdad contra la app construida.
 */
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const BASE = process.env.GP_BASE_URL || 'http://localhost:3000'

/**
 * El Chromium que YA está en la máquina.
 *
 * El repo fija una versión de Playwright distinta de la de los binarios
 * preinstalados, y `playwright install` está prohibido en este entorno. Se
 * apunta al ejecutable existente en vez de descargar otro.
 */
export const EXE = process.env.GP_CHROMIUM
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

export const MEDICO_A = { email: 'medico@capturas.demo', password: 'captura-v10-demo' }
export const MEDICO_B = { email: 'medico.b@gp-final.demo', password: 'gp-final-demo-b' }

export const CLINICA_A = 'clinica-capturas-v10'
export const CLINICA_B = 'clinica-gp-final-b'

export async function abrirNavegador() {
  return chromium.launch({
    executablePath: EXE,
    args: [
      // Sin esto no hay forma de recorrer el paso 5 («comenzar grabación») en
      // una máquina sin micrófono: el navegador pediría permiso y se quedaría
      // esperando a un humano. La pista es sintética, como manda `data-privacy`.
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  })
}

export async function nuevaSesion(browser, { viewport, movil } = {}) {
  const ctx = await browser.newContext({
    viewport: viewport || { width: 1440, height: 900 },
    permissions: ['microphone'],
    ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  })
  const page = await ctx.newPage()
  const consola = []
  page.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 400)) })
  page.on('pageerror', e => consola.push('PAGEERROR ' + String(e).slice(0, 400)))
  page.__consola = consola
  return { ctx, page, consola }
}

export async function entrar(page, quien = MEDICO_A) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('#correo-electronico', quien.email)
  await page.fill('#contrasena', quien.password)
  await page.click('button:has-text("Iniciar sesión")')
  await page.waitForURL('**/dashboard', { timeout: 45_000 })
}

/** El tour de bienvenida tapa la pantalla; se salta antes de medir nada. */
export async function saltarTour(page) {
  for (let i = 0; i < 4; i++) {
    const b = page.locator('button[aria-label="Saltar"], button:has-text("Saltar")').first()
    if (await b.count() && await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {})
      await page.waitForTimeout(400)
    } else break
  }
}

/** Texto plano de la pantalla, para buscar sin depender de la maqueta. */
export const textoDe = (page) => page.evaluate(() => document.body.innerText)

// ── Acta ────────────────────────────────────────────────────────────────
//
// `severidad` sólo se pone cuando hay defecto. Un caso OK no lleva severidad
// para que un `grep P0` sobre el acta no devuelva los que pasaron.
export function acta(nombre) {
  const casos = []
  const registrar = (id, titulo, ok, evidencia, severidad) => {
    const c = { id, titulo, resultado: ok === null ? 'NO_EJECUTADO' : ok ? 'OK' : 'DEFECTO', evidencia }
    if (!ok && ok !== null) c.severidad = severidad || 'P1'
    casos.push(c)
    const marca = c.resultado === 'OK' ? '  ok  ' : c.resultado === 'DEFECTO' ? `**${c.severidad}**` : ' n/e  '
    console.log(`${marca} ${id}  ${titulo}${evidencia ? '  — ' + String(evidencia).slice(0, 220) : ''}`)
    return c
  }
  const volcar = (ruta) => {
    mkdirSync(dirname(ruta), { recursive: true })
    const resumen = {
      recorrido: nombre,
      total: casos.length,
      ok: casos.filter(c => c.resultado === 'OK').length,
      defectos: casos.filter(c => c.resultado === 'DEFECTO').length,
      p0: casos.filter(c => c.severidad === 'P0').length,
      p1: casos.filter(c => c.severidad === 'P1').length,
      casos,
    }
    writeFileSync(ruta, JSON.stringify(resumen, null, 2))
    console.log(`\n── ${nombre}: ${resumen.ok}/${resumen.total} ok · ${resumen.p0} P0 · ${resumen.p1} P1 → ${ruta}`)
    return resumen
  }
  return { registrar, volcar, casos }
}

// ── Mirar del otro lado ─────────────────────────────────────────────────
//
// «El dato tiene que LLEGAR»: una prueba que sólo mira la pantalla no puede
// decir qué quedó escrito. Esto lee la base directamente, con el mismo candado
// anti-producción del resto del arnés.
export async function leerAprendizaje(clinicId) {
  const { initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const PROJECT_ID = 'demo-nexusmed-test'
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('candado anti-producción')
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: PROJECT_ID })
  const snap = await getFirestore(app).collection(`clinics/${clinicId}/asr_aprendizaje`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** ¿Consta ya el consentimiento de grabación en el expediente? */
export async function consentimientoEnExpediente(clinicId, patientId) {
  const { initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: 'demo-nexusmed-test' })
  const d = await getFirestore(app).doc(`clinics/${clinicId}/patients/${patientId}`).get()
  return !!d.data()?.consentimientoGrabacion?.fecha
}

async function db_() {
  const { initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: 'demo-nexusmed-test' })
  return getFirestore(app)
}

/** Las notas del expediente, tal y como quedaron ESCRITAS. */
export async function leerNotas(clinicId, patientId) {
  const s = await (await db_()).collection(`clinics/${clinicId}/patients/${patientId}/notas`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Los paquetes de visita, tal y como quedaron ESCRITOS. */
export async function leerPaquetes(clinicId, patientId) {
  const s = await (await db_()).collection(`clinics/${clinicId}/patients/${patientId}/paquetes_visita`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * El idToken de un médico sembrado, por la API REST del emulador de Auth.
 *
 * Se usa para llamar a las rutas HTTP con la credencial REAL del médico, sin
 * pasar por el navegador. Hace falta porque media prueba de aislamiento consiste
 * precisamente en pedirle cosas a la ruta sin una pantalla de por medio:
 * «esconder un botón no cierra una ruta HTTP».
 */
export async function idTokenDe({ email, password }) {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
  const r = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=arnes-gp-final`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  const d = await r.json()
  if (!d.idToken) throw new Error(`sin idToken para ${email}: ${JSON.stringify(d).slice(0, 200)}`)
  return d.idToken
}

/** Emite un enlace de portal por el camino real, con la credencial del médico. */
export async function emitirEnlace(idToken, clinicId, patientId, alcance) {
  const r = await fetch(BASE + '/api/portal/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ clinicId, patientId, alcance }),
  })
  const cuerpo = await r.json().catch(() => ({}))
  return { status: r.status, url: cuerpo?.url ?? null, error: cuerpo?.error ?? null }
}

/** Pone (o quita) el nombre del médico en la configuración del consultorio. */
export async function ponerNombreDelMedico(clinicId, nombre) {
  await (await db_()).doc(`clinics/${clinicId}/config/main`)
    .set({ nombreMedico: nombre }, { merge: true })
}
