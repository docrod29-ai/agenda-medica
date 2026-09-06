// Config de vitest para las REPRODUCCIONES de la auditoría (fuera de src/__tests__).
// Hereda todo de la config del repo y sólo cambia el `include`.
import { mergeConfig, defineConfig } from 'vitest/config'
import base from '../../../../vitest.config'
export default mergeConfig(base, defineConfig({
  test: { include: ['docs/audit/panel-de-lujo-2026-09/reproducciones/**/*.test.ts'], exclude: ['**/node_modules/**'] },
}))
