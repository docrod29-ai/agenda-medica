/**
 * GOLDEN — DOS DEFECTOS QUE SÓLO EXISTEN EN UN TELÉFONO, Y QUE NADIE MEDÍA.
 *
 * ── CÓMO SE DESCUBRIERON ─────────────────────────────────────────────────────
 *
 * No leyendo el código: **abriendo el producto**. Emuladores de Firebase, la
 * clínica sintética de `sembrar-capturas.mjs`, el build de producción servido, y
 * Chromium a 390×844 — el iPhone 14 en píxeles CSS.
 * `scripts/design/medir-el-alto-del-telefono.mjs`, acta en
 * `docs/design/capturas/alto-del-telefono/`.
 *
 * Los arneses de móvil que ya existían miden el ANCHO —desbordamiento, 44×44,
 * contraste, foco—. El **alto** no lo medía nadie, y es donde vive la familia
 * que sólo aparece en un teléfono.
 *
 * ── DEFECTO 1 · «¿Por qué está aquí?» no recibía el toque (REG-425) ─────────
 *
 * En `/pacientes`, `document.elementFromPoint` en el centro exacto del control
 * devolvía `.nx-fila-abrir`. El toque caía en el **velo** de la fila
 * —`.nx-fila-abrir::after { position:absolute; inset:0 }`, el área de golpe que
 * hace que pulsar en cualquier punto abra el expediente— y **navegaba** en vez
 * de abrir la lente. Tres filas de tres: todas las que tienen un pendiente vivo,
 * que son exactamente las filas que esa pregunta existe para explicar.
 *
 * **Causa raíz.** El mecanismo estaba resuelto y documentado a veinte líneas de
 * distancia: «Editar» lleva `position:relative; z-index:1` en línea, con un
 * comentario que dice literalmente «por encima del velo de .nx-fila-abrir::after».
 * El disparador de la lente se envolvió en `<span className="nx-fila-porque">`,
 * un nombre de clase que **no existía en ninguna hoja de estilos**. Escrito, y
 * sin conectar.
 *
 * **La regla, y por qué es genérica.** Escribir `.nx-fila-porque` habría dejado
 * el mismo defecto esperando al CUARTO control. La hoja dice ahora que dentro de
 * una fila de paciente, cualquier cosa pulsable que no sea la que abre vive por
 * encima del velo. Nadie tiene que acordarse de nada al añadir un control.
 *
 * ── DEFECTO 2 · el alto del calendario describía otra pantalla (REG-426) ────
 *
 * `/calendario` llevaba `height: calc(100vh - 52px)` **en línea**, y era el
 * ÚNICO alto fijo en `vh` de todo el árbol. Medido: **792px de alto contra 735
 * visibles — 57px por debajo de lo que se ve**.
 *
 * En un iPhone es peor y no un poco: `100vh` en Safari es la altura del viewport
 * **con la barra del navegador oculta**, o sea siempre mayor que lo que hay
 * delante. Y el `- 52px` es la topbar de ESCRITORIO; en el teléfono la topbar
 * mide 48px + área segura y abajo hay una barra de 53px más el indicador del
 * iPhone. La resta describía una pantalla que no es ésta.
 *
 * **La regla.** Un estilo EN LÍNEA no puede tener respaldo —una propiedad, un
 * valor—, así que la altura se muda a la hoja, que sí puede: `vh` primero para
 * el navegador que no entienda `dvh`, `dvh` después para el que sí. `dvh` es la
 * altura REAL del viewport móvil.
 *
 * ── QUÉ *NO* CUBRE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * · **No mide.** Mide el arnés, en un navegador. Esto vigila que las dos reglas
 *   que el arnés dejó verdes no se deshagan — porque el arnés necesita
 *   emuladores y un build, y no corre en CI.
 * · **No es un iPhone.** Ni el arnés lo es. El rebote elástico y
 *   `overflow-anchor` son de WebKit, cuyo binario no se puede ni descargar en
 *   este entorno (403 de la política de red, comprobado). **WS-05 sigue sin
 *   `PROVEN`**, y nada de aquí debe usarse para marcarlo.
 * · **No cubre las hojas de estilo en `vh`.** `globals.css` usa `100vh` en
 *   varios sitios y está bien: ahí SIEMPRE va seguido de `100dvh`, que es el
 *   respaldo que un estilo en línea no puede tener. Lo que se vigila es
 *   exactamente lo que no puede defenderse solo.
 * · **No dice si la resta del calendario es la correcta.** Dice que ya no está
 *   en línea y que tiene respaldo. Que el contenido llegue al fondo se comprueba
 *   corriendo el arnés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const CSS = readFileSync('src/app/globals.css', 'utf8')

/** Alturas fijadas en `vh` por un estilo EN LÍNEA, en todo el árbol de pantallas. */
function alturasEnVhEnLinea(): string[] {
  const archivos = execSync(
    "grep -rl 'vh' src/app src/components --include=*.tsx | grep -v __tests__ || true",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)

  const hallazgos: string[] = []
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8')
    /* `height:` de JSX en línea con `vh` dentro. `minHeight` NO cuenta: un
       mínimo mayor que el viewport sólo añade scroll, y el scroll se resuelve
       solo. Lo que no se resuelve solo es una altura FIJA. */
    for (const m of fuente.matchAll(/(?<!min)(?<!max)[Hh]eight:\s*'([^']*vh[^']*)'/g)) {
      hallazgos.push(`${archivo}: height: '${m[1]}'`)
    }
  }
  return hallazgos
}

describe('ningún alto fijo del producto se mide en `vh` desde un estilo en línea', () => {
  it('EL CASO: no queda ninguno', () => {
    expect(
      alturasEnVhEnLinea(),
      'un `height` en `vh` escrito EN LÍNEA no puede tener respaldo `dvh` —una ' +
      'propiedad, un valor— y en iOS Safari `100vh` es la altura CON LA BARRA ' +
      'OCULTA: siempre mayor que lo que se ve. Va a la hoja de estilos, donde sí ' +
      'cabe el par vh/dvh (ver `.nx-alto-de-trabajo`).',
    ).toEqual([])
  })

  it('y el que había vive en la hoja, con su respaldo `dvh` DESPUÉS', () => {
    /**
     * El orden importa y es la mitad del arreglo: el navegador se queda con la
     * ÚLTIMA declaración que entiende. `dvh` antes de `vh` dejaría ganar a `vh`
     * en todos los navegadores modernos — el arreglo escrito al revés.
     */
    const bloque = CSS.slice(CSS.indexOf('.nx-alto-de-trabajo'))
    expect(bloque, 'desapareció `.nx-alto-de-trabajo`').not.toBe('')
    const vh = bloque.indexOf('100vh')
    const dvh = bloque.indexOf('100dvh')
    expect(vh, 'falta el respaldo en `vh` para quien no entienda `dvh`').toBeGreaterThan(-1)
    expect(dvh, 'falta `dvh`, que es la altura REAL del viewport móvil').toBeGreaterThan(-1)
    expect(dvh, '`dvh` tiene que ir DESPUÉS de `vh`, o gana `vh`').toBeGreaterThan(vh)
  })

  it('al revés: el cedazo caza un `height` en `vh` en línea', () => {
    /* Sobre una fuente de mentira: sobre el árbol bueno sólo demuestra hoy. */
    const caza = (jsx: string) => [...jsx.matchAll(/(?<!min)(?<!max)[Hh]eight:\s*'([^']*vh[^']*)'/g)].length
    expect(caza("<div style={{ height: 'calc(100vh - 52px)' }}>"), 'no cazó el defecto original').toBe(1)
    expect(caza("<div style={{ height: '100vh' }}>")).toBe(1)
    /* Y NO caza lo que no es defecto: un mínimo sólo añade scroll. */
    expect(caza("<div style={{ minHeight: '100vh' }}>"), 'un `minHeight` no es un alto fijo').toBe(0)
    expect(caza("<div style={{ maxHeight: '85vh' }}>"), 'un `maxHeight` tampoco').toBe(0)
  })
})

describe('en una fila de paciente, todo control recibe su propio toque', () => {
  it('EL CASO: la hoja levanta por encima del velo lo pulsable que no abre', () => {
    /**
     * `.nx-fila-abrir::after` estira el área de golpe sobre la fila entera. Sin
     * esta regla, cualquier control hermano queda DEBAJO y su toque navega al
     * expediente — medido en Chromium a 390px: tres de tres filas con pendiente.
     */
    const regla = CSS.match(
      /\.nx-fila-paciente button:not\(\.nx-fila-abrir\)[\s\S]{0,400}?\}/,
    )?.[0]
    expect(regla, 'desapareció la regla que levanta los controles de la fila sobre el velo').toBeTruthy()
    expect(regla!, 'sin `position: relative` el `z-index` no cuenta').toMatch(/position:\s*relative/)
    expect(regla!).toMatch(/z-index:\s*[1-9]/)
  })

  it('y el velo sigue existiendo — el arreglo no lo quitó', () => {
    /**
     * La salida fácil habría sido borrar `::after`. Eso arregla el toque del
     * control y rompe el de la FILA, que es como se abre un expediente con el
     * pulgar. Las dos cosas tienen que seguir siendo verdad a la vez.
     */
    expect(CSS).toMatch(/\.nx-fila-abrir::after\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/)
  })

  it('al revés: si `.nx-fila-porque` volviera a ser la única defensa, no bastaría', () => {
    /**
     * Ésta es la forma exacta del defecto: una clase escrita en el JSX que no
     * existe en ninguna hoja. Se comprueba que la defensa de hoy NO depende de
     * ese nombre — si dependiera, borrarlo del CSS la desarmaría otra vez.
     */
    /* La hoja SIN comentarios: un nombre citado en prosa no es una defensa. */
    const reglas = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(
      /\.nx-fila-paciente button:not\(\.nx-fila-abrir\)/.test(reglas),
      'la regla genérica no está fuera de los comentarios: no rige nada',
    ).toBe(true)
    expect(
      /\.nx-fila-porque\s*[,{]/.test(reglas),
      'la defensa volvió a colgar del nombre `.nx-fila-porque`: el cuarto control caería otra vez',
    ).toBe(false)
  })
})
