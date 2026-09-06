/**
 * GOLDEN — ningún campo apaga el anillo de foco sin poner otro en su lugar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En `/consulta/pac-001` —la pantalla donde el médico ESCRIBE LA NOTA— **15 de
 * 15 campos no acusaban el foco**. Ni un píxel cambiaba al llegar el cursor:
 * mismo borde, misma sombra (ninguna), mismo fondo, `outline: 0px none`. Con el
 * teclado no había forma de saber en qué caja se estaba escribiendo.
 *
 * No era exclusivo de la consulta. El barrido encontró **33 declaraciones** en
 * **21 archivos**: los paneles clínicos (cardiometabólico, gineco, pediatría,
 * cirugía, preventivo, preoperatorio, calculadoras, antibiograma), el chat y el
 * asistente, `setup`, `finanzas`, `configuración`, `guía`, fotos clínicas,
 * facturación, soporte y la paleta de búsqueda. Es decir: **casi todos los
 * campos escritos a mano del producto**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo, no leyendo. Una sonda enfocaba cada campo visible de cada ruta y
 * comparaba `outlineWidth · outlineStyle · boxShadow · borderColor ·
 * backgroundColor` antes y después. Si la foto era idéntica, el campo estaba
 * MUDO. Salieron 17 de 39 en las quince rutas visitadas; el `grep` posterior
 * mostró que las visitadas eran la parte pequeña.
 *
 * Conviene decir que **axe no lo caza**: no existe una regla automática de
 * «foco visible», así que catorce pantallas ya auditadas con 0 violaciones
 * llevaban esto dentro.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La familia de defectos que este repositorio ya tiene nombrada: **la lección se
 * aprende en un componente y no en el de al lado**.
 *
 * El sistema de diseño hace lo correcto. `.input` apaga el `outline` del
 * navegador —que en un formulario denso es ruidoso— y **pone otro anillo en su
 * lugar**:
 *
 *     .input { outline: none; }
 *     .input:focus { border-color: var(--nexus); box-shadow: 0 0 0 3px var(--nexus-soft); }
 *
 * Los campos escritos a mano copiaron la primera línea y no la segunda. Y no
 * podían copiarla: un `style={{ }}` en línea **no sabe expresar `:focus`**. Así
 * que se quedaron con la mitad que quita y sin la mitad que devuelve.
 *
 * Peor: el estilo en línea gana por especificidad al selector global
 * `:focus-visible { outline: 2px solid var(--nexus) }`, que es el que viste al
 * resto de la aplicación. Cada `outline: 'none'` en línea no sólo no añadía
 * nada — **desactivaba la defensa que ya existía**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un control que recibe el foco lo enseña. Si un componente quiere apagar el
 * `outline` del navegador, tiene que dibujar el suyo en una hoja de estilo,
 * donde `:focus` existe. Si no va a dibujarlo, **no lo apaga**: el anillo global
 * ya está puesto y es el mismo en toda la aplicación.
 *
 * Es el criterio 2.4.7 de WCAG 2.2 (Focus Visible), nivel AA, que la regla de
 * diseño de este repositorio nombra entre los mínimos que reprueban la
 * compuerta: «foco invisible».
 *
 * ── LA ÚNICA EXCEPCIÓN, Y POR QUÉ ───────────────────────────────────────────
 *
 * `#cierre-de-la-consulta` es un `<div tabIndex={-1}>`: no entra en el orden de
 * tabulación y sólo recibe el foco **por programa**, para que el teclado y el
 * lector de pantalla aterricen donde ya aterrizó la vista. Anillar una sección
 * entera al aterrizar es ruido, no información. Se deja apagado a propósito y
 * la lista de abajo lo dice con nombre y apellido.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Volviendo a poner `outline: 'none'` en cualquiera de los 33 sitios —o en uno
 * nuevo— el primer caso cae nombrando archivo y línea. Se comprobó devolviendo
 * la declaración a `consulta-ui.tsx`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mira las hojas de estilo.** En un `.css` apagar el `outline` es
 *   legítimo porque ahí sí se puede escribir el `:focus` que lo repone — es lo
 *   que hacen `.input` y `.nx-fila-abrir`. Este guardián vigila el estilo EN
 *   LÍNEA, que es donde la reposición es imposible.
 * · **No mide el contraste del anillo** contra el fondo del campo (criterio
 *   1.4.11 / 2.4.13). El anillo es `--nexus` sobre superficies de la escala
 *   `--s1/--s2`; queda sin medir.
 * · **No comprueba que el anillo se VEA** en cada pantalla: un campo dentro de
 *   un contenedor con `overflow: hidden` puede recortar los 2px de desplazamiento
 *   del anillo. Eso sólo se ve mirando.
 * · No vigila el apagado desde JavaScript (`el.style.outline = 'none'`).
 * · No entra en `e2e/` ni en los guiones del arnés: no son producto.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Las formas de apagar el anillo desde un estilo en línea. `outline: 0` y
 * `outlineWidth: 0` cuentan igual que `'none'`: el resultado en pantalla es el
 * mismo y el defecto también.
 *
 * Se busca leyendo el árbol desde Node y no con `grep`: el patrón lleva comilla
 * simple Y doble, y pasarlo por el intérprete de órdenes lo parte. Se descubrió
 * al escribir este guardián — falló con «Unterminated quoted string».
 */
const APAGADO =
  /outline: *['"]none['"]|outline: *0(?![0-9.])|outlineStyle: *['"]none['"]|outlineWidth: *0(?![0-9.])/

/**
 * Apagados deliberados, cada uno con su razón. Un contenedor con `tabIndex={-1}`
 * que sólo recibe el foco por programa no se anilla: la sección entera no es un
 * control.
 */
const DELIBERADOS = [
  {
    archivo: 'src/app/(dashboard)/consulta/[patientId]/page.tsx',
    marca: "marginTop: 16, outline: 'none'",
    porque: 'contenedor de aterrizaje `#cierre-de-la-consulta`, `tabIndex={-1}`',
  },
]

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e)
    if (statSync(ruta).isDirectory()) {
      if (e !== '__tests__' && e !== 'node_modules') fuentes(ruta, acc)
    } else if (e.endsWith('.tsx') || e.endsWith('.ts')) acc.push(ruta)
  }
  return acc
}

function apagados(): string[] {
  const malos: string[] = []
  for (const archivo of fuentes('src')) {
    const lineas = readFileSync(archivo, 'utf8').split('\n')
    lineas.forEach((l, i) => {
      if (!APAGADO.test(l)) return
      if (DELIBERADOS.some(d => d.archivo === archivo && l.includes(d.marca))) return
      malos.push(`${archivo}:${i + 1}: ${l.trim()}`)
    })
  }
  return malos
}

describe('el campo que recibe el foco lo enseña', () => {
  it('ningún estilo en línea apaga el anillo sin poner otro', () => {
    const malos = apagados()
    expect(
      malos,
      'un `outline` apagado en línea gana al `:focus-visible` global y deja el campo ' +
      'sin ninguna señal de foco (WCAG 2.2 AA · 2.4.7). Si hace falta apagarlo, se ' +
      'hace en una hoja de estilo y se repone el anillo en `:focus`:\n' + malos.join('\n'),
    ).toEqual([])
  })

  it('el barrido está mirando el árbol de verdad', () => {
    // Sin esto, un barrido que dejara de encontrar archivos haría pasar el caso
    // de arriba para siempre.
    const archivos = fuentes('src')
    expect(archivos.length, 'el barrido no encuentra fuentes: ¿sigue mirando el árbol?')
      .toBeGreaterThan(200)
    expect(archivos.some(a => a.includes('consulta'))).toBe(true)
  })

  it('el buscador reconoce las cuatro formas de apagarlo', () => {
    // Sin esto, el primer caso pasaría para siempre el día que el patrón dejara
    // de casar — por un cambio de comillas, de espaciado o de nombre.
    const muestra = [
      "  campo: { color: 'var(--text)', outline: 'none' },",
      '  campo: { color: "var(--text)", outline: "none" },',
      '  campo: { outline: 0, padding: 4 },',
      "  campo: { outlineStyle: 'none' },",
      '  campo: { outlineWidth: 0 },',
    ]
    for (const l of muestra) {
      expect(APAGADO.test(l), `el patrón no reconoce este apagado: ${l}`).toBe(true)
    }
    // Y no debe cazar un anillo que SÍ se dibuja.
    expect(APAGADO.test("  foco: { outline: '2px solid var(--nexus)' },")).toBe(false)
    expect(APAGADO.test('  foco: { outlineWidth: 02 },')).toBe(false)
  })

  it('la excepción deliberada sigue siendo un contenedor que no se tabula', () => {
    // Si alguien borra el `tabIndex={-1}` y deja el `outline: 'none'`, el
    // contenedor pasa a ser tabulable y sin anillo: el permiso deja de valer.
    for (const d of DELIBERADOS) {
      const lineas = readFileSync(d.archivo, 'utf8').split('\n')
      const i = lineas.findIndex(l => l.includes(d.marca))
      expect(i, `la excepción «${d.porque}» ya no está donde decía la lista`).toBeGreaterThan(-1)
      const alrededor = lineas.slice(Math.max(0, i - 6), i + 1).join('\n')
      expect(
        alrededor,
        'el permiso era para un contenedor que sólo recibe el foco por programa; ' +
        'sin `tabIndex={-1}` ya no lo es',
      ).toContain('tabIndex={-1}')
    }
  })
})
