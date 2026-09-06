/**
 * LA FILA DE CITA DE «HOY» SE TOCABA EN 39 PÍXELES — REG-442.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando `/dashboard` —la primera pantalla que ve el médico al entrar— a
 * 390 px. La pantalla salía limpia en todo lo demás: cero recortes, cero campos
 * sin etiqueta, cero errores de consola. Y seis enlaces a **354×39**, cinco por
 * debajo del mínimo táctil, uno detrás de otro.
 *
 * ── POR QUÉ ÉSTE Y NO OTRO ──────────────────────────────────────────────────
 *
 * No es un enlace de navegación ni un aviso: **cada fila abre un paciente**. Un
 * toque que cae entre dos filas no lleva a una página equivocada — abre el
 * **expediente equivocado**, que es el defecto que el equipo rojo de este
 * repositorio persigue por su nombre.
 *
 * ── EL MECANISMO YA EXISTÍA, Y ESTE ENLACE ERA EL QUE DECLARÓ QUE FALTABA ────
 *
 * `globals.css` tiene, bajo `@media (pointer: coarse)`, una familia de enlaces
 * que estiran su **área de golpe** con un pseudo invisible sin mover un píxel de
 * lo visible: `a.nx-ident`, `.nx-cta-aviso`, `.nx-enlace-tactil`. Su guardián
 * (`v15-a11y-tactiles-de-enlace`) dejó escrito lo que NO cubría:
 *
 *     «un enlace nuevo con otra clase no está vigilado por esto»
 *
 * `.cita-principal` era exactamente ese enlace. Se añade a la familia en vez de
 * inventarle un mecanismo propio.
 *
 * ── MEDIDO CON HIT-TESTING, NO CON `getBoundingClientRect` ──────────────────
 *
 *     visible  39   golpe  45      (×4 filas de 30 min)
 *     visible  58   golpe  60
 *     visible  78   golpe  81
 *
 * La caja del enlace **sigue midiendo 39** con el arreglo puesto, y así debe
 * ser: lo que cambia es a quién atribuye el navegador un punto. Medirlo con
 * `getBoundingClientRect` habría dicho «no funciona».
 *
 * ── TRES TRAMPAS, Y LAS TRES ESTABAN EN MI MEDICIÓN ─────────────────────────
 *
 * Estuve convencido de que el arreglo no servía. No era el arreglo:
 *
 *  1. **El recorrido de bienvenida tapaba las filas**: el hit-testing contestaba
 *     `DIV.nx-tour-card`. Tercera vez que ese modal contamina una medición en
 *     esta rama.
 *  2. **Las filas están bajo el pliegue** y `elementFromPoint` sólo ve dentro de
 *     la ventana: fuera devuelve `null`, el barrido corta al instante y el
 *     resultado es «el golpe mide lo mismo que la caja».
 *  3. **El pseudo de una fila alta mide su propio alto**, no 44: `max(100%,
 *     44px)`. Al medir la fila de 78 salió un pseudo de 78 y lo leí como avería.
 *
 * Las tres quedan cerradas en
 * `scripts/ausculta-transformacion/el-area-de-golpe-de-una-fila-de-cita.mjs`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de FUENTE.** Que el área de golpe mida 45 lo dice el
 *   navegador, y esa sonda **no corre en CI**: necesita emuladores.
 * · **No se añadió al arnés `capturar-tactiles-de-enlace-v15`**, que es donde
 *   naturalmente iría. Se intentó y **no se pudo ejecutar**: usa su propia
 *   siembra y sus credenciales (`medico@capturas.demo`), que este contenedor no
 *   tiene. Se retiró en vez de dejar ahí código sin probar.
 * · **No es un iPhone.** Chromium a 390 px con puntero grueso — comprobado, no
 *   supuesto: la sonda verifica que `(pointer: coarse)` case.
 * · **No comprueba que el toque NAVEGUE al paciente correcto.** Sólo que el
 *   punto se atribuya al enlace. Entregar el tap y ver a dónde va es lo que hace
 *   el arnés grande, y por eso queda dicho arriba que no se pudo correr.
 * · **No mira el resto de `/dashboard`**: la tarjeta de la próxima cita, las
 *   tres tareas de «Siguiente acción» y el resumen quedan sin recorrer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
/** Sin comentarios: este arreglo se explica citando sus propios selectores. */
const SIN_COMENTARIOS = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** El bloque de puntero grueso, que es donde el estirón tiene sentido. */
function bloqueDePunteroGrueso(): string {
  const i = SIN_COMENTARIOS.indexOf('@media (pointer: coarse)')
  expect(i, 'ya no existe el bloque de puntero grueso').toBeGreaterThan(0)
  return SIN_COMENTARIOS.slice(i, i + 6000)
}

describe('la fila de cita se puede tocar sin abrir a otro paciente', () => {
  it('EL CASO: `.cita-principal` entra en la familia que estira el golpe', () => {
    /**
     * PROBADO AL REVÉS: quitando `.cita-principal` de la lista del pseudo, la
     * sonda vuelve a medir golpe 39. Medido: 39 → 45.
     */
    const bloque = bloqueDePunteroGrueso()
    expect(
      bloque,
      'la fila de cita salió de la familia del pseudo: vuelve a tocarse en 39 px, ' +
      'y cada fila abre un paciente distinto',
    ).toMatch(/\.cita-principal::before/)
  })

  it('y lleva el `position: relative` sin el cual el pseudo no se ancla', () => {
    /**
     * Las dos mitades hacen falta. Sin `position: relative` en el enlace, el
     * pseudo absoluto se ancla al primer ancestro posicionado y el estirón cae
     * en otro sitio — sin fallar nada visible.
     */
    const bloque = bloqueDePunteroGrueso()
    const i = bloque.indexOf('.cita-principal')
    const regla = bloque.slice(Math.max(0, i - 200), i + 120)
    expect(regla).toMatch(/position:\s*relative/)
  })

  it('el estirón vive SÓLO en puntero grueso', () => {
    /**
     * En escritorio el clic del ratón no necesita 44 px, y estirar el área
     * robaría clics de selección de texto — lo dice el propio bloque. Si la
     * regla se saliera de la media query, este caso cae.
     */
    const i = SIN_COMENTARIOS.indexOf('@media (pointer: coarse)')
    const antes = SIN_COMENTARIOS.slice(0, i)
    expect(
      antes,
      'el estirón se salió del bloque de puntero grueso: en escritorio robaría ' +
      'clics de selección de texto',
    ).not.toMatch(/\.cita-principal::before/)
  })

  it('y NO se le puso un `min-height`, que habría movido la fila', () => {
    /**
     * El atajo era `min-height: 44px` en el enlace. Habría engordado la fila
     * cinco píxeles por seis filas: treinta píxeles de agenda perdidos en la
     * primera pantalla, para arreglar algo que no se ve. El mecanismo del pseudo
     * existe precisamente para no pagar eso.
     */
    const bloque = bloqueDePunteroGrueso()
    const i = bloque.indexOf('.cita-principal::before')
    const regla = bloque.slice(i, i + 300)
    expect(regla).not.toMatch(/\.cita-principal\s*\{[^}]*min-height/)
  })
})
