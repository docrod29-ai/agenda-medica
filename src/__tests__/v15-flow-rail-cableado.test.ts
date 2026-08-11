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
 *    en algún grupo de `/operaciones`. Ninguna se perdió en la reforma de IA.
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

  it('el cajón móvil decide igual — el mismo componente en los dos lugares donde vivía Sidebar', () => {
    expect(LAYOUT).toContain('? <FlowRail onNavigate={() => setSidebarOpen(false)} />')
    expect(LAYOUT).toContain(': <Sidebar onClose={() => setSidebarOpen(false)} />')
  })
})

describe('V15 — FlowRail no reconstruye el almacén de 20+ destinos', () => {
  it('no declara un arreglo NAV al estilo Sidebar (eso sería reincidir en el defecto medido en BASELINE.md)', () => {
    expect(FLOW_RAIL).not.toMatch(/const NAV\s*:/)
  })

  it('expone como máximo 5 RailLink/acciones primarias', () => {
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

  it('toda ruta del Sidebar de médico (NAV + Guía + Configuración) sigue alcanzable desde FlowRail u Operaciones', () => {
    const rutasAntiguas = [...hrefsDeArreglo(SIDEBAR, /const NAV:/), '/guia', '/configuracion']
    expect(rutasAntiguas.length).toBeGreaterThanOrEqual(21)

    const rutasFlowRail = [...FLOW_RAIL.matchAll(/href="([^"{]+)"/g)].map(m => m[1])
    const rutasOperaciones = hrefsDeArreglo(OPERACIONES, /const GRUPOS:/)
    const alcanzables = new Set([...rutasFlowRail, ...rutasOperaciones])

    const huerfanas = rutasAntiguas.filter(r => !alcanzables.has(r))
    expect(huerfanas).toEqual([])
  })
})
