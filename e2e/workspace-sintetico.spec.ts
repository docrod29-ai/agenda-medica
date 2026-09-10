import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * QA del workspace autenticado contra el arnés canónico de Firebase.
 * Sólo datos sintéticos demo-* y localhost. No usa la cuenta del dueño,
 * Vercel, grabación, IA externa, mensajes, firma ni producción.
 * WebKit emulado no equivale a probar Safari en un iPhone físico.
 */
test.skip(process.env.AUSCULTA_WORKSPACE_QA !== '1', 'Requiere el arnés sintético explícito')
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, baseURL }) => {
  const target = new URL(baseURL ?? '')
  expect(['localhost', '127.0.0.1']).toContain(target.hostname)
  expect(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('demo-nexusmed-v10')
  // Impide que un cambio del arnés termine llamando Firebase/IA/telemetría real.
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort()
  })
})

async function sinDesborde(page: Page) {
  const medida = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    contenido: document.documentElement.scrollWidth,
  }))
  expect.soft(medida.contenido, `La página se sale ${medida.contenido - medida.ancho}px`).toBeLessThanOrEqual(medida.ancho + 1)
}

async function entrar(page: Page) {
  // Este archivo lo produce la siembra. Nunca se leen secretos de otro entorno.
  const sesion = JSON.parse(readFileSync('scripts/design/arnes-sesion.json', 'utf8'))
  expect(sesion.proyecto).toBe('demo-nexusmed-v10')
  await page.addInitScript(({ uid }) => {
    localStorage.setItem(`nexus_tour_v1_${uid}`, '1')
  }, { uid: sesion.uid })
  await page.goto('/login')
  await page.locator('input[type=email]').fill(sesion.correo)
  await page.locator('input[type=password]').fill(sesion.clave)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 })
  await expect(page.locator('.hoy')).toBeVisible()
}

for (const tema of ['light', 'dark']) {
  test.describe(`Tema ${tema}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(t => localStorage.setItem('nexusmed.theme', t), tema)
    })

    test('el acceso cabe y respeta movimiento reducido', async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/login')
      await expect(page.locator('input[type=email]')).toBeVisible()
      await sinDesborde(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', tema)
      const movimiento = await page.locator('.nx-puerta-columna').evaluate(el => getComputedStyle(el).animationName)
      expect(movimiento).toBe('none')
      await info.attach(`acceso-${tema}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      if (info.project.name === 'iphone-safari') {
        await page.setViewportSize({ width: 320, height: 740 })
        await sinDesborde(page)
        await info.attach(`acceso-320-${tema}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      }
    })

    test('Hoy, pacientes, calendario y consulta conservan navegación y foco', async ({ page }, info) => {
      test.setTimeout(120_000)
      if (info.project.name === 'chromium') await page.setViewportSize({ width: 1440, height: 900 })
      await entrar(page)
      for (const [ruta, selector] of [
        ['/dashboard', '.hoy'],
        ['/pacientes', '.nx-fila-paciente'],
        ['/calendario', '.nx-calendario'],
        ['/consulta/pac-001', '#consulta-nota'],
      ]) {
        await page.goto(ruta)
        await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 })
        await sinDesborde(page)
        await info.attach(`${ruta.replaceAll('/', '-')}-${tema}`, { body: await page.screenshot(), contentType: 'image/png' })
        if (info.project.name === 'iphone-safari') {
          await page.setViewportSize({ width: 320, height: 740 })
          await sinDesborde(page)
          await info.attach(`${ruta.replaceAll('/', '-')}-320-${tema}`, { body: await page.screenshot(), contentType: 'image/png' })
          await page.setViewportSize({ width: 390, height: 844 })
        }
      }

      // Las regiones siguen montadas al navegar por teclado entre ellas.
      await page.locator('a[href="#consulta-nota"]').press('Enter')
      await expect(page).toHaveURL(/#consulta-nota$/)
      await expect(page.locator('#consulta-contexto')).toBeAttached()
      await expect(page.locator('#consulta-asistente')).toBeAttached()

      await page.goto('/pacientes')
      const abrir = page.locator('.nx-fila-abrir').first()
      await expect(abrir).toBeVisible()
      // Shift+Tab y Tab devuelven foco por teclado, sin pulsar ni editar datos.
      await abrir.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(abrir).toBeFocused()
      const contorno = await abrir.evaluate(el => {
        const css = getComputedStyle(el, '::after')
        return { estilo: css.outlineStyle, ancho: parseFloat(css.outlineWidth) }
      })
      expect(contorno.estilo).not.toBe('none')
      expect(contorno.ancho).toBeGreaterThanOrEqual(2)

      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/pacientes')
      await expect(page.locator('.page-header')).toBeVisible()
      expect(await page.locator('.page-header').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
    })
  })
}
