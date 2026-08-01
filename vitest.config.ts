import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

/**
 * LA SUITE CORRE EN LA HORA DEL CONSULTORIO, NO EN LA DEL SERVIDOR.
 *
 * Se fija ANTES de que arranque vitest porque V8 lee la zona una sola vez, al
 * inicializar: ponerla dentro de un `beforeAll` no cambia nada, y una prueba que
 * cree estar comprobando husos horarios sin haberlos cambiado es peor que no
 * tenerla.
 *
 * Sin esto, el CI corría en UTC — una configuración que NINGÚN usuario tiene— y
 * ahí desaparece toda una familia de errores. El caso que lo destapó: una fecha
 * de nacimiento suelta se lee como medianoche UTC, así que en México caía el día
 * anterior y un niño nacido el 15 «cumplía años» el 14. En UTC eso no pasa, y la
 * prueba escrita para cazarlo pasaba en verde con el fallo vivo.
 *
 * México central es la zona del consultorio del dueño. Es más fiel que UTC para
 * todo lo demás también: cortes de caja, agenda y recordatorios.
 */
process.env.TZ = process.env.TZ_TESTS ?? 'America/Mexico_City'

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
