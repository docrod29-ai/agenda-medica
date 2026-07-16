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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
