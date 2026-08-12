/**
 * Los roles tipográficos de VISUAL_DNA §2 existen como CLASES y `/pendientes`
 * los habla — V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7), segunda rebanada.
 *
 * QUÉ FALLABA: la tabla de §2 de `docs/design/NEXUSMED_VISUAL_DNA.md` ordena
 * «mapear a clases, no inventar tamaños», pero tres de sus roles no existían
 * como clase (`.nx-ident`, `.nx-meta`, `.nx-critico`) — cada pantalla escribía
 * su propio fontSize inline para el mismo papel. En `/pendientes` (la cola de
 * cierre de Fase 7, la pantalla de trabajo que el médico más visita) el
 * paciente era un enlace teal de 13px ENTERRADO en la fila de metadatos,
 * contradiciendo R3 («la identidad del paciente es el elemento tipográfico
 * dominante de su entrada — cita, resultado, TAREA, medicamento») y el modelo
 * de producto V15 §4 («el resultado de ESTE paciente necesita mi decisión»).
 *
 * CÓMO SE DESCUBRIÓ: tarea exacta dejada por la primera rebanada de Fase 10
 * en `agent-state/V15_CURRENT_ITERATION.md` — inventario de los roles de §2
 * sin clase, contrastado con grep contra `globals.css`.
 *
 * CAUSA RAÍZ: los roles se implementaron primero DENTRO del riel de agenda
 * (`.riel-nombre`, `.riel-meta` — clases con alcance de una pantalla) y nunca
 * se promovieron a clases de rol reutilizables; las pantallas siguientes
 * copiaron tamaños a mano.
 *
 * LA REGLA QUE LO HACE SEGURO: los cuatro roles que `/pendientes` usa viven
 * en `globals.css` con los valores de la tabla §2; la página los referencia
 * por clase; la identidad del paciente encabeza la entrada y SIGUE navegando
 * al expediente (equivalencia funcional); lo crítico lleva icono además de
 * color; y los tamaños inline que esta rebanada retiró (11/13/15) no vuelven.
 *
 * QUÉ NO CUBRE: no verifica el resultado pintado (peso efectivo de la fuente,
 * contraste, subrayado visible) — eso lo mide el arnés de navegador real de
 * esta misma corrida (`scripts/design/capturar-roles-tipograficos-v15.mjs`)
 * con getComputedStyle y axe. Tampoco impone los roles en otras pantallas:
 * cada superficie se migra con su propia rebanada y su propia verificación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const PAGINA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/pendientes/page.tsx'),
  'utf8',
)

describe('los roles de VISUAL_DNA §2 existen como clases en globals.css', () => {
  it('.nx-ident: 15.5/1.3 y peso 600 (550 de la especificación resuelto al corte estático real de Plex)', () => {
    const bloque = CSS.slice(CSS.indexOf('.nx-ident {'))
    expect(CSS).toContain('.nx-ident {')
    expect(bloque.slice(0, 200)).toContain('font-size: 15.5px')
    expect(bloque.slice(0, 200)).toContain('line-height: 1.3')
    expect(bloque.slice(0, 200)).toContain('font-weight: 600')
    // La razón del 600 queda ESCRITA donde vive el valor: si alguien «corrige»
    // a 550 sin cargar el corte variable de la fuente, el navegador pintará
    // 600 de todos modos y el CSS mentiría.
    expect(CSS).toMatch(/550[\s\S]{0,200}?\.nx-ident \{/)
  })

  it('a.nx-ident subraya: un enlace dentro de texto plano no puede distinguirse sólo por color', () => {
    expect(CSS).toContain('a.nx-ident {')
    const bloque = CSS.slice(CSS.indexOf('a.nx-ident {'), CSS.indexOf('a.nx-ident {') + 300)
    expect(bloque).toContain('text-decoration: underline')
  })

  it('.nx-meta: 12.5 en --text3', () => {
    const i = CSS.indexOf('.nx-meta {')
    expect(i).toBeGreaterThan(-1)
    const bloque = CSS.slice(i, i + 150)
    expect(bloque).toContain('font-size: 12.5px')
    expect(bloque).toContain('var(--text3)')
  })

  it('.nx-critico: 13/700 en --red — el peso y el icono cargan la señal, no sólo el color', () => {
    const i = CSS.indexOf('.nx-critico {')
    expect(i).toBeGreaterThan(-1)
    const bloque = CSS.slice(i, i + 200)
    expect(bloque).toContain('font-size: 13px')
    expect(bloque).toContain('font-weight: 700')
    expect(bloque).toContain('var(--red)')
  })
})

describe('/pendientes habla los roles', () => {
  it('la identidad del paciente encabeza la entrada como .nx-ident y SIGUE navegando al expediente', () => {
    // Falla contra el árbol previo: el paciente era un <Link> teal de 13px en
    // la fila de metadatos.
    expect(PAGINA).toMatch(/<Link href=\{`\/expediente\/\$\{t\.patientId\}`\} className="nx-ident">/)
  })

  it('si la tarea trae nombre sin patientId, la identidad se pinta sin enlace roto', () => {
    // El dato manda: un href a /expediente/undefined sería peor que no navegar.
    expect(PAGINA).toMatch(/t\.patientNombre && !t\.patientId && <span className="nx-ident">/)
  })

  it('el enlace teal del paciente en la fila de metadatos ya no existe — la identidad vive en UN sitio', () => {
    expect(PAGINA).not.toContain("var(--teal)")
  })

  it('el tipo de tarea es .nx-estado (versalitas + punto), no un fontSize inline propio', () => {
    expect(PAGINA).toMatch(/<span className="nx-estado">\{ETIQUETA_TIPO\[t\.tipo\] \?\? 'Pendiente'\}<\/span>/)
  })

  it('la tarjeta cerrada dice «cerrado» con el punto en verde — VISUAL_DNA §3, atenuado, nunca celebratorio', () => {
    expect(PAGINA).toMatch(/--estado-tono' as string\]: 'var\(--green\)'/)
  })

  it('el motivo de escalamiento es .nx-critico Y lleva el icono en el mismo elemento — nunca sólo color', () => {
    expect(PAGINA).toMatch(/className="nx-critico"[^>]*>\s*<AlertTriangle/)
  })

  it('metadatos en .nx-meta y fechas en .nx-num (tabulares)', () => {
    expect(PAGINA).toMatch(/className="nx-meta" style=\{\{ display: 'flex'/)
    const nxNum = PAGINA.match(/className="nx-num"/g) ?? []
    expect(nxNum.length).toBeGreaterThanOrEqual(2) // venceEn + cerradaEn
  })

  it('los tamaños inline que esta rebanada retiró no vuelven (deriva contra la escala)', () => {
    // 11, 13 y 15 no están en la escala del trinquete de diseño; el papel que
    // cumplían ahora tiene clase. Si un cambio futuro los reintroduce inline
    // en esta pantalla, está escribiendo un rol sin su clase.
    expect(PAGINA).not.toMatch(/fontSize: (11|13|15)[,\s}]/)
  })
})

describe('freeze funcional — la rebanada es tipográfica, no de conducta', () => {
  it('las cuatro acciones del worklist conservan su texto exacto', () => {
    expect(PAGINA).toContain("texto: 'Tomarla'")
    expect(PAGINA).toContain("texto: 'Ya se hizo'")
    expect(PAGINA).toContain("texto: 'Lo revisé — cerrar'")
    expect(PAGINA).toContain('Ya no aplica')
  })

  it('cancelar sigue exigiendo motivo', () => {
    expect(PAGINA).toContain('disabled={!motivo.trim()}')
  })

  it('el dueño y el vencimiento siguen en el metadato — se movió al paciente, no se borró nada', () => {
    expect(PAGINA).toContain("{t.ownerNombre || 'sin dueño'}")
    expect(PAGINA).toMatch(/vencida \? 'venció' : 'vence'/)
  })
})
