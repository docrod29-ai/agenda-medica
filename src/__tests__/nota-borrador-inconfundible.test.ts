/**
 * LA NOTA BORRADOR ES INCONFUNDIBLE — V10-NOTE-001 · DEBT-008/DEBT-009.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * Captura `nota--1440.png` del arnés V10 (9-ago-2026, nota borrador sembrada
 * `nota-sint-01`): una nota SIN FIRMAR era indistinguible de una firmada a
 * golpe de vista. El único marcador era una línea gris de 9.5px al FINAL del
 * documento — después de la línea de firma con el nombre del médico, bajo el
 * pliegue — y Descargar PDF / Imprimir / Word se ofrecían exactamente igual
 * que en una firmada. Regla de diseño V10 §8.30: «Signed/released/draft
 * clinical states are visually unambiguous»; factores humanos §37: «Is draft
 * vs final unmistakable?» — la respuesta era NO.
 *
 * En la misma captura, axe reportó contraste serious ×7 en la tabla de datos
 * del paciente: `globals.css` pinta `tbody td { color: var(--text2) }` (gris
 * claro del tema oscuro) y esa regla se COLABA en el documento-papel blanco.
 * Peor: el popup de impresión (`imprimirElemento`) copia los <link> globales,
 * así que el papel IMPRESO también salía con los datos del paciente en gris.
 *
 * Y `nota--390.png`: las 3 acciones de exportar apiladas a ancho completo
 * SOBRE el documento y «Atrás» recortado detrás de Imprimir (DEBT-009).
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * 1. El estado `borrador` sólo se comunicaba en el sello NOM-024 del pie: un
 *    lugar pensado para lo legal, no para la percepción. Nada arriba, nada en
 *    el papel exportado.
 * 2. El documento-papel hereda reglas de la app (tbody td) porque sus <td> no
 *    declaraban su color explícito, y el documento viaja por outerHTML a la
 *    ventana de impresión, donde el <style> de la página NO llega.
 * 3. `.actions-row` global hace `flex: 1 1 100%` bajo 480px (cada botón una
 *    fila a lo ancho) y el contenedor de la barra no envolvía (`flex-wrap`).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una nota no firmada se declara BORRADOR en TODAS las superficies: banda
 * arriba en pantalla (no-print), marca de agua dentro del documento (pantalla,
 * PDF e impresión — repetida por hoja impresa vía regla @media print global,
 * porque el popup sólo recibe los <link>), y banda roja en el Word editable.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Escrito ANTES del arreglo: las 8 comprobaciones fallaron contra el código
 * de 2b9cfaa9 (corrida del 9-ago noche). Con el arreglo pasan todas.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * Es un barrido de FUENTE: comprueba que el código exista, no lo que pinta el
 * navegador (eso lo mide `tests/visual/arnes-a11y.mjs` + capturas, fuera de
 * CI). El PDF de la nota SIN membrete es una captura html2canvas continua: la
 * marca de agua cae una vez sobre el lienzo (centrada), no una por página del
 * PDF multipágina — la vía membretada sí la lleva en CADA hoja. Tampoco
 * cubre receta ni orden (documentos que sólo existen firmados).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const pagina = () => leer('src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx')

describe('DEBT-008 · la nota borrador se declara arriba, no sólo en el pie', () => {
  it('hay banda BORRADOR (no-print) condicionada al estado sin firmar', () => {
    const src = pagina()
    // La banda existe y dice BORRADOR de frente…
    expect(src).toMatch(/BORRADOR — esta nota no está firmada/)
    // …y está condicionada al estado (no puede salir en una firmada). La ventana
    // de 800 caracteres cubre el <div> de la banda entre la condición y el texto.
    expect(src).toMatch(/nota\.estado !== 'firmada'[\s\S]{0,800}BORRADOR — esta nota no está firmada/)
  })

  it('el documento lleva marca de agua BORRADOR en la vía continua (sin membrete)', () => {
    expect(pagina()).toMatch(/nota-marca-borrador/)
  })

  it('la vía membretada recibe el estado y estampa la marca en cada hoja', () => {
    const src = pagina()
    // El paginador recibe si es borrador…
    expect(src).toMatch(/<HojasNota[\s\S]{0,400}borrador=\{/)
    // …y lo estampa dentro de cada .nota-sheet.
    expect(src).toMatch(/nota-sheet[\s\S]{0,2000}MarcaBorrador/)
  })

  it('la marca de agua se REPITE por hoja impresa (regla global, porque el popup sólo copia <link>)', () => {
    const css = leer('src/app/globals.css')
    // Dentro de un bloque @media print (el de tokens de impresión es largo: la
    // ventana perezosa llega hasta la regla) y con el fixed pegado a la clase.
    expect(css).toMatch(/@media print[\s\S]*?\.nota-marca-borrador[\s\S]{0,200}position:\s*fixed/)
  })

  it('el Word editable también sale marcado BORRADOR', () => {
    const word = leer('src/lib/nota-word.ts')
    expect(word).toMatch(/estado !== 'firmada'/)
    expect(word).toMatch(/BORRADOR/)
  })
})

describe('DEBT-008 · los datos del paciente no heredan el gris del tema (contraste serious ×7)', () => {
  it('cada <td> del documento declara su color de papel explícito', () => {
    // tbody td { color: var(--text2) } de globals.css se colaba en el documento
    // Y en el popup de impresión. El color va INLINE porque el documento viaja
    // por outerHTML: una clase de la página no llega a la ventana de imprimir.
    const tds = pagina().match(/padding: '2px 0', color: '#1a1a1a'/g) ?? []
    expect(tds.length).toBeGreaterThanOrEqual(5)
  })

  it('el hover de tabla de la app no pinta bandas oscuras sobre el papel', () => {
    // globals.css: tbody tr:hover { background: var(--s2) } — sobre el documento
    // blanco, pasar el mouse (o el toque emulado del arnés) dibujaba una banda
    // gris oscuro encima de Edad/Sexo/Tel. El papel neutraliza la regla de la app.
    expect(pagina()).toMatch(/#doc tbody tr, #doc tbody tr:hover\s*\{[^}]*background:\s*transparent/)
  })
})

describe('DEBT-009 · la barra de acciones cabe en un teléfono', () => {
  it('la barra envuelve y las acciones van en rejilla de 2 columnas bajo 480px', () => {
    const src = pagina()
    expect(src).toMatch(/\.nota-toolbar\s*\{[^}]*flex-wrap:\s*wrap/)
    expect(src).toMatch(/\.nota-toolbar \.actions-row\s*\{[^}]*display:\s*grid/)
    expect(src).toMatch(/grid-template-columns:\s*1fr 1fr/)
  })

  it('los objetivos táctiles miden 44px y el primario ocupa la fila completa', () => {
    const src = pagina()
    expect(src).toMatch(/\.nota-toolbar \.actions-row > button\s*\{[^}]*min-height:\s*44px/)
    expect(src).toMatch(/grid-column:\s*1 \/ -1/)
  })
})
