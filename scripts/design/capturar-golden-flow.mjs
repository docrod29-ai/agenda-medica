/**
 * V10 · B-V10-2 — capturas del golden flow AUTENTICADO, contra emuladores.
 *
 * Corre DENTRO de `firebase emulators:exec` (nunca deja servidores vivos):
 *
 *   npm run capturas:golden
 *
 * Qué hace: siembra el consultorio sintético, levanta `next dev` con la
 * compuerta de emuladores encendida, inicia sesión como la médica demo en un
 * navegador real y captura cada pantalla del golden flow en escritorio
 * (1440×900) y móvil (390×844). Las capturas quedan en
 * `docs/design/capturas/golden-flow/` — la evidencia que V10 §33 exige antes
 * de puntuar una pantalla.
 *
 * Sin datos reales: todo lo sembrado es sintético (ver sembrar-emulador.mjs).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { sembrar, MEDICO } from './sembrar-emulador.mjs'

const PUERTO = 3100
const BASE = `http://127.0.0.1:${PUERTO}`
const SALIDA = join(process.cwd(), 'docs/design/capturas/golden-flow')

const PANTALLAS = [
  { ruta: '/dashboard', nombre: 'hoy' },
  { ruta: '/citas', nombre: 'citas' },
  { ruta: '/calendario', nombre: 'agenda' },
  { ruta: '/pacientes', nombre: 'pacientes' },
  { ruta: '/expediente/pac-01', nombre: 'expediente' },
  { ruta: '/consulta/pac-03', nombre: 'consulta' },
  { ruta: '/pendientes', nombre: 'pendientes' },
]

const VISTAS = [
  { nombre: 'escritorio', viewport: { width: 1440, height: 900 } },
  { nombre: 'movil', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]

function esperarServidor(url, timeoutMs = 180000) {
  const inicio = Date.now()
  return new Promise((resolve, reject) => {
    const intentar = async () => {
      try {
        const r = await fetch(url)
        if (r.status < 500) return resolve()
      } catch { /* aún no levanta */ }
      if (Date.now() - inicio > timeoutMs) return reject(new Error(`Servidor no respondió en ${timeoutMs}ms`))
      setTimeout(intentar, 1500)
    }
    intentar()
  })
}

/** Un puerto ocupado aquí es SIEMPRE un servidor zombi de una corrida rota:
 *  mejor morir con un mensaje claro que esperar 180 s a un servidor que no
 *  va a poder levantar. */
function exigirPuertoLibre(puerto) {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', () => reject(new Error(
      `El puerto ${puerto} está ocupado (¿next dev zombi de una corrida anterior? ` +
      `pgrep -af "next dev" y mátalo).`)))
    s.once('listening', () => s.close(resolve))
    s.listen(puerto, '127.0.0.1')
  })
}

async function main() {
  await exigirPuertoLibre(PUERTO)
  await sembrar()
  mkdirSync(SALIDA, { recursive: true })

  // La salida del servidor va a UN ARCHIVO, no a pipes de este proceso: si esta
  // corrida muere, un pipe huérfano se llena y BLOQUEA a next dev en el write —
  // queda un zombi que retiene el puerto sin servir nada (pasó en la corrida 2).
  const logServidor = openSync(join(process.cwd(), '.next-dev-capturas.log'), 'w')
  const servidor = spawn('npx', ['next', 'dev', '-p', String(PUERTO)], {
    detached: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_FIREBASE_EMULATORS: '1',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-nexusmed-test',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-nexusmed-test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:demo',
      FIREBASE_ADMIN_PROJECT_ID: 'demo-nexusmed-test',
    },
    stdio: ['ignore', logServidor, logServidor],
  })
  // Grupo de proceso completo (npx → next → workers): matar solo al padre
  // dejaba vivo al hijo con el puerto tomado.
  const matar = () => { try { process.kill(-servidor.pid, 'SIGKILL') } catch { /* ya murió */ } }
  process.on('exit', matar)
  process.on('SIGTERM', () => { matar(); process.exit(1) })
  process.on('SIGINT', () => { matar(); process.exit(1) })

  try {
    await esperarServidor(`${BASE}/login`)
    console.log('✓ next dev arriba')

    // Calentar cada ruta ANTES de abrir el navegador: en dev, la primera visita
    // compila la ruta y puede tardar >30 s — un timeout de navegación que no es
    // un defecto de la pantalla.
    for (const p of PANTALLAS) {
      try { await fetch(`${BASE}${p.ruta}`) } catch { /* la compilación igual arrancó */ }
    }
    console.log('✓ rutas compiladas')

    // El chromium preinstalado del entorno: la versión pinneada de Playwright
    // puede pedir una build más nueva que no está descargada; el binario del
    // sistema (symlink estable) evita descargar navegadores en cada corrida.
    const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
    const erroresConsola = []

    for (const vista of VISTAS) {
      const contexto = await navegador.newContext({
        viewport: vista.viewport, isMobile: vista.isMobile, hasTouch: vista.hasTouch,
        locale: 'es-MX', timezoneId: 'America/Mexico_City',
      })
      const page = await contexto.newPage()
      // networkidle NUNCA llega con Firestore vivo (websocket permanente):
      // se navega a domcontentloaded y se espera contenido concreto.
      page.setDefaultNavigationTimeout(120000)
      page.setDefaultTimeout(60000)
      page.on('console', (m) => {
        if (m.type() === 'error') erroresConsola.push(`[${vista.nombre}] ${page.url()}: ${m.text().slice(0, 200)}`)
      })

      // Sesión: la médica demo entra por la pantalla de login real.
      try {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await page.fill('input[type="email"]', MEDICO.email)
        await page.fill('input[type="password"]', MEDICO.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/dashboard**', { timeout: 90000 })
      } catch (e) {
        // Diagnóstico ANTES de morir: qué pantalla estaba viendo el navegador.
        await page.screenshot({ path: join(SALIDA, `debug-login--${vista.nombre}.png`) }).catch(() => {})
        const cuerpo = await page.evaluate(() => document.body?.innerText?.slice(0, 600)).catch(() => '(sin cuerpo)')
        console.log(`✗ login atorado (${vista.nombre}) en ${page.url()}\n--- texto visible ---\n${cuerpo}\n--- errores de consola ---`)
        for (const err of erroresConsola.slice(0, 10)) console.log(`  ${err}`)
        throw e
      }

      for (const p of PANTALLAS) {
        await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded' })
        // Respiro fijo: deja pintar las suscripciones onSnapshot antes de capturar.
        await page.waitForTimeout(3500)
        const archivo = join(SALIDA, `${p.nombre}--${vista.nombre}.png`)
        await page.screenshot({ path: archivo, fullPage: false })
        console.log(`  ✓ ${p.nombre} (${vista.nombre})`)
      }
      await contexto.close()
    }

    await navegador.close()
    if (erroresConsola.length) {
      console.log(`\n⚠ ${erroresConsola.length} errores de consola durante el recorrido:`)
      for (const e of erroresConsola.slice(0, 20)) console.log(`  ${e}`)
    }
    console.log(`\n✓ Capturas en ${SALIDA}`)
  } finally {
    matar()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
