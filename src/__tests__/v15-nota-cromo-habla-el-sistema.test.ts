/**
 * V15-REMAINING-SCREENS-001 (§32/§34, primera rebanada) — EL CROMO DE /nota
 * HABLA EL SISTEMA; EL PAPEL QUEDA INTACTO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El inventario de superficies no tocadas por las fases estructurales (la
 * primera tarea de REMAINING-SCREENS) encontró que la trilogía documental
 * (/nota, /receta, /orden) hablaba dialecto puro: cero roles de §2 y 47
 * `fontSize` inline sólo en /nota. En /nota, la parte que SÍ es interfaz de la
 * app (no papel) tenía dos defectos de la vara §34:
 *
 *   1. JERARQUÍA: la barra de acciones pintaba SIETE botones a mano, cada uno
 *      con su relleno, peso y color propios — incluidos teal y violeta CRUDOS
 *      (`rgba(20,184,166,…)`, `#a78bfa`) que no cambian de tema. Siete voces
 *      con casi el mismo volumen, contra §16: una tarea dominante por vista.
 *
 *   2. INTERACCIÓN: el modal de adenda — la corrección de un documento
 *      medicolegal FIRMADO — era un overlay a mano sin trampa de foco, sin
 *      Escape, sin `role="dialog"` y con la X de cierre sin nombre accesible.
 *      La regla de diseño lista exactamente eso como falla de compuerta
 *      («modal que no atrapa el foco ni cierra con Escape»), y la primitiva
 *      accesible `Modal` existía en `components/ui` desde antes.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el inventario-por-grep de REMAINING-SCREENS-001 (conteo de roles §2 vs
 * `fontSize:` inline por pantalla), el mismo método que usó la Fase 10. /nota
 * salió primera por uso clínico: es el documento de TODA consulta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El papel NO se toca: los estilos inline del documento (`#doc`) son
 * deliberados — viaja por `outerHTML` a la ventana de impresión y al lienzo
 * del PDF, donde las variables del tema no deben mandar (DEBT-008). La vara
 * V15 aplica al CROMO (toolbar, modal, transcripción); el documento-papel es
 * un fixture funcional congelado, y este guardián lo vigila también.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide estilos computados ni el foco real en un navegador — eso lo hace el
 * arnés `scripts/design/capturar-nota-cromo-v15.mjs` (Escape real, foco
 * medido, axe, dos viewports). No cubre /receta ni /orden: son las siguientes
 * rebanadas del inventario y tendrán su propio guardián. No cubre la conducta
 * interna de `Modal` (trampa de foco, Escape): ésa vive en la primitiva y su
 * propia batería.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUTA = join('src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx')
const src = readFileSync(RUTA, 'utf8')

describe('V15 /nota — jerarquía de la barra de acciones (§16)', () => {
  it('Descargar PDF es LA primaria de la pantalla (btn-primary en la toolbar)', () => {
    // La primaria existe y está en el bloque de la toolbar, junto al spinner de descarga.
    const toolbar = src.slice(src.indexOf('nota-toolbar'), src.indexOf('Documento de la nota'))
    expect(toolbar).toContain('btn btn-primary')
    expect(toolbar).toContain('Descargar PDF')
  })

  it('sólo hay UNA voz primaria por capa: toolbar y pie del modal (2 en total)', () => {
    const primarias = src.match(/btn btn-primary/g) ?? []
    expect(primarias.length).toBe(2)
  })

  it('Imprimir, Word, Receta, Orden y Adenda son secundarias del sistema', () => {
    const secundarias = src.match(/btn btn-secondary/g) ?? []
    // 5 en la toolbar + Cancelar en el modal
    expect(secundarias.length).toBeGreaterThanOrEqual(6)
    for (const texto of ['Imprimir', 'Word', 'Receta', 'Orden', 'Adenda']) {
      expect(src).toContain(texto)
    }
  })

  it('el dialecto de la toolbar murió: sin rellenos primarios a mano ni teal/violeta crudos', () => {
    // El relleno inline de la vieja primaria:
    expect(src).not.toContain("background: 'var(--nexus-solido)'")
    // Los colores crudos de Receta/Orden (no cambian de tema):
    expect(src).not.toContain('rgba(20,184,166')
    expect(src).not.toContain('#a78bfa')
  })

  it('«Atrás» es un botón del sistema, no un texto suelto de 13px', () => {
    expect(src).toMatch(/onClick=\{volver\} className="btn btn-ghost btn-sm"/)
  })
})

describe('V15 /nota — el modal de adenda es la primitiva accesible', () => {
  it('importa y usa Modal de components/ui', () => {
    expect(src).toMatch(/import \{[^}]*Modal[^}]*\} from '@\/components\/ui'/)
    expect(src).toContain('<Modal')
    expect(src).toContain('open={modalAdenda}')
  })

  it('el overlay a mano desapareció (era el modal sin foco ni Escape)', () => {
    expect(src).not.toContain('zIndex: 200')
    expect(src).not.toContain("backdropFilter: 'blur(3px)'")
  })

  it('cerrar sigue bloqueado mientras guarda — ahora por TODAS las vías (onClose del Modal)', () => {
    expect(src).toMatch(/onClose=\{\(\) => \{ if \(!guardandoAdenda\) setModalAdenda\(false\) \}\}/)
  })

  it('freeze funcional: la validación de la adenda no se movió', () => {
    // Motivo obligatorio (≥3) y texto no vacío, en el disabled del botón que firma.
    const disabled = src.match(/disabled=\{guardandoAdenda \|\| !textoAdenda\.trim\(\) \|\| motivoAdenda\.trim\(\)\.length < 3\}/g) ?? []
    expect(disabled.length).toBeGreaterThanOrEqual(1)
    // Y la función guarda con el mismo umbral.
    expect(src).toContain('motivoAdenda.trim().length < 3) return')
  })
})

describe('V15 /nota — freeze funcional del resto del cromo', () => {
  it('la primaria conserva su guarda de config y de descarga en curso', () => {
    expect(src).toContain('disabled={descargando || !!configError}')
  })

  it('Receta y Orden navegan a las mismas rutas y sólo con la nota firmada', () => {
    expect(src).toContain('router.push(`/receta/${patientId}/${notaId}`)')
    expect(src).toContain('router.push(`/orden/${patientId}/${notaId}`)')
    expect(src).toContain("nota.estado === 'firmada' && (")
  })

  it('la toolbar sigue fuera del papel (no-print) y conserva su rejilla móvil', () => {
    expect(src).toContain('className="no-print nota-toolbar"')
    expect(src).toContain('.nota-toolbar .actions-row { display: grid')
  })
})

describe('V15 /nota — el papel queda intacto (DEBT-008)', () => {
  it('la tinta del documento y su tipografía de papel no cambiaron', () => {
    expect(src).toContain("const TINTA = '#1a1a1a'")
    expect(src).toContain('"Times New Roman", Georgia, serif')
  })

  it('#doc sigue siendo el documento y la impresión sólo lo enseña a él', () => {
    expect(src).toContain('id="doc"')
    expect(src).toContain('body * { visibility: hidden !important; }')
    expect(src).toContain('#doc, #doc * { visibility: visible !important; }')
  })

  it('ningún rol de §2 se metió al papel: nx-* sólo vive en bloques no-print', () => {
    // El papel se arma en `printables`; los roles del cromo viven después
    // (transcripción). Si alguien mete un nx-* al papel, el documento impreso
    // dependería de la hoja del TEMA — exactamente lo que DEBT-008 prohíbe.
    const papel = src.slice(src.indexOf('const printables'), src.indexOf('Trazabilidad: lo que se DIJO'))
    expect(papel).not.toContain('nx-meta')
    expect(papel).not.toContain('nx-ident')
    expect(papel).not.toContain('nx-num')
  })
})

describe('V15 /nota — roles de §2 en el cromo', () => {
  it('los metadatos de la transcripción hablan .nx-meta', () => {
    const metas = src.match(/className="nx-meta"/g) ?? []
    expect(metas.length).toBeGreaterThanOrEqual(2)
  })
})
