/**
 * V15-REMAINING-SCREENS-001 (§32/§34, segunda rebanada) — EL CROMO DE /receta
 * HABLA EL SISTEMA; EL PAPEL (RecetaDocumento) QUEDA INTACTO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * /receta es la segunda pantalla del inventario de REMAINING-SCREENS (0 roles
 * §2, 31 `fontSize` inline) y, a diferencia de /nota, es un EDITOR además de
 * un impreso. Tres defectos de la vara §34 en su cromo:
 *
 *   1. INTERACCIÓN/§24: el editor de la receta — un documento medicolegal —
 *      tenía TODOS sus campos sin nombre accesible: las etiquetas visibles
 *      (Diagnóstico, Indicaciones, Nota al paciente, Creatinina, Peso) no se
 *      asociaban (`htmlFor`/`id`), y los SEIS campos de cada fila de
 *      medicamento (nombre, dosis, vía, frecuencia, duración, indicación)
 *      sólo tenían placeholder — que desaparece al escribir. La regla de
 *      diseño lista «campo sin etiqueta» como falla de compuerta, y aquí el
 *      campo mudo es el que lleva LA DOSIS. El botón de quitar medicamento
 *      (icono solo) tampoco tenía nombre accesible.
 *
 *   2. TEMA: el cromo pintaba colores CRUDOS que no cambian de tema — y este
 *      archivo está en la lista PAPEL del trinquete de color (la receta se
 *      rasteriza), así que ningún guardián los veía. El peor: la alerta de
 *      DOSIS — la más importante de la pantalla — titulaba en `#b91c1c` fijo,
 *      ilegible sobre el canvas oscuro; la MISMA lección que el bloque de
 *      alergia de arriba ya tenía escrita en su comentario desde antes.
 *      También: banners de cédula/domicilio/firma en rgba crudos, ámbar como
 *      texto (falla contraste en claro — lección del TrialBanner), teal crudo
 *      en la caja de tip, borde rojo crudo en el botón de quitar.
 *
 *   3. JERARQUÍA §16: «Atrás» era un texto suelto de 13px a mano (no un botón
 *      del sistema), y la primaria (Descargar PDF) iba al FINAL de la fila de
 *      acciones mientras /nota — la otra mitad de la familia documental — la
 *      lleva primero: dos pantallas hermanas con dos órdenes distintos.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Por el inventario-por-grep de REMAINING-SCREENS-001 (roles §2 vs `fontSize:`
 * inline por pantalla). /receta salió segunda por uso clínico, después de
 * /nota; el estado vivo la dejó nombrada como siguiente rebanada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El papel NO se toca: `RecetaDocumento` viaja rasterizado (html2canvas) y a
 * la ventana de impresión, donde las variables del tema no deben mandar
 * (DEBT-008). La vara V15 aplica al CROMO (toolbar, banners, alertas, editor);
 * el freeze funcional exige onClick/disabled/validaciones idénticos, y este
 * guardián los fija.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide estilos computados, foco real ni axe — eso lo hace el arnés
 * `scripts/design/capturar-receta-cromo-v15.mjs` en navegador real. No cubre
 * /orden (tercera rebanada, su propio guardián) ni el contenido del papel
 * (RecetaDocumento tiene su propia batería). No cubre que el lector de
 * pantalla ANUNCIE bien los aria-label — sólo que existan.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUTA = join('src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx')
const src = readFileSync(RUTA, 'utf8')
const PAPEL = readFileSync(join('src', 'components', 'RecetaDocumento.tsx'), 'utf8')

describe('V15 /receta — jerarquía de la barra de acciones (§16)', () => {
  it('Descargar PDF es LA primaria y va PRIMERO en la fila, como en /nota', () => {
    const fila = src.slice(src.indexOf('className="actions-row"'), src.indexOf('receta-gen-grid'))
    expect(fila).toContain('btn btn-primary')
    expect(fila).toContain('Descargar PDF')
    // La primaria abre la fila: aparece antes que cualquier secundaria.
    expect(fila.indexOf('btn btn-primary')).toBeLessThan(fila.indexOf('btn btn-secondary'))
  })

  it('sólo hay UNA voz primaria en la pantalla', () => {
    // El botón de «Nota no encontrada» usa la clase legacy `btn btn-primary`
    // en el estado de error (sin nota no hay toolbar: nunca conviven).
    const toolbarEnAdelante = src.slice(src.indexOf('receta-toolbar'))
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
    expect(src).toContain('.receta-toolbar .actions-row { display: grid')
    expect(src).toContain('.receta-toolbar .actions-row > button:first-child { grid-column: 1 / -1; }')
    expect(src).toContain('min-height: 44px')
  })
})

describe('V15 /receta — el editor tiene nombre accesible (la razón de ser de la rebanada)', () => {
  it('las etiquetas visibles se ASOCIAN: htmlFor + id en los 5 campos sueltos', () => {
    for (const id of ['rx-diagnostico', 'rx-creatinina', 'rx-peso', 'rx-indicaciones', 'rx-nota-paciente']) {
      expect(src).toContain(`htmlFor="${id}"`)
      expect(src).toContain(`id="${id}"`)
    }
  })

  it('los SEIS campos de la fila de medicamento llevan aria-label (el placeholder desaparece al escribir)', () => {
    for (const etiqueta of ['Medicamento (DCI)', 'Dosis', 'Vía de administración', 'Frecuencia', 'Duración', 'Indicación']) {
      expect(src).toContain(`aria-label="${etiqueta}"`)
    }
  })

  it('quitar un medicamento tiene nombre accesible (icono solo no basta)', () => {
    expect(src).toContain('aria-label="Quitar medicamento"')
  })

  it('«Medicamentos» dejó de ser un <label> huérfano: encabeza el grupo como span', () => {
    expect(src).not.toMatch(/<label[^>]*>Medicamentos /)
    expect(src).toMatch(/<span[^>]*>Medicamentos /)
  })
})

describe('V15 /receta — el cromo habla tokens POR TEMA (el trinquete de color no ve este archivo)', () => {
  it('la alerta de DOSIS dejó el #b91c1c fijo: título y borde en tokens de badge', () => {
    // El hex sólo puede sobrevivir en comentarios o como fallback de un var().
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(codigo).not.toContain("'#b91c1c'")
    expect(codigo).not.toContain('#b91c1c }')
    expect((src.match(/var\(--badge-red-t\)/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('los banners de cédula/domicilio/firma hablan badges por tema, no rgba crudos', () => {
    expect(src).not.toContain('rgba(239,68,68,0.08)')
    expect(src).not.toContain('rgba(245,158,11,0.08)')
    expect(src).toContain("background: 'var(--badge-red-b)'")
    expect((src.match(/var\(--badge-amber-b\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el ámbar y el azul como TEXTO usan el token de texto del badge (lección del TrialBanner)', () => {
    expect(src).toContain("color: 'var(--badge-amber-t)'")
    expect(src).toContain("color: 'var(--badge-blue-t)'")
    expect(src).not.toContain('rgba(217,119,6,0.10)')
    expect(src).not.toContain('rgba(61,90,254,0.08)')
  })

  it('el teal crudo murió y el rojo del botón de quitar es token', () => {
    expect(src).not.toContain('rgba(20,184,166')
    expect(src).not.toContain('rgba(239,68,68,0.3)')
    expect(src).toContain('color-mix(in srgb, var(--red) 30%, transparent)')
    // El icono del estado «Nota no encontrada» también.
    expect(src).not.toContain('#f59e0b')
  })
})

describe('V15 /receta — freeze funcional del editor', () => {
  it('la primaria conserva sus guardas: descarga en curso, config y receta vacía', () => {
    expect(src).toContain('disabled={descargando || !!configError || recetaVacia}')
  })

  it('imprimir y descargar siguen auditando y aprendiendo (mismos eventos)', () => {
    expect(src).toContain("evento: 'receta_generada'")
    expect(src).toContain("evento: 'receta_descargada'")
    expect((src.match(/aprenderDeReceta\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el tope de 6 medicamentos y la receta-en-blanco bloqueada no se movieron', () => {
    expect(src).toContain('const MAX_MEDS = 6')
    expect(src).toContain("const recetaVacia = !medicamentos.some(m => m.nombre?.trim()) && !indicaciones.trim()")
  })

  it('lo suspendido y lo habitual siguen sin bajar al papel (cadena de filtrado intacta)', () => {
    /**
     * LA CADENA SIGUE INTACTA; LO QUE CAMBIÓ ES DÓNDE VIVE (H-01, REG-329).
     *
     * Esto congelaba las dos mitades escritas A MANO en esta pantalla:
     * `loQueSeReceta(...)` y `.filter(m => estaVigente(m))`. Ambas siguen
     * aplicándose —ni una menos— pero componidas dentro de
     * `medicamentosDeLaReceta`, que es ahora la única puerta y la que cruza
     * también el portal del paciente.
     *
     * Congelar la composición aquí dentro era, de hecho, parte del problema:
     * daba por buena una regla clínica que sólo protegía a esta pantalla,
     * mientras el portal bajaba `nota.medicamentos` en crudo a un documento
     * titulado «RECETA MÉDICA».
     */
    expect(src).toContain('medicamentosDeLaReceta(n.medicamentos ?? [])')
    // Y no vuelve a haber una segunda composición a mano que pueda divergir.
    expect(src).not.toContain('loQueSeReceta(')
  })

  it('el folio sigue derivado de la nota y el QR se sigue minteando en el servidor', () => {
    expect(src).toContain('folioDeNota(notaId)')
    expect(src).toContain("fetchAutenticado('/api/receta/verificacion-url'")
  })

  it('Template navega a configuración y el estado sin nota vuelve a expedientes', () => {
    expect(src).toContain("router.push('/configuracion?tab=recetas')")
    expect(src).toContain("router.push('/pacientes')")
  })
})

describe('V15 /receta — el papel queda intacto (DEBT-008)', () => {
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

describe('V15 /receta — roles de §2 en el cromo', () => {
  it('los metadatos del cromo hablan .nx-meta (vista previa, avisos de apoyo, tip)', () => {
    expect((src.match(/className="nx-meta"/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })
})
