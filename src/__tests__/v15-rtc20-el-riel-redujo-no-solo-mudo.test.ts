/**
 * RTC-20 — la vara del riel medía MUDANZA, no reducción.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `v15-flow-rail-cableado.test.ts` protege el riel con dos casos, y los dos
 * son necesarios pero ninguno mide lo que §14 pide:
 *
 *   · `railLinks.length <= 5` cuenta **etiquetas JSX** `<RailLink`.
 *   · la reachability exige que las **≥21 rutas del Sidebar viejo** sigan
 *     alcanzables.
 *
 * Los dos juntos se satisfacen **mudándolo todo**: 5 nodos arriba y 18
 * destinos metidos en `/operaciones`. Nada en la suite distingue eso de una
 * reducción de verdad. Peor: la segunda condición *premia* la mudanza, porque
 * lo que castiga es perder una ruta.
 *
 * Y contar etiquetas JSX tiene un punto ciego que se abre solo: **el día que
 * alguien escriba `{ITEMS.map(i => <RailLink … />)}`, la cuenta será 1** y el
 * riel podrá pintar veinte destinos con el guardián en verde. La forma del
 * código no es la forma del producto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de equipo rojo (ORT-16), leyendo los guardianes en vez de la pantalla:
 * «certifican reubicación, no reducción». Es hermano de RTC-02 (la vara de
 * genericidad contaba clases Tailwind en un código escrito en línea) y de
 * INS-01 (el gate medía producción con una lista del árbol). La familia es
 * siempre la misma: **el instrumento no mide lo que dice medir, y como da un
 * número, se le cree.**
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Se cuentan DESTINOS, no nodos.** La cuenta sale de los `href` que el
 *    riel pinta de verdad, así que sobrevive a que mañana se generen en bucle.
 * 2. **El cromo persistente es lo que se mide.** Lo que cuesta al médico no es
 *    cuántas rutas existen: es cuántas decisiones tiene delante todo el día.
 *    Riel (escritorio) y barra del pulgar (móvil) son ese cromo.
 * 3. **La mudanza tiene precio, y el precio se declara.** Los 18 destinos que
 *    bajaron a `/operaciones` cuestan **un gesto más**. Eso es exactamente la
 *    reducción: no desaparecieron, dejaron de estar delante. Este guardián
 *    exige que sigan **fuera** del cromo — si alguno vuelve a subir al riel,
 *    la cuenta pasa de 5 y muerde.
 * 4. **Ninguna ruta se pierde.** Ese invariante ya lo defiende
 *    `v15-flow-rail-cableado`; aquí no se duplica, se cita.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 *   destinos primarios de médico      antes 23 (Sidebar) → 5 (riel)
 *   destinos en la barra del pulgar                        4 + acción central
 *   destinos que bajaron a /operaciones                    18, a un gesto más
 *
 * Probado al revés, y con la vara vieja al lado para ver la diferencia:
 *
 *   defecto inyectado                        vara vieja        vara nueva
 *   /farmacia sube al riel (6 enlaces)       ROJA (cuenta 6)   ROJA (casos 1 y 3)
 *   6 destinos en bucle, UN nodo JSX         **VERDE**         ROJA (caso 1)
 *
 * La segunda fila es la razón de existir de este archivo: **el caso de conteo
 * viejo pasó en verde con seis destinos en el riel**, porque contaba un nodo.
 * (La otra prueba se puso roja, sí — pero por su caso de reachability y por
 * otra cosa: dejaba de *ver* rutas que antes leía como literales. Es una queja
 * distinta, y se habría callado si esas rutas siguieran listadas en otro
 * sitio.)
 *
 * ── LO QUE ESTE INSTRUMENTO SABE DE SÍ MISMO ────────────────────────────────
 *
 * Contar `href` en el fuente **también** tiene un punto ciego, y es el mismo
 * que mata a la cuenta de etiquetas: un `{ITEMS.map(i => <RailLink
 * href={i.href} …/>)}` daría **un** `href` para veinte destinos. Escribir un
 * guardián nuevo sin verlo habría sido cambiar una ceguera por otra.
 *
 * Por eso el caso 1 lleva una **guarda de validez**: si aparece un bucle
 * dentro del `<nav>`, la prueba se pone roja diciendo que **el instrumento
 * dejó de valer**, en vez de seguir dando un número. Un instrumento que no
 * sabe cuándo dejó de medir es peor que ninguno — es la lección de RTC-02.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No juzga si los cinco contextos son los correctos.** Que Hoy · Paciente ·
 *   Encuentro · Seguimiento sean los cuatro clínicos es decisión de producto
 *   (§14, sitemap IA-001); esto mide el TAMAÑO, no la elección.
 * · **No mide gestos en navegador.** «Un gesto más» se deduce de la estructura
 *   —el destino no está en el cromo, luego hay que entrar a `/operaciones`—,
 *   no de un cronómetro sobre la pantalla.
 * · No cubre el modo Secretaria: su navegación sigue siendo `Sidebar` y no es
 *   sujeto de esta fase.
 * · **No dice que 5 sea suficiente.** Dice que 5 es lo que hay y que crecer
 *   duele. Si el dueño decide que Encuentro no es un contexto, esta prueba no
 *   tiene opinión — se cambia la lista y el número se recalcula solo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const FLOW_RAIL = leer('src/components/FlowRail.tsx')
const BOTTOM_NAV = leer('src/components/BottomNav.tsx')
const OPERACIONES = leer('src/app/(dashboard)/operaciones/page.tsx')

/**
 * Los `href` que pinta el riel dentro de su `<nav>`.
 *
 * Se recorta al `<nav>` a propósito: el pie del riel lleva «Cerrar sesión»
 * (acción, no destino) y la cabecera lleva «Buscar…» (acción). Contar el
 * archivo entero mezclaría cromo con navegación.
 *
 * Se aceptan las dos formas —`href="/x"` y `href={VARIABLE}`— porque el
 * Encuentro es dinámico: su destino depende de si hay uno abierto. Un
 * destino calculado sigue siendo UN destino.
 */
function destinosDelRiel(): string[] {
  const i = FLOW_RAIL.indexOf('<nav className="sidebar-nav"')
  const j = FLOW_RAIL.indexOf('</nav>', i)
  if (i === -1 || j === -1) throw new Error('el riel ya no tiene un <nav>: revisa este instrumento antes que el producto')
  const nav = FLOW_RAIL.slice(i, j)
  return [...nav.matchAll(/href=(?:"([^"]+)"|\{([A-Za-z][\w.]*)\})/g)].map(m => m[1] ?? `{${m[2]}}`)
}

/** Los destinos declarados de la barra del pulgar en el shell V15. */
function destinosDelPulgar(): string[] {
  const i = BOTTOM_NAV.indexOf('const CONTEXTOS_V15: Item[] = [')
  const j = BOTTOM_NAV.indexOf('\n]', i)
  if (i === -1) throw new Error('CONTEXTOS_V15 ya no se declara: revisa este instrumento')
  return [...BOTTOM_NAV.slice(i, j).matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
}

/** Los destinos que viven en el índice de operaciones. */
function destinosDeOperaciones(): string[] {
  const i = OPERACIONES.indexOf('const GRUPOS:')
  const j = OPERACIONES.indexOf('\n]', i)
  if (i === -1) throw new Error('GRUPOS ya no se declara en /operaciones: revisa este instrumento')
  return [...OPERACIONES.slice(i, j).matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
}

describe('RTC-20 — el riel redujo el cromo, no sólo mudó las rutas', () => {
  it('1 · el riel pinta como mucho 5 DESTINOS (contados por href, no por etiqueta)', () => {
    /**
     * GUARDA DE VALIDEZ, ANTES DEL NÚMERO.
     *
     * Contar `href` en el fuente vale mientras los enlaces se escriban uno a
     * uno. Un `.map(` dentro del `<nav>` convertiría veinte destinos en un
     * solo `href={i.href}` y esta prueba daría «1 destino» tan tranquila —
     * exactamente el defecto que RTC-20 vino a arreglar, reencarnado en su
     * propio arreglo. Si eso pasa, aquí se para: primero se arregla el
     * instrumento, después se mide el producto.
     */
    const i = FLOW_RAIL.indexOf('<nav className="sidebar-nav"')
    const nav = FLOW_RAIL.slice(i, FLOW_RAIL.indexOf('</nav>', i))
    expect(
      nav.includes('.map('),
      'el riel genera enlaces en bucle: contar href ya no mide destinos — arregla este instrumento antes de creerte el número',
    ).toBe(false)

    const destinos = destinosDelRiel()
    expect(destinos.length, `el riel navega a: ${destinos.join(', ')}`).toBeLessThanOrEqual(5)
    // Y no es que el instrumento no encuentre nada: eso pasaría por 0.
    expect(destinos.length).toBeGreaterThanOrEqual(4)
    expect(new Set(destinos).size, 'un destino repetido es una decisión repetida').toBe(destinos.length)
  })

  it('2 · la barra del pulgar no es un riel más largo disfrazado', () => {
    /**
     * §14 se mide en el cromo que el médico tiene delante, y en el teléfono
     * ese cromo es el pulgar. Si el riel adelgaza y la barra engorda, el
     * producto no ha reducido nada: ha movido el bulto de ancho.
     */
    const pulgar = destinosDelPulgar()
    expect(pulgar.length, `la barra navega a: ${pulgar.join(', ')}`).toBeLessThanOrEqual(5)
    expect(new Set(pulgar).size).toBe(pulgar.length)
  })

  it('3 · lo que bajó a /operaciones se QUEDA fuera del cromo persistente', () => {
    /**
     * AQUÍ ESTÁ LA REDUCCIÓN, Y ES LO ÚNICO QUE LA DISTINGUE DE UNA MUDANZA.
     *
     * Los 18 destinos administrativos cuestan hoy un gesto más: hay que entrar
     * a `/operaciones`. Ése es el trato. Si alguno vuelve a asomar al riel o a
     * la barra, el trato se deshizo — y como la reachability seguiría en
     * verde, nadie se enteraría sin este caso.
     *
     * `/operaciones` es la excepción declarada: es la puerta del índice, no
     * uno de sus destinos.
     */
    const cromo = new Set([...destinosDelRiel(), ...destinosDelPulgar()])
    const ops = destinosDeOperaciones().filter(r => r !== '/operaciones')
    expect(ops.length, 'el índice de operaciones se quedó sin destinos: revisa el instrumento').toBeGreaterThanOrEqual(15)

    const reasomadas = ops.filter(r => cromo.has(r))
    expect(reasomadas, `destinos administrativos de vuelta en el cromo: ${reasomadas.join(', ')}`).toEqual([])
  })

  it('4 · el índice administrativo entra UNA vez, y subordinado', () => {
    // Una segunda puerta al mismo índice es un destino que no informa.
    expect(destinosDelRiel().filter(r => r === '/operaciones')).toHaveLength(1)
    expect(FLOW_RAIL).toMatch(/href="\/operaciones"[\s\S]{0,320}subordinado/)
  })

  it('5 · el riel sigue sin declarar un almacén de destinos', () => {
    /**
     * El defecto de la línea base era un `const NAV` de 23 filas. Que el riel
     * no lo tenga es lo que hace que el caso 1 pueda contar `href` a mano; si
     * un día hiciera falta un arreglo, este caso se cambia por su lectura —
     * pero entonces habrá que mirar el caso 1, que es de lo que avisa.
     */
    expect(FLOW_RAIL).not.toMatch(/const NAV\s*:/)
  })
})
