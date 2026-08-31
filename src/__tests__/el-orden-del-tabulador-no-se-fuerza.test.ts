/**
 * GOLDEN — nadie fuerza el orden del tabulador con un `tabindex` positivo.
 *
 * ── CÓMO SE LLEGÓ AQUÍ ──────────────────────────────────────────────────────
 *
 * Yendo a por el criterio 2.4.3 de WCAG (orden del foco), que este carril no
 * había mirado: se había probado que el foco **no se escapa** de un diálogo
 * (unidades 48–51), nunca que el **orden** tenga sentido.
 *
 * ── LO QUE SE PUEDE AFIRMAR, Y LO QUE NO ────────────────────────────────────
 *
 * Se puede afirmar esto: **no hay un solo `tabindex` positivo en el árbol**. Los
 * diez que existen son `-1` (ocho: cajas de diálogo que reciben el foco inicial)
 * y `0` (dos: elementos que entran en el orden natural). Ninguno lo **reordena**.
 *
 * Y eso importa porque un `tabindex` positivo es el defecto clásico de 2.4.3:
 * saca a un control de su sitio y lo mete antes que todo lo demás, de forma que
 * el orden del teclado deja de parecerse a lo que se ve. Es fácil de escribir,
 * invisible con el ratón, y sólo se nota cuando ya hay diez.
 *
 * Lo que **no** se puede afirmar es que el orden completo sea el correcto en
 * cada pantalla. Se intentó recorriendo con Tab y comparando posiciones, y el
 * método **no es fiable**: ver abajo.
 *
 * ── POR QUÉ EL RECORRIDO CON TAB NO SIRVIÓ ──────────────────────────────────
 *
 * En `/finanzas` la sonda informó un salto hacia atrás —«Anular (y=844) →
 * Anular (y=683)»— que parecía un orden roto en la tabla de cobros. No lo era, y
 * costó tres intentos:
 *
 *  1. Primero lo di por defecto del producto.
 *  2. Luego lo achaqué al desplazamiento de la ventana y pasé a coordenadas de
 *     documento. **Los números no cambiaron**: `window.scrollY` era 0.
 *  3. La causa real: los botones viven en un `div` con scroll **propio**, que se
 *     desplaza al mover el foco. Ni la ventana ni `scrollY` saben de eso.
 *
 * Leídos directamente, los doce botones están en y = 1552 … 2193, **estrictamente
 * crecientes**. El orden era correcto desde el principio.
 *
 * Así que el orden queda **NOT_PROVEN** en general y comprobado a mano en la
 * pantalla donde saltó la sospecha. Lo que sí queda vigilado es el `tabindex`
 * positivo, que es la causa que sí se puede cazar leyendo.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Poniendo `tabIndex={1}` en cualquier componente, cae nombrando el archivo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El orden en sí. Dicho arriba, y es la parte grande.
 * · `tabindex` puesto desde JavaScript (`el.tabIndex = 3`): no se busca.
 * · No mira `e2e/` ni los guiones del arnés, que no son producto.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/** `tabIndex={7}` en JSX o `tabindex="7"` en HTML. Cero y -1 son legítimos. */
const POSITIVO = String.raw`tabIndex=\{[1-9]|tabindex="[1-9]`

function positivos(): string[] {
  const salida = execSync(
    `grep -rnE '${POSITIVO}' src --include=*.tsx --include=*.ts || true`,
    { encoding: 'utf8' },
  ).trim()
  return salida ? salida.split('\n').filter(l => !l.includes('__tests__')) : []
}

describe('el orden del tabulador es el del documento', () => {
  it('ningún `tabindex` positivo saca un control de su sitio', () => {
    const malos = positivos()
    expect(
      malos,
      'un `tabindex` positivo reordena el teclado y deja de parecerse a lo que se ve:\n' +
      malos.join('\n'),
    ).toEqual([])
  })

  it('el barrido encuentra los `tabindex` que SÍ hay, o no está mirando nada', () => {
    // Sin esto, un `grep` que no case con nada haría pasar el caso de arriba
    // para siempre — incluido el día que alguien escriba `tabIndex={3}`.
    const todos = execSync(
      `grep -rhoE 'tabIndex=\\{-?[0-9]+\\}' src --include=*.tsx || true`,
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    expect(todos.length, 'el barrido no encuentra ningún tabIndex: ¿sigue mirando el árbol?')
      .toBeGreaterThan(5)
    // Y todos los que hay son de los dos legítimos.
    for (const t of todos) expect(t).toMatch(/tabIndex=\{(-1|0)\}/)
  })
})
