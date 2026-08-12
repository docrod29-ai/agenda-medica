/**
 * `ContinuidadPanel` habla los roles tipográficos de VISUAL_DNA §2 —
 * V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7), tercera rebanada.
 *
 * QUÉ FALLABA: la zona CONTINUITY de /dashboard («Sigue abierto de antes») y
 * /pendientes muestran LA MISMA entidad (TareaClinica, vía `tareasVivas()` —
 * eso ya lo protege `v15-continuidad-en-hoy.test.ts`) pero hablaban idiomas
 * tipográficos distintos tras la segunda rebanada: en /pendientes el paciente
 * encabezaba la entrada como `.nx-ident` y el escalamiento era `.nx-critico`
 * con icono; en el panel de Hoy el paciente seguía ENTERRADO en la fila de
 * metadatos a 12px («Tipo · Nombre»), el título mandaba, y el motivo de
 * escalamiento era un fontSize 10.5/700 inline en rojo SIN clase y SIN icono
 * pegado al texto. Una entidad, dos jerarquías: el médico que aprende «el
 * nombre grande es el paciente» en el worklist no encuentra ese patrón en Hoy.
 *
 * CÓMO SE DESCUBRIÓ: tarea exacta dejada por la segunda rebanada en
 * `agent-state/V15_CURRENT_ITERATION.md` — candidata (a): «ContinuidadPanel …
 * comparte entidad (TareaClinica) y debería compartir idioma con /pendientes».
 *
 * CAUSA RAÍZ: la de la familia — los roles de §2 no existían como clase cuando
 * se escribió el panel (V15-TODAY-001, Fase 3), así que copió tamaños a mano;
 * la segunda rebanada creó las clases pero migró sólo /pendientes.
 *
 * LA REGLA QUE LO HACE SEGURO: la identidad encabeza la entrada como
 * `.nx-ident`, PERO COMO <span>, no como <a> — la FILA ENTERA de este panel ya
 * es un <Link> al expediente; un enlace dentro de un enlace sería
 * nested-interactive (axe) y dos destinos para el mismo gesto. El tipo es
 * `.nx-estado`; el motivo de escalamiento es `.nx-critico` CON su icono en el
 * mismo elemento (nunca sólo color, §24); los tamaños inline retirados
 * (12, 10.5) no vuelven; y la conducta no cambia (mismo href, misma vista
 * previa de 5, mismo «Ver todo»).
 *
 * QUÉ NO CUBRE: el resultado pintado (peso efectivo, punto del estado,
 * contraste, que el clic de la fila aterrice en el expediente) lo mide el
 * arnés de navegador real de esta corrida
 * (`scripts/design/capturar-roles-continuidad-v15.mjs`) con getComputedStyle
 * y axe en los dos temas y en móvil. Tampoco impone los roles en otras
 * superficies: cada una se migra con su propia rebanada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PANEL = readFileSync(
  join(process.cwd(), 'src/components/ContinuidadPanel.tsx'),
  'utf8',
)

describe('ContinuidadPanel habla los roles de VISUAL_DNA §2', () => {
  it('la identidad del paciente encabeza la entrada como .nx-ident', () => {
    // Falla contra el árbol previo: el paciente era ` · ${tarea.patientNombre}`
    // a 12px dentro de la fila de metadatos.
    expect(PANEL).toMatch(/tarea\.patientNombre && <span className="nx-ident">\{tarea\.patientNombre\}<\/span>/)
  })

  it('la identidad es <span>, NO un enlace anidado: la fila entera ya navega', () => {
    // Un <Link>/<a> con nx-ident DENTRO del <Link> de la fila sería
    // nested-interactive (axe) — la diferencia deliberada con /pendientes,
    // donde la tarjeta no es un enlace y la identidad sí lo es.
    expect(PANEL).not.toMatch(/<(Link|a)[^>]*className="nx-ident"/)
    // Y la razón queda escrita donde vive la decisión.
    expect(PANEL).toContain('nested-interactive')
  })

  it('la identidad va ANTES que el título: QUIÉN manda sobre QUÉ', () => {
    const ident = PANEL.indexOf('className="nx-ident"')
    const titulo = PANEL.indexOf('{tarea.titulo}')
    expect(ident).toBeGreaterThan(-1)
    expect(titulo).toBeGreaterThan(-1)
    expect(ident, 'el título quedó por encima de la identidad').toBeLessThan(titulo)
  })

  it('el tipo de tarea es .nx-estado, no texto plano en la fila de metadatos', () => {
    expect(PANEL).toMatch(/<span className="nx-estado">\{ETIQUETA_TIPO\[tarea\.tipo\] \?\? 'Pendiente'\}<\/span>/)
    // La fila vieja «Tipo · Nombre» ya no existe.
    expect(PANEL).not.toMatch(/` · \$\{tarea\.patientNombre\}`/)
  })

  it('el motivo de escalamiento es .nx-critico Y lleva el icono en el mismo elemento — nunca sólo color', () => {
    expect(PANEL).toMatch(/className="nx-critico"><AlertTriangle/)
  })

  it('el pie «+N más» es .nx-meta, no un fontSize 12 inline', () => {
    expect(PANEL).toMatch(/className="nx-meta"[^>]*>\s*\+\{ordenadas\.length - TOPE_VISIBLE\}/)
  })

  it('los tamaños inline que esta rebanada retiró no vuelven (deriva contra la escala)', () => {
    // 12 (metadato) y 10.5 (motivo) tienen clase ahora; reintroducirlos inline
    // es escribir un rol sin su clase. El 14 del título se queda: es el mismo
    // valor que /pendientes conserva para el título de la tarea.
    expect(PANEL).not.toMatch(/fontSize: (10\.5|12)[,\s}]/)
  })
})

describe('freeze funcional — la rebanada es tipográfica, no de conducta', () => {
  it('la fila sigue navegando al expediente del paciente (o a /pendientes sin patientId)', () => {
    expect(PANEL).toMatch(/href=\{tarea\.patientId \? `\/expediente\/\$\{tarea\.patientId\}` : '\/pendientes'\}/)
  })

  it('sigue siendo vista previa de 5 con «Ver todo» hacia /pendientes', () => {
    expect(PANEL).toContain('const TOPE_VISIBLE = 5')
    expect(PANEL).toContain('href="/pendientes"')
  })

  it('el icono del carril izquierdo conserva su semántica: triángulo al escalar, reloj si no', () => {
    expect(PANEL).toMatch(/esc\.escalar \? <AlertTriangle size=\{16\} \/> : <FileClock size=\{16\} \/>/)
  })

  it('sigue leyendo tareasVivas() — la fuente única que vigila v15-continuidad-en-hoy', () => {
    expect(PANEL).toContain("import { tareasVivas } from '@/lib/tareas-clinicas/firestore'")
  })
})
