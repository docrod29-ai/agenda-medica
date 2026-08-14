/**
 * RTC-05 (V15-ORIGINALITY-REDTEAM-001, registro canónico; RT-06 + ORT-14) —
 * los widgets flotantes se aquietan al grabar, salen del arco del pulgar en
 * móvil, y el tema tiene UNA fuente de verdad.
 *
 * ── AVISO: RTC-32 MOVIÓ PARTE DE LO QUE ESTE GUARDIÁN MEDÍA ─────────────────
 *
 * Este guardián nació cuando el escritorio conservaba los dos FAB a propósito
 * (ver «QUÉ NO CUBRE» abajo, que lo declaraba). RTC-32 midió el escritorio y
 * los retiró: la ayuda vive en el pie del riel y el tema en Operaciones, en
 * TODOS los anchos. Los casos 3 y 4 se reescribieron para seguir al código —
 * el invariante que protegen (la capacidad se muda, no se ampu­ta; el evento se
 * declara una vez) es el mismo, y ahora se cumple más fuerte. La medida fina
 * del cromo flotante vive en `v15-rtc32-en-el-shell-nada-flota.test.ts`.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * El equipo rojo (13-ago-2026) midió DOS FAB permanentes sobre TODA pantalla
 * clínica: ayuda (52px, esquina del pulgar) + tema (44px, debajo). Ninguno
 * suscrito a `EVENTO_GRABANDO` — flotaban ENCIMA del modo encuentro mientras
 * §8.5 manda que lo no esencial desaparezca al grabar. En móvil ocluían
 * contenido en 4 de 6 superficies (defecto #7 de la DNA, intacto), el toggle
 * llevaba glassmorphism (backdrop-filter, la 2ª señal de genericidad), y la
 * convivencia se sostenía con parches por-pantalla de números mágicos
 * (bottom: 78/92/120/136px según la pantalla).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Los dos consumen la compuerta COMPARTIDA `@/hooks/useGrabando` (RTC-04)
 *    — no una copia privada (familia `depende_de_recordar`) — y devuelven
 *    null mientras el micrófono está abierto. Vuelven al detener.
 * 2. En móvil (≤768px) NINGÚN FAB flota sobre trabajo clínico: la ayuda vive
 *    en la topbar (estática: cero oclusión, fuera del arco del pulgar) y el
 *    tema vive en Operaciones (§11: es sistema, no trabajo clínico).
 * 3. El nombre del evento que abre la ayuda se declara UNA vez
 *    (`EVENTO_ABRIR_AYUDA` en BotonAyuda) y el layout lo importa — la
 *    lección de `estoy-grabando`: una cadena repetida en dos archivos es una
 *    compuerta que se abre sola.
 * 4. El tema tiene UNA fuente de verdad (`@/hooks/useTema`): la llave de
 *    localStorage vive sólo ahí; ThemeToggle (flotante, escritorio) y la fila
 *    de Operaciones son dos VISTAS del mismo estado, sincronizadas por
 *    evento.
 * 5. El toggle no lleva glassmorphism: fondo sólido del sistema.
 *
 * Probado al revés: contra el árbol previo a este cambio fallan los casos
 * 1, 2, 3, 4, 5 y 6 (verificado en esta corrida antes de aplicar el arreglo).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · La oclusión PINTADA y el aquietado real los mide el arnés de navegador
 *   (`capturar-pulgar-y-fabs-v15.mjs`) despachando `nx:grabando` de verdad.
 * · No cubre la acción central del BottomNav (RTC-07, guardián hermano).
 * · Ya NO deja fuera el escritorio: ese hueco («no juzga si la ayuda merece
 *   FAB en escritorio») lo cerró RTC-32 midiéndolo, y su guardián es
 *   `v15-rtc32-en-el-shell-nada-flota.test.ts`. Se deja escrito aquí porque
 *   este texto fue durante un día la única razón por la que nadie lo miraba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const AYUDA = readFileSync(join(process.cwd(), 'src/components/BotonAyuda.tsx'), 'utf8')
const TOGGLE = readFileSync(join(process.cwd(), 'src/components/ThemeToggle.tsx'), 'utf8')
const LAYOUT = readFileSync(join(process.cwd(), 'src/app/(dashboard)/layout.tsx'), 'utf8')
const OPERACIONES = readFileSync(join(process.cwd(), 'src/app/(dashboard)/operaciones/page.tsx'), 'utf8')
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('RTC-05 — los FAB se aquietan al grabar y salen del arco del pulgar', () => {
  it('1 · BotonAyuda consume la compuerta compartida y se aquieta al grabar', () => {
    expect(AYUDA).toMatch(/import \{ useGrabando \} from '@\/hooks\/useGrabando'/)
    expect(AYUDA).toMatch(/if \(grabando\) return null/)
  })

  it('2 · ThemeToggle consume la MISMA compuerta — no una copia privada', () => {
    expect(TOGGLE).toMatch(/import \{ useGrabando \} from '@\/hooks\/useGrabando'/)
    expect(TOGGLE).toMatch(/if \(grabando\) return null/)
    // Sin copia privada del listener: la compuerta es el hook.
    expect(TOGGLE).not.toContain('EVENTO_GRABANDO')
  })

  it('3 · la ayuda no flota y su trigger es estático — el evento se declara UNA vez', () => {
    // RTC-32: el FAB ya no existe (antes bastaba con ocultarlo ≤768px).
    expect(AYUDA).not.toContain('boton-ayuda-fab')
    // El layout usa la pieza compartida, que trae el evento y la compuerta
    // dentro: ningún consumidor teclea la cadena del evento.
    expect(LAYOUT).toMatch(/import \{ BotonAyuda, DisparadorAyuda \} from '@\/components\/BotonAyuda'/)
    expect(LAYOUT).not.toContain("'nx:abrir-ayuda'")
    // …y BotonAyuda lo declara UNA vez y lo escucha.
    expect(AYUDA).toMatch(/export const EVENTO_ABRIR_AYUDA = 'nx:abrir-ayuda'/)
    expect(AYUDA).toMatch(/addEventListener\(EVENTO_ABRIR_AYUDA/)
  })

  it('4 · el tema no flota en el shell: vive en Operaciones (§11)', () => {
    // El toggle flotante se oculta en el shell (donde hay BottomNav). RTC-32
    // le quitó la media query: el alcance subió de «shell móvil» a «shell».
    const idx = CSS.indexOf('body:has(.bottom-nav-wrap) .theme-toggle { display: none; }')
    expect(idx).toBeGreaterThan(-1)
    // …y Operaciones ofrece el control con el MISMO estado compartido.
    expect(OPERACIONES).toMatch(/import \{ useTema \} from '@\/hooks\/useTema'/)
  })

  it('5 · el tema tiene UNA fuente de verdad: la llave vive sólo en useTema', () => {
    const fuentes = ['src/hooks/useTema.ts', 'src/components/ThemeToggle.tsx',
      'src/app/(dashboard)/operaciones/page.tsx']
    const conLlave = fuentes.filter(f =>
      readFileSync(join(process.cwd(), f), 'utf8').includes("'nexusmed.theme'"))
    expect(conLlave).toEqual(['src/hooks/useTema.ts'])
    expect(TOGGLE).toMatch(/import \{ useTema \} from '@\/hooks\/useTema'/)
  })

  it('6 · el toggle no lleva glassmorphism y el parche móvil de números mágicos murió', () => {
    // Ancla en el bloque del componente (hay `.theme-toggle` en selectores
    // compuestos antes — push-optin — que no son este bloque).
    const desde = CSS.indexOf('ThemeToggle component')
    expect(desde).toBeGreaterThan(-1)
    const bloque = CSS.slice(desde, CSS.indexOf('.theme-toggle:hover'))
    expect(bloque).not.toContain('backdrop-filter')
    // El parche móvil del lienzo de chat (bottom: 136px) era la convivencia
    // FAB×composer×BottomNav: sin FAB móvil, no hay convivencia que parchar.
    expect(CSS).not.toContain('bottom: 136px')
  })
})
