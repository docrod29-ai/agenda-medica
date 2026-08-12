/**
 * La franja de instrumentos y el barrido final hablan los roles de
 * VISUAL_DNA §2 — V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7), octava
 * rebanada. Con ella, el inventario de superficies en dialecto propio que
 * abrió la séptima rebanada queda VACÍO.
 *
 * QUÉ FALLABA (las cuatro superficies que la séptima dejó nombradas):
 *
 * 1. `InstrumentStrip` (la de más peso clínico): la identidad del paciente —
 *    el PRIMER estado periférico de §5 Capa 1 — vivía como cromo de
 *    12px/--text2 CON ellipsis de una línea, MÁS CHICA que el respaldo del
 *    consultorio (16px): la franja hablaba más fuerte cuando enseñaba lo
 *    menos importante. Y el timer de grabación no usaba tabular-nums — el
 *    ancho temblaba a cada segundo.
 * 2. `ClinicalSpine`: los conteos (10.5/800) sin tabular-nums.
 * 3. `/pacientes`: las tarjetas de duplicados (modal «Posibles expedientes
 *    repetidos» y el aviso del formulario) pintaban `p.nombre`/
 *    `c.paciente.nombre` a 13/600 y 13.5/600 inline — identidad estructurada
 *    de §2 fuera de la fila del directorio ya migrada en la cuarta rebanada.
 * 4. `PanelPendientes`: `detalle` y «+N más» a 11.5/text3 inline, cuando en
 *    /pendientes la misma pieza ya es `.nx-meta`.
 *
 * CÓMO SE DESCUBRIÓ: inventario por grep de la séptima rebanada
 * (`agent-state/V15_CURRENT_ITERATION.md`), que dejó estas cuatro como las
 * ÚNICAS superficies restantes de §2 en dialecto propio.
 *
 * CAUSA RAÍZ: la de toda la familia — los roles de §2 no existían como clase
 * cuando estas superficies se escribieron; cada una copió tamaños a mano.
 * La franja además exigía una DECISIÓN de diseño, no un reemplazo mecánico:
 * ¿qué significa identidad dentro de una franja periférica de 30px?
 *
 * LA REGLA QUE LO HACE SEGURO: `.nx-ident-franja` (nueva en `globals.css`,
 * con la decisión escrita): la identidad de la franja tiene UNA voz —
 * 14/600/var(--text), de la escala oficial — y la porta el paciente cuando
 * hay paciente en la ruta, el consultorio cuando no. Más fuerte que el cromo
 * (12/--text3), por debajo de la identidad de lienzo (15.5) y del ancla
 * (20): periférica, no protagonista. En la topbar móvil el nombre ENVUELVE
 * hasta 2 líneas (`--clamp`) — la excepción a «la identidad no se trunca»
 * (§24) queda DECLARADA con su razón en la hoja: la franja es eco
 * periférico, el enlace lleva al ancla donde el nombre vive completo, y
 * crecer sin tope empujaría el indicador de grabación (señal de seguridad)
 * fuera de la fila. Los conteos y el timer llevan `nx-num` (tabular). Las
 * tarjetas de duplicados y los metadatos hablan `.nx-ident`/`.nx-meta`.
 * Y la conducta no cambia: mismos href, mismo getPatient, mismo onClick.
 *
 * QUÉ NO CUBRE: el resultado pintado (tamaños/colores efectivos por tema,
 * que el nombre envuelva sin desbordar en 390, que el enlace siga navegando
 * al expediente) lo mide el arnés de navegador real de esta corrida
 * (`scripts/design/capturar-roles-franja-v15.mjs`). Las tarjetas de
 * duplicados no se miden en navegador (la siembra no crea pares duplicados)
 * — su rol lo vigila sólo este guardián estático, y eso queda declarado en
 * el arnés. Tampoco toca los títulos de acción de PanelPendientes (contenido,
 * no rol de §2 — misma decisión que la séptima rebanada).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FRANJA = leer('src/components/InstrumentStrip.tsx')
const HOJA = leer('src/app/globals.css')
const SPINE = leer('src/components/expediente/ClinicalSpine.tsx')
const PACIENTES = leer('src/app/(dashboard)/pacientes/page.tsx')
const PANEL = leer('src/components/PanelPendientes.tsx')

describe('V15 §2 — .nx-ident-franja existe en la hoja con la decisión escrita', () => {
  it('la clase pinta 14/600/var(--text) — la escala oficial, no un tamaño inventado', () => {
    const bloque = HOJA.slice(HOJA.indexOf('.nx-ident-franja {'))
    expect(bloque).toContain('font-size: 14px')
    expect(bloque).toContain('font-weight: 600')
    expect(bloque).toContain('color: var(--text)')
    expect(bloque).toContain('overflow-wrap: anywhere')
  })

  it('el clamp de 2 líneas existe como modificador y su excepción a §24 está declarada con razón', () => {
    expect(HOJA).toContain('.nx-ident-franja--clamp')
    expect(HOJA).toContain('-webkit-line-clamp: 2')
    // La razón de la excepción, escrita donde vive la regla — sin ella, un
    // futuro lector la borraría por parecer una truncación prohibida.
    expect(HOJA).toMatch(/excepción DECLARADA|excepción declarada/i)
  })

  it('el enlace de la franja conserva el subrayado atenuado (WCAG 1.4.1), como a.nx-ident', () => {
    expect(HOJA).toMatch(/a\.nx-ident-franja \{\s*\n\s*text-decoration: underline/)
  })
})

describe('V15 §2 — InstrumentStrip: la identidad de la franja tiene una voz', () => {
  it('el enlace del paciente habla nx-ident-franja en las DOS variantes (topbar y escritorio)', () => {
    const enlaces = FRANJA.match(/href=\{`\/expediente\/\$\{paciente\.id\}`\}/g) ?? []
    expect(enlaces.length).toBe(2)
    const clases = FRANJA.match(/className="nx-ident-franja"/g) ?? []
    // topbar (Link), respaldo del consultorio (span) y escritorio (Link)
    expect(clases.length).toBeGreaterThanOrEqual(3)
  })

  it('el nombre del paciente ya no se trunca a UNA línea: el clamp de 2 vive en un span interior, no ellipsis en el enlace', () => {
    expect(FRANJA).toContain('className="nx-ident-franja--clamp"')
    // El patrón retirado: textOverflow/ellipsis directamente sobre el Link
    // del paciente. El único ellipsis permitido es el del respaldo del
    // consultorio (no es identidad de paciente).
    const topbar = FRANJA.slice(FRANJA.indexOf('if (enTopbar)'), FRANJA.indexOf('return (', FRANJA.indexOf('if (enTopbar)') + 200))
    const enlacePaciente = FRANJA.slice(FRANJA.indexOf('paciente ? ('), FRANJA.indexOf('</Link>'))
    expect(enlacePaciente).not.toContain('textOverflow')
    expect(enlacePaciente).not.toContain('whiteSpace')
    expect(topbar).toBeTruthy()
  })

  it('veto de deriva: el paciente ya no es cromo 12/--text2 ni el respaldo pinta 16 inline', () => {
    // Los estilos retirados no vuelven al componente como fontSize inline de
    // identidad: el único fontSize inline que queda en la franja es el cromo
    // base (12) de los contenedores.
    expect(FRANJA).not.toMatch(/fontSize: 16/)
    // El Link del paciente no fija color/fontWeight a mano — los pone la clase.
    const linkTopbar = FRANJA.slice(FRANJA.indexOf('<Link'), FRANJA.indexOf('</Link>'))
    expect(linkTopbar).not.toContain("color: 'var(--text2)'")
  })

  it('el objetivo táctil de 44px del enlace de topbar sobrevive al cambio', () => {
    expect(FRANJA).toContain('minHeight: 44')
  })

  it('el timer de grabación es tabular (nx-num) en las DOS variantes', () => {
    const timers = FRANJA.match(/className="nx-num"/g) ?? []
    expect(timers.length).toBe(2)
  })

  it('freeze funcional: getPatient reutilizado y filtro por id intactos (la conducta no cambió)', () => {
    expect(FRANJA).toContain("import { getPatient } from '@/lib/firestore'")
    expect(FRANJA).toContain('return cargado && cargado.id === patientId ? cargado : null')
  })

  it('el separador «·» del escritorio vive FUERA del enlace — subrayar el punto diría que también navega', () => {
    expect(FRANJA).toMatch(/<span aria-hidden="true">·<\/span>/)
    expect(FRANJA).not.toMatch(/>\s*· \{paciente\.nombre\}/)
  })
})

describe('V15 §2 — barrido final: ClinicalSpine, duplicados de /pacientes, PanelPendientes', () => {
  it('los conteos del riel son nx-num (tabular)', () => {
    const conteos = SPINE.match(/className="nx-num"/g) ?? []
    expect(conteos.length).toBe(2)
  })

  it('la tarjeta del modal de duplicados habla nx-ident/nx-meta — no 13/600 inline', () => {
    expect(PACIENTES).toMatch(/className="nx-ident" style=\{\{ display: 'block' \}\}>\{p\.nombre\}/)
    expect(PACIENTES).not.toMatch(/fontSize: 13 \}\}>\{p\.nombre\}/)
  })

  it('el aviso de duplicados del formulario habla nx-ident/nx-meta — no 13.5/600 inline', () => {
    expect(PACIENTES).toMatch(/className="nx-ident" style=\{\{ display: 'block' \}\}>\{c\.paciente\.nombre\}/)
    expect(PACIENTES).not.toMatch(/fontSize: 13\.5 \}\}>\{c\.paciente\.nombre\}/)
  })

  it('PanelPendientes: detalle y «+N más» son nx-meta, y el 11.5 inline no vuelve al archivo', () => {
    expect(PANEL).toMatch(/className="nx-meta">\{a\.detalle\}/)
    expect(PANEL).toMatch(/className="nx-meta" style=\{\{ marginTop: 8 \}\}>\+\{acciones\.length - 8\} más/)
    expect(PANEL).not.toContain('fontSize: 11.5')
  })

  it('freeze funcional del barrido: los onClick/href de las tarjetas de duplicados siguen ahí', () => {
    expect(PACIENTES).toContain('setRevisandoDuplicados(false)')
    expect(PACIENTES).toMatch(/router\.push\(`\/expediente\/\$\{p\.id\}`\)/)
    expect(PACIENTES).toContain('onAbrirExistente(c.paciente)')
  })
})
