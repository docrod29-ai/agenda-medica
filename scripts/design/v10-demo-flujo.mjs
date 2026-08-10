import { chromium } from '@playwright/test'
const OUT = 'docs/design/screenshots/v10'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:3005/demo/interactivo', { waitUntil: 'networkidle' })
await page.getByText('Paciente M. F.').first().click()
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/demo-flujo-2-dictado__desktop-1440.jpg`, quality: 55, type: 'jpeg', fullPage: true })
// intentar avanzar con el CTA visible
for (const [i, etiqueta] of [['3', /Simular|Iniciar|Grabar|Dictar|Continuar|Generar/i], ['4', /Nota|Continuar|Generar|Ver/i], ['5', /Receta|Orden|Continuar/i]]) {
  const btn = page.getByRole('button', { name: etiqueta }).first()
  try {
    await btn.click({ timeout: 4000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/demo-flujo-${i}__desktop-1440.jpg`, quality: 55, type: 'jpeg', fullPage: true })
    console.log(`paso ${i}: click en "${await btn.textContent().catch(() => '?')}"`)
  } catch { console.log(`paso ${i}: sin botón que empate`) }
}
await browser.close()
