/**
 * EL CTA PRIMARIO DEL EXPEDIENTE VA PRIMERO EN EL TELÉFONO — V10-DEBT-006.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * Captura `expediente--390.png` del arnés V10 (9-ago-2026, pacientes
 * sintéticos sembrados): bajo 480px la regla global `.actions-row` apila cada
 * botón a fila completa EN ORDEN DOM, y el orden DOM del expediente pone el
 * primario al final (a la derecha en escritorio). Resultado en móvil: «Nueva
 * consulta con IA» — la acción que arranca el flujo dorado — quedaba en CUARTO
 * lugar, debajo de Carta de referencia, Expediente completo y FHIR, tres
 * secundarios de idéntico peso visual. V10 §8.3: «One primary action per
 * visual region»; §48: «THE NEXT SAFE ACTION IS OBVIOUS» — no lo era.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `.actions-row` global (globals.css) hace `flex: 1 1 100%` bajo 480px: cada
 * botón una fila, sin noción de jerarquía. El orden correcto de escritorio
 * (primario a la derecha, o sea al FINAL del DOM) se convierte en el orden
 * incorrecto de móvil (primario al FONDO de la pila).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La página lleva `exp-actions`: bajo 480px pasa a rejilla de 2 columnas donde
 * el último hijo (el primario) sube a la primera fila completa (`order: -1` +
 * `grid-column: 1 / -1`) con objetivos táctiles de 44px. El DOM no cambia:
 * escritorio conserva primario-a-la-derecha y el orden de tabulación.
 * Es el mismo patrón que `nota-toolbar` (DEBT-009) — coherencia V10 §8.33.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Corrido contra el código sin el arreglo (git stash, 9-ago-2026): los 4
 * casos de la rejilla fallan. Con el arreglo pasan todos.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * Es un barrido de FUENTE: no mide lo que pinta el navegador (eso lo hacen las
 * capturas del arnés `tests/visual/`). No cubre la jerarquía de escritorio
 * (ahí el primario ya era el único botón relleno, a la derecha) ni el resto de
 * DEBT-006 (los círculos de icono de hoy-escritorio → V10-TODAY-001). El
 * orden de foco en móvil sigue al DOM (secundarios antes que el primario):
 * decisión deliberada para no romper el orden de tabulación de escritorio,
 * documentada aquí para que nadie la «arregle» rompiendo la otra mitad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const pagina = () =>
  readFileSync(join(process.cwd(), 'src/app/(dashboard)/expediente/[patientId]/page.tsx'), 'utf8')

describe('V10-DEBT-006 · el CTA primario del expediente va primero en móvil', () => {
  it('la fila de acciones lleva la clase de rejilla móvil exp-actions', () => {
    expect(pagina()).toMatch(/className="actions-row exp-actions"/)
  })

  it('bajo 480px las acciones pasan a rejilla de 2 columnas', () => {
    const src = pagina()
    expect(src).toMatch(/@media \(max-width: 480px\)[\s\S]{0,600}\.exp-actions\s*\{[^}]*display: grid/)
    expect(src).toMatch(/\.exp-actions\s*\{[^}]*grid-template-columns: 1fr 1fr/)
  })

  it('el primario (último hijo del DOM) sube a la primera fila completa', () => {
    const src = pagina()
    expect(src).toMatch(/\.exp-actions > button:last-child\s*\{[^}]*order: -1/)
    expect(src).toMatch(/\.exp-actions > button:last-child\s*\{[^}]*grid-column: 1 \/ -1/)
  })

  it('los objetivos táctiles miden 44px y no quedan celdas huérfanas', () => {
    const src = pagina()
    expect(src).toMatch(/\.exp-actions > button\s*\{[^}]*min-height: 44px/)
    expect(src).toMatch(/\.exp-actions > button:first-child\s*\{[^}]*grid-column: 1 \/ -1/)
  })

  it('el último hijo del DOM sigue siendo «Nueva consulta con IA» (si esto falla, la regla last-child apunta a otro botón)', () => {
    const src = pagina()
    // Dentro del div exp-actions, el botón con primaryBtn es el último antes
    // del cierre de la fila, y es el de Nueva consulta con IA.
    expect(src).toMatch(/primaryBtn\}>\s*<Mic size=\{16\} \/> Nueva consulta con IA\s*<\/button>\s*<\/div>/)
  })
})
