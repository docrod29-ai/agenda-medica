import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * CONFIG APARTE para la suite del emulador (unidad Nexus OS E0-08).
 *
 * Por qué no reutilizar `vitest.config.ts`: esa config es la del GATE COMPARTIDO
 * (`npx vitest run src/__tests__/`) que corre en todas las máquinas del programa,
 * muchas sin Java. Si los specs del emulador entraran ahí, el gate se pondría rojo
 * en cualquier máquina sin emulador levantado y tumbaría el lote entero de las demás
 * unidades. Los dos mundos no se mezclan a propósito.
 *
 * Se lanza SOLO con `npm run test:emulador` (que a su vez lo envuelve en
 * `firebase emulators:exec`, un comando que TERMINA solo — nunca `emulators:start`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['emulator/**/*.emu.test.ts'],
    /**
     * Un solo emulador compartido: paralelizar ficheros contra el mismo projectId
     * produce carreras de siembra (`clearFirestore` de un fichero borra los datos del
     * otro) → flakiness. Y una prueba de seguridad flaky acaba desactivada, que es la
     * peor forma de perderla.
     */
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    /**
     * SIN setupFiles: `src/__tests__/setup.ts` inyecta variables NEXT_PUBLIC_FIREBASE_*
     * para el SDK cliente de la app. Aquí el SDK lo construye
     * `@firebase/rules-unit-testing` apuntando al emulador; esos stubs no aplican.
     */
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
