/**
 * A11Y DEL FLUJO CENTRAL — V10-DEBT-005 · axe del arnés V10 (9-ago-2026).
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * Primera corrida de `tests/visual/arnes-a11y.mjs` (axe WCAG A/AA, navegador
 * real, sesión sintética contra emuladores) sobre el golden flow. Hallazgos
 * CRITICAL en las dos pantallas donde el médico pasa el día:
 *
 *   - AGENDA: los dos chevrones del navegador de fecha no tenían nombre
 *     accesible (axe `button-name`) y el input de fecha no tenía etiqueta
 *     (axe `label`). Un lector de pantalla decía «botón, botón, edición».
 *   - CONSULTA: las CUATRO secciones narrativas de la nota (subjetivo,
 *     exploración, análisis, plan) eran `<textarea>` sin nombre. El título
 *     visible vive en el `<Section>` de al lado, SIN asociar — el peor tipo
 *     de defecto porque mirando la pantalla parece resuelto (mismo patrón
 *     que REG-233 encontró en /login).
 *
 * Y dos SERIOUS de la misma corrida:
 *
 *   - `.prox-hero-cta` (el CTA del dashboard, «Iniciar consulta») pintaba
 *     blanco sobre `--nexus` = 3.28:1. Es EXACTAMENTE el defecto de v1104
 *     (REG-233), pero en CSS global: el guardián de entonces sólo barre
 *     estilos en línea en .tsx, y la clase se le escapó.
 *   - El botón de mostrar/ocultar contraseña en /login y /registro medía
 *     menos de 24px (axe `target-size`); la regla propia de diseño pide 44.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Iconos sin texto y títulos visuales sin asociación programática: el árbol
 * accesible no se ve en un `git diff`, y ninguna prueba lo miraba en las
 * pantallas autenticadas (REG-233 sólo cubrió lo público).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * Es un barrido de FUENTE, no de árbol accesible: comprueba que los atributos
 * estén escritos, no que lleguen al DOM ni que el nombre sea el correcto. La
 * verificación en navegador real es `tests/visual/arnes-a11y.mjs` (axe), que
 * no corre en CI porque necesita emuladores + dev server. Tampoco cubre los
 * SERIOUS de contraste restantes de agenda/hoy («Registrar cobro», subtítulos
 * de la agenda del día) — esos son rediseño y van en V10-AGENDA-001.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('agenda: el navegador de fecha tiene nombres accesibles', () => {
  const src = () => leer('src/app/(dashboard)/citas/page.tsx')

  it('los dos chevrones dicen a dónde van', () => {
    expect(src()).toMatch(/aria-label="Día anterior"/)
    expect(src()).toMatch(/aria-label="Día siguiente"/)
  })

  it('el input de fecha tiene etiqueta', () => {
    // axe: label (critical). El input type="date" era el único control del
    // navegador de fecha sin nombre.
    expect(src()).toMatch(/aria-label="Ir a una fecha"/)
  })
})

describe('consulta: las secciones narrativas de la nota tienen nombre', () => {
  it('el textarea de cada sección lleva aria-label con su etiqueta', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    // La forma concreta: dentro del map de `secciones`, el <textarea> se nombra
    // con la misma etiqueta que el médico ve en el título del Section.
    expect(src).toMatch(/<textarea\s*\n\s*aria-label=\{s\.label\}/)
  })
})

describe('el CTA del dashboard no repite el 3.28:1 de v1104', () => {
  it('.prox-hero-cta usa el azul sólido, no --nexus', () => {
    const css = leer('src/app/globals.css')
    const bloque = css.slice(css.indexOf('.prox-hero-cta {'), css.indexOf('.prox-hero-cta:hover'))
    expect(bloque, 'blanco sobre --nexus da 3.28:1; el relleno con texto blanco usa --nexus-solido').toMatch(
      /background: var\(--nexus-solido\)/
    )
    expect(bloque).not.toMatch(/background: var\(--nexus\)/)
  })
})

describe('el botón de mostrar la contraseña se puede tocar', () => {
  for (const archivo of ['src/app/login/page.tsx', 'src/app/registro/page.tsx']) {
    it(`${archivo.split('/')[2]}: área táctil de 44×44`, () => {
      // axe: target-size (serious). El botón medía el puro icono (16–17px).
      const s = leer(archivo)
      expect(s, 'el toggle de contraseña declara width: 44, height: 44').toMatch(
        /aria-label=\{showPwd[^}]*\}[\s\S]{0,400}?width: 44, height: 44/
      )
    })
  }
})
