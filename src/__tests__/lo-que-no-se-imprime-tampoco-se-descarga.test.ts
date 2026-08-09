/**
 * LO QUE NO SE IMPRIME TAMPOCO SE DESCARGA.
 *
 * ── LA PREGUNTA DEL MÉDICO ──────────────────────────────────────────────────
 *
 * Mandó un PDF de una nota firmada con un recuadro negro en medio:
 *
 *     «Sello de formato anterior (v3): verificado sobre el cuerpo de la nota.
 *      No cubre: … metadata.fechaModificacion, metadata.hashIntegridad,
 *      metadata.hashVersion, metadata.version, metadata.estado.»
 *
 * Y preguntó: **«esto tiene que salir a fuerzas?»** «eso negro se va imprimir?»
 *
 * ── LA RESPUESTA ES QUE NO, Y EL PORQUÉ ES LO INTERESANTE ───────────────────
 *
 * El recuadro **ya estaba marcado** `className="no-print"`. Al pulsar Imprimir
 * desaparece, correctamente. Pero la regla que lo oculta vive dentro de un
 * `@media print`, y **descargar el PDF no es imprimir**: html2canvas rasteriza
 * el DOM tal como se ve en pantalla, y `@media print` no se activa nunca.
 *
 * Así que el MISMO documento salía de dos maneras distintas según el botón. El
 * aviso es para el médico en pantalla; en el papel que se entrega o se archiva
 * es jerga interna en medio de una nota clínica.
 *
 * ── POR QUÉ NO SE BORRÓ EL RECUADRO Y YA ────────────────────────────────────
 *
 * Porque dice algo cierto: el sello de esa nota es de un formato viejo y no
 * cubre toda la nota. Esconderlo en la app sería ocultar una limitación real.
 * Lo que estaba mal no era el aviso: era que este camino no miraba la marca.
 *
 * Y por eso el arreglo va en el exportador y no en el recuadro — así protege a
 * TODOS los avisos marcados, en todos los documentos, incluidos los que aún no
 * existen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const pdf = readFileSync(join(process.cwd(), 'src', 'lib', 'pdf-download.ts'), 'utf8')

describe('los dos caminos de PDF respetan la marca no-print', () => {
  it('el PDF hoja-por-hoja oculta lo marcado antes de rasterizar', () => {
    expect(pdf).toMatch(/querySelectorAll<HTMLElement>\('\.no-print'\)/)
    expect(pdf).toMatch(/el\.style\.display = 'none'/)
  })

  it('y lo devuelve a la vista pase lo que pase', () => {
    // En el `finally`: si html2canvas falla a mitad, el aviso NO puede quedarse
    // invisible en la pantalla del médico.
    const bloqueFinally = pdf.slice(pdf.indexOf('} finally {'))
    expect(bloqueFinally).toMatch(/for \(const \{ el, display \} of ocultados\) el\.style\.display = display/)
  })

  it('el PDF de una sola pieza lo oculta en el clon', () => {
    expect(pdf).toMatch(/onclone: \(doc: Document\) =>/)
    expect(pdf).toMatch(/doc\.querySelectorAll<HTMLElement>\('\.no-print'\)/)
  })
})

describe('la marca sigue significando algo en las pantallas de documento', () => {
  it('las pantallas imprimibles siguen declarando la regla de impresión', () => {
    // Si alguien borra el @media print, el arreglo del exportador se queda
    // solo y la marca deja de tener efecto al imprimir.
    const pantallas = [
      ['src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx'],
    ]
    for (const p of pantallas) {
      const src = readFileSync(join(process.cwd(), ...p), 'utf8')
      expect(src, p.join('/')).toMatch(/\.no-print \{ display: none !important; \}/)
    }
  })

  it('hay avisos que de verdad la usan (si no, esto no protege nada)', () => {
    let usos = 0
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n)
        if (statSync(p).isDirectory()) { if (n !== '__tests__') recorrer(p); continue }
        if (!/\.tsx$/.test(n)) continue
        usos += (readFileSync(p, 'utf8').match(/className="no-print"/g) ?? []).length
      }
    }
    recorrer(join(process.cwd(), 'src'))
    expect(usos).toBeGreaterThan(0)
  })
})
