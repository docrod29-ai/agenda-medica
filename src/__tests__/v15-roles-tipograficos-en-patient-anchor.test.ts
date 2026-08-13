/**
 * V15-VISUAL-SYSTEM-001 (Fase 10, quinta rebanada) — EL PATIENT ANCHOR HABLA
 * LOS ROLES TIPOGRÁFICOS DE VISUAL_DNA §2, Y SU IDENTIDAD ES NIVEL DISPLAY.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * El inventario de la cuarta rebanada (grep de fontSize inline sobre las
 * superficies del shell V15) dejó UNA superficie estructurada sin pagar:
 * `PatientAnchor.tsx` tenía 6 fontSize inline. Tres eran papeles de §2
 * hablados en dialecto propio: la identidad del paciente era un <h1> de
 * `fontSize: 16, fontWeight: 700` grotesca — exactamente el tamaño de una
 * fila de lista, en la ÚNICA pantalla donde VISUAL_DNA §1 R3 reserva la serif
 * display («Serif Fraunces SOLO en el nivel display: saludo, nombre del
 * paciente en su espacio clínico»); el metadato (edad · sexo · teléfono) y el
 * «Último cambio» eran fontSize 12 inline en vez de `.nx-meta`; y la alergia
 * REGISTRADA — el valor más crítico del ancla — pesaba lo mismo que el texto
 * neutro del aviso (12px heredado), señal sólo por color, que es lo que §2
 * prohíbe para `.nx-critico`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * VISUAL_DNA §2: un texto que cumple un papel usa SU clase; un fontSize
 * inline nuevo para el mismo papel es deriva. La identidad en el workspace
 * del paciente es nivel display (R3), no `.nx-ident` de fila. Un valor
 * crítico lleva peso + icono, nunca sólo color, y NUNCA se trunca (§24) —
 * por eso `.nx-critico` envuelve (flex-wrap) desde esta rebanada.
 *
 * Probado al revés (git stash del árbol previo): los casos de rol fallan
 * contra el PatientAnchor anterior; los de freeze funcional pasan en los dos
 * árboles porque protegen el invariante, no el cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide getComputedStyle: eso lo hace el arnés
 *   `scripts/design/capturar-roles-patient-anchor-v15.mjs` en navegador real
 *   (dos temas + móvil + axe + navegación).
 * · No cubre los fontSize que NO son papeles de §2 (inicial del avatar,
 *   botón «continuar»): cada rol se paga en su rebanada.
 * · El cableado del ancla en la página y su derivación de `notas` los cubre
 *   `v15-patient-anchor-cableado.test.ts` — aquí no se duplica.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const ANCLA = leer('src/components/expediente/PatientAnchor.tsx')
const CSS = leer('src/app/globals.css')

describe('V15-VISUAL-SYSTEM-001 — la identidad del ancla es nivel display', () => {
  it('el <h1> habla nx-display + nx-ancla-nombre, no un tamaño a mano', () => {
    // `.nx-vt-paciente` (4ª rebanada de MOTION-001) es un GANCHO de la
    // coreografía de §20, sin una sola declaración tipográfica: la voz del
    // ancla sigue siendo nx-display + nx-ancla-nombre.
    expect(ANCLA).toMatch(/<h1 className="nx-display nx-ancla-nombre nx-vt-paciente">/)
  })

  it('deriva vetada: el h1 no vuelve al fontSize 16/700 inline de fila', () => {
    // El h1 del ancla no lleva style: su tipografía vive en la clase.
    expect(ANCLA).not.toMatch(/<h1 style=/)
  })

  it('.nx-ancla-nombre existe en globals.css: 20px de la escala, envuelve, --text', () => {
    const i = CSS.indexOf('.nx-ancla-nombre {')
    expect(i).toBeGreaterThan(-1)
    const bloque = CSS.slice(i, CSS.indexOf('}', i))
    expect(bloque).toContain('font-size: 20px')
    expect(bloque).toContain('overflow-wrap: anywhere')
    expect(bloque).toContain('color: var(--text)')
  })

  it('la razón de diseño queda escrita junto a la clase (R3: display en su espacio clínico)', () => {
    expect(CSS).toMatch(/nombre del paciente en su espacio clínico/)
  })
})

describe('V15-VISUAL-SYSTEM-001 — metadatos del ancla en .nx-meta', () => {
  it('edad · sexo · teléfono es .nx-meta, sin fontSize inline', () => {
    expect(ANCLA).toMatch(/<div className="nx-meta" style=\{\{ marginTop: 2 \}\}>/)
  })

  it('«Último cambio» es .nx-meta y conserva sólo su layout inline', () => {
    expect(ANCLA).toMatch(/<span className="nx-meta" style=\{\{ marginLeft: 'auto' \}\}>/)
  })

  it('deriva vetada: sólo quedan los 3 fontSize inline que NO son papeles de §2', () => {
    // Inicial del avatar (16), botón «continuar» (12) y el cuerpo del aviso
    // (alertaEstilo, 12) no son papeles de §2 — cada rol se paga en su
    // rebanada. Un cuarto fontSize inline sería deriva sobre un rol pagado.
    expect(ANCLA.match(/fontSize: \d/g)?.length).toBe(3)
  })
})

describe('V15-VISUAL-SYSTEM-001 — la alergia registrada es valor crítico', () => {
  it('el texto de alergias lleva .nx-critico SÓLO cuando hay alergia registrada', () => {
    expect(ANCLA).toMatch(/className=\{sinAlergias \? undefined : 'nx-critico'\}/)
  })

  it('el icono existe de verdad al lado del valor (nunca sólo color)', () => {
    // AlertTriangle en la misma fila del aviso, antes del span del valor.
    expect(ANCLA).toMatch(/<AlertTriangle size=\{14\}[^/]*\/>\s*\{\/\*[\s\S]*?\*\/\}\s*<span className=\{sinAlergias/)
  })

  it('.nx-critico envuelve — un valor crítico largo nunca se trunca (§24)', () => {
    const i = CSS.indexOf('.nx-critico {')
    expect(i).toBeGreaterThan(-1)
    const bloque = CSS.slice(i, CSS.indexOf('}', i))
    expect(bloque).toContain('flex-wrap: wrap')
  })
})

describe('V15-VISUAL-SYSTEM-001 — freeze funcional del ancla (la rebanada es visual)', () => {
  it('el aviso sigue SIEMPRE visible y el vacío sigue diciendo «no registradas»', () => {
    expect(ANCLA).not.toMatch(/\{alergiaTexto && \(/)
    expect(ANCLA).toContain("'no registradas'")
  })

  it('el ancla sigue pegajosa (sticky) — §7: siempre visible', () => {
    expect(ANCLA).toMatch(/position: 'sticky', top: 0/)
  })

  it('la identidad sigue siendo el único <h1> del ancla', () => {
    // Sólo el JSX real, no la mención de <h1> en el comentario de diseño.
    expect(ANCLA.match(/<h1 className/g)?.length).toBe(1)
  })
})
