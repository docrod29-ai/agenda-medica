/**
 * LA LISTA DE ALERGIAS NO CABÍA EN EL TELÉFONO — REG-436.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Abriendo `/consulta/pac-001` en Chromium a 390×844 contra el arnés con
 * emuladores (`npm run arnes:emuladores` · `arnes:sembrar` · `arnes:dev`) y
 * MIRANDO la captura. Ninguna prueba de este repositorio podía verlo: el JSX
 * era correcto, el CSS era correcto, y el defecto sólo existe cuando los dos
 * se miden juntos a un ancho concreto.
 *
 * Lo que se vio, medido en el navegador:
 *
 *     franja de alergias   pedía 555 px   en una caja de 356
 *     la lectura acababa   en x = 572     con la ventana en 390
 *     overflow-x           visible        → ni siquiera había barra que arrastrar
 *
 * El texto era «Penicilina (anafilaxia) · sulfas · AINEs». **AINEs no estaba
 * escondido: no existía.** No había gesto que lo trajera a la pantalla.
 *
 * ── POR QUÉ ESTA LÍNEA Y NO OTRA ────────────────────────────────────────────
 *
 * Es la línea que se lee ANTES de recetar. Un médico que ve «Penicilina
 * (anafilaxia), sulfa…» cortado no tiene forma de saber que falta un tercer
 * alérgeno — y `clinical-safety.md` §4 dice que la ausencia de un dato no es
 * dato de su ausencia. La franja cumplía su trabajo en escritorio y mentía por
 * omisión en el bolsillo, que es donde se pasa visita.
 *
 * ── LA CAUSA RAÍZ, Y POR QUÉ CADA MITAD ERA CORRECTA ────────────────────────
 *
 * La fila es `display: flex` en un `style` EN LÍNEA, sin `flex-wrap`, con la
 * lectura en `flex-shrink: 0`.
 *
 * Y `flex-shrink: 0` **era la decisión correcta**: apretar «se lee: …» hasta
 * dejarlo ilegible sería peor que no enseñarlo. Lo que faltaba no era dejarla
 * encoger — era dejarla BAJAR. Un `style` en línea no puede tener una forma
 * distinta a 390 px que a 1440: la colocación tenía que mudarse a CSS, que es
 * la misma lección que la barra del portal (REG-425).
 *
 * ── EL PRIMER ARREGLO ESTUVO MAL, Y LA MEDICIÓN LO APROBÓ ───────────────────
 *
 * Poner sólo `flex-wrap: wrap` dejó los desbordamientos en CERO — y la pantalla
 * peor de leer que con el defecto. La lectura dejaba de salirse y se metía en
 * los 150 px que sobraban al lado del campo, saliendo a palabra por renglón:
 *
 *     se lee: / Penicilina / (anafilaxia) / · sulfas · / AINEs
 *
 * Exactamente la patología que el dueño fotografió en la portada (REG-434). La
 * medición decía verde; la captura decía que no. Hizo falta `flex-basis: 100%`
 * bajo 900 px para bajarla ENTERA, lo que de paso le devuelve al campo el ancho
 * completo.
 *
 * Por eso `design-system.md` dice que no se aprueba una interfaz leyendo el
 * código — y esto añade: tampoco leyendo sólo los números.
 *
 * ── LO QUE APARECIÓ EN LA MISMA MIRADA ──────────────────────────────────────
 *
 * · **La medicación se salía 27 px.** El separador « · » vivía DENTRO del
 *   `white-space: nowrap` que mantiene unidos el fármaco y su botón «ya no» —
 *   y con él, el único espacio partible entre un fármaco y el siguiente. Sin
 *   punto de corte el navegador no bajaba de línea: se salía. Mantener unido el
 *   par nombre+acción sigue siendo correcto (un «ya no» huérfano al principio de
 *   un renglón no dice de qué medicamento habla); el separador no formaba parte
 *   de ese par.
 *
 * · **Nueve campos sin etiqueta.** Los siete signos vitales tenían `<label>`
 *   con el texto correcto y ningún `htmlFor`: se ven «TA», «FC», «SpO₂» y se
 *   anuncian como cajas anónimas. El marcador de posición, único indicio que
 *   quedaba dentro, DESAPARECE al escribir el primer dígito.
 *
 * · **Diez objetivos táctiles por debajo de 44×44**, entre ellos los siete
 *   signos vitales a 113×40 y el campo de alergias a 244×24. Se capturan de pie,
 *   con el paciente delante.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de FUENTE.** Comprueba que las reglas estén declaradas y
 *   que nada en línea las pise. Que el texto quepa de verdad lo mide
 *   `scripts/ausculta-transformacion/mirar-la-consulta.mjs`, y **esa sonda no
 *   corre en CI**: necesita emuladores de Firebase y un navegador.
 * · **No es un iPhone.** Todo lo medido es Chromium a 390 px. WebKit no está en
 *   este entorno y no se declara probado.
 * · **No mira las otras pantallas.** `expediente/[patientId]` pinta su propia
 *   franja de alergias; no se ha medido a 390 y este guardián no la vigila.
 * · **Los dos «ya no» siguen a 34×44 y es a propósito.** Son botones DENTRO de
 *   una frase, el caso que WCAG 2.2 §2.5.8 exceptúa expresamente; ensancharlos
 *   rompería la prosa que los hace comprensibles. Se declara, no se esconde.
 * · **`Visitas anteriores: [2026-09-02]`** se vio y NO se tocó. El corchete es
 *   el formato de `getUltimasNotasResumen`, y esa misma cadena alimenta el
 *   contexto de los motores: cambiarla por estética movería lo que el modelo
 *   lee. Queda anotado como observado y descartado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** El cuerpo sin comentarios: un golden no debe dispararse con su propia prosa. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const CONSULTA_LIMPIA = sinComentarios(CONSULTA)
const UI = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'consulta-ui.tsx')
/** El CSS SIN sus comentarios: este golden ya cayó una vez contra su propia
 *  prosa — el comentario que explica el arreglo nombra `flex-basis: 100%`. */
const CSS = sinComentarios(leer('src', 'app', 'globals.css'))

describe('la franja de alergias tiene forma de teléfono', () => {
  it('EL CASO: la colocación vive en CSS, no en un `style` en línea', () => {
    /**
     * PROBADO AL REVÉS: quitando la clase del `div`, este caso cae. Se comprobó
     * además en el navegador, en la MISMA página cargada, devolviéndole a la
     * lectura su `flex-shrink: 0` y su `nowrap`: 356 → 555 px pedidos, y la
     * lectura acabando 182 px fuera de la ventana.
     */
    expect(CONSULTA_LIMPIA).toContain('className="nx-franja-alergias"')
    expect(CSS).toMatch(/\.nx-franja-alergias\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it('la lectura baja a su PROPIA línea en el teléfono, no a una columna estrecha', () => {
    /**
     * El corazón del segundo intento. `flex-wrap` a secas ya daba cero
     * desbordamientos y dejaba la lectura a palabra por renglón; lo que la
     * arregla es la base del 100 %, y por eso es lo que se sella.
     */
    const movil = CSS.slice(CSS.indexOf('@media (max-width: 899px)', CSS.indexOf('.nx-lectura-alergenos')))
    expect(movil).toMatch(/\.nx-lectura-alergenos\s*\{[^}]*flex-basis:\s*100%/)
  })

  it('y NADA en línea puede volver a pisarlo', () => {
    /**
     * Un `style` en línea gana a la hoja: si alguien devuelve `flexShrink: 0`
     * al `span`, la media query deja de servir y no falla nada más. Aquí falla.
     */
    const franja = CONSULTA_LIMPIA.slice(
      CONSULTA_LIMPIA.indexOf('nx-lectura-alergenos'),
      CONSULTA_LIMPIA.indexOf('nx-lectura-alergenos') + 400,
    )
    expect(franja).not.toMatch(/flexShrink:\s*0/)
    expect(franja).not.toMatch(/whiteSpace:\s*'nowrap'/)
  })

  it('el campo de alergias puede estrecharse (min-width: 0) en vez de empujar', () => {
    expect(CSS).toMatch(/\.nx-franja-alergias\s*>\s*input\s*\{[^}]*min-width:\s*0/)
  })
})

describe('la medicación vigente parte por donde debe', () => {
  it('EL CASO: el separador queda FUERA del `nowrap`', () => {
    /**
     * PROBADO AL REVÉS: metiendo el `{i > 0 && ' · '}` de vuelta dentro del
     * `span` con `nowrap`, desaparece el único punto de corte entre fármacos y
     * el segundo vuelve a salirse 27 px.
     *
     * Se comprueba el ORDEN, no la presencia: los dos trozos existían antes y
     * el defecto era cuál envolvía a cuál.
     */
    const i = CONSULTA_LIMPIA.indexOf("{i > 0 && ' · '}")
    expect(i, 'ya no está el separador de fármacos').toBeGreaterThan(0)

    /**
     * Se mira el envoltorio QUE LO CONTIENE, no «hay un nowrap más adelante».
     * La primera versión de este caso preguntaba lo segundo y pasaba con el
     * defecto puesto: siempre hay otro `nowrap` en alguna parte del archivo.
     * Lo que importa es el `<span>` que abre justo antes del separador.
     */
    const aperturaEnvoltorio = CONSULTA_LIMPIA.lastIndexOf('<span key={', i)
    expect(aperturaEnvoltorio).toBeGreaterThan(0)
    const envoltorio = CONSULTA_LIMPIA.slice(aperturaEnvoltorio, i)
    expect(
      envoltorio,
      'el `nowrap` volvió a envolver al separador: sin espacio partible entre ' +
      'fármacos, el segundo se sale de la pantalla en vez de bajar de línea',
    ).not.toMatch(/whiteSpace/)
  })

  it('pero el fármaco y su «ya no» siguen sin poder separarse', () => {
    /**
     * La mitad que NO se toca. Un «ya no» al principio de un renglón, lejos del
     * nombre, es un botón que suspende un medicamento sin decir cuál.
     */
    const trozo = CONSULTA_LIMPIA.slice(
      CONSULTA_LIMPIA.indexOf("{i > 0 && ' · '}"),
      CONSULTA_LIMPIA.indexOf('>ya no</button>'),
    )
    expect(trozo).toMatch(/whiteSpace:\s*'nowrap'/)
  })
})

describe('los campos de la consulta se anuncian y se pueden tocar', () => {
  it('EL CASO: los siete signos vitales tienen etiqueta ATADA, no sólo visible', () => {
    /**
     * PROBADO AL REVÉS: quitando el `htmlFor`, la sonda vuelve a contar nueve
     * campos sin etiqueta. Medido: 9 → 0.
     */
    expect(CONSULTA_LIMPIA).toContain('htmlFor={`signo-${k}`}')
    expect(CONSULTA_LIMPIA).toContain('id={`signo-${k}`}')
  })

  it('el campo de alergias tiene nombre accesible', () => {
    /** El «Alergias:» de al lado es un `<strong>`: se ve y no se anuncia. */
    expect(CONSULTA_LIMPIA).toContain('aria-label="Alergias del paciente"')
  })

  it('el campo de corrección de la nota también', () => {
    expect(CONSULTA_LIMPIA).toContain('aria-label="Corrección para la nota"')
  })

  it('EL CASO: los signos vitales llegan a 44 px de alto', () => {
    /**
     * Medían 113×40. Cuatro píxeles de menos son el dedo que cae al lado, y se
     * capturan de pie con el paciente delante. El mínimo está en
     * `design-system.md` entre los que tumban la compuerta.
     */
    const mini = UI.slice(UI.indexOf('miniInput:'), UI.indexOf('miniInput:') + 320)
    expect(mini).toMatch(/minHeight:\s*44/)
  })

  it('y el de alergias también, que es el que más se toca', () => {
    const campo = CONSULTA_LIMPIA.slice(
      CONSULTA_LIMPIA.indexOf('aria-label="Alergias del paciente"'),
      CONSULTA_LIMPIA.indexOf('aria-label="Alergias del paciente"') + 400,
    )
    expect(campo).toMatch(/minHeight:\s*44/)
  })

  it('sube el ALTO, no la letra: la escala tipográfica no se toca', () => {
    /**
     * El arreglo fácil era agrandar la fuente hasta que la caja creciera sola.
     * La escala está medida (10.5 · 12 · 14 · 16 · 20 · 28) y el trinquete de
     * diseño la vigila; este campo no necesita letra más grande, necesita sitio.
     */
    const mini = UI.slice(UI.indexOf('miniInput:'), UI.indexOf('miniInput:') + 320)
    expect(mini).toMatch(/fontSize:\s*13\b/)
  })
})

describe('el escritorio no paga el arreglo del teléfono', () => {
  it('la lectura conserva su `flex-shrink: 0` fuera del teléfono', () => {
    /**
     * Medido a 1440: la franja pide 1050 px en una caja de 1050 y se pinta en
     * una sola fila, igual que antes de tocar nada. La regla que la baja de
     * línea está DENTRO de la media query, y esto lo sella: sacarla de ahí
     * cambiaría el escritorio sin que nadie se enterara.
     */
    const base = CSS.slice(CSS.indexOf('.nx-lectura-alergenos'), CSS.indexOf('@media (max-width: 899px)', CSS.indexOf('.nx-lectura-alergenos')))
    expect(base).toMatch(/flex-shrink:\s*0/)
    expect(base, 'la base no puede llevar la bajada de línea: eso es del teléfono').not.toMatch(/flex-basis/)
  })
})
