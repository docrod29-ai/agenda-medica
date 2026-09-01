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
     * EL TOPE POR CASO NO MIDE NADA CLÍNICO — MIDE LA CARGA DE LA MÁQUINA.
     *
     * ── QUÉ FALLABA ──────────────────────────────────────────────────────────
     *
     * Con el defecto de vitest (5 s) la suite completa fallaba de forma
     * intermitente, en archivos distintos cada vez y sin que nadie hubiera
     * tocado nada. Medido en tres vueltas seguidas del 31-ago-2026:
     *
     *     vuelta 1  la-agenda-es-un-riel.test.ts
     *     vuelta 2  (verde)
     *     vuelta 3  la-agenda-es-un-riel.test.ts  +  tope-creditos.test.ts
     *
     * Y el error NO era una aserción. Era siempre el mismo:
     *
     *     Error: Test timed out in 5000ms.
     *       ❯ la-agenda-es-un-riel.test.ts:123
     *         await import('../app/(dashboard)/citas/page')
     *       ❯ tope-creditos.test.ts:60
     *         await import('@/lib/ai-keys')
     *
     * ── LA CAUSA ─────────────────────────────────────────────────────────────
     *
     * 52 archivos de prueba hacen `await import(...)` DENTRO del `it()`. Ese
     * import transforma y carga un grafo entero —`citas/page.tsx` arrastra Next,
     * Firebase e iconos— y su coste cae dentro de la ventana del caso. Con 841
     * archivos peleándose la CPU, pasar de 5 s no es raro: es cuestión de qué
     * trabajador tuvo mala suerte.
     *
     * ── POR QUÉ SUBIR EL TOPE NO ES TAPAR NADA ───────────────────────────────
     *
     * Ninguna de esas pruebas afirma que un import sea rápido. No hay una sola
     * aserción sobre latencia en toda la suite. El tope existe para que un caso
     * COLGADO no cuelgue el lote, y a 20 s sigue haciendo exactamente eso: un
     * bucle infinito o una promesa que nunca resuelve siguen fallando. Lo único
     * que se quita es que el runner llame «fallo» a una máquina ocupada.
     *
     * La alternativa era convertir a import estático los 29 archivos que no usan
     * `vi.mock` (los otros 23 lo necesitan para que el mock se aplique antes).
     * Son 29 diffs en pruebas que hoy funcionan, para arreglar lo mismo que
     * arregla esta línea. Se eligió la línea.
     *
     * `el-tope-por-caso-no-mide-la-maquina.test.ts` vigila que no vuelva a 5 s.
     */
    testTimeout: 20_000,
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
