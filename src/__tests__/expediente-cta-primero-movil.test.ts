/**
 * EL CTA PRIMARIO DEL EXPEDIENTE VA PRIMERO EN EL TELÉFONO — V10-DEBT-006.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * Captura `expediente--390.png` del arnés V10 (9-ago-2026, pacientes
 * sintéticos sembrados): bajo 480px la regla global `.actions-row` apila cada
 * botón a fila completa EN ORDEN DOM, y el orden DOM del expediente ponía el
 * primario al final (a la derecha en escritorio). Resultado en móvil: «Nueva
 * consulta con IA» — la acción que arranca el flujo dorado — quedaba en CUARTO
 * lugar, debajo de Carta de referencia, Expediente completo y FHIR, tres
 * secundarios de idéntico peso visual. V10 §8.3: «One primary action per
 * visual region»; §48: «THE NEXT SAFE ACTION IS OBVIOUS» — no lo era.
 *
 * ── QUÉ CAMBIÓ, Y POR QUÉ ESTE GUARDIÁN SIGUE VIVO ──────────────────────────
 *
 * El arreglo original fue una rejilla de 2 columnas (`exp-actions`) que subía
 * al primario a la primera fila completa. Después:
 *
 *   · **RTC-10** (14-ago) bajó los TRES secundarios de documentos al final de
 *     la página, con nombre propio. La rejilla quedó ordenando un solo botón.
 *   · **RTC-31** (14-ago, 5ª rebanada) midió esa fila —43px + 24px de margen
 *     con **720px sin usar a su izquierda** sobre los tres expedientes
 *     sembrados— y subió el primario al **ancla del paciente**. La fila murió,
 *     y con ella su rejilla.
 *
 * **El invariante NO murió**: «el primario es lo primero que encuentra el
 * pulgar» sigue siendo la regla, y ahora se cumple mejor —el botón está más
 * arriba, a 44px y a todo el ancho, justo bajo la identidad—. Lo que cambia es
 * DÓNDE se comprueba. Un guardián que se borra porque su código se movió deja
 * de proteger justo cuando el código es más frágil.
 *
 * ── LA REGLA QUE LO HACE SEGURO, HOY ────────────────────────────────────────
 *
 * En el teléfono el primario vive en `.nx-ancla-accion-movil`: fila completa,
 * 44px de alto mínimo, y **después del aviso de alergias**. Ese orden no es
 * estético — en un ancho donde todo va en columna el orden ES la jerarquía, y
 * lo único que hay que leer antes de empezar a atender es el aviso. La primera
 * versión de RTC-31 metió la acción entre el nombre y las alergias; se vio en
 * la captura, no en el código.
 *
 * En escritorio el primario va en la fila del nombre (172px libres medidos a su
 * derecha) y el aviso conserva su renglón entero. Sólo uno de los dos sitios se
 * pinta a cada ancho: dos primarios idénticos a la vez serían dos veces la
 * misma acción (medido: 1 de 2 visible en los dos anchos).
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * 9-ago-2026, versión de rejilla: los 4 casos fallaban sin el arreglo.
 * 14-ago-2026, versión de ancla: quitando el slot móvil falla el caso 2;
 * poniéndolo antes del aviso de alergias falla el 3; quitando el mínimo táctil
 * falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * Es un barrido de FUENTE: no mide lo que pinta el navegador — eso lo hace
 * `scripts/design/medir-primario-del-expediente-v15.mjs`, cuyas actas
 * (`docs/design/capturas/v15-rtc31-primario{,-despues}/medicion.json`) traen el
 * antes y el después. **No cubre el caso de un encuentro SIN CERRAR**: ninguno
 * de los tres expedientes sembrados lo tiene, así que la convivencia del
 * primario con «Consulta sin cerrar — continuar» en la misma fila no se ha
 * medido en navegador. Queda declarado como hueco del arnés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const pagina = () => leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const ancla = () => leer('src/components/expediente/PatientAnchor.tsx')

describe('V10-DEBT-006 · el CTA primario del expediente va primero en móvil', () => {
  it('1 · la acción primaria la porta el ancla del paciente, no una fila propia', () => {
    const src = pagina()
    expect(src, 'volvió la fila propia que RTC-31 midió vacía').not.toMatch(/className="actions-row exp-actions"/)
    expect(src).toMatch(/accion=\{/)
    expect(src).toMatch(/<Mic size=\{16\} \/> Nueva consulta/)
  })

  it('2 · en el teléfono ocupa su propia fila completa, con 44px para el pulgar', () => {
    const src = ancla()
    expect(src).toContain('className="nx-ancla-accion-movil"')
    expect(src).toMatch(/\.nx-ancla-accion-movil > button \{ width: 100%; justify-content: center; min-height: 44px; \}/)
  })

  it('3 · y va DESPUÉS del aviso de alergias: el orden es la jerarquía', () => {
    const src = ancla()
    const aviso = src.indexOf('<strong>Alergias:</strong>')
    const slot = src.indexOf('className="nx-ancla-accion-movil"')
    expect(aviso).toBeGreaterThan(0)
    expect(slot, 'la acción se metió entre el paciente y sus alergias').toBeGreaterThan(aviso)
  })

  it('4 · sólo uno de los dos sitios se pinta a cada ancho', () => {
    // Dos primarios idénticos a la vez serían dos veces la misma acción.
    const src = ancla()
    expect(src).toMatch(/@media \(max-width: 768px\)\s*\{\s*\.nx-ancla-accion \{ display: none; \}/)
    expect(src).toMatch(/@media \(min-width: 769px\)\s*\{\s*\.nx-ancla-accion-movil \{ display: none; \}/)
  })

  it('5 · los tres secundarios de documentos siguen fuera del primer viewport (RTC-10)', () => {
    // La mitad del hallazgo original: el primario no puede volver a compartir
    // peso con Carta de referencia, Expediente completo y FHIR.
    const src = pagina()
    expect(src.indexOf('Documentos y exportación')).toBeGreaterThan(src.indexOf('<DatosPaciente'))
  })
})
