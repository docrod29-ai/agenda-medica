/**
 * V15-MOBILE-001 (Fase 9, §22) — el móvil del médico navega por la MISMA IA
 * que el escritorio, y también se aquieta al grabar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Tras V15-SHELL-GREYBOX-001 el escritorio del médico navegaba por los cinco
 * contextos (Hoy · Paciente · Encuentro · Seguimiento · Operaciones), pero
 * `BottomNav` seguía con la IA VIEJA (Inicio · Agenda · Pacientes · CRM): el
 * mismo médico tenía DOS mapas mentales según el tamaño de su pantalla, y en
 * móvil no existía ninguna entrada a /pendientes (la cola de cierre) ni a
 * /operaciones. Además `BottomNav` ignoraba `EVENTO_GRABANDO` — deuda anotada
 * explícitamente desde V15-ENCOUNTER-MODE-001 («BottomNav.tsx no se suscribe
 * a EVENTO_GRABANDO → V15-MOBILE-001»).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Medición de baseline de la Fase 9: lectura de `BottomNav.tsx` contra los
 * cinco contextos del routine y contra la lista de deuda de
 * `agent-state/V15_CURRENT_ITERATION.md`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `V15-SHELL-GREYBOX-001` decidió a propósito no tocar móvil (Fase 9 diferida)
 * — correcto en su momento, pero nada impedía que la Fase 9 se olvidara de la
 * paridad: ningún guardián comparaba los destinos del pulgar con los del rail.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Cuando la navegación V15 aplica (`navPrimaria`, el MISMO criterio del
 *    layout que elige FlowRail vs Sidebar), los destinos-ruta del móvil son
 *    EXACTAMENTE los mismos hrefs que pinta FlowRail — comparado archivo
 *    contra archivo, no una lista copiada a mano en esta prueba.
 * 2. ENCUENTRO sigue siendo la acción central contextual (accionContextual),
 *    no una quinta pestaña.
 * 3. Al grabar, sólo se atenúan ÍCONOS de destinos no activos (WCAG 1.4.11);
 *    las etiquetas de texto y la acción central nunca (lección de contraste
 *    de FlowRail — `--text3` sobre `--s1` no tiene margen AA).
 * 4. La barra heredada (Secretaria / rol no-médico) queda intacta: COMMON,
 *    CRM/Chat y el filtro de `rutaPermitida` siguen ahí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No verifica el render real en un navegador (eso lo hace
 *   `scripts/design/capturar-bottom-nav-v15.mjs` contra los emuladores).
 * · No cubre la IA de la Secretaria — fuera del alcance de V15 por decisión
 *   escrita en FlowRail.tsx.
 * · No cubre BottomNav en escritorio: `.bottom-nav-wrap` lo oculta por CSS y
 *   esta prueba no mide CSS.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { iconoAtenuado } from '@/components/BottomNav'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const bottomNav = leer('src/components/BottomNav.tsx')
const flowRail = leer('src/components/FlowRail.tsx')
const layout = leer('src/app/(dashboard)/layout.tsx')

describe('V15-MOBILE-001 — la misma IA en el pulgar que en el escritorio', () => {
  it('el layout le pasa a BottomNav el MISMO criterio que elige FlowRail', () => {
    expect(layout).toMatch(/<BottomNav navPrimaria=\{navPrimaria\}/)
  })

  it('los destinos-ruta V15 del móvil son EXACTAMENTE los hrefs de FlowRail', () => {
    // Los hrefs literales que FlowRail pinta como RailLink (Encuentro usa una
    // variable contextual — no es un href literal y no debe serlo en móvil).
    const deFlowRail = [...flowRail.matchAll(/RailLink href="([^"]+)"/g)].map(m => m[1]).sort()
    // Los hrefs del bloque CONTEXTOS_V15 de BottomNav.
    const bloque = bottomNav.match(/const CONTEXTOS_V15[\s\S]*?^\]/m)?.[0] ?? ''
    const deBottomNav = [...bloque.matchAll(/href: '([^']+)'/g)].map(m => m[1]).sort()
    expect(deFlowRail.length).toBeGreaterThan(0)
    expect(deBottomNav).toEqual(deFlowRail)
  })

  it('el bloque V15 no revive Agenda ni CRM como destinos primarios', () => {
    const bloque = bottomNav.match(/const CONTEXTOS_V15[\s\S]*?^\]/m)?.[0] ?? ''
    expect(bloque).not.toContain('/calendario')
    expect(bloque).not.toContain('/crm')
  })

  it('ENCUENTRO sigue siendo la acción central contextual, no una quinta pestaña', () => {
    const bloque = bottomNav.match(/const CONTEXTOS_V15[\s\S]*?^\]/m)?.[0] ?? ''
    expect(bloque).not.toContain('/consulta')
    // La acción central existente sigue viva y sin condicionar a navPrimaria.
    expect(bottomNav).toMatch(/export function accionContextual/)
  })

  it('la barra heredada queda intacta: COMMON, CRM/Chat y rutaPermitida', () => {
    expect(bottomNav).toContain("href: '/calendario'")
    expect(bottomNav).toContain("href: '/crm'")
    expect(bottomNav).toContain("href: '/chat'")
    expect(bottomNav).toMatch(/filter\(it => rutaPermitida\(clinic, it\.href\)\)/)
  })
})

describe('V15-MOBILE-001 — §8.1 también en móvil: se aquieta al grabar', () => {
  it('se suscribe vía la compuerta compartida (RTC-04), no con una copia propia', () => {
    /* La mecánica del listener vive en @/hooks/useGrabando y la vigila
       v15-avisos-se-aquietan-al-grabar.test.ts. */
    expect(bottomNav).toMatch(/import \{ useGrabando \} from '@\/hooks\/useGrabando'/)
    expect(bottomNav).not.toMatch(/function useGrabando/)
    // Si alguien lo cambiara por el literal, habría DOS fuentes del nombre.
    expect(bottomNav).not.toContain("'nx:grabando'")
  })

  it('iconoAtenuado: sólo grabando Y no activo', () => {
    expect(iconoAtenuado(true, false)).toBe(true)
    expect(iconoAtenuado(true, true)).toBe(false)
    expect(iconoAtenuado(false, false)).toBe(false)
    expect(iconoAtenuado(false, true)).toBe(false)
  })

  it('el aquietado sólo aplica a la navegación V15 (la barra heredada no cambia)', () => {
    expect(bottomNav).toMatch(/const quieto = navPrimaria && grabando/)
  })

  it('sólo el ÍCONO se atenúa; la etiqueta de texto nunca', () => {
    // El único uso de iconoAtenuado en JSX vive en el <Icon>, no en el <span>.
    const navItem = bottomNav.match(/function NavItem[\s\S]*$/)?.[0] ?? ''
    const usos = [...navItem.matchAll(/iconoAtenuado\(/g)]
    expect(usos.length).toBe(1)
    // La etiqueta (el span del label) no lleva opacity.
    const spanEtiqueta = navItem.match(/<span style=\{\{[^}]*\}\}>\{it\.label\}<\/span>/)?.[0] ?? ''
    expect(spanEtiqueta).not.toBe('')
    expect(spanEtiqueta).not.toContain('opacity')
  })

  it('la acción central (entrada al encuentro) nunca se atenúa', () => {
    // El bloque de la acción central: desde su comentario hasta el cierre </Link>.
    const central = bottomNav.match(/Acción central contextual[\s\S]*?<\/Link>/)?.[0] ?? ''
    expect(central).not.toBe('')
    expect(central).not.toContain('iconoAtenuado')
    expect(central).not.toContain('quieto')
  })
})
