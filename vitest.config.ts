import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    /**
     * CINTURÓN ADEMÁS DE TIRANTES (unidad Nexus OS E0-08). El `include` de arriba ya
     * deja fuera `emulator/**`, pero esta config es la del GATE COMPARTIDO de todo el
     * programa (`npx vitest run src/__tests__/`) y corre en máquinas SIN Java. Si un
     * `include` más laxo en el futuro arrastrara los `*.emu.test.ts`, el gate se
     * pondría rojo en cualquier máquina sin emulador levantado y tumbaría el lote de
     * las demás unidades. `src/__tests__/emulador-config-guard.test.ts` vigila que
     * esta línea no desaparezca.
     */
    exclude: [...configDefaults.exclude, 'emulator/**'],
    setupFiles: ['./src/__tests__/setup.ts'],
    /**
     * La cobertura NUNCA se había medido: no existía este bloque ni el paquete.
     * Sin umbrales que rompan el build — el objetivo es poder mirar el número
     * (`npm run test:cobertura`) y ver si baja, no bloquear a nadie hoy.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/**/__tests__/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
