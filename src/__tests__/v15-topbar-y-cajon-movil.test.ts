/**
 * V15-MOBILE-001 (segunda rebanada) — el móvil del médico NO lleva el árbol
 * de navegación de escritorio dentro de un cajón, y Buscar por fin tiene
 * entrada en el teléfono.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Hasta el 12-ago-2026 el layout clonaba `FlowRail` COMPLETO dentro de un
 * `role="dialog"` deslizante para móvil — exactamente lo que §22 del master
 * loop V15 prohíbe («Do not expose the complete desktop navigation tree on
 * mobile»). Dos consecuencias medidas, no supuestas:
 *
 *   1. axe marcó `landmark-unique` en TODAS las corridas de captura de esta
 *      fase (v15-today-continuidad, v15-patient-anchor, v15-clinical-spine…):
 *      dos `<aside aria-label="Navegación clínica principal">` en el DOM — el
 *      fijo de escritorio y el clon del cajón (translateX(-100%) lo esconde
 *      del ojo, no del árbol de accesibilidad).
 *   2. El médico tenía DOS modelos de navegación en la misma pantalla móvil:
 *      BottomNav con los 5 contextos (primera rebanada) Y una hamburguesa que
 *      abría los mismos 5 en cajón — dos mapas para el mismo territorio.
 *
 * Además SEARCH/COMMAND (quinto contexto de la IA de V15) no tenía NINGUNA
 * entrada móvil fuera de ese cajón: ⌘K no existe en un teléfono.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El fingerprint `landmark-unique` venía arrastrándose como «preexistente, no
 * de esta corrida» desde V15-SHELL-GREYBOX-001; la medición de baseline de
 * V15-MOBILE-001 lo señaló como deuda estructural del cajón, no como un
 * aria-label a renombrar. Renombrar el label habría callado a axe dejando el
 * defecto de §22 intacto — un reskin del síntoma.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. El cajón móvil (backdrop + dialog) se renderiza SÓLO cuando
 *    `!navPrimaria` — la asistente lo conserva; el médico no lo tiene.
 * 2. Dentro del cajón va `Sidebar` (asistente). `FlowRail` se renderiza UNA
 *    sola vez en el layout (el fijo de escritorio) — sin clon, no puede
 *    haber landmark duplicado.
 * 3. La hamburguesa («Abrir menú») vive sólo en la rama de asistente; el
 *    médico lleva en su lugar un botón Buscar en el borde derecho de la
 *    topbar (pulgar, §22) que dispara `nexus:open-palette`.
 * 4. Los dos lados del enlace («el dato tiene que llegar»): el evento que
 *    dispara la topbar es EXACTAMENTE el que `PaletteBusqueda` escucha, y la
 *    paleta está habilitada para el médico en este mismo layout.
 * 5. «Cerrar sesión» — que sólo vivía en el cajón retirado — existe en
 *    /operaciones (área de sistema, §11) con el MISMO `salirSeguro` de
 *    FlowRail/Sidebar, no una salida propia con otro criterio de purga.
 *
 * Probada al revés (git stash del layout previo): los casos 1, 2, 3 y el de
 * /operaciones fallan contra el árbol anterior a este cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No verifica el DOM real ni que axe deje de marcar `landmark-unique` — eso
 *   lo mide `scripts/design/capturar-topbar-movil-v15.mjs` en navegador real.
 * · No cubre la ergonomía táctil (44×44 del botón) — `.mobile-topbar-btn` ya
 *   la fija en globals.css y el arnés la mide.
 * · No cubre el caso «médico en modo secretaria» más allá de que cae en la
 *   rama de asistente (navPrimaria es falso ahí por diseño, ver FlowRail).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const PALETA = leer('src/components/PaletteBusqueda.tsx')
const OPERACIONES = leer('src/app/(dashboard)/operaciones/page.tsx')

describe('V15-MOBILE-001 — el cajón móvil es sólo de asistente', () => {
  it('el cajón (backdrop + dialog) está dentro de la compuerta !navPrimaria', () => {
    const gate = LAYOUT.indexOf('{!navPrimaria && (<>')
    const dialog = LAYOUT.indexOf('role="dialog"')
    const cierre = LAYOUT.indexOf('</>)}', gate)
    expect(gate).toBeGreaterThanOrEqual(0)
    expect(dialog).toBeGreaterThan(gate)
    expect(dialog).toBeLessThan(cierre)
  })

  it('dentro del cajón va Sidebar, no un clon de FlowRail', () => {
    expect(LAYOUT).toContain('<Sidebar onClose={() => setSidebarOpen(false)} />')
    expect(LAYOUT).not.toContain('<FlowRail onNavigate=')
  })

  it('FlowRail se renderiza UNA sola vez (el fijo de escritorio) — sin clon no hay landmark duplicado', () => {
    const usos = LAYOUT.match(/<FlowRail\b/g) ?? []
    expect(usos.length).toBe(1)
  })
})

describe('V15-MOBILE-001 — la topbar del médico: Buscar en vez de hamburguesa', () => {
  it('la hamburguesa «Abrir menú» vive sólo en la rama de asistente', () => {
    // El botón existe (asistente lo necesita)…
    expect(LAYOUT).toContain('aria-label="Abrir menú"')
    // …pero condicionado: entre el arranque de la topbar y el botón hay un
    // `{!navPrimaria && (`. Se localiza el botón y se busca la compuerta antes.
    const topbar = LAYOUT.indexOf('className="mobile-topbar"')
    const boton = LAYOUT.indexOf('aria-label="Abrir menú"')
    const compuerta = LAYOUT.indexOf('{!navPrimaria && (', topbar)
    expect(compuerta).toBeGreaterThan(topbar)
    expect(compuerta).toBeLessThan(boton)
  })

  it('el médico lleva un botón Buscar que dispara nexus:open-palette', () => {
    const topbar = LAYOUT.indexOf('className="mobile-topbar"')
    const buscar = LAYOUT.indexOf('aria-label="Buscar paciente o acción"')
    expect(buscar).toBeGreaterThan(topbar)
    // Condicionado a navPrimaria (la asistente no tiene paleta habilitada).
    const compuertaMedico = LAYOUT.lastIndexOf('{navPrimaria && (', buscar)
    expect(compuertaMedico).toBeGreaterThan(topbar)
    // Y dispara el evento real, no uno con nombre parecido.
    const bloque = LAYOUT.slice(compuertaMedico, buscar)
    expect(bloque).toContain("window.dispatchEvent(new Event('nexus:open-palette'))")
  })

  it('los dos lados del enlace: la paleta ESCUCHA ese evento y está habilitada para el médico', () => {
    expect(PALETA).toContain("window.addEventListener('nexus:open-palette'")
    expect(LAYOUT).toContain('<PaletteBusqueda enabled={esMedicoReal}')
  })
})

describe('V15-MOBILE-001 — Cerrar sesión sobrevive a la retirada del cajón', () => {
  it('/operaciones ofrece Cerrar sesión con el MISMO salirSeguro, no una salida propia', () => {
    expect(OPERACIONES).toContain('Cerrar sesión')
    expect(OPERACIONES).toContain("import { salirSeguro } from '@/lib/salir-seguro'")
    expect(OPERACIONES).toContain("void salirSeguro('/login')")
    // No importa signOut de firebase directamente (eso saltaría la purga de
    // IndexedDB que salirSeguro garantiza — regla PHI de security-tenant).
    expect(OPERACIONES).not.toMatch(/from ['"]firebase\/auth['"]/)
  })
})
