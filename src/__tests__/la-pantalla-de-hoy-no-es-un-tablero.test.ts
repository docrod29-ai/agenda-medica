/**
 * LA PANTALLA DE HOY NO ES UN TABLERO, Y EN EL TELÉFONO NO ES EL ESCRITORIO
 * ENCOGIDO — V10 · HOME-001.
 *
 * ── LO MEDIDO, EN LA APLICACIÓN DESPLEGADA Y CON LA CUENTA DEL DUEÑO ────────
 *
 * El 9-ago-2026, con la ventana a 390 px de ancho —un iPhone— la pantalla de
 * inicio se veía así:
 *
 *   · las cuatro tarjetas seguían **de dos en dos**, no apiladas;
 *   · «Agenda de hoy» y «Accesos rápidos» seguían **lado a lado**, en un
 *     teléfono, así que el título se partía en tres renglones con «Ver todas»
 *     metido dentro;
 *   · la columna derecha **quedaba cortada** fuera de la pantalla;
 *   · «Citas hoy 0» salía **dos veces**: en el encabezado y en la primera
 *     tarjeta.
 *
 * ── LA CAUSA, QUE NO ERA UN DESCUIDO DE ESTILO ──────────────────────────────
 *
 * `gridTemplateColumns: '1fr 300px'`, **fijo, sin una sola consulta de medios**
 * en toda la pantalla. Una rejilla de dos columnas con una de ellas en píxeles
 * no se apila nunca: a 390 px de ancho, 300 de ellos son de la columna derecha
 * y el resto se sale.
 *
 * No se arregla con un `minmax`. Se arregla **no teniendo dos columnas que
 * defender** — y esa decisión sólo se puede tomar quitando de la pantalla lo
 * que no debería estar en ella.
 *
 * ── LO QUE SE QUITÓ, Y POR QUÉ CADA COSA ────────────────────────────────────
 *
 * · **Las cuatro tarjetas KPI.** §14 del charter, con estas palabras: *«no
 *   construyas un tablero de KPIs genérico para médicos»*. Los números siguen
 *   estando, en un renglón de texto.
 * · **«Accesos rápidos».** Sus cuatro destinos —calendario, lista de espera,
 *   pacientes, configuración— ya están, los cuatro, en la barra lateral.
 *   Navegación duplicada, del detector §9.
 * · **El «Citas hoy» del encabezado.** El mismo número dos veces no es
 *   jerarquía. Encabezado duplicado, del detector §9.
 * · **El sparkline de siete días.** Métrica decorativa sin acción asociada.
 *
 * ── POR QUÉ ESTA PRUEBA LEE EL FUENTE ───────────────────────────────────────
 *
 * Lo que falló no fue una función: fue **una hoja de estilos que no contemplaba
 * el teléfono**. Un test de render con jsdom no tiene motor de layout y daría
 * verde con la rejilla rota — que es exactamente cómo esto sobrevivió hasta
 * hoy. La medición de verdad es la captura a 390 px; esto es el cerrojo que
 * impide que el patrón vuelva a entrar sin que nadie lo note.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resumenDelDia } from '@/lib/hoy/resumen-del-dia'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const CSS = leer('src/app/globals.css')

/**
 * El fuente **sin comentarios**.
 *
 * La primera versión de esta prueba buscaba «Accesos rápidos» en el archivo
 * entero y fallaba — porque la propia pantalla explica en su cabecera por qué
 * se quitó «Accesos rápidos». Una prueba que se encuentra a sí misma en la
 * documentación no está midiendo el código: está midiendo la prosa, y habría
 * dado verde el día que alguien reintrodujera el bloque sin comentarlo.
 */
const PANTALLA = leer('src/app/(dashboard)/dashboard/page.tsx')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('la rejilla que se salía de la pantalla', () => {
  it('no queda ninguna columna fija en píxeles', () => {
    /**
     * `1fr 300px` era el defecto exacto. Cualquier rejilla con una columna en
     * `px` reintroduce el mismo problema con otro número.
     */
    expect(
      PANTALLA,
      'volvió una rejilla de columna fija: a 390 px se sale de la pantalla',
    ).not.toMatch(/gridTemplateColumns:\s*['"`][^'"`]*\d+px/)
  })

  it('la pantalla declara su comportamiento en pantalla estrecha', () => {
    /**
     * Antes de esto, la pantalla de inicio no tenía **ni una** consulta de
     * medios propia. Heredaba las de otros componentes y por eso en el
     * teléfono se veía como el escritorio, más pequeño.
     */
    expect(CSS).toMatch(/@media \(max-width: 640px\)[\s\S]{0,600}\.hoy-head/)
  })

  it('y a 560 px el nombre del paciente deja de pelearse con el botón', () => {
    /** Se aplastaba a dos letras y puntos suspensivos. */
    expect(CSS).toMatch(/@media \(max-width: 560px\)[\s\S]{0,300}\.cita-acciones/)
  })
})

describe('lo que se fue de la pantalla de inicio', () => {
  it('no hay tarjetas KPI', () => {
    /** §14: «no construyas un tablero de KPIs genérico para médicos». */
    expect(PANTALLA).not.toMatch(/KpiCard|kpi-card/)
  })

  it('no hay circulitos de icono', () => {
    /**
     * «arbitrary icon circles» está nombrado en el detector §9. Eran cuatro,
     * de 36×36, uno por tarjeta, cada uno con su color de fondo.
     */
    expect(PANTALLA).not.toMatch(/borderRadius:\s*10,\s*background:\s*`color-mix/)
  })

  it('«Accesos rápidos» ya no duplica la barra lateral', () => {
    expect(PANTALLA).not.toMatch(/Accesos rápidos/i)
  })

  it('y sus cuatro destinos siguen existiendo en el menú', () => {
    /**
     * Quitar el atajo no puede volver inalcanzable ningún destino: eso sería
     * cambiar un defecto visual por una pérdida de función.
     */
    const sidebar = leer('src/components/Sidebar.tsx')
    for (const destino of ['/calendario', '/lista-espera', '/pacientes', '/configuracion']) {
      expect(sidebar, `${destino} desapareció del menú al quitar el atajo`).toContain(destino)
    }
  })

  it('«Citas hoy» no aparece dos veces', () => {
    const veces = (PANTALLA.match(/Citas hoy/g) ?? []).length
    expect(veces, 'el mismo número dos veces no es jerarquía').toBeLessThanOrEqual(1)
  })

  it('y no queda el sparkline decorativo', () => {
    expect(PANTALLA).not.toMatch(/Sparkline|nx-spark/)
    expect(CSS).not.toMatch(/\.nx-spark/)
  })
})

describe('lo que NO se perdió al quitar las tarjetas', () => {
  /**
   * El riesgo de un rediseño es tirar el dato con el envase. Los cuatro
   * números de las tarjetas siguen en pantalla, en el renglón de resumen.
   */
  const conteo = { total: 8, confirmadas: 5, pendientes: 2, noShow: 1, canceladas: 0, manana: 3 }

  it('siguen los cuatro números y además el de mañana', () => {
    const linea = resumenDelDia(conteo).map(p => p.texto).join(' · ')
    expect(linea).toBe('8 citas · 5 confirmadas · 2 por confirmar · 1 no asistió · 3 mañana')
  })

  it('lo único con color es lo que pide una acción HOY', () => {
    const conAlerta = resumenDelDia(conteo).filter(p => p.alerta).map(p => p.texto)
    expect(conAlerta, 'el color deja de significar algo si lo lleva todo').toEqual(['2 por confirmar'])
  })

  it('un cero no se escribe', () => {
    const linea = resumenDelDia({ total: 3, confirmadas: 3, pendientes: 0, noShow: 0, canceladas: 0, manana: 0 })
    expect(linea.map(p => p.texto)).toEqual(['3 citas', '3 confirmadas'])
  })

  it('sin citas no hay renglón: el estado vacío ya lo dice', () => {
    expect(resumenDelDia({ total: 0, confirmadas: 0, pendientes: 0, noShow: 0, canceladas: 0, manana: 4 })).toEqual([])
  })

  it('los plurales son de español, no de plantilla', () => {
    const uno = resumenDelDia({ total: 1, confirmadas: 1, pendientes: 1, noShow: 1, canceladas: 1, manana: 0 })
    expect(uno.map(p => p.texto)).toEqual([
      '1 cita', '1 confirmada', '1 por confirmar', '1 no asistió', '1 cancelada',
    ])
  })

  it('y «no asistieron» concuerda cuando son varios', () => {
    const varios = resumenDelDia({ total: 9, confirmadas: 0, pendientes: 0, noShow: 3, canceladas: 0, manana: 0 })
    expect(varios.map(p => p.texto)).toEqual(['9 citas', '3 no asistieron'])
  })
})

describe('el área táctil de lo que se toca con el dedo', () => {
  it('«Ver todas» cumple los 44 px de WCAG 2.2', () => {
    /**
     * Era un enlace de 13 px de texto sin altura mínima: en el teléfono había
     * que apuntarle. La regla 25 del charter: los flujos móviles son táctiles
     * de nacimiento, no de adaptación.
     */
    expect(CSS).toMatch(/\.hoy-vertodas\s*\{[^}]*min-height:\s*44px/)
  })

  it('y el botón de nueva cita ocupa el ancho en pantalla estrecha', () => {
    expect(CSS).toMatch(/\.hoy-accion,\s*\.hoy-accion \.btn\s*\{[^}]*width:\s*100%/)
  })
})

describe('el orden de la pantalla contesta las preguntas de §14', () => {
  /**
   * §14 pide que la pantalla de inicio conteste, por este orden de urgencia:
   * quién sigue → qué necesita atención → qué pasa hoy.
   *
   * Antes el orden era: recuento → pendientes → KPIs → próxima cita → agenda.
   * La próxima cita —lo único que hace falta a las nueve de la mañana— salía
   * en cuarto lugar, debajo de cuatro tarjetas de estadística.
   */
  it('la próxima cita va antes que los pendientes, y los pendientes antes que la agenda', () => {
    const prox = PANTALLA.indexOf('<ProxHero')
    const pend = PANTALLA.indexOf('<PanelPendientes')
    const agenda = PANTALLA.indexOf('Agenda de hoy')
    expect(prox).toBeGreaterThan(-1)
    expect(prox, 'la próxima cita quedó debajo de los pendientes').toBeLessThan(pend)
    expect(pend, 'los pendientes quedaron debajo de la agenda').toBeLessThan(agenda)
  })

  it('el estado vacío enseña la siguiente acción útil', () => {
    /** Regla 27 del charter. Y si hay citas mañana, lo dice. */
    expect(PANTALLA).toMatch(/Mañana tienes \$\{stats\.manana\}|Mañana tienes/)
    expect(PANTALLA).toContain('Agendar cita')
  })
})
