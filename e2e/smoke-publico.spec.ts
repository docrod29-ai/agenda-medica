import { test, expect } from '@playwright/test'

/**
 * Smoke E2E del camino PÚBLICO (sin autenticación). Verifica que las páginas y
 * artefactos que ve un paciente/prospecto/Google cargan de verdad en un navegador
 * real. Corre contra la URL de `baseURL` (producción por defecto).
 */

test('la landing carga y responde 200', async ({ page }) => {
  const resp = await page.goto('/')
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
})

test('página de login accesible', async ({ page }) => {
  const resp = await page.goto('/login')
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
})

for (const ruta of ['/precios', '/seguridad', '/privacidad', '/terminos', '/contacto']) {
  test(`página pública ${ruta} carga`, async ({ page }) => {
    const resp = await page.goto(ruta)
    expect(resp?.status(), `${ruta} debe cargar`).toBeLessThan(400)
  })
}

test('robots.txt existe y apunta al sitemap', async ({ request }) => {
  const r = await request.get('/robots.txt')
  expect(r.status()).toBe(200)
  const txt = await r.text()
  expect(txt).toContain('Sitemap:')
  expect(txt).toContain('Disallow: /api/')
})

test('sitemap.xml existe y lista URLs', async ({ request }) => {
  const r = await request.get('/sitemap.xml')
  expect(r.status()).toBe(200)
  const xml = await r.text()
  expect(xml).toContain('<loc>')
})

test('endpoints protegidos rechazan sin sesión (401)', async ({ request }) => {
  const fhir = await request.get('/api/fhir/paciente/x?clinicId=x')
  expect([401, 403]).toContain(fhir.status())
  const cal = await request.get('/api/calendar/connect?uid=x')
  expect(cal.status()).toBe(401)
})
