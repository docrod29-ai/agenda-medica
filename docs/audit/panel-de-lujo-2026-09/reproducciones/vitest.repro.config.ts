// Config de vitest para las REPRODUCCIONES de la auditoría (fuera de src/__tests__).
// Autocontenida: replica alias «@», setup y zona horaria de vitest.config.ts del repo,
// y SÓLO incluye esta carpeta (heredar la config del repo arrastraba la suite entera).
import { defineConfig } from 'vitest/config'
import path from 'path'
process.env.TZ = process.env.TZ_TESTS ?? 'America/Mexico_City'
const raiz = path.resolve(__dirname, '../../../..')
export default defineConfig({
  test: {
    environment: 'node',
    include: ['docs/audit/panel-de-lujo-2026-09/reproducciones/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: [path.join(raiz, 'src/__tests__/setup.ts')],
    testTimeout: 20_000,
  },
  resolve: { alias: { '@': path.join(raiz, 'src') } },
})
