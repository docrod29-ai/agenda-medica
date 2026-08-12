/**
 * V15-MOBILE-001 (tercera rebanada) — el shell móvil es UNA fila, no dos
 * apiladas, y sus objetivos táctiles miden lo que §24 exige.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `scripts/design/medir-trabajos-moviles-v15.mjs` (radiografía a 390×844 de
 * dashboard/consulta/pendientes/expediente, 12-ago-2026) midió en TODAS las
 * pantallas:
 *
 *   1. «Ausculta» DOS veces apiladas en el shell — el wordmark estático de la
 *      topbar y la franja de instrumentos justo debajo repitiendo la marca;
 *   2. 135px de shell fijo (topbar 52 + franja 30 + bottom-nav 53) — 16% del
 *      viewport comido antes del primer píxel de contenido clínico;
 *   3. el enlace del paciente en la franja con objetivo táctil de 141×18px —
 *      MENOS DE LA MITAD del mínimo de 44px (§24) — en el elemento de
 *      continuidad más importante del shell (volver al expediente);
 *   4. el pie de la paleta enseñando «⌘K abrir/cerrar» y «↑↓ moverse» en un
 *      teléfono donde ni ⌘K ni flechas existen (§25, desktop-ism).
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El shell móvil se construyó APILANDO piezas de escritorio (topbar + franja
 * de fila propia) en vez de decidir por breakpoint qué persiste y qué se
 * fusiona (§23). Nada medía la suma de alturas ni el tamaño táctil real.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. En modo médico la topbar renderiza `<InstrumentStrip enTopbar />` como
 *    centro — NO el `<span>Ausculta</span>` estático (ese queda para la rama
 *    de asistente, que conserva su shell anterior).
 * 2. La franja de fila propia queda SÓLO en escritorio (gate
 *    `nx-franja-escritorio`, ≥769px desde la 7ª rebanada): sin ese gate se
 *    pintaría dos veces.
 * 3. En la variante compacta el paciente GANA a la clínica (ternario
 *    `paciente ?`): con 390px no caben los dos, y a media consulta lo que
 *    importa es en quién estás — el nombre del consultorio es admin (§8.5).
 * 4. El enlace del paciente lleva padding vertical de 13px (13+18+13 = 44 de
 *    alto táctil real dentro de la fila de 52).
 * 5. El pie de pistas de teclado de la paleta lleva `nx-pista-teclado` y
 *    globals.css lo oculta bajo 768px.
 *
 * Probada al revés (git stash de los 4 archivos): los casos 1, 2, 3, 4 y 5
 * fallan contra el árbol previo a este cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide alturas ni anchos reales — jsdom no tiene motor de layout; la
 *   verificación de verdad es `capturar-shell-consolidado-v15.mjs` en
 *   navegador real (390×844 + 1440).
 * · No cubre el truncado con nombres muy largos — el arnés lo captura, y el
 *   `textOverflow: ellipsis` se afirma aquí sólo como presencia.
 * · No cubre a la asistente: su shell (hamburguesa + wordmark) no es sujeto
 *   de esta fase y se afirma sólo que su rama sigue existiendo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const FRANJA = leer('src/components/InstrumentStrip.tsx')
const PALETA = leer('src/components/PaletteBusqueda.tsx')
const CSS = leer('src/app/globals.css')

describe('V15-MOBILE-001 — la franja ES el centro de la topbar en móvil', () => {
  it('la topbar de médico renderiza la variante enTopbar, no el wordmark estático', () => {
    expect(LAYOUT).toContain('<InstrumentStrip enTopbar />')
    // El wordmark estático queda en la rama de asistente (ternario), no suelto.
    const topbar = LAYOUT.indexOf('className="mobile-topbar"')
    const ternario = LAYOUT.indexOf('? <InstrumentStrip enTopbar />', topbar)
    const wordmark = LAYOUT.indexOf(': <span', topbar)
    expect(ternario).toBeGreaterThan(topbar)
    expect(wordmark).toBeGreaterThan(ternario)
  })

  it('la franja de fila propia queda sólo en escritorio (nx-franja-escritorio)', () => {
    // El gate era Tailwind `hidden md:block`; la 7ª rebanada lo movió a la
    // clase de hoja `nx-franja-escritorio` (≥769px) porque `md:` enciende en
    // 768 y en ese ancho exacto la franja convivía con la topbar móvil (ver
    // v15-frontera-768-un-solo-shell.test.ts). El invariante de ESTE caso no
    // cambia: la franja de fila propia jamás se renderiza sin gate.
    expect(LAYOUT).toContain('{navPrimaria && <div className="nx-franja-escritorio"><InstrumentStrip /></div>}')
    // Y no queda ningún render de franja de fila propia SIN el gate.
    expect(LAYOUT).not.toMatch(/\{navPrimaria && <InstrumentStrip \/>\}/)
  })
})

describe('V15-MOBILE-001 — la variante compacta prioriza y mide bien', () => {
  it('el paciente GANA a la clínica: ternario, no los dos apilados', () => {
    expect(FRANJA).toContain('if (enTopbar)')
    expect(FRANJA).toMatch(/\{paciente \? \(/)
  })

  it('el enlace del paciente alcanza 44px de alto táctil (13+18+13) — el 141×18 medido era ilegal por §24', () => {
    const variante = FRANJA.slice(FRANJA.indexOf('if (enTopbar)'), FRANJA.indexOf('\n  return ('))
    expect(variante).toContain("padding: '13px 8px 13px 0'")
    expect(variante).toContain('textOverflow')
  })

  it('la variante compacta reutiliza los MISMOS hooks — no abre una segunda fuente de verdad', () => {
    // Un solo usePacienteActual y un solo useSegundosGrabando en el archivo:
    // las dos variantes son el mismo estado pintado distinto.
    expect((FRANJA.match(/usePacienteActual\(\)/g) ?? []).length).toBe(2) // definición + 1 uso
    expect((FRANJA.match(/useSegundosGrabando\(\)/g) ?? []).length).toBe(2)
  })
})

describe('V15-MOBILE-001 — las pistas de teclado no viajan al teléfono (§25)', () => {
  it('el pie de la paleta lleva nx-pista-teclado y el CSS lo oculta bajo 768px', () => {
    expect(PALETA).toContain('className="nx-pista-teclado"')
    const regla = CSS.indexOf('.nx-pista-teclado { display: none; }')
    expect(regla).toBeGreaterThanOrEqual(0)
    // Dentro de un media query móvil, no como regla global (en escritorio las
    // pistas SÍ sirven — teclado-primero es el punto de la paleta).
    const mediaAntes = CSS.lastIndexOf('@media (max-width: 768px)', regla)
    const cierreEntre = CSS.slice(mediaAntes, regla).split('}').length
    expect(mediaAntes).toBeGreaterThanOrEqual(0)
    expect(cierreEntre).toBeLessThanOrEqual(2)
  })

  it('el display del pie vive en la HOJA, no inline — un display inline vence al media query', () => {
    // El defecto que el arnés cazó de verdad en la primera pasada de esta
    // rebanada: con style={{ display:'flex' }} inline, el media query nunca
    // pudo ocultarlo (pistasTecladoMovil: true en resultado.json). Misma
    // familia que nx-stat-grid-cableada caso 3.
    const div = PALETA.slice(PALETA.indexOf('className="nx-pista-teclado"'))
    const bloqueStyle = div.slice(0, div.indexOf('>'))
    expect(bloqueStyle).not.toMatch(/display\s*:/)
    expect(CSS).toContain('.nx-pista-teclado { display: flex; gap: 14px; }')
  })
})

describe('V15-MOBILE-001 — la asistente conserva su shell', () => {
  it('la rama de asistente sigue con hamburguesa y wordmark', () => {
    expect(LAYOUT).toContain('aria-label="Abrir menú"')
    expect(LAYOUT).toContain('>Ausculta</span>')
  })
})
