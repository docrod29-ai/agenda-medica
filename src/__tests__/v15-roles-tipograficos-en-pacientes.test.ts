/**
 * `PacienteRow` (/pacientes) habla los roles tipográficos de VISUAL_DNA §2 —
 * V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7), cuarta rebanada.
 *
 * QUÉ FALLABA: el directorio de pacientes es la superficie donde la identidad
 * ES el contenido — cada fila existe para decir QUIÉN — y era la única
 * superficie del shell V15 donde la identidad seguía hablando un tamaño a
 * mano: `fontSize: 14` inline con `whiteSpace: nowrap` + `textOverflow:
 * ellipsis`. Dos defectos en uno: (1) el médico que aprendió en /pendientes y
 * en Hoy que «el nombre grande es el paciente» (15.5/600, .nx-ident) no
 * encontraba ese patrón en la lista de pacientes; (2) un nombre compuesto
 * largo —«María Guadalupe Fernández de la Garza»— se TRUNCABA con puntos
 * suspensivos en móvil, y la identidad del paciente es exactamente el dato
 * que §24 prohíbe truncar («no critical truncation»).
 *
 * CÓMO SE DESCUBRIÓ: tarea exacta dejada por la tercera rebanada en
 * `agent-state/V15_CURRENT_ITERATION.md` — candidata (a): inventariar con
 * grep qué superficies estructuradas siguen hablando tamaños inline para los
 * papeles de §2; el grep encontró 6 en PatientAnchor y 25 en /pacientes, y
 * de ellas la fila del directorio es la que comparte papel (R3: identidad
 * encabeza su entrada) con las dos superficies ya migradas.
 *
 * CAUSA RAÍZ: la de la familia — los roles de §2 no existían como clase
 * cuando se escribió la lista, así que copió tamaños a mano; las rebanadas
 * 2 y 3 crearon las clases y migraron /pendientes y ContinuidadPanel, pero
 * cada superficie se migra con su propia rebanada.
 *
 * LA REGLA QUE LO HACE SEGURO: la identidad encabeza la fila como
 * `span.nx-ident` — span, NO enlace: la fila entera ya es `role="button"`
 * (activable) y abre el expediente; un enlace dentro sería nested-interactive
 * (axe) y dos destinos para el mismo gesto (la misma decisión deliberada que
 * ContinuidadPanel, por la misma razón). El metadato (teléfono · edad ·
 * internado) es `.nx-meta`. El nombre ENVUELVE en vez de truncarse. Y la
 * conducta no cambia: misma etiqueta accesible, mismo botón Editar con
 * stopPropagation, mismas píldoras de no-show/cancelación.
 *
 * QUÉ NO CUBRE: el resultado pintado (tamaño efectivo, color por tema, que la
 * fila navegue de verdad al expediente, que el nombre largo no desborde en
 * 390px) lo mide el arnés de navegador real de esta corrida
 * (`scripts/design/capturar-roles-pacientes-v15.mjs`) con getComputedStyle y
 * axe en los dos temas y en móvil. Tampoco migra PatientAnchor ni el resto de
 * los 25 fontSize de la página (encabezados de sección, botones, vacíos): no
 * son el papel R3 y cada rol se paga en su rebanada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGINA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'),
  'utf8',
)

// Sólo la fila: entre su función y la siguiente. Los demás fontSize de la
// página (encabezados, botones, vacíos) no son el papel R3 y no se vetan aquí.
const inicioFila = PAGINA.indexOf('function PacienteRow')
const finFila = PAGINA.indexOf('function PatientModal')
const FILA = PAGINA.slice(inicioFila, finFila)

describe('PacienteRow habla los roles de VISUAL_DNA §2', () => {
  it('el segmento de la fila existe donde el test lo espera', () => {
    expect(inicioFila).toBeGreaterThan(-1)
    expect(finFila).toBeGreaterThan(inicioFila)
  })

  it('la identidad del paciente encabeza la fila como span.nx-ident', () => {
    // Falla contra el árbol previo: el nombre era un div con fontSize 14 inline.
    expect(FILA).toMatch(/<span className="nx-ident"[^>]*>\{p\.nombre\}<\/span>/)
  })

  it('la identidad es <span>, NO un enlace anidado: la fila entera ya es role="button"', () => {
    expect(FILA).not.toMatch(/<(Link|a)[^>]*className="nx-ident"/)
    // Y la razón queda escrita donde vive la decisión.
    expect(FILA).toContain('nested-interactive')
  })

  it('la identidad ya no se trunca con ellipsis — §24: la identidad envuelve', () => {
    // Falla contra el árbol previo: el nombre llevaba nowrap + ellipsis.
    expect(FILA).not.toContain("textOverflow: 'ellipsis'")
    expect(FILA).not.toContain("whiteSpace: 'nowrap', overflow: 'hidden'")
  })

  it('el metadato (teléfono · edad · internado) es .nx-meta, no un fontSize 12 inline', () => {
    expect(FILA).toMatch(/className="nx-meta"/)
    expect(FILA).not.toMatch(/fontSize: 12, color: 'var\(--text3\)'/)
  })

  it('los tamaños inline que esta rebanada retiró no vuelven (deriva contra la escala)', () => {
    // 14 (identidad) tiene clase ahora; reintroducirlo inline en la fila es
    // escribir el rol sin su clase. El 15 del avatar, el 11 de las píldoras y
    // el 12/600 del botón Editar se quedan: no son papeles de §2.
    expect(FILA).not.toMatch(/fontSize: 14[,\s}]/)
  })
})

describe('freeze funcional — la rebanada es tipográfica, no de conducta', () => {
  it('la fila sigue siendo activable con su etiqueta accesible', () => {
    expect(FILA).toMatch(/activable\(onAbrir, \{ etiqueta: `Abrir el expediente de \$\{p\.nombre\}` \}\)/)
  })

  it('el botón Editar sigue frenando la propagación para no abrir el expediente', () => {
    expect(FILA).toMatch(/onClick=\{e => \{ e\.stopPropagation\(\); onEditar\(\) \}\}/)
  })

  it('el marcador de internado conserva su icono y su aviso', () => {
    expect(FILA).toMatch(/<BedDouble size=\{11\} \/> Internado — ver Hospitalización/)
  })

  it('las píldoras de no-show y cancelaciones siguen vivas', () => {
    expect(FILA).toContain('p.noShowCount > 0')
    expect(FILA).toContain('p.cancelacionCount > 0')
  })
})
