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
  // No interceptar los streams locales de Firestore: WebKit debe consumirlos
  // directamente, igual que la aplicación. Sólo se intercepta lo prohibido.
  await context.route(
    url => !['localhost', '127.0.0.1'].includes(url.hostname),
    route => route.abort(),
  )
})

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && process.env.AUSCULTA_WORKSPACE_QA === '1') {
    console.log('WORKSPACE_QA_URL', page.url())
    console.log('WORKSPACE_QA_FALLO', await page.locator('body').innerText().catch(() => 'Página cerrada'))
  }
})

async function sinDesborde(page: Page) {
  const medida = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    contenido: document.documentElement.scrollWidth,
  }))
  expect.soft(medida.contenido, `La página se sale ${medida.contenido - medida.ancho}px`).toBeLessThanOrEqual(medida.ancho + 1)
}

async function contenidoListo(page: Page, ruta: string) {
  // El contenedor aparece antes que los datos: capturarlo entonces sólo
  // demostraría que existe un spinner, no que la agenda/identidad se cargaron.
  if (ruta === '/dashboard') await expect(page.locator('.hoy .cita-fila').first()).toBeVisible({ timeout: 30_000 })
  if (ruta === '/calendario') await expect(page.locator('.nx-agenda-bloque').first()).toBeVisible({ timeout: 30_000 })
  if (ruta === '/consulta/pac-001') await expect(page.locator('h1.nx-vt-paciente')).toHaveText('Rosalía Mendieta Cuevas', { timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
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
      await info.attach(`acceso-${tema}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' })
      if (info.project.name === 'iphone-safari') {
        await page.setViewportSize({ width: 320, height: 740 })
        await sinDesborde(page)
        await info.attach(`acceso-320-${tema}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' })
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
        await contenidoListo(page, ruta)
        await sinDesborde(page)
        await info.attach(`${ruta.replaceAll('/', '-')}-${tema}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
        if (info.project.name === 'iphone-safari') {
          await page.setViewportSize({ width: 320, height: 740 })
          await sinDesborde(page)
          await info.attach(`${ruta.replaceAll('/', '-')}-320-${tema}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
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

test('cambiar de paciente conserva cada borrador en su propio expediente', async ({ page, browserName }) => {
  // Una sola ejecución con escritura para no enfrentar dos sesiones artificiales
  // sobre los mismos pacientes sembrados. El resto de esta matriz sólo lee.
  test.skip(browserName !== 'chromium', 'La matriz visual ya cubre ambos motores')
  test.setTimeout(120_000)
  await entrar(page)
  await page.goto('/consulta/pac-001')
  await contenidoListo(page, '/consulta/pac-001')
  const campo = page.locator('#consulta-nota textarea[aria-label]').first()
  await expect(campo).toBeEditable()
  const etiqueta = await campo.getAttribute('aria-label')
  expect(etiqueta).toBeTruthy()
  const textoA = 'QA sintética: contenido exclusivo del primer expediente.'
  const textoB = 'QA sintética: contenido exclusivo del segundo expediente.'
  await campo.fill(textoA)

  async function abrirDesdeDirectorio(nombre: string, id: string) {
    // Navegación real dentro de la app: conserva los proveedores en memoria.
    // page.goto entre pacientes recargaría todo y ocultaría una contaminación.
    await page.locator('a[href="/pacientes"]:visible').first().click()
    await expect(page).toHaveURL(/\/pacientes$/)
    // El directorio abre en Recientes: un paciente sin consulta atendida puede
    // no estar ahí. Buscarlo usa el flujo real, sin alterar la siembra.
    await page.getByRole('textbox', { name: 'Buscar un paciente por nombre, teléfono, correo o CURP' }).fill(nombre)
    await page.getByRole('button', { name: `Abrir el expediente de ${nombre}`, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/expediente/${id}$`))
    await page.getByRole('button', { name: 'Nueva consulta', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/consulta/${id}$`))
    await expect(page.locator('h1.nx-vt-paciente')).toHaveText(nombre)
    return page.locator('#consulta-nota').getByRole('textbox', { name: etiqueta!, exact: true })
  }

  const campoB = await abrirDesdeDirectorio('Aurelio Barquín Salcedo', 'pac-002')
  await expect(campoB).toBeEditable()
  await expect(campoB).not.toHaveValue(textoA)
  await campoB.fill(textoB)

  const regresoA = await abrirDesdeDirectorio('Rosalía Mendieta Cuevas', 'pac-001')
  await expect(regresoA).toHaveValue(textoA)
  await expect(regresoA).not.toHaveValue(textoB)
})
