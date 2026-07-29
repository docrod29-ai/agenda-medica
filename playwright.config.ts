import { defineConfig, devices } from '@playwright/test'

/**
 * E2E con Playwright — smoke del camino PÚBLICO (sin login), corre contra la URL
 * que se le pase (por defecto producción). El camino clínico completo (con sesión)
 * se agrega cuando exista una cuenta de prueba dedicada (paso del Dr.).
 *
 * Uso:  npx playwright test                 → contra producción
 *       PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test  → local
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://agenda-medica-one.vercel.app',
    trace: 'on-first-retry',
  },
  /**
   * Servidor local OPCIONAL (unidad E0-10). Sin PLAYWRIGHT_LOCAL=1 no existe y
   * todo sigue corriendo contra `baseURL` como hasta ahora. Con él, la matriz de
   * seguridad puede probar el flip de la CSP sin desplegar nada:
   *
   *   npm run build && PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
   *     PLAYWRIGHT_ENFORCE=1 CSP_MODE=enforce npx playwright test e2e/seguridad.spec.ts
   *
   * (CSP_MODE se lee en el BUILD, así que el build previo debe llevar la variable.)
   */
  ...(process.env.PLAYWRIGHT_LOCAL === '1'
    ? {
        webServer: {
          command: 'npm run start',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
  // Matriz de navegadores: el mismo smoke corre en los motores reales que usan
  // médicos y pacientes. WebKit + Mobile Safari son clave porque muchos entran
  // desde iPhone (fallos que solo pasan en Safari no se ven en Chrome).
  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',       use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',        use: { ...devices['Desktop Safari'] } },
    { name: 'iphone-safari', use: { ...devices['iPhone 14'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
