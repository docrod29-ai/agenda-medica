/**
 * V15-SHELL-GREYBOX-001 — el FlowRail de ≤5 contextos está CONECTADO, y
 * ninguna de las 23 rutas del `Sidebar` antiguo se perdió en la mudanza.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * `docs/design/capturas/v15-baseline-before/BASELINE.md` midió 23 destinos
 * primarios de médico en `Sidebar.tsx` contra el objetivo del routine V15 de
 * ≤5. El riesgo de construir `FlowRail` como componente aislado es la MISMA
 * familia de defecto que ya pasó con `.nx-stat-grid`
 * (`nx-stat-grid-cableada.test.ts`): que exista y no esté enchufado en
 * `layout.tsx`, o que al mudar los 18 destinos restantes a `/operaciones`
 * alguno se quede sin ruta de entrada (la regla «el dato tiene que LLEGAR»,
 * aplicada a navegación en vez de a datos).
 *
 * ── LO QUE VERIFICA ──────────────────────────────────────────────────────────
 *
 * 1. `layout.tsx` renderiza `FlowRail` — no `Sidebar` — quan `esMedicoReal &&
 *    mode === 'medico'`, en escritorio Y en el cajón móvil (dos sitios,
 *    porque `Sidebar` también se renderiza dos veces en ese archivo).
 * 2. `FlowRail` expone como máximo 5 contextos primarios de ruta/acción
 *    (Hoy, Paciente, Encuentro, Seguimiento, Buscar) — no una lista de 20+.
 * 3. Toda ruta que vivía en el `Sidebar` de médico (los 21 `NAV` + Guía +
 *    Configuración) sigue siendo alcanzable: o quedó en `FlowRail`, o quedó
 *    en algún grupo de `/operaciones`, o —desde RTC-09— es una capacidad que
 *    vive en el PACIENTE (`CAPACIDADES_DEL_PACIENTE`). Ninguna se perdió en la
 *    reforma de IA.
 *
 * Probado al revés: si a `layout.tsx` se le quita la rama `navPrimaria` y
 * vuelve a renderizar `<Sidebar />` sin condición, el caso 1 falla. Si se
 * borra un `href` de un grupo de `/operaciones` (p. ej. Farmacia), el caso 3
 * falla nombrando la ruta huérfana.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No verifica layout ni contraste en navegador real — eso es
 *   `scripts/design/capturar-stat-grid-v15.mjs` y su familia, pendiente para
 *   este shell en el arnés de captura de V15-SHELL-GREYBOX-001.
 * · No cubre el modo Secretaria: `Sidebar` sigue siendo su navegación y no es
 *   sujeto de esta fase (ver `docs/design/v15/IA-001-sitemap.md`, §5).
 * · No cubre `/consulta/[id]` dinámico como destino de ENCOUNTER: ese caso
 *   se prueba en navegador real, no por análisis estático de fuente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { RUTAS_DE_CAPACIDADES } from '@/lib/nav/capacidades-del-paciente'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const FLOW_RAIL = leer('src/components/FlowRail.tsx')
const SIDEBAR = leer('src/components/Sidebar.tsx')
const OPERACIONES = leer('src/app/(dashboard)/operaciones/page.tsx')

describe('V15 — FlowRail conectado en layout.tsx (medico), no huérfano', () => {
  it('layout.tsx importa FlowRail e InstrumentStrip', () => {
    expect(LAYOUT).toContain("import { FlowRail } from '@/components/FlowRail'")
    expect(LAYOUT).toContain("import { InstrumentStrip } from '@/components/InstrumentStrip'")
  })

  it('el escritorio decide entre FlowRail y Sidebar según navPrimaria, no renderiza Sidebar fijo', () => {
    expect(LAYOUT).toContain('const navPrimaria = esMedicoReal')
    expect(LAYOUT).toContain('{navPrimaria ? <FlowRail /> : <Sidebar />}')
  })

  it('el cajón móvil es SÓLO de asistente desde V15-MOBILE-001 — el médico no lleva el árbol de escritorio en un dialog', () => {
    // Conducta nueva (§22): el cajón se renderiza sólo cuando !navPrimaria, y
    // dentro va Sidebar (asistente). FlowRail ya NO se clona dentro del dialog —
    // eso duplicaba el <aside> y era «shrunk desktop». El detalle fino vive en
    // v15-topbar-y-cajon-movil.test.ts; aquí sólo el cableado grueso.
    expect(LAYOUT).toContain('{!navPrimaria && (<>')
    expect(LAYOUT).toContain('<Sidebar onClose={() => setSidebarOpen(false)} />')
    expect(LAYOUT).not.toContain('<FlowRail onNavigate=')
  })
})

describe('V15 — FlowRail no reconstruye el almacén de 20+ destinos', () => {
  it('no declara un arreglo NAV al estilo Sidebar (eso sería reincidir en el defecto medido en BASELINE.md)', () => {
    expect(FLOW_RAIL).not.toMatch(/const NAV\s*:/)
  })

  it('expone como máximo 5 RailLink/acciones primarias', () => {
    /**
     * ── RTC-20 (14-ago-2026): ESTE CASO NO MIDE LO QUE PARECE ─────────────
     *
     * Cuenta **etiquetas JSX**, no destinos. Medido: con seis destinos
     * generados en bucle desde un solo `<RailLink`, este caso pasa **en
     * verde**. Y junto a la reachability de abajo certifica una MUDANZA —5
     * nodos arriba, 18 destinos en `/operaciones`— tan bien como una
     * reducción.
     *
     * No se borra, y es deliberado: sigue protegiendo la forma del marcado
     * (que nadie escriba veinte `<RailLink>` a mano) y su rojo es más fácil de
     * leer que el del instrumento fino. La medición de verdad —destinos
     * contados por `href`, cromo del pulgar incluido, y los administrativos
     * obligados a quedarse fuera— vive en
     * `v15-rtc20-el-riel-redujo-no-solo-mudo.test.ts`, que además sabe
     * declararse inválido si los enlaces pasan a generarse en bucle.
     */
    const railLinks = FLOW_RAIL.match(/<RailLink\b/g) ?? []
    // 4 rutas (Hoy, Paciente, Encuentro, Seguimiento) + Operaciones subordinada = 5 en el marcado,
    // más el botón de Buscar (acción, no <RailLink>) fuera de esa cuenta.
    expect(railLinks.length).toBeLessThanOrEqual(5)
    // SEARCH/COMMAND es acción, no ruta: se prueba por su cableado real al evento
    // que ya abre la paleta ⌘K (`PaletteBusqueda`), no por un texto de comentario.
    expect(FLOW_RAIL).toContain("window.dispatchEvent(new Event('nexus:open-palette'))")
  })
})

describe('V15 — plan de compatibilidad de rutas: nada de lo que vivía en Sidebar se perdió', () => {
  const hrefsDeArreglo = (fuente: string, nombreArreglo: RegExp): string[] => {
    const inicio = fuente.search(nombreArreglo)
    expect(inicio).toBeGreaterThanOrEqual(0)
    const cierre = fuente.indexOf('\n]', inicio)
    const bloque = fuente.slice(inicio, cierre === -1 ? undefined : cierre)
    return [...bloque.matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
  }

  it('toda ruta del Sidebar de médico (NAV + Guía + Configuración) sigue alcanzable desde FlowRail, Operaciones o el PACIENTE', () => {
    /**
     * EL MECANISMO CAMBIÓ EN RTC-09; EL INVARIANTE NO.
     *
     * Hasta hoy había dos superficies donde podía vivir una ruta que salió del
     * Sidebar: el `FlowRail` (lo primario) y `/operaciones` (lo secundario).
     * RTC-09 abrió una TERCERA que no existía cuando se escribió esta prueba:
     * la capacidad que vive en el PACIENTE (§3.2 — la IA es contextual). El
     * consultor y el antibiograma se fueron del índice administrativo a la
     * barra de Herramientas del expediente.
     *
     * El invariante que esta prueba defiende sigue siendo el mismo —«ninguna
     * ruta se quedó huérfana en la reforma de IA»— y por eso NO se le añade
     * una lista de excepciones escrita a mano: se lee la declaración real
     * (`CAPACIDADES_DEL_PACIENTE`). Si mañana alguien borra la fila del
     * expediente sin borrar la declaración, lo caza el guardián de RTC-09
     * (`v15-rtc09-ia-contextual`), que exige que el expediente la consuma.
     */
    const rutasAntiguas = [...hrefsDeArreglo(SIDEBAR, /const NAV:/), '/guia', '/configuracion']
    expect(rutasAntiguas.length).toBeGreaterThanOrEqual(21)

    const rutasFlowRail = [...FLOW_RAIL.matchAll(/href="([^"{]+)"/g)].map(m => m[1])
    const rutasOperaciones = hrefsDeArreglo(OPERACIONES, /const GRUPOS:/)
    const alcanzables = new Set([...rutasFlowRail, ...rutasOperaciones, ...RUTAS_DE_CAPACIDADES])

    const huerfanas = rutasAntiguas.filter(r => !alcanzables.has(r))
    expect(huerfanas).toEqual([])
  })
})
