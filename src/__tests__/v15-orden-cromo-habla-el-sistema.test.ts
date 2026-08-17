/**
 * V15-REMAINING-SCREENS-001 (§32/§34, tercera rebanada) — EL CROMO DE /orden
 * HABLA EL SISTEMA; EL PAPEL (RecetaDocumento) QUEDA INTACTO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * /orden es la tercera pantalla de la familia documental (nota → receta →
 * orden) y compartía TODOS los defectos que sus hermanas ya pagaron, más uno
 * propio:
 *
 *   1. INTERACCIÓN/§24: el editor de la orden — un documento medicolegal —
 *      tenía campos sin nombre accesible: «Diagnóstico de sospecha» e
 *      «Indicaciones para el estudio» eran etiquetas visibles SIN asociar
 *      (`htmlFor`/`id`), el input del estudio personalizado sólo tenía
 *      placeholder (desaparece al escribir), y el botón de quitar de cada
 *      chip (icono solo, repetido N veces) era mudo: el lector de pantalla
 *      anunciaba «botón» N veces sin decir QUÉ estudio quita. «Estudios
 *      solicitados» era un <label> huérfano. Las categorías del catálogo no
 *      declaraban `aria-expanded` ni los estudios `aria-pressed`.
 *
 *   2. TEMA: el cromo pintaba crudos que no cambian de tema — y este archivo
 *      está en la lista PAPEL del trinquete de color (la orden se
 *      rasteriza), así que ningún guardián los veía: banners de
 *      cédula/firma en rgba(239,68,68)/rgba(245,158,11), chips y catálogo en
 *      rgba(20,184,166), el icono de «Nota no encontrada» en #f59e0b. El
 *      propio: la casilla marcada pintaba `Check color="#000"` sobre
 *      `var(--teal)` — 2.99:1 en claro, EXACTAMENTE el defecto ya medido y
 *      pagado en el chip del directorio de /pacientes (rebanada 6 de
 *      VISUAL-SYSTEM); aquí seguía vivo porque el archivo es invisible para
 *      el trinquete. Y el teal COMO TEXTO en chips y estudios seleccionados
 *      — la lección del TrialBanner.
 *
 *   3. JERARQUÍA §16: «Atrás» era un texto suelto de 13px a mano; la
 *      primaria (Descargar PDF) iba al FINAL de la fila mientras /nota y
 *      /receta la llevan PRIMERO; y el botón «Agregar» del estudio
 *      personalizado era una SEGUNDA `btn-primary` en la misma capa — dos
 *      voces primarias en un solo lienzo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el inventario-por-grep de REMAINING-SCREENS-001 (roles §2 vs `fontSize:`
 * inline por pantalla). /orden salió tercera; el estado vivo la dejó nombrada
 * como siguiente rebanada tras /receta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El papel NO se toca: `RecetaDocumento` viaja rasterizado (html2canvas) y a
 * la ventana de impresión, donde las variables del tema no deben mandar
 * (DEBT-008). La vara V15 aplica al CROMO (toolbar, banners, editor, chips);
 * el freeze funcional exige onClick/disabled/validaciones idénticos — en
 * /orden eso incluye que EMITIR (imprimir/Word/PDF) siga creando los
 * pendientes y auditando, que este guardián fija.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide estilos computados, foco real ni axe — eso lo hace el arnés
 * `scripts/design/capturar-orden-cromo-v15.mjs` en navegador real. No cubre
 * el contenido del papel (RecetaDocumento tiene su propia batería) ni que el
 * lector de pantalla ANUNCIE bien los aria-label — sólo que existan. No
 * cubre /login ni /registro (cuarta rebanada, su propio guardián).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUTA = join('src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx')
const src = readFileSync(RUTA, 'utf8')
const PAPEL = readFileSync(join('src', 'components', 'RecetaDocumento.tsx'), 'utf8')

describe('V15 /orden — jerarquía de la barra de acciones (§16)', () => {
  it('Descargar PDF es LA primaria y va PRIMERO en la fila, como en /nota y /receta', () => {
    const fila = src.slice(src.indexOf('className="actions-row"'), src.indexOf('orden-gen-grid'))
    expect(fila).toContain('btn btn-primary')
    expect(fila).toContain('Descargar PDF')
    // La primaria abre la fila: aparece antes que cualquier secundaria.
    expect(fila.indexOf('btn btn-primary')).toBeLessThan(fila.indexOf('btn btn-secondary'))
  })

  it('sólo hay UNA voz primaria en la pantalla (Agregar dejó de ser la segunda)', () => {
    // El botón de «Nota no encontrada» usa `btn btn-primary` en el estado de
    // error (sin nota no hay toolbar: nunca conviven). Desde la toolbar en
    // adelante — el lienzo real — la primaria es una sola.
    const toolbarEnAdelante = src.slice(src.indexOf('orden-toolbar'))
    expect((toolbarEnAdelante.match(/btn btn-primary/g) ?? []).length).toBe(1)
  })

  it('Imprimir, Word y Template son secundarias del sistema', () => {
    expect((src.match(/btn btn-secondary/g) ?? []).length).toBeGreaterThanOrEqual(3)
    for (const texto of ['Imprimir', 'Word', 'Template']) expect(src).toContain(texto)
  })

  it('«Atrás» es un botón del sistema, no un texto suelto de 13px', () => {
    expect(src).toMatch(/onClick=\{volver\} className="btn btn-ghost btn-sm"/)
  })

  it('la toolbar móvil hereda la rejilla de /nota (primaria a fila completa, táctil 44)', () => {
    expect(src).toContain('.orden-toolbar .actions-row { display: grid')
    expect(src).toContain('.orden-toolbar .actions-row > button:first-child { grid-column: 1 / -1; }')
    expect(src).toContain('min-height: 44px')
  })
})

describe('V15 /orden — el editor tiene nombre accesible (la razón de ser de la rebanada)', () => {
  it('las etiquetas visibles se ASOCIAN: htmlFor + id en diagnóstico e indicaciones', () => {
    for (const id of ['om-diagnostico', 'om-indicaciones']) {
      expect(src).toContain(`htmlFor="${id}"`)
      expect(src).toContain(`id="${id}"`)
    }
  })

  it('el estudio personalizado lleva aria-label (el placeholder desaparece al escribir)', () => {
    expect(src).toContain('aria-label="Nombre del estudio personalizado"')
  })

  it('quitar un estudio del chip dice QUÉ estudio quita (se repite N veces)', () => {
    expect(src).toContain('aria-label={`Quitar ${e}`}')
  })

  it('«Estudios solicitados» dejó de ser un <label> huérfano: encabeza el grupo como span', () => {
    expect(src).not.toMatch(/<label[^>]*>Estudios solicitados/)
    expect(src).toMatch(/<span[^>]*>Estudios solicitados/)
  })

  it('el catálogo declara su estado: aria-expanded en categorías, aria-pressed en estudios', () => {
    expect(src).toContain('aria-expanded={abierta}')
    expect(src).toContain('aria-pressed={seleccionado}')
  })
})

describe('V15 /orden — el cromo habla tokens POR TEMA (el trinquete de color no ve este archivo)', () => {
  it('los banners de cédula/firma hablan badges por tema, no rgba crudos', () => {
    expect(src).not.toContain('rgba(239,68,68,0.08)')
    expect(src).not.toContain('rgba(245,158,11,0.08)')
    expect(src).toContain("background: 'var(--badge-red-b)'")
    expect(src).toContain("background: 'var(--badge-amber-b)'")
  })

  it('el teal crudo murió: chips y catálogo hablan color-mix sobre el token', () => {
    expect(src).not.toContain('rgba(20,184,166')
    expect((src.match(/color-mix\(in srgb, var\(--teal\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('el teal COMO TEXTO murió en chips y estudios seleccionados (lección del TrialBanner)', () => {
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(codigo).not.toContain("color: 'var(--teal)'")
    expect(codigo).not.toContain("seleccionado ? 'var(--teal)' : 'var(--text2)'")
  })

  it('la casilla marcada es --nexus-solido + blanco, no #000 sobre teal (2.99:1 en claro)', () => {
    expect(src).not.toContain('color="#000"')
    expect(src).toContain('color="#fff"')
    expect(src).toMatch(/background: seleccionado \? 'var\(--nexus-solido\)'/)
  })

  it('el icono del estado «Nota no encontrada» es token, no #f59e0b', () => {
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(codigo).not.toContain('#f59e0b')
  })
})

describe('V15 /orden — freeze funcional del editor', () => {
  it('la primaria conserva sus guardas: descarga en curso, config y orden vacía', () => {
    expect(src).toContain('disabled={descargando || !!configError || ordenVacia}')
  })

  it('EMITIR (imprimir/Word/PDF) sigue creando los pendientes y auditando — los tres caminos', () => {
    expect((src.match(/crearPendientesDeLaOrden\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((src.match(/evento: 'orden_generada'/g) ?? []).length).toBe(3)
  })

  it('la orden-en-blanco sigue bloqueada (membrete firmado sin contenido)', () => {
    expect(src).toContain("const ordenVacia = estudios.filter(e => e.trim()).length === 0")
    expect((src.match(/disabled=\{ordenVacia\}/g) ?? []).length).toBe(2)
  })

  it('el folio sigue derivado de la nota (OM- estable, no del reloj)', () => {
    expect(src).toContain("return `OM-${base ? base.slice(-7) : semillaFolio}`")
  })

  it('Template navega a configuración y el estado sin nota vuelve a expedientes', () => {
    expect(src).toContain("router.push('/configuracion?tab=recetas')")
    expect(src).toContain("router.push('/pacientes')")
  })

  it('los estudios de la nota siguen pre-poblando y las tareas derivan de la nota', () => {
    expect(src).toContain('n.estudiosOrden')
    expect(src).toContain('tareasDeNota({')
  })
})

describe('V15 /orden — el papel queda intacto (DEBT-008)', () => {
  it('la impresión sólo enseña el documento, igual que antes', () => {
    expect(src).toContain('body * { visibility: hidden !important; }')
    expect(src).toContain('#receta-doc, #receta-doc * { visibility: visible !important; }')
  })

  it('ningún rol de §2 se metió a RecetaDocumento: el papel no depende de la hoja del tema', () => {
    for (const rol of ['nx-meta', 'nx-ident', 'nx-num', 'nx-display', 'nx-critico', 'nx-estado']) {
      expect(PAPEL).not.toContain(rol)
    }
  })

  it('el accento del template del papel sigue siendo config del médico, no un token del tema', () => {
    expect(src).toContain("colorAccento: '#14b8a6'")
  })
})

describe('V15 /orden — roles de §2 en el cromo', () => {
  it('los metadatos del cromo hablan .nx-meta (vista previa)', () => {
    expect((src.match(/className="nx-meta"/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })
})
