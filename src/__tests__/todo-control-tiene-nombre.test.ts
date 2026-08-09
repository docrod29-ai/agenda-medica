/**
 * TODO CONTROL TIENE NOMBRE, Y SE ALCANZA CON EL TECLADO — V9 · A11Y-GATE-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * **Doce botones de sólo icono sin nombre accesible.** Para quien usa lector de
 * pantalla se anuncian «botón» y nada más: no hay forma de saber qué hacen sin
 * pulsarlos. Y algunos borran cosas.
 *
 * | Dónde | Qué botón |
 * |---|---|
 * | consulta | quitar diagnóstico · quitar medicamento (papelera) |
 * | orden | quitar estudio |
 * | calendario · citas | avanzar y retroceder el periodo |
 * | pacientes | limpiar la búsqueda |
 * | nota · laboratorios | cerrar el diálogo |
 * | **reseña del paciente** | **las cinco estrellas de la valoración** |
 *
 * El último es de cara al paciente: cinco botones idénticos y sin nombre, que es
 * justamente la pantalla donde no hay un profesional que pueda deducir el resto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `A11Y-GATE-001` de V9 midió la línea base: **1 prueba de accesibilidad entre
 * 540**, y era una expresión regular sobre `layout.tsx`. Al escribir el
 * instrumento aparecieron los doce.
 *
 * Y apareció algo más: el primer intento, hecho con `grep`, dio **65** botones
 * «sin nombre». Cuarenta eran falsos —el texto vivía dentro de un
 * `{cargando ? … : 'Guardar'}`—, así que se tiró y se rehízo parseando con el
 * compilador de TypeScript, que ya es dependencia del proyecto. Un guardián que
 * señala 65 casos de los que 40 son mentira **enseña a ignorarlo**: es la lección
 * de REG-245 y de REG-291, ya escrita dos veces en este repositorio.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * Un icono **parece** que se explica solo a quien lo ve. El defecto no es
 * descuido: es que la pantalla se revisa mirándola, y mirándola el icono de
 * papelera es obvio. Sólo deja de serlo cuando no se mira — y eso no aparece en
 * ninguna revisión visual, por buena que sea.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Techo CERO, y se queda en cero.** No es un trinquete que baja despacio como
 * el de diseño: no quedaba ninguno, así que cualquier caso nuevo es deuda nueva y
 * el arreglo cuesta un atributo. Igual que la píldora de `--r-pill`, que también
 * se llevó a cero porque podía llegarse.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * El medidor se prueba con los defectos metidos a mano —el botón de sólo icono,
 * el `<div onClick>` sin teclado— y también con los casos que NO debe señalar:
 * el botón con texto dentro de una expresión, el fondo de un diálogo y la
 * fontanería `stopPropagation`. Las dos direcciones, porque un guardián que sólo
 * se ha visto pasar no se ha probado, y uno que grita de más se acaba silenciando.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No es `axe`.** No ve el árbol de accesibilidad renderizado, ni el orden de
 *   foco real, ni una etiqueta que apunte a un `id` inexistente. `axe` sobre el
 *   producto corriendo sigue pendiente: sin credenciales de Firebase este entorno
 *   no puede levantarlo.
 * - **Un nombre que viene de una variable no se juzga** (`{etiqueta}`): podría
 *   ser texto y podría no serlo. Señalar de menos, nunca de más — y eso significa
 *   que ese caso **no se vigila**, no que esté bien (regla 5 de seguridad clínica
 *   dicha en lenguaje de interfaz).
 * - **No juzga la CALIDAD del nombre.** `aria-label="botón"` pasaría. Que diga
 *   algo útil es criterio, y el criterio no sale de un `grep`.
 * - No mide contraste (`el-contraste-esta-medido.test.ts`) ni tamaño del objetivo
 *   táctil, que exige medir cajas en un navegador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { medir, medirTexto } from '../../scripts/a11y/trinquete-de-accesibilidad.mjs'

const TECHO = join(process.cwd(), 'docs', 'design', 'a11y-techo.json')

describe('el medidor señala lo que debe (probado al revés)', () => {
  it('un botón de sólo icono, sin nombre, se señala', () => {
    expect(medirTexto('<button onClick={borrar}><Trash2 size={14} /></button>').sinNombre).toBe(1)
  })

  it('con aria-label deja de señalarse', () => {
    expect(
      medirTexto('<button onClick={borrar} aria-label="Quitar medicamento"><Trash2 size={14} /></button>').sinNombre,
    ).toBe(0)
  })

  it('un botón cuyo texto vive dentro de una expresión NO se señala', () => {
    /**
     * Éste es el caso que hundió la primera versión: 40 falsos positivos de 65.
     * El texto está dentro de un ternario y dentro de un fragmento anidado.
     */
    const codigo = "<button onClick={g}>{cargando ? <><Loader2 size={14} />Guardando…</> : 'Guardar'}</button>"
    expect(medirTexto(codigo).sinNombre).toBe(0)
  })

  it('un botón cuyo contenido es una variable NO se juzga', () => {
    // Podría ser texto y podría no serlo. Señalar de menos, nunca de más.
    expect(medirTexto('<button onClick={g}>{etiqueta}</button>').sinNombre).toBe(0)
  })

  it('un div con onClick y sin teclado se señala', () => {
    expect(medirTexto('<div onClick={abrir}>Ver paciente</div>').noEsControl).toBe(1)
  })

  it('el mismo div con role, tabIndex y teclado NO se señala', () => {
    const codigo = '<div role="button" tabIndex={0} onClick={abrir} onKeyDown={k}>Ver paciente</div>'
    expect(medirTexto(codigo).noEsControl).toBe(0)
  })

  it('el ayudante `activable()` cuenta como hecho bien', () => {
    /**
     * `src/lib/ui/activable.ts` devuelve `role`, `tabIndex`, `aria-label` y
     * `onKeyDown` de una vez. La primera versión de este guardián lo señalaba
     * —sólo miraba atributos escritos a mano— y así castigaba la solución que el
     * propio repositorio inventó. Mismo defecto que REG-291.
     */
    expect(medirTexto('<div {...activable(abrir, { etiqueta: "Cita" })}>Cita</div>').noEsControl).toBe(0)
  })

  it('el fondo de un diálogo y la fontanería de eventos NO se señalan', () => {
    const fondo = "<div style={{ position: 'fixed', inset: 0 }} onClick={cerrar}>x</div>"
    const fontaneria = '<div onClick={e => e.stopPropagation()}>x</div>'
    const fontaneria2 = '<span onClick={e => { e.preventDefault(); e.stopPropagation() }}>x</span>'
    expect(medirTexto(fondo).noEsControl).toBe(0)
    expect(medirTexto(fontaneria).noEsControl).toBe(0)
    expect(medirTexto(fontaneria2).noEsControl).toBe(0)
  })
})

describe('no queda ningún control sin nombre ni ninguno fuera del teclado', () => {
  it('el techo existe y es CERO', () => {
    expect(existsSync(TECHO)).toBe(true)
    /**
     * Cero y no un techo que baja: no quedaba ninguno, así que cualquier caso
     * nuevo es deuda nueva y el arreglo cuesta un atributo. Subir este número es
     * exactamente lo que esta prueba existe para impedir.
     */
    expect(JSON.parse(readFileSync(TECHO, 'utf8')).total).toBe(0)
  })

  it('la aplicación entera está en cero', () => {
    const { total, porArchivo } = medir()
    expect(Object.entries(porArchivo).map(([f, n]) => `${f}: ${n}`)).toEqual([])
    expect(total).toBe(0)
  })

  it('el medidor recorre código de verdad', () => {
    /**
     * Un cero puede significar «todo bien» o «no miré nada». Sin esta
     * comprobación, romper el recorrido del árbol dejaría la prueba en verde
     * para siempre — que es el modo de fallo más caro de un guardián.
     */
    const consulta = readFileSync(
      join(process.cwd(), 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'),
      'utf8',
    )
    // La consulta tiene botones de papelera CON nombre desde este cambio: el
    // medidor tiene que verlos y no contarlos.
    expect(consulta).toContain('aria-label="Quitar medicamento"')
    expect(medirTexto(consulta, 'consulta.tsx').sinNombre).toBe(0)
    expect(medirTexto('<button><X size={14} /></button>').sinNombre).toBe(1)
  })
})
