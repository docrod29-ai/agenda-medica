/**
 * RTC-06 (V15-ORIGINALITY-REDTEAM-001, registro canónico; ORT-05 + RT-11) —
 * Hoy tiene UNA acción primaria, y es CLÍNICA.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Los dos paneles del equipo rojo (13-ago-2026) midieron la jerarquía de
 * acción de /dashboard invertida, cada uno por su lado:
 *
 * · El comentario del código decía «la ÚNICA acción primaria de la pantalla»
 *   sobre «Nueva cita» (ADMIN, agenda una cita) mientras el héroe NOW pintaba
 *   «Iniciar consulta» (CLÍNICA) con el mismo relleno cobalto — dos primarias
 *   co-iguales, y la administrativa arriba (ORT-05).
 * · Con 6 citas del día, la agenda pintaba SEIS botones «Consulta» rellenos
 *   idénticos al CTA del héroe: 7 rellenos en un viewport. Si todo es
 *   primario, nada lo es (RT-11).
 * · El saludo («Buenos días, Dr. X») era el texto MÁS grande de la pantalla
 *   (32px display): pesaba más que el paciente que sigue — decoración
 *   ganándole al trabajo (RT-11: «el saludo pesa más que el NOW»).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. UN solo relleno primario en la pantalla: el CTA clínico del héroe NOW
 *    (`.prox-hero-cta`, «Iniciar consulta») — la cita INMINENTE es la única
 *    que lleva relleno.
 * 2. «Nueva cita» (header) es `variant="secondary"`: disponible, subordinada.
 * 3. Los «Consulta» por fila de agenda son `btn-secondary`: la acción existe
 *    en cada fila (la conducta no cambió), pero sólo la inminente domina.
 * 4. El saludo es un KICKER (junto a la fecha, tamaño de metadato), no un
 *    display de 32px: el elemento dominante de Hoy es el paciente que sigue.
 *
 * Probado al revés: contra el árbol previo a este cambio fallan los casos
 * 1 al 5 (verificado en esta corrida antes de aplicar el arreglo).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El peso PINTADO (getComputedStyle) y el orden visual real los mide el
 *   arnés de navegador (`capturar-hoy-una-primaria-v15.mjs`): aquí sólo se
 *   vigila la fuente, como sus guardianes hermanos.
 * · No cubre el shell móvil (FAB central «Nueva cita» + supresión del CTA del
 *   header en móvil): eso es RTC-07, la siguiente deuda del registro.
 * · No cubre la estructura de zonas del héroe vs las tarjetas (ORT-10, P2).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGINA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'),
  'utf8',
)
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('RTC-06 — una sola acción primaria, y es clínica', () => {
  it('1 · el único relleno primario es el CTA clínico del héroe (prox-hero-cta)', () => {
    // Ningún botón de la página usa la clase de relleno primario del sistema…
    expect(PAGINA).not.toContain('btn-primary')
    /**
     * …y el CTA del héroe existe, una sola vez. VARA MUDADA, NO BAJADA
     * (V15-A11Y-001, «el botón que navega»): antes se contaban las
     * apariciones del TEXTO `prox-hero-cta`, y ahora la cabecera del enlace
     * explica en prosa por qué dejó de ser un `<button>` dentro del `<a>`. Se
     * cuenta el ATRIBUTO, que es lo que el invariante siempre quiso decir:
     * un solo control lleva el relleno primario.
     */
    expect(PAGINA.match(/className="prox-hero-cta"/g)?.length).toBe(1)
  })

  it('2 · «Nueva cita» NO vive en la cabecera clínica — y sigue sin ser primaria', () => {
    /**
     * VARA ENDURECIDA DOS VECES, Y LA SEGUNDA LA PIDIÓ UNA MEDICIÓN.
     *
     * v1: el control era `<Link><Button…></Link>` y este caso exigía que fuera
     *     `secondary` en la cabecera — que no compitiera con «Iniciar consulta».
     * v2: pasó a `ButtonLink` (un enlace que parece botón, sin un botón dentro:
     *     §24, dos paradas de teclado para un destino). Misma exigencia.
     * v3 (ésta): bajarle el peso NO bastaba. La medición de anatomía §29
     *     encontró que «Nueva cita» seguía siendo **la primera acción
     *     consecuente de Hoy, a 8px**: lo primero que la pantalla clínica
     *     ofrecía hacer era administración. El peso no cambia el orden; el
     *     sitio sí. La acción se mudó al bloque de la AGENDA, que es de lo que
     *     habla, y la cabecera se quedó sin ninguna acción.
     *
     * Lo que este caso defiende ahora es más fuerte que antes: no que la acción
     * administrativa pese poco, sino que **no esté en la cabecera clínica**.
     */
    const cabecera = PAGINA.slice(PAGINA.indexOf('<header className="hoy-head'), PAGINA.indexOf('</header>'))
    expect(cabecera).not.toMatch(/Nueva cita/)
    expect(cabecera).not.toMatch(/<ButtonLink|<Button\b/)

    // Sigue existiendo, y sigue sin ser primaria: mudarla no es amputarla.
    expect(PAGINA).toMatch(/Nueva cita/)
    expect(PAGINA).not.toMatch(/variant="primary"[^>]*>\s*Nueva cita/)
    // Y vive donde habla: el bloque de la agenda.
    expect(PAGINA).toMatch(/hoy-bloque-acciones[\s\S]{0,400}Nueva cita/)
  })

  it('3 · el «Consulta» por fila es btn-secondary: presente, no dominante', () => {
    const fila = PAGINA.slice(PAGINA.indexOf('function AppointmentRow'), PAGINA.indexOf('function ProxHero'))
    expect(fila).toContain('btn btn-secondary btn-sm')
  })

  it('4 · el comentario ya no miente: no queda la frase «la ÚNICA acción primaria» sobre el header', () => {
    expect(PAGINA).not.toContain('la ÚNICA acción primaria')
  })

  it('5 · el saludo es kicker: sin display de 32px ni la clase nx-display en el h1', () => {
    expect(PAGINA).not.toMatch(/className="nx-display hoy-saludo"/)
    const bloque = CSS.slice(CSS.indexOf('.hoy-saludo {'), CSS.indexOf('}', CSS.indexOf('.hoy-saludo {')))
    expect(bloque).not.toContain('font-size: 32px')
    // El kicker vive en la escala de metadato (≤15px), no en la de display.
    expect(bloque).toMatch(/font-size: 1[0-5]/)
    // Y la ampliación móvil a 26px del saludo murió con él.
    expect(CSS).not.toMatch(/\.hoy-saludo \{ font-size: 26px; \}/)
  })

  it('6 · la conducta no cambió: mismos href y el mismo puedeIniciar por fila', () => {
    expect(PAGINA).toContain('href="/asistente"')
    expect(PAGINA).toContain('router.push(`/consulta/${appt.pacienteId}`)')
    expect(PAGINA).toContain('const puedeIniciar = puedeConsultar && !isPast && !!appt.pacienteId')
  })
})
