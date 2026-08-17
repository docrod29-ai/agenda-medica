/**
 * V15-MOBILE-001 (Fase 9, §23) — el shell del dashboard tiene FONDO y el
 * scroll vive en <main>, no en el documento.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * El arnés de la cuarta rebanada (`capturar-cierre-al-pulgar-v15.mjs`) no
 * pudo pulsar la barra de cierre: Playwright reportaba `<html> intercepts
 * pointer events` y después «element was detached». La sonda de geometría
 * reveló la causa real, mucho más vieja que la barra: el layout del
 * dashboard usaba `minHeight: 100vh` SIN tope de altura, así que la columna
 * entera crecía con el contenido, `<main>` (que siempre tuvo
 * `overflowY: auto` con la intención de ser el contenedor de scroll) nunca
 * desplazaba nada (clientHeight === scrollHeight), y quien se desplazaba era
 * el DOCUMENTO. Consecuencia silenciosa: TODO `position: sticky` cuyo
 * scrollport era <main> estaba mudo — el ancla del paciente
 * (`PatientAnchor`), el encabezado del calendario, el encabezado de la tabla
 * de pacientes, los paneles laterales de receta/orden, y el propio
 * `BottomNav` en páginas largas (medido: a 2,321px del borde en un viewport
 * de 844 en /consulta — la navegación del pulgar simplemente no estaba).
 *
 * Ninguna prueba lo veía porque los arneses medían `main.scrollTop = N` (un
 * no-op sobre un main que no desplaza) y las aserciones «sigue pegado»
 * pasaban trivialmente: el elemento no se movía porque NADA se movía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. `.nx-app-shell` en globals.css: `height: 100vh` con fallback
 *    `height: 100dvh` (altura real del viewport móvil) y `overflow: hidden`.
 * 2. El div raíz del layout del dashboard lleva esa clase.
 * 3. `<main>` conserva `overflowY: 'auto'` — ahora sí desplaza de verdad.
 * 4. `.sidebar` gana `overflow-y: auto`: dentro de un shell con tope, el
 *    riel debe poder desplazar su propio contenido si excede el viewport.
 * 5. La restauración de scroll de /consulta lee y escribe EN LOS DOS lados
 *    (main y window): mover el contenedor que no desplaza es un no-op, así
 *    que funciona sea cual sea el contenedor activo.
 *
 * Probado al revés (git stash de layout.tsx + globals.css): los casos 1, 2 y
 * 4 fallan contra el árbol previo. El comportamiento real (main desplaza,
 * sticky pega, BottomNav visible en /consulta) se mide en navegador real con
 * `capturar-cierre-al-pulgar-v15.mjs`, no aquí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles ni desplaza nada: análisis estático de fuente (patrón de
 *   los guardianes v15-*). El navegador real es el arnés de capturas.
 * · No cubre los layouts FUERA del dashboard (login, portal del paciente,
 *   marketing): esos siguen desplazando el documento y está bien — la regla
 *   es del área de trabajo clínica, no del sitio entero.
 * · No cubre que cada sticky individual tenga el offset correcto — sólo que
 *   el sistema que los alimenta (un main que desplaza) exista.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const CSS = leer('src/app/globals.css')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('V15 — el shell del dashboard tiene fondo (§23)', () => {
  it('la clase nx-app-shell existe con tope de altura (vh + fallback dvh) y overflow oculto', () => {
    const idx = CSS.indexOf('.nx-app-shell {')
    expect(idx).toBeGreaterThan(0)
    const bloque = CSS.slice(idx, CSS.indexOf('}', idx))
    expect(bloque).toContain('height: 100vh')
    expect(bloque).toContain('height: 100dvh')
    expect(bloque).toContain('overflow: hidden')
    // height, no min-height: min-height fue exactamente el defecto.
    expect(bloque).not.toContain('min-height')
  })

  it('el div raíz del layout del dashboard lleva la clase', () => {
    expect(LAYOUT).toContain('className="nx-app-shell"')
    // Y ya no fija minHeight inline en ese raíz (dejaría crecer la columna
    // otra vez si alguien quitara la clase sin leer este guardián).
    const raiz = LAYOUT.slice(LAYOUT.indexOf('className="nx-app-shell"'), LAYOUT.indexOf('className="nx-app-shell"') + 200)
    expect(raiz).not.toContain('minHeight')
  })

  it('<main> conserva su overflowY auto — ahora es el contenedor de scroll real', () => {
    expect(LAYOUT).toMatch(/<main style=\{\{[^}]*overflowY: 'auto'/)
  })

  it('el riel lateral puede desplazar su propio contenido dentro del shell con tope', () => {
    expect(CSS).toMatch(/\.sidebar \{ overflow-y: auto; \}/)
  })
})

describe('V15 — la restauración de scroll de /consulta no depende de cuál contenedor desplaza', () => {
  it('guarda leyendo main con window como respaldo', () => {
    expect(CONSULTA).toContain("scroller()?.scrollTop || window.scrollY")
  })

  it('restaura escribiendo en los dos lados (el que no desplaza es un no-op)', () => {
    const idx = CONSULTA.indexOf('if (m) m.scrollTop = y')
    expect(idx).toBeGreaterThan(0)
    expect(CONSULTA.slice(idx, idx + 120)).toContain('window.scrollTo(0, y)')
  })

  it('escucha el scroll en los dos lados y se desuscribe de los dos', () => {
    expect(CONSULTA).toContain("m?.addEventListener('scroll', guardarScroll")
    expect(CONSULTA).toContain("window.addEventListener('scroll', guardarScroll")
    expect(CONSULTA).toContain("m?.removeEventListener('scroll', guardarScroll)")
    expect(CONSULTA).toContain("window.removeEventListener('scroll', guardarScroll)")
  })
})
