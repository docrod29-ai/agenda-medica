/**
 * V15-ENCOUNTER-MODE-001 (Fase 5, §8.1 «navigation visually quiets») — el
 * FlowRail baja de peso visual mientras el médico graba, en vez de quedarse
 * con el mismo peso íntegro al lado del marco perimetral de
 * `MarcoEscuchando` — SIN violar contraste WCAG en el intento.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * La medición de baseline de esta fase (`agent-state/V15_CURRENT_ITERATION.md`)
 * encontró que `FlowRail.tsx` no tenía NINGUNA referencia a `EVENTO_GRABANDO`
 * — la navegación no reaccionaba en absoluto a que el médico estuviera
 * grabando. La primera versión de este cambio atenuaba TODO (etiquetas de
 * texto incluidas) con `opacity` plano y el propio arnés de verificación en
 * navegador real (`scripts/design/capturar-flow-rail-quieto-v15.mjs`) lo cazó
 * como una violación axe `color-contrast` nueva: `--text3` sobre `--s1` mide
 * apenas ~5.6:1 en modo oscuro, sin margen para atenuar sin caer bajo el
 * mínimo AA de 4.5:1. Este guardián protege la forma corregida:
 *
 * 1. `FlowRail` se suscribe al MISMO `EVENTO_GRABANDO` (`@/lib/seguridad/
 *    estoy-grabando`) que ya usan sus hermanos — no inventa un segundo
 *    evento ni un segundo criterio de "estoy grabando".
 * 2. Las ETIQUETAS de texto de navegación (los `<span>` de label dentro de
 *    `RailLink`) y el nombre del consultorio NUNCA llevan una clase que las
 *    atenúe o las oculte — deben seguir exactamente con su contraste de
 *    siempre.
 * 3. Sólo dos clases cambian con el estado "quieto": `.nx-flow-rail-quiet-icon`
 *    (SVG decorativos — sujetos a un umbral de contraste no-textual de 3:1,
 *    no 4.5:1, así que sí hay margen) y `.nx-flow-rail-quiet-hide` (texto
 *    puramente secundario y NO interactivo — nombre del médico, correo,
 *    "⌘K", rótulo "Operaciones" — que se oculta de verdad porque nunca
 *    recibe el foco de teclado, así que ocultarlo no rompe tabulación).
 * 4. El contexto activo (`.nav-item.active`, que durante una consulta es
 *    siempre «Encuentro» porque `EVENTO_GRABANDO` sólo lo emite
 *    `useGrabacionAudio`, usado hoy sólo en `/consulta/[patientId]`) nunca
 *    pierde el ícono ni el texto — sólo los ítems NO activos atenúan su
 *    ícono.
 *
 * Probado al revés: se verificó contra el árbol previo a este cambio (sin
 * `useGrabando`, sin `EVENTO_GRABANDO`, sin ninguna de las dos clases) que
 * los seis casos fallan — es exactamente el defecto que midió la corrida de
 * baseline. También se verificó, a mitad de esta misma corrida, que la
 * PRIMERA versión (con `.nx-flow-rail-quietable` de `opacity` plano sobre
 * texto) hacía fallar el caso 2 (la etiqueta SÍ llevaba una clase que la
 * atenuaba) — es el defecto de contraste que el propio arnés de esta corrida
 * encontró y que motivó la reescritura.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni dispara el evento en jsdom: análisis estático de
 *   fuente, mismo patrón que el resto de guardianes `v15-*-cableado` de esta
 *   fase (el repo no usa @testing-library/react). La verificación de que la
 *   opacidad/visibilidad cambia DE VERDAD y que axe sigue en 0 violaciones
 *   nuevas es del arnés de capturas de esta corrida
 *   (`capturar-flow-rail-quieto-v15.mjs`).
 * · No cubre `InstrumentStrip` — ese componente ya pinta "Grabando · mm:ss"
 *   desde V15-SHELL-GREYBOX-001 y no se tocó en esta corrida.
 * · No cubre el resto de los 9 comportamientos de §8 (acción primaria
 *   dominante en el cierre, admin no esencial dentro de la página) — quedan
 *   para una corrida siguiente de esta misma fase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FLOW_RAIL = leer('src/components/FlowRail.tsx')
const GLOBALS_CSS = leer('src/app/globals.css')

describe('V15 — FlowRail se suscribe a EVENTO_GRABANDO, no inventa una fuente nueva', () => {
  it('importa EVENTO_GRABANDO del módulo único (@/lib/seguridad/estoy-grabando)', () => {
    expect(FLOW_RAIL).toContain(
      "import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'"
    )
  })

  it('escucha y limpia el listener (addEventListener + removeEventListener del mismo evento)', () => {
    expect(FLOW_RAIL).toMatch(/window\.addEventListener\(EVENTO_GRABANDO, alSonar\)/)
    expect(FLOW_RAIL).toMatch(/window\.removeEventListener\(EVENTO_GRABANDO, alSonar\)/)
  })

  it('no declara un segundo nombre de evento literal para "estoy grabando"', () => {
    expect(FLOW_RAIL).not.toMatch(/addEventListener\(['"]nx:/)
  })

  it('el <aside> añade la clase nx-flow-rail--quieto sólo cuando useGrabando() es true', () => {
    expect(FLOW_RAIL).toContain(
      "className={`sidebar nx-flow-rail${grabando ? ' nx-flow-rail--quieto' : ''}`}"
    )
  })
})

describe('V15 — las etiquetas de navegación NUNCA se atenúan ni se ocultan', () => {
  it('el <span> de label dentro de RailLink no lleva clase de atenuado/ocultado', () => {
    expect(FLOW_RAIL).toContain("<span style={{ flex: 1 }}>{label}</span>")
  })

  it('el nombre del consultorio (identidad) no lleva nx-flow-rail-quiet-hide ni nx-flow-rail-quiet-icon', () => {
    expect(FLOW_RAIL).toContain(
      "<div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>"
    )
  })

  it('no queda ningún rastro de la clase anterior de opacidad plana sobre texto (nx-flow-rail-quietable)', () => {
    expect(FLOW_RAIL).not.toContain('nx-flow-rail-quietable')
    expect(GLOBALS_CSS).not.toContain('nx-flow-rail-quietable')
  })
})

describe('V15 — sólo íconos decorativos y texto secundario no interactivo cambian', () => {
  it('los tres íconos decorativos (marca, buscar, cerrar sesión) llevan nx-flow-rail-quiet-icon', () => {
    expect(FLOW_RAIL).toContain('<MarcaAusculta size={20} />')
    expect(FLOW_RAIL).toContain('<Search size={15} className="nx-flow-rail-quiet-icon" />')
    expect(FLOW_RAIL).toContain('<LogOut size={16} className="nx-flow-rail-quiet-icon" />')
  })

  it('los cuatro textos secundarios (médico, ⌘K, rótulo Operaciones, correo) llevan nx-flow-rail-quiet-hide', () => {
    expect(FLOW_RAIL.match(/nx-flow-rail-quiet-hide/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('RailLink no añade ninguna clase de atenuado a los items inactivos — sólo distingue active', () => {
    expect(FLOW_RAIL).toContain("className={`nav-item${activo ? ' active' : ''}`}")
  })
})

describe('V15 — CSS: ícono se atenúa con opacity, texto secundario se oculta de verdad', () => {
  it('.nx-flow-rail-quiet-icon usa opacity (margen WCAG no-textual), no display:none', () => {
    const inicio = GLOBALS_CSS.indexOf('.nx-flow-rail--quieto .nx-flow-rail-quiet-icon,')
    expect(inicio).toBeGreaterThanOrEqual(0)
    const bloque = GLOBALS_CSS.slice(inicio, GLOBALS_CSS.indexOf('}', inicio))
    expect(bloque).toContain('opacity')
    expect(bloque).not.toContain('display: none')
    expect(bloque).not.toContain('display:none')
  })

  it('.nx-flow-rail-quiet-hide usa display:none — se oculta, no se atenúa', () => {
    const inicio = GLOBALS_CSS.indexOf('.nx-flow-rail--quieto .nx-flow-rail-quiet-hide {')
    expect(inicio).toBeGreaterThanOrEqual(0)
    const bloque = GLOBALS_CSS.slice(inicio, GLOBALS_CSS.indexOf('}', inicio))
    expect(bloque).toContain('display: none')
  })

  it('los íconos no activos también se atenúan por selector estructural (.nav-item:not(.active) .nav-icon)', () => {
    expect(GLOBALS_CSS).toContain('.nx-flow-rail--quieto .nav-item:not(.active) .nav-icon')
  })

  it('el foco/hover de los controles restaura el peso normal del ícono que contienen', () => {
    expect(GLOBALS_CSS).toContain('.nx-flow-rail--quieto .nav-item:hover .nav-icon,')
    expect(GLOBALS_CSS).toContain('.nx-flow-rail--quieto .nav-item:focus .nav-icon {')
  })
})
