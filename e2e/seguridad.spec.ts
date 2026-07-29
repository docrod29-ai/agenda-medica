import { test, expect } from '@playwright/test'
import { RUTAS_PRIVADAS, rutaDePrueba } from '../src/lib/security/rutas-privadas'

/**
 * Matriz E2E de SEGURIDAD (unidad Nexus OS E0-10).
 *
 * Qué prueba: las cabeceras de seguridad que realmente llegan al navegador y que
 * la CSP no rompe el camino público. Todo SIN sesión (no hay cuenta de prueba —
 * ver e2e/README.md §Limitación).
 *
 * Contra qué corre: `baseURL` (producción por defecto; local con
 * PLAYWRIGHT_BASE_URL=http://localhost:3000). El grupo D sólo tiene sentido en
 * local, contra un servidor arrancado con CSP_MODE=enforce.
 *
 * OJO — se espera que el grupo A3 esté ROJO contra producción hasta que se
 * despliegue esta unidad: ese rojo ES el hallazgo (había pantallas con PHI sin
 * ninguna cabecera anti-iframe). No se "arregla" relajando el test.
 */

/** Rutas públicas que un paciente o un buscador visita sin sesión. */
const RUTAS_PUBLICAS = [
  '/',
  '/precios',
  '/seguridad',
  '/privacidad',
  '/terminos',
  '/contacto',
  '/login',
  '/registro',
]

/** ¿Hay política CSP (en cualquiera de las dos claves) y qué dice? */
function csp(headers: Record<string, string>) {
  const enforce = headers['content-security-policy'] ?? ''
  const reportOnly = headers['content-security-policy-report-only'] ?? ''
  return { enforce, reportOnly, cualquiera: `${enforce} ${reportOnly}` }
}

// ───────────────────────── Grupo A — cabeceras ─────────────────────────

test('A1 · las cabeceras de endurecimiento globales están presentes', async ({ request }) => {
  const r = await request.get('/')
  const h = r.headers()
  expect(h['strict-transport-security']).toContain('max-age=')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['cross-origin-opener-policy']).toBe('same-origin')
  expect(h['origin-agent-cluster']).toBe('?1')
  // La app sólo necesita micrófono (dictado). Cámara y ubicación, cerradas.
  expect(h['permissions-policy']).toContain('microphone=(self)')
  expect(h['permissions-policy']).toContain('camera=()')
  expect(h['permissions-policy']).toContain('geolocation=()')
  // No le regalamos el stack a quien escanee.
  expect(h['x-powered-by']).toBeUndefined()
})

test('A2 · existe una CSP con las directivas de contención', async ({ request }) => {
  const r = await request.get('/')
  const p = csp(r.headers()).cualquiera
  expect(p, 'no llega ninguna cabecera CSP').not.toBe(' ')
  expect(p).toContain("default-src 'self'")
  expect(p).toContain("object-src 'none'")
  expect(p).toContain("base-uri 'self'")
  expect(p).toContain('/api/csp-report')
})

for (const segmento of RUTAS_PRIVADAS) {
  test(`A3 · ${rutaDePrueba(segmento)} no se puede embeber (anti-clickjacking)`, async ({ request }) => {
    // La cabecera viaja incluso en la redirección al login: se puede verificar
    // sin credenciales, que es justo lo que hace útil a este caso.
    const r = await request.get(rutaDePrueba(segmento), { maxRedirects: 0 })
    const h = r.headers()
    expect(h['x-frame-options'], `${segmento}: falta X-Frame-Options`).toBe('DENY')
    expect(
      csp(h).enforce,
      `${segmento}: frame-ancestors debe ir en la cabecera que BLOQUEA, no en report-only`,
    ).toContain("frame-ancestors 'none'")
  })
}

for (const ruta of ['/reservar/demo', '/privacidad']) {
  test(`A4 · ${ruta} SIGUE siendo embebible (widget de los consultorios)`, async ({ request }) => {
    const r = await request.get(ruta, { maxRedirects: 0 })
    const h = r.headers()
    expect(h['x-frame-options'], `${ruta} dejó de ser embebible`).toBeUndefined()
    expect(csp(h).enforce).toContain('frame-ancestors *')
  })
}

for (const ruta of ['/mi/token-de-prueba', '/resena/token-de-prueba', '/verificar/token-de-prueba']) {
  test(`A5 · ${ruta} no filtra el token por referer ni se indexa`, async ({ request }) => {
    const r = await request.get(ruta, { maxRedirects: 0 })
    const h = r.headers()
    expect(h['referrer-policy']).toBe('no-referrer')
    expect(h['x-robots-tag']).toContain('noindex')
  })
}

// ──────────── Grupo B — violaciones reales en el navegador ────────────

for (const ruta of RUTAS_PUBLICAS) {
  test(`B1 · ${ruta} carga sin violar la CSP`, async ({ page }) => {
    const violaciones: string[] = []
    // El evento se dispara TAMBIÉN en report-only (disposition='report'), así que
    // este caso convierte "esperar una semana de reportes" en "una corrida de CI".
    await page.exposeFunction('__registrarViolacionCsp', (d: string) => void violaciones.push(d))
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => {
        const w = window as unknown as { __registrarViolacionCsp?: (d: string) => void }
        w.__registrarViolacionCsp?.(`${e.effectiveDirective} ← ${e.blockedURI}`)
      })
    })
    const resp = await page.goto(ruta, { waitUntil: 'domcontentloaded' })
    expect(resp?.status()).toBeLessThan(400)
    await page.waitForTimeout(1500) // margen para scripts diferidos
    expect(violaciones, `${ruta} violaría la CSP:\n  ${violaciones.join('\n  ')}`).toEqual([])
  })
}

test('B2 · el camino público no pierde recursos por el camino', async ({ page }) => {
  const fallos: string[] = []
  page.on('response', r => {
    // 401/403 son legítimos (endpoints que exigen sesión); 5xx y 404 de recursos no.
    if (r.status() >= 400 && ![401, 403].includes(r.status())) fallos.push(`${r.status()} ${r.url()}`)
  })
  for (const ruta of RUTAS_PUBLICAS) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' })
  }
  expect(fallos, `recursos que no cargan:\n  ${fallos.join('\n  ')}`).toEqual([])
})

// ─────────── Grupo C — superficie autenticada sin credenciales ───────────

const ENDPOINTS_PROTEGIDOS: { ruta: string; metodo: 'GET' | 'POST' }[] = [
  { ruta: '/api/fhir/paciente/x?clinicId=x', metodo: 'GET' },
  { ruta: '/api/calendar/connect?uid=x', metodo: 'GET' },
  { ruta: '/api/config/guardar', metodo: 'POST' },
  { ruta: '/api/auditoria/registrar', metodo: 'POST' },
]

for (const { ruta, metodo } of ENDPOINTS_PROTEGIDOS) {
  test(`C1 · ${metodo} ${ruta} rechaza sin sesión`, async ({ request }) => {
    const r =
      metodo === 'GET'
        ? await request.get(ruta, { maxRedirects: 0 })
        : await request.post(ruta, { data: {}, maxRedirects: 0 })
    // Lo que NO vale es un 2xx: cualquier rechazo (incluido 400 por cuerpo vacío
    // ANTES de autenticar) deja el dato dentro; un 200 sin sesión sería el hallazgo.
    expect(r.status(), `${metodo} ${ruta} respondió ${r.status()}`).toBeGreaterThanOrEqual(400)
  })
}

test('C2 · /api/csp-report traga basura sin caerse y rechaza GET', async ({ request }) => {
  const post = await request.post('/api/csp-report', {
    data: { 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://x.example/y' } },
  })
  expect(post.status()).toBe(204)

  const basura = await request.post('/api/csp-report', { data: 'no soy json' as unknown as object })
  expect(basura.status()).toBeLessThan(500)

  const get = await request.get('/api/csp-report')
  expect(get.status()).toBe(405)
})

// ──────────── Grupo D — enforce, sólo en local (evidencia) ────────────

/**
 * Se salta si no se está probando el flip en local. NO es un bypass silencioso:
 * `src/__tests__/csp-guard.test.ts` prueba el interruptor en los dos modos sin
 * navegador, y el runbook (docs/seguridad/csp-enforce.md) exige correr esto con
 * CSP_MODE=enforce antes de tocar la variable en Vercel.
 */
test.describe('D · con CSP_MODE=enforce', () => {
  test.skip(process.env.PLAYWRIGHT_ENFORCE !== '1', 'requiere servidor local con CSP_MODE=enforce')

  test('D1 · la política llega en la cabecera que BLOQUEA', async ({ request }) => {
    const { enforce, reportOnly } = csp((await request.get('/')).headers())
    expect(enforce).toContain("default-src 'self'")
    expect(reportOnly).toBe('')
  })

  test('D2 · el camino público sigue vivo con la política apretada', async ({ page }) => {
    for (const ruta of RUTAS_PUBLICAS) {
      const resp = await page.goto(ruta, { waitUntil: 'domcontentloaded' })
      expect(resp?.status(), `${ruta} se cayó con enforce`).toBeLessThan(400)
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
