/**
 * Hoy (NOW y TODAY) habla los roles tipográficos de VISUAL_DNA §2 —
 * V15-VISUAL-SYSTEM-001 (Fase 10, §18 paso 7), séptima rebanada.
 *
 * QUÉ FALLABA: la pantalla MÁS usada del producto era la única superficie
 * estructurada de Hoy donde la identidad del paciente seguía hablando
 * tamaños a mano, y con los dos defectos de la familia a la vez:
 *
 * 1. `ProxHero` (zona NOW): el nombre era `fontSize: 16/600` inline CON
 *    `whiteSpace: nowrap` + `textOverflow: ellipsis` — el héroe que existe
 *    para decir QUIÉN SIGUE truncaba justo el nombre del paciente en móvil
 *    (§24: «no critical truncation», la misma familia que ya murió en las
 *    filas de /pacientes y en el Patient Anchor).
 * 2. `AppointmentRow` (zona TODAY): el nombre era `14/500` inline con
 *    ellipsis, y la HORA de al lado pesaba `14/700` — la hora dominaba
 *    tipográficamente sobre la identidad, exactamente la inversión de R3
 *    («la identidad del paciente es el elemento tipográfico dominante de su
 *    entrada»). El metadato (tipo · motivo) era `12/text3` inline.
 *
 * CÓMO SE DESCUBRIÓ: tarea exacta dejada por la sexta rebanada en
 * `agent-state/V15_CURRENT_ITERATION.md` — candidata (b): inventariar con
 * grep si queda ALGUNA superficie del shell V15 con papeles de §2 en
 * dialecto propio. El inventario NO salió vacío: encontró Hoy (esta
 * rebanada), y deja nombradas InstrumentStrip (identidad como cromo de
 * 12px + timer sin tabulares), ClinicalSpine (conteos sin tabulares),
 * las tarjetas de duplicados de /pacientes y los metadatos de
 * PanelPendientes.
 *
 * CAUSA RAÍZ: la de toda la familia — los roles de §2 no existían como
 * clase cuando V10-HOME-001 escribió esta pantalla, así que copió tamaños a
 * mano; las rebanadas 2–6 crearon las clases y migraron una superficie por
 * corrida, y a Hoy le tocó la séptima.
 *
 * LA REGLA QUE LO HACE SEGURO: la identidad es `span.nx-ident` con
 * `display: block` y ENVUELVE (overflow-wrap de la clase) en las dos zonas;
 * la hora habla `.riel-hora`/`.riel-dur` (14/600 tabular — el idioma que ya
 * habla el riel de /citas, no un 700 inventado que le gane al nombre); el
 * metadato es `.nx-meta`. La dominancia del héroe la dan su posición, el
 * avatar y el CTA (§16: posición antes que contenedor), no un tamaño propio.
 * Y la conducta no cambia: mismos href, mismo `puedeIniciar`, mismo
 * StatusBadge, mismo atenuado de lo pasado.
 *
 * QUÉ NO CUBRE: el resultado pintado (tamaño/peso efectivos por tema, que el
 * nombre largo envuelva sin desbordar en 390px, que los clics sigan
 * aterrizando en /citas y /consulta) lo mide el arnés de navegador real de
 * esta corrida (`scripts/design/capturar-roles-hoy-v15.mjs`) con
 * getComputedStyle y axe en los dos temas y en móvil. Tampoco migra
 * PanelPendientes ni ContinuidadPanel (la tercera rebanada ya migró el
 * segundo; los títulos de acción del primero no son papeles de §2 — el
 * título de una tarea es contenido, como decidió /pendientes) ni el saludo
 * display, que ya habla `.nx-display`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGINA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'),
  'utf8',
)

// Sólo las dos zonas con identidad estructurada. Los demás fontSize de la
// página (chips del resumen, vacíos) no son el papel R3 y no se vetan aquí.
const inicioFila = PAGINA.indexOf('function AppointmentRow')
const inicioHero = PAGINA.indexOf('function ProxHero')
const finHero = PAGINA.indexOf('function DashboardFallback')
const FILA = PAGINA.slice(inicioFila, inicioHero)
const HERO = PAGINA.slice(inicioHero, finHero === -1 ? undefined : finHero)

describe('los segmentos existen donde el test los espera', () => {
  it('AppointmentRow y ProxHero se encuentran en la página', () => {
    expect(inicioFila).toBeGreaterThan(-1)
    expect(inicioHero).toBeGreaterThan(inicioFila)
  })
})

describe('AppointmentRow (zona TODAY) habla los roles de §2', () => {
  it('la identidad del paciente es span.nx-ident', () => {
    // Falla contra el árbol previo: el nombre era un div con fontSize 14 inline.
    expect(FILA).toMatch(/className="nx-ident"/)
  })

  it('la identidad ya no se trunca con ellipsis — §24: la identidad envuelve', () => {
    expect(FILA).not.toContain("textOverflow: 'ellipsis'")
    expect(FILA).not.toContain("whiteSpace: 'nowrap'")
  })

  it('la hora habla .riel-hora/.riel-dur, no un 700 inline que le gane al nombre', () => {
    expect(FILA).toMatch(/className="riel-hora"/)
    expect(FILA).toMatch(/className="riel-dur"/)
    expect(FILA).not.toMatch(/fontWeight: 700/)
    expect(FILA).not.toMatch(/fontVariantNumeric/)
  })

  it('el metadato (tipo · motivo) es .nx-meta, no un fontSize 12 inline', () => {
    expect(FILA).toMatch(/className="nx-meta"/)
    expect(FILA).not.toMatch(/fontSize: 12, color: 'var\(--text3\)'/)
  })

  it('los tamaños inline que esta rebanada retiró no vuelven (deriva contra el rol)', () => {
    // 14 (identidad/hora) y 10 (duración) tienen clase ahora. El 14 del
    // avatar-inicial se queda: no es un papel de §2 (misma decisión que el
    // avatar del Patient Anchor y el de /pacientes).
    expect(FILA).not.toMatch(/fontSize: 14, fontWeight: [57]00/)
    expect(FILA).not.toMatch(/fontSize: 10[,\s}]/)
  })
})

describe('ProxHero (zona NOW) habla los roles de §2', () => {
  it('la identidad del paciente es span.nx-ident', () => {
    // Falla contra el árbol previo: el nombre era un div con fontSize 16 inline.
    expect(HERO).toMatch(/className="nx-ident"/)
  })

  it('la identidad del héroe ya no se trunca — §24, el defecto central de la rebanada', () => {
    expect(HERO).not.toContain("textOverflow: 'ellipsis'")
    expect(HERO).not.toContain("whiteSpace: 'nowrap'")
  })

  it('la hora del héroe habla .riel-hora y el metadato es .nx-meta', () => {
    expect(HERO).toMatch(/className="riel-hora"/)
    expect(HERO).toMatch(/className="nx-meta"/)
    expect(HERO).not.toMatch(/className="t-num"/)
  })

  it('el tamaño inventado del héroe no vuelve', () => {
    expect(HERO).not.toMatch(/fontSize: 16/)
    expect(HERO).not.toMatch(/fontSize: 13, color: 'var\(--text2\)'/)
  })
})

describe('freeze funcional — la rebanada es tipográfica, no de conducta', () => {
  it('la fila sigue abriendo la cita y el héroe sigue iniciando consulta', () => {
    expect(FILA).toMatch(/href=\{`\/citas\?id=\$\{appt\.id\}`\}/)
    expect(HERO).toMatch(/href=\{`\/consulta\/\$\{appt\.pacienteId\}`\}/)
  })

  it('la fila conserva su compuerta puedeIniciar y su StatusBadge', () => {
    expect(FILA).toContain('const puedeIniciar = puedeConsultar && !isPast && !!appt.pacienteId')
    expect(FILA).toMatch(/<StatusBadge status=\{appt\.estado\}/)
  })

  it('lo pasado se sigue atenuando', () => {
    expect(FILA).toMatch(/opacity: isPast \? 0\.6 : 1/)
  })
})
