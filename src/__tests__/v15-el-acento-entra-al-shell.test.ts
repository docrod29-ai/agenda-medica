/**
 * V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7) — EL ACENTO ENTRA AL SHELL,
 * y entra UNA sola vez, con la semántica escrita, sin deshacer el greybox
 * ya aprobado.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Al abrir Fase 10 (12-ago-2026) se inventariaron los deferrals explícitos
 * que las fases estructurales dejaron escritos «para la fase de estilo»:
 *
 * 1. `globals.css` re-declaraba `.nx-flow-rail .nav-item.active` en
 *    `var(--text)` (el override greybox de V15-SHELL-GREYBOX-001) — con lo
 *    que el shell hablaba DOS idiomas: el `BottomNav` móvil marcaba el
 *    contexto activo en cobalto desde su primera rebanada, y el FlowRail de
 *    escritorio lo marcaba en neutro.
 * 2. `ClinicalSpine` pintaba la categoría seleccionada en
 *    `var(--text)`/`var(--bg)` (nota de deferral en el estado de la fase 4).
 * 3. El indicador «Grabando» del `InstrumentStrip` iba en `var(--text)`,
 *    mientras el marco perimetral (`MarcoEscuchando`) decía lo MISMO en
 *    cobalto — dos colores para «el micrófono está abierto».
 *
 * ── LA CAUSA RAÍZ Y LA REGLA ────────────────────────────────────────────────
 *
 * El greybox era deliberado (§12: la jerarquía se aprueba SIN acento), y
 * pasó su compuerta con capturas el 11-ago-2026. La regla que este guardián
 * sella es la de VISUAL_DNA §3: **cobalto = acción/selección/ahora**, un solo
 * acento con una sola semántica en todo el shell — y la de MarcoEscuchando:
 * grabar NUNCA es rojo (rojo = riesgo clínico; enseñar a ignorarlo es el
 * defecto más caro de un producto clínico).
 *
 * Probado al revés (git stash): 6 de los casos fallan contra el árbol previo
 * a esta rebanada (override greybox presente, spine y grabación en neutro).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide contraste renderizado — eso lo hace el arnés de navegador real
 *   (`scripts/design/capturar-acento-en-el-shell-v15.mjs`, axe contra la app
 *   servida) porque un token AA en el comentario no garantiza AA en el DOM.
 * · No cubre las demás rebanadas de Fase 10 (tipografía, espaciado, motion):
 *   cada una traerá su guardián cuando exista.
 * · No impide usar `var(--text)` en el shell para TEXTO normal — sólo vigila
 *   los tres puntos de acento que esta rebanada decidió.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const GLOBALS = leer('src/app/globals.css')
const SPINE = leer('src/components/expediente/ClinicalSpine.tsx')
const STRIP = leer('src/components/InstrumentStrip.tsx')
const FLOW_RAIL = leer('src/components/FlowRail.tsx')

describe('V15 Fase 10 — el override greybox del FlowRail se retiró (no se re-declara)', () => {
  it('globals.css ya no pisa la barra del contexto activo con var(--text)', () => {
    expect(GLOBALS).not.toContain('.nx-flow-rail .nav-item.active::before { background: var(--text); }')
  })

  it('globals.css ya no pisa el icono del contexto activo con var(--text)', () => {
    expect(GLOBALS).not.toContain('.nx-flow-rail .nav-item.active .nav-icon { color: var(--text); }')
  })

  it('las reglas BASE del estado activo siguen en cobalto — el acento que ahora aplica', () => {
    // Si alguien «limpiara» las reglas base, quitar el override no habría
    // dejado ningún acento: el activo quedaría sin barra ni color.
    // [^}] ya cruza saltos de línea (clase negada); no requiere la bandera /s,
    // que el target de tsconfig no admite.
    expect(GLOBALS).toMatch(/\.nav-item\.active::before \{[^}]*background: var\(--nexus\);/)
    expect(GLOBALS).toContain('.nav-item.active .nav-icon { color: var(--nexus); }')
  })

  it('la decisión queda escrita donde vivió el override, no borrada', () => {
    expect(GLOBALS).toContain('EL ACENTO ENTRA AL SHELL')
  })

  it('FlowRail.tsx documenta la decisión de Fase 10 en su cabecera', () => {
    expect(FLOW_RAIL).toContain('GREYBOX PRIMERO, ACENTO DESPUÉS')
  })
})

describe('V15 Fase 10 — ClinicalSpine: la selección se dice en cobalto', () => {
  /**
   * LA CONDICIÓN SIGUE AL CÓDIGO, Y EL INVARIANTE NO CAMBIA.
   *
   * Estos casos fijaban la selección del riel como RELLENO cobalto con texto
   * blanco. RTC-18 (14-ago) le quitó al riel la forma de píldora —medido: era
   * indistinguible de los filtros de la historia clínica, dos filas más abajo—
   * y lo pasó al idioma de navegación de este producto: **barra de acento**,
   * como el FlowRail, con la barra debajo porque el riel es horizontal.
   *
   * Lo que estos casos protegen sigue siendo lo mismo y se comprueba igual:
   * **selección = cobalto** (no el neutro greybox), y **el acento entra SÓLO
   * en la selección**. Lo que ya no aplica es el par de contraste
   * texto-blanco-sobre-relleno, porque no hay relleno: el texto va sobre el
   * fondo de la página, con los tokens de siempre.
   */
  it('la categoría seleccionada se marca en cobalto (barra de acento, no relleno)', () => {
    expect(SPINE).toContain("boxShadow: seleccionado ? 'inset 0 -2px 0 0 var(--nexus)' : 'none'")
    // Y no vuelve el relleno: competía con los datos que tiene al lado.
    expect(SPINE).not.toContain("background: seleccionado ? 'var(--nexus-solido)'")
  })

  it('el texto no se apoya en un par de contraste inventado', () => {
    // `--nexus-solido` documentaba su contraste CON BLANCO (5.16:1 oscuro /
    // 7.0:1 claro) porque el texto iba ENCIMA del relleno. Sin relleno, el
    // texto va sobre el fondo de la página y usa los tokens medidos de
    // siempre: nada de `#fff` suelto ni de `var(--bg)` sobre cobalto.
    expect(SPINE).not.toContain("color: seleccionado ? '#fff'")
    expect(SPINE).not.toContain("color: seleccionado ? 'var(--bg)'")
    expect(SPINE).toContain("color: seleccionado ? 'var(--text)' : 'var(--text2)'")
  })

  it('el estado NO seleccionado sigue siendo el neutro del sistema', () => {
    // El acento entra sólo en la selección: lo demás, en la voz secundaria.
    expect(SPINE).toContain("'var(--text2)'")
    expect(SPINE).toContain("fontWeight: seleccionado ? 600 : 500")
  })
})

describe('V15 Fase 10 — InstrumentStrip: «Grabando» habla el idioma del marco (cobalto, nunca rojo)', () => {
  it('las dos variantes (topbar y fila propia) pintan el indicador en var(--nexus)', () => {
    const indicadores = STRIP.match(/color: 'var\(--nexus\)', fontWeight: 600/g) ?? []
    expect(indicadores.length).toBe(2)
  })

  it('ningún indicador de grabación quedó en el neutro greybox', () => {
    // El patrón exacto que esta rebanada retiró. Si vuelve, el shell dice
    // «grabando» en dos colores otra vez.
    expect(STRIP).not.toMatch(/color: 'var\(--text\)', fontWeight: 600, flexShrink: 0/)
  })

  it('grabar NUNCA es rojo — la regla de MarcoEscuchando aplica también aquí', () => {
    expect(STRIP).not.toMatch(/--red|--peligro|#e5484d|#d32f2f/i)
  })

  it('freeze: el latido y el punto no cambiaron, sólo el color', () => {
    expect(STRIP).toContain("animation: 'pulse 1.6s ease-in-out infinite'")
    const puntos = STRIP.match(/<Circle size=\{8\} fill="currentColor"/g) ?? []
    expect(puntos.length).toBe(2)
  })
})

describe('V15 Fase 10 — el acento no deshizo lo que el greybox aprobó', () => {
  it('el aquietado de grabación (§8.1) sigue intacto en globals.css', () => {
    expect(GLOBALS).toContain('.nx-flow-rail--quieto .nx-flow-rail-quiet-icon')
    expect(GLOBALS).toMatch(/\.nx-flow-rail--quieto[\s\S]{0,200}opacity: 0\.4/)
  })

  it('FlowRail sigue sin acento decorativo propio — el acento vive en las reglas base compartidas', () => {
    // El componente no gana ESTILOS INLINE de --nexus (la forma con comillas
    // que aparece en un objeto style de JSX; la mención en su comentario de
    // cabecera es documentación, no estilo): si un día los gana, habría DOS
    // fuentes del acento (hoja + inline) y la lección nx-stat-grid dice que
    // el inline gana en silencio.
    expect(FLOW_RAIL).not.toContain("'var(--nexus)'")
    expect(FLOW_RAIL).not.toContain('"var(--nexus)"')
  })
})
