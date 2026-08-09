/**
 * UN CAMPO SIN NOMBRE NO EXISTE — V9 · A11Y-GATE-001 · REG-292.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * **La etiqueta que se ve no era la etiqueta que se oye.** En las pantallas del
 * paciente, el `<label>` se pintaba encima del campo y no lo señalaba: sin
 * `htmlFor`, sin `id`, sin envolverlo. A la vista, un formulario etiquetado.
 * Para un lector de pantalla, «cuadro de edición», en blanco, sin decir qué va
 * ahí. Y tocar la palabra «Teléfono» no enfocaba el campo — en móvil, toques
 * que no hacen nada.
 *
 * Nueve controles, en las cuatro pantallas donde el paciente **escribe**:
 *
 * | Dónde | Qué |
 * |---|---|
 * | `/reservar` | Los cuatro campos del alta: nombre, teléfono, correo, motivo. Es la primera pantalla que toca un paciente nuevo |
 * | `/privacidad/[clinicId]` | Los cinco campos de la solicitud **ARCO** y su descripción |
 * | `/resena` | El comentario, con sólo `placeholder`… y **las cinco estrellas**, que eran cinco botones sin nombre: un lector anunciaba «botón, botón, botón, botón, botón» y la única acción de la pantalla era imposible sin ver |
 * | `/mi/[token]` | El campo de fecha para reagendar, con un `<div>` por encabezado |
 *
 * ── POR QUÉ NO ES UN DETALLE ────────────────────────────────────────────────
 *
 * El de ARCO es el que más pesa. Ese formulario **es** el ejercicio de un
 * derecho reconocido por la LFPDPPP, con plazo legal de 20 días hábiles, y
 * `.claude/rules/data-privacy.md` dice que el acceso *se entrega*, no se
 * resuelve escribiendo un texto. Quien no puede ver es precisamente quien más
 * necesita poder pedir su expediente por escrito.
 *
 * Y hay una asimetría que V9 ya nombró: del lado del médico, un control sin
 * nombre lo sortea alguien que usa la pantalla ochenta veces al día. Del lado
 * del paciente, no. Por eso aquí la compuerta es **cero**, y en el resto de la
 * aplicación es un trinquete que sólo baja.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * La auditoría de `PATIENT-UX-TRUTH-001` había contado «41 botones sólo-icono y
 * sólo 4 con `aria-label`» y lo declaró **un suelo, no un techo**: la búsqueda
 * era una expresión regular y sólo cazaba hijos autocerrados. Al construir esta
 * compuerta con el parseador de TypeScript aparecieron los campos, que nadie
 * había contado — y son más y peores.
 *
 * ── EL INSTRUMENTO SE EQUIVOCÓ DOS VECES, Y ESO IMPORTA ─────────────────────
 *
 * Con expresiones regulares falló en **las dos direcciones** sobre estas mismas
 * pantallas: `<button onMouseEnter={() => …}>` corta la lista de atributos en el
 * `>` de la flecha y escondía el botón de estrella; y descartar las expresiones
 * marcaba como mudos cinco botones cuyo texto viene de una variable (`{s}`,
 * `{m.nombre}`, `{ARCO_TIPO_LABEL[t]}`).
 *
 * Un instrumento que se equivoca en las dos direcciones no mide: opina. Y la
 * lección de REG-245 es que **un guardián que grita de más se acaba
 * silenciando**, exactamente igual que una alerta clínica. Por eso el
 * analizador usa el parseador de verdad y, ante la duda, decide a favor de
 * «tiene nombre».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo control interactivo de la superficie del paciente tiene nombre
 * accesible. Un `placeholder` **no** cuenta: desaparece al escribir y la WCAG no
 * lo acepta como nombre único — es justo la trampa de esta base de código, donde
 * el campo se ve etiquetado y no lo está.
 *
 * Y el arreglo tiene que ser **verificable**. La primera versión del arreglo de
 * `/reservar` generaba el `id` con `useId()` y se lo inyectaba al hijo con
 * `cloneElement`: funcionaba, no había nada que recordar… y el guardián no podía
 * verlo. Se rehízo con el `id` escrito en las dos puntas. Un arreglo que la
 * compuerta no comprueba puede deshacerse en silencio.
 *
 * ── PROBADA AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el `htmlFor` de `/reservar`, o el `aria-label` de las estrellas, la
 * primera prueba falla nombrando archivo y línea. Está automatizado abajo: se
 * altera el fuente en memoria y se comprueba que el analizador lo caza.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Que el nombre sea BUENO.** `aria-label="botón"` pasa y no sirve.
 * - **Contraste, orden de foco, trampa de foco, `aria-live`, objetivo táctil.**
 *   Eso exige un navegador, y este contenedor no tiene credenciales para
 *   levantar la aplicación. `axe` sobre las pantallas corriendo sigue pendiente
 *   y está declarado en el backlog como `A11Y-AXE-001`. Esta compuerta es la
 *   red que faltaba, **no** la aprobación de ninguna pantalla.
 * - **Un `<label htmlFor>` que viva en otro archivo.** Se cuenta como sin
 *   nombre: señalar de menos aquí sería peor que una falsa alarma.
 * - **Controles hechos con `div` + `onClick`.** Son 16 en la aplicación y
 *   ninguno en la superficie del paciente; su barrido es otra unidad.
 * - **El resto de la aplicación no está arreglado**: 312 hallazgos congelados en
 *   `docs/audit/a11y-techo.json`, que sólo pueden bajar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
// El analizador vive en JS puro y lo comparten esta prueba y el script de
// consola (`npm run a11y`): una sola definición de qué cuenta como nombre.
import { medir, analizar, porClase, esDelPaciente, pantallas, RUTAS_DEL_PACIENTE } from '../../scripts/a11y/nombres-accesibles.mjs'

const RAIZ = process.cwd()
const TECHO = JSON.parse(readFileSync(join(RAIZ, 'docs/audit/a11y-techo.json'), 'utf8'))

interface Hallazgo { archivo: string; linea: number; clase: string; detalle: string }

const { paciente, resto } = medir() as { paciente: Hallazgo[]; resto: Hallazgo[] }

describe('un campo sin nombre no existe para quien no ve', () => {
  it('la superficie del paciente no tiene NINGÚN control sin nombre', () => {
    /**
     * Cero, no un techo. Es la superficie que V9 gobierna y la única donde
     * quien usa el lector de pantalla no conoce la pantalla de memoria.
     */
    expect(paciente.map((h) => `${h.archivo}:${h.linea} ${h.clase}`)).toEqual([])
  })

  it('el resto de la aplicación no añade deuda', () => {
    const actual = porClase(resto) as Record<string, number>
    const clases = [...new Set([...Object.keys(TECHO.resto), ...Object.keys(actual)])]
    const subieron = clases
      .filter((c) => (actual[c] ?? 0) > (TECHO.resto[c] ?? 0))
      .map((c) => `${c}: ${TECHO.resto[c] ?? 0} → ${actual[c] ?? 0}`)
    expect(subieron).toEqual([])
  })

  it('el techo no se queda alto cuando la deuda baja', () => {
    /**
     * La otra mitad del trinquete. Si el techo no se aprieta al arreglar algo,
     * el margen ganado se lo come el siguiente descuido sin que nadie se entere.
     */
    const actual = porClase(resto) as Record<string, number>
    const bajaron = Object.keys(TECHO.resto)
      .filter((c) => (actual[c] ?? 0) < TECHO.resto[c])
      .map((c) => `${c}: ${TECHO.resto[c]} → ${actual[c] ?? 0} — corre \`node scripts/a11y/nombres-accesibles.mjs --actualizar\``)
    expect(bajaron).toEqual([])
  })

  it('las nueve rutas del paciente siguen siendo las declaradas', () => {
    /**
     * La lista de rutas del paciente es **a mano**, igual que la del inventario
     * de pantallas y por la misma razón: una heurística falla en silencio, una
     * lista se queda corta de forma visible. Pero sólo si algo la vigila — una
     * ruta nueva del paciente que nadie añada aquí quedaría fuera de la
     * compuerta y nadie lo notaría.
     *
     * Se contrasta contra el único otro sitio del repositorio que enumera
     * superficie de paciente: las rutas con PHI.
     */
    const rutasPhi = readFileSync(join(RAIZ, 'src/lib/security/rutas-privadas.ts'), 'utf8')
      .match(/RUTAS_PACIENTE_CON_PHI[^=]*=\s*\[([^\]]*)\]/)?.[1]
    expect(rutasPhi, 'no se encontró RUTAS_PACIENTE_CON_PHI').toBeTruthy()
    const declaradas = [...rutasPhi!.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(declaradas.length).toBeGreaterThan(0)
    for (const r of declaradas) expect(RUTAS_DEL_PACIENTE).toContain(r)
  })

  it('el analizador CAZA el defecto cuando se devuelve — probado al revés', () => {
    /**
     * Un guardián que nunca se ha visto fallar no es un guardián. Aquí se le
     * mete el defecto de verdad, sobre el archivo real, y se comprueba que
     * suena. Las dos formas del defecto, porque son distintas:
     *
     *   1. el `htmlFor` que desaparece — el campo se queda huérfano;
     *   2. el `aria-label` que desaparece — el botón sólo-icono se queda mudo.
     */
    const conDefecto = (archivo: string, de: string, a: string) => {
      const ruta = join(RAIZ, archivo)
      const original = readFileSync(ruta, 'utf8')
      expect(original.includes(de), `el fuente ya no contiene «${de}»`).toBe(true)
      // En memoria: el disco no se toca, así que una prueba interrumpida no
      // puede dejar el repositorio con el defecto puesto.
      return analizar(ruta, original.replace(de, a)) as Hallazgo[]
    }

    const sinFor = conDefecto(
      'src/app/reservar/[clinicId]/page.tsx',
      '<label htmlFor={id}',
      '<label',
    )
    expect(sinFor.filter((h) => h.clase === 'campo-sin-etiqueta').length).toBe(4)

    const sinLabel = conDefecto(
      'src/app/resena/[token]/page.tsx',
      "aria-label={n === 1 ? '1 estrella' : `${n} estrellas`}",
      '',
    )
    expect(sinLabel.filter((h) => h.clase === 'boton-sin-nombre').length).toBe(1)
  })

  it('el analizador no grita de más: los botones con texto de variable pasan', () => {
    /**
     * La otra mitad de «probada al revés», y la que costó dos vueltas: cinco
     * botones de estas mismas pantallas tienen su texto en una variable
     * —`{s}` la hora, `{m.nombre}` el médico, `{ARCO_TIPO_LABEL[t]}` el derecho—
     * y una versión anterior del instrumento los marcaba a los cinco. Si esto
     * se rompe, el guardián vuelve a gritar de más y alguien lo silencia.
     */
    const conTextoDeVariable = analizar(join(RAIZ, 'src/app/reservar/[clinicId]/page.tsx')) as Hallazgo[]
    expect(conTextoDeVariable.filter((h) => h.clase.startsWith('boton'))).toEqual([])
  })

  it('la superficie del paciente que se analiza no está vacía', () => {
    /**
     * Una compuerta que no mide nada pasa siempre. Si un cambio de rutas dejara
     * `esDelPaciente` sin casar con nada, la primera prueba seguiría en verde
     * sobre cero archivos — el modo de fallo más silencioso que tiene un
     * guardián.
     */
    const archivos = (pantallas() as string[]).filter((f) => esDelPaciente(f))
    expect(archivos.length).toBeGreaterThanOrEqual(9)
  })
})
