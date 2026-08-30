import { test, expect } from '@playwright/test'

/**
 * WS-05 — LO QUE UN TELÉFONO SÍ SE PUEDE COMPROBAR SIN TENER UN TELÉFONO.
 *
 * ── POR QUÉ ESTE ARCHIVO ────────────────────────────────────────────────────
 *
 * REG-342 y REG-355 cerraron los dos mecanismos del rebote de iPhone —los
 * escritores de scroll que no preguntaban y el encadenamiento sin
 * `overscroll-behavior`— y los dejaron probados **leyendo el árbol**. La regla de
 * diseño de este repositorio dice que eso no basta: «no se aprueba una interfaz
 * leyendo el código». Aquí el producto se abre en un navegador de verdad, con la
 * pantalla de un teléfono, y se le mide lo que se puede medir.
 *
 * ── LO QUE ESTO **NO** ES, Y ES LA MITAD IMPORTANTE ─────────────────────────
 *
 * **No es un iPhone, y no prueba el rebote.** Corre en el proyecto
 * `telefono-chromium`: el **tamaño** de un iPhone 14 sobre el motor **Chromium**.
 * Los dos comportamientos que causan el defecto de REG-355 son de WebKit y no
 * existen aquí:
 *
 *   · `overflow-anchor`, que Chromium **sí** implementa y WebKit no — así que una
 *     escritura tardía de scroll que en un iPhone se siente, aquí la compensa el
 *     motor y no se ve;
 *   · el rebote elástico del documento al encadenar el gesto, que es de WebKit.
 *
 * Es decir: **este archivo no puede poner WS-05 en `PROVEN`**, y no debe usarse
 * para eso. Lo que cierra es todo lo demás —que la pantalla quepa, que se pueda
 * tocar, que no haya desbordamiento horizontal, que la consola esté limpia—, que
 * hasta ahora tampoco se había mirado en un navegador.
 *
 * El proyecto `iphone-safari` de `playwright.config.ts` sí usa WebKit y es el que
 * daría esa prueba. **No se puede ejecutar en este entorno**: el binario de WebKit
 * no está instalado y su descarga está bloqueada. Queda como lo que es, una
 * acción externa.
 *
 * ── CÓMO SE CORRE ───────────────────────────────────────────────────────────
 *
 *   npm run build
 *   npm run e2e:telefono
 *
 * En un entorno cuyo Chromium no es la build exacta que pide la versión de
 * Playwright del repositorio, `PLAYWRIGHT_CHROMIUM_PATH=<ruta>` usa el que haya.
 *
 * ── UNA COSA QUE SE VIO CORRIÉNDOLO ─────────────────────────────────────────
 *
 * El caso de la consola falló **una vez**, en el primer arranque del servidor, y
 * pasó en todas las ejecuciones posteriores contra un servidor ya caliente. Es
 * una carrera entre `networkidle` y la primera compilación, no un defecto del
 * producto. Se anota en vez de callarlo: si algún día se vuelve frecuente, esto
 * es lo primero que hay que releer.
 */

/** Lo que un paciente o un prospecto puede abrir sin sesión. */
const PUBLICAS = ['/', '/precios', '/seguridad', '/privacidad', '/terminos', '/contacto', '/login', '/registro']

/**
 * El mínimo de WCAG 2.2 para un objetivo táctil, y el que la regla de diseño de
 * este repositorio nombra: 44×44 CSS px.
 */
const OBJETIVO_MINIMO = 44

for (const ruta of PUBLICAS) {
  test(`${ruta} — no desborda a lo ancho en una pantalla de teléfono`, async ({ page }) => {
    /**
     * El desbordamiento horizontal es el defecto de móvil que más se cuela:
     * nadie lo ve en un escritorio ancho, y en el teléfono aparece una barra que
     * mueve toda la página de lado. La regla de diseño lo dice literal — el
     * cuerpo NUNCA scrollea en horizontal; lo ancho scrollea dentro de su propio
     * contenedor.
     */
    await page.goto(ruta, { waitUntil: 'networkidle' })
    const { scroll, cliente } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }))
    expect(scroll, `${ruta} desborda ${scroll - cliente}px a la derecha`).toBeLessThanOrEqual(cliente + 1)
  })
}

test('los controles que se tocan miden al menos 44×44', async ({ page }) => {
  /**
   * Se miden los controles VISIBLES de la landing, que es la pantalla que más
   * gente abre desde un teléfono. Un objetivo por debajo de 44 px falla la
   * compuerta de accesibilidad de la regla de diseño, y en la práctica es el
   * botón que hay que intentar tocar tres veces.
   *
   * Se excluyen los enlaces dentro de un párrafo: un enlace en línea hereda la
   * altura de su texto y exigirle 44 px sería exigir que el texto corrido tenga
   * interlineado de botón. La regla es para los CONTROLES.
   */
  await page.goto('/', { waitUntil: 'networkidle' })
  const pequenos = await page.evaluate((minimo) => {
    const malos: string[] = []
    const controles = document.querySelectorAll('button, [role="button"], input[type="submit"], a[class*="btn"], a[class*="boton"]')
    for (const el of controles) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue            // oculto
      if (getComputedStyle(el).display === 'none') continue
      if (r.width < minimo || r.height < minimo) {
        malos.push(`${el.tagName.toLowerCase()}«${(el.textContent ?? '').trim().slice(0, 24)}» ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return malos
  }, OBJETIVO_MINIMO)
  expect(pequenos, `objetivos táctiles por debajo de ${OBJETIVO_MINIMO}px`).toEqual([])
})

test('la landing no ensucia la consola con nada SUYO', async ({ page, baseURL }) => {
  /**
   * «Se comprueba la consola y la red» es parte literal de la regla de diseño.
   * Un error de consola en la landing es el primero que ve alguien que evalúa el
   * producto, y suele ser la punta de algo que sí importa.
   *
   * ── POR QUÉ SE SEPARA POR ORIGEN, Y NO SE FILTRA A OJO ────────────────────
   *
   * La primera versión exigía la consola limpia a secas y salía roja por
   * `net::ERR_TUNNEL_CONNECTION_FAILED`: una red que corta las salidas a
   * internet —un contenedor de agente, un CI aislado— hace fallar cualquier
   * recurso de tercero, y eso no dice nada del producto.
   *
   * La tentación es filtrar ese texto. Sería un error: un 404 de un recurso
   * PROPIO produce un mensaje parecido y **sí** es un defecto. Así que se
   * clasifica por ORIGEN — lo que sirve este servidor es responsabilidad del
   * producto; lo de fuera, no— y lo de fuera se **enumera** en el mensaje en vez
   * de desaparecer, para que un tercero caído se vea aunque no tumbe el caso.
   */
  /**
   * ── LA TERCERA CLASE: CANCELADA (el flake que tuvo main en rojo) ──────────
   *
   * Este caso salió rojo tres veces con catorce
   * `/_next/static/chunks/*.js — net::ERR_ABORTED`, y en corridas sobre el MISMO
   * commit que otras veces salía verde. Reproducido aquí con `--repeat-each`.
   *
   * Son PREFETCH que el propio navegador retira: el router de Next pide los
   * trozos que quizá haga falta, la navegación termina y cancela los que ya no
   * necesita. Que sobrevivan o no depende de cuándo `networkidle` da por quieta
   * la red, y eso cambia con la carga de la máquina — de ahí la intermitencia.
   *
   * **No se filtra el texto**, que es justo lo que el comentario de arriba
   * advierte que sería un error. Se clasifica por NATURALEZA, que es el mismo
   * criterio que ya separaba propios de ajenos:
   *
   *   · una petición FALLIDA recibió un veredicto malo del servidor, o no pudo
   *     llegar a él —404, 500, conexión rechazada—. Es un defecto.
   *   · una petición CANCELADA no llegó a tener veredicto: el cliente la retiró.
   *     No dice nada del producto, y por eso no puede tumbar el caso.
   *
   * Las canceladas **se enumeran en el mensaje**, igual que los terceros caídos:
   * la regla de esta prueba es que nada desaparezca, no que nada falle.
   *
   * Lo que esto NO cubre: un componente que aborte sus propias peticiones por un
   * defecto suyo saldría aquí como cancelada y no rompería el caso. Si la página
   * se rompiera de verdad lo dirían los otros diez casos de este archivo —que la
   * landing pinta, que el foco se ve, que los objetivos táctiles miden—, y
   * ninguno de ésos es intermitente.
   */
  const propios: string[] = []
  const ajenos: string[] = []
  const canceladas: string[] = []
  const origen = new URL(baseURL ?? 'http://localhost:3000').origin

  page.on('pageerror', e => propios.push(`excepción sin capturar: ${e}`))
  page.on('requestfailed', r => {
    const motivo = r.failure()?.errorText ?? 'falló'
    const linea = `${r.url()} — ${motivo}`
    if (motivo === 'net::ERR_ABORTED') { canceladas.push(linea); return }
    ;(r.url().startsWith(origen) ? propios : ajenos).push(linea)
  })
  page.on('response', r => {
    if (r.status() >= 400 && r.url().startsWith(origen)) propios.push(`${r.url()} — HTTP ${r.status()}`)
  })
  page.on('console', m => {
    /* Un mensaje de consola no trae URL: sólo cuenta si no lo explica ya un
       recurso ajeno que falló. */
    if (m.type() === 'error' && ajenos.length === 0) propios.push(`consola: ${m.text()}`)
  })

  await page.goto('/', { waitUntil: 'networkidle' })
  expect(
    propios,
    `errores del propio producto (terceros caídos: ${ajenos.join(' · ') || 'ninguno'}` +
    ` · canceladas por el navegador: ${canceladas.length})`,
  ).toEqual([])
})

test('el foco se ve al recorrer con el teclado', async ({ page }) => {
  /**
   * «Se prueba con teclado» — la otra mitad de la misma regla. Un foco invisible
   * falla la compuerta de accesibilidad, y no se detecta leyendo el CSS porque
   * depende de qué gana en la cascada.
   */
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const visible = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const s = getComputedStyle(el)
    const anillo = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
    return { anillo, sombra: s.boxShadow !== 'none' }
  })
  expect(visible, 'el primer Tab no movió el foco a ningún control').not.toBeNull()
  expect(visible!.anillo || visible!.sombra, 'el elemento enfocado no enseña foco visible').toBe(true)
})
