#!/usr/bin/env node
/**
 * ARNÉS VISUAL V10 — capturas del flujo dorado, con sesión y datos sintéticos.
 *
 * Depende de `sembrar-emulador.mjs` y de `npm run arnes:dev`. Ver la cabecera de
 * aquél para por qué los datos son inventados y por qué eso no es negociable.
 *
 * ── LOS ANCHOS ───────────────────────────────────────────────────────────────
 *
 * Los cuatro de V10 §39. No son redondeos bonitos:
 *   1440  el portátil del consultorio;
 *   1024  el iPad apaisado y la ventana a media pantalla — el ancho donde una
 *         rejilla de dos columnas fijas se rompe primero;
 *    768  el iPad de pie;
 *    390  el iPhone del bolsillo, que es donde el dueño vio el defecto que
 *         disparó HOME-001.
 *
 * ── EL INICIO DE SESIÓN VA POR EL FORMULARIO REAL ────────────────────────────
 *
 * Se podría inyectar el token y ahorrarse la pantalla. No se hace: si el login
 * se rompe, la corrida tiene que enterarse aquí y no dos pantallas después con
 * una captura vacía que parezca un problema de maquetación.
 *
 * El valor se escribe con el `setter` nativo del prototipo y un evento `input`
 * sintético porque los campos son controlados por React: asignar `.value` a
 * secas cambia el DOM y deja el estado de React en blanco, y el formulario se
 * envía vacío. Es el mismo motivo por el que un `fill` ingenuo falla.
 *
 * Uso:  node scripts/design/capturar-flujo-dorado.mjs [etiqueta]
 *       → docs/design/capturas/<etiqueta>/<pantalla>@<ancho>.png
 */
import { chromium } from 'playwright'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.ARNES_URL || 'http://localhost:3200'
const ETIQUETA = process.argv[2] || 'antes'
const SALIDA = path.join('docs', 'design', 'capturas', ETIQUETA)

/**
 * La sesión la deja escrita la siembra. Si el archivo no está, el arnés se
 * detiene aquí en vez de intentarlo con credenciales adivinadas: fallar al
 * entrar produce siete capturas de la pantalla de login, y eso se parece
 * demasiado a un resultado.
 */
const SESION = JSON.parse(
  await readFile(new URL('./arnes-sesion.json', import.meta.url), 'utf8')
    .catch(() => { throw new Error('Falta arnes-sesion.json — corre primero: npm run arnes:sembrar') }),
)
const CORREO = SESION.correo
const CLAVE = SESION.clave

const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1024', width: 1024, height: 800 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
]

/**
 * Las pantallas del flujo dorado de V10 §1, en el orden en que el médico las
 * vive. `espera` sólo donde la pantalla tarda en asentarse por su cuenta.
 */
const PANTALLAS = [
  { id: '01-hoy', ruta: '/dashboard' },
  { id: '02-citas', ruta: '/citas' },
  { id: '03-calendario', ruta: '/calendario' },
  { id: '04-pacientes', ruta: '/pacientes' },
  { id: '05-pendientes', ruta: '/pendientes' },
  { id: '06-consulta', ruta: '/consulta/pac-001', espera: 2500 },
  { id: '07-configuracion', ruta: '/configuracion' },
]

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type=email]', { timeout: 30_000 })
  await page.evaluate(({ correo, clave }) => {
    const set = (el, val) => {
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')
      desc.set.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set(document.querySelector('input[type=email]'), correo)
    set(document.querySelector('input[type=password]'), clave)
  }, { correo: CORREO, clave: CLAVE })
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
  await page.waitForTimeout(2500)   // la agenda llega por suscripción, no por SSR

  /**
   * El paseo de bienvenida se marca como visto.
   *
   * Sale a los 700 ms de entrar y tapa la pantalla entera con un telón. Una
   * cuenta recién sembrada lo dispara SIEMPRE, así que sin esto las siete
   * capturas serían siete fotos del mismo modal.
   *
   * El uid se saca de la sesión que Firebase acaba de escribir en localStorage,
   * porque la clave del paseo lo lleva dentro (`nexus_tour_v1_<uid>`) y el
   * script no lo conoce de antemano.
   *
   * El paseo se audita aparte, con su propio caso. Aquí estorba.
   */
  await page.evaluate(uid => { localStorage.setItem(`nexus_tour_v1_${uid}`, '1') }, SESION.uid)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
}

/**
 * Los avisos que tapan la pantalla y no son parte de lo que se audita.
 *
 * El indicador de desarrollo de Next y el aviso de «confirma tu correo» son
 * ruido del arnés: ninguno de los dos sale en la aplicación de un médico con la
 * cuenta verificada. Dejarlos falsearía tanto la captura como la puntuación.
 */
async function despejar(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal { display: none !important; }
      [data-nextjs-dev-tools-button] { display: none !important; }
    `,
  })
}

const errores = []

async function main() {
  await mkdir(SALIDA, { recursive: true })
  const navegador = await chromium.launch()

  for (const tam of ANCHOS) {
    const ctx = await navegador.newContext({
      viewport: { width: tam.width, height: tam.height },
      deviceScaleFactor: 2,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      colorScheme: 'dark',
      isMobile: tam.width <= 768,
      hasTouch: tam.width <= 768,
    })
    const page = await ctx.newPage()
    page.on('console', m => { if (m.type() === 'error') errores.push(`[${tam.nombre}] ${m.text().slice(0, 200)}`) })
    page.on('pageerror', e => errores.push(`[${tam.nombre}] PAGEERROR ${e.message.slice(0, 200)}`))

    await entrar(page)

    for (const p of PANTALLAS) {
      try {
        await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await page.waitForTimeout(p.espera ?? 1600)
        await despejar(page)
        await page.screenshot({
          path: path.join(SALIDA, `${p.id}@${tam.nombre}.png`),
          fullPage: false,   // lo que CABE es lo que el médico ve sin desplazar
        })
      } catch (e) {
        errores.push(`[${tam.nombre}] ${p.ruta}: ${e.message.slice(0, 160)}`)
      }
    }
    await ctx.close()
  }

  await navegador.close()

  // La consola forma parte de la evidencia: una pantalla bonita que grita en la
  // consola no está terminada (V10 §33 paso 17).
  await writeFile(
    path.join(SALIDA, 'consola.txt'),
    errores.length ? [...new Set(errores)].join('\n') : 'Sin errores de consola.\n',
  )

  console.log(`\n  ✓ Capturas en ${SALIDA}`)
  console.log(`    ${PANTALLAS.length} pantallas × ${ANCHOS.length} anchos`)
  console.log(`    errores de consola: ${new Set(errores).size}\n`)
}

main().catch(e => { console.error('\n  ✗', e, '\n'); process.exit(1) })
