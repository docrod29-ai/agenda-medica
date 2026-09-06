/**
 * GOLDEN — el consentimiento impreso lo firma QUIEN CONSIENTE.
 *
 * Reproducción REP-055 del Panel de Lujo (hallazgo MC-003, auditor M-cirujano,
 * P1), movida aquí con el arreglo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * Una nota de tipo `consentimiento` se imprimía con UN solo bloque de firma —el
 * del médico, con su firma escaneada y su cédula—, igual que una nota de
 * evolución: `nota/[patientId]/[notaId]/page.tsx:548` y `nota-word.ts:75-79`.
 * Para el paciente, para su representante y para los testigos no había renglón;
 * tampoco lugar, fecha ni hora del otorgamiento, ni huella del texto aceptado.
 * La sección `declaracion` de la plantilla es prosa libre, y «nombre de
 * testigos» vivía en su *placeholder*.
 *
 * El documento que debía demostrar que se le explicaron riesgos y alternativas
 * no llevaba la firma de quien consintió: ante una queja, el médico exhibe un
 * consentimiento que sólo firmó él, y un perito lo lee como inexistente.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditoría Panel de Lujo, sep-2026: auditor M-cirujano, hallazgo MC-003;
 * equipo rojo CONFIRMADO en P1 tras buscar la vía alterna y no encontrarla —
 * ni el portal, ni /legal, ni ninguna huella SHA-256 de un texto aceptado
 * (la única era la del aviso de privacidad, REG-107).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El consentimiento era «una nota más»: mismo impreso, misma firma, sin acto de
 * otorgamiento. Nadie decidió omitirlo; simplemente el tipo no tenía nada
 * propio en el papel.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md, misión: «que lo escrito sea correcto, rastreable y revisable». Un
 * consentimiento que sólo firma el médico acredita la mitad que no hacía falta
 * acreditar. Las palabras del bloque viven en UN sitio
 * (`src/lib/consentimiento-impreso.ts`) para que la hoja impresa y el .doc
 * digan lo mismo — la lección de MI-002, donde cada impreso redactó la suya.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `construirNotaHTML` (función pura, el Word) y CONTRATO
 * TEXTUAL declarado sobre la página de impresión, que es JSX y no se monta en
 * node. Es la prueba que el hallazgo pide: exigir «Firma del paciente» y
 * «Testigo» en el HTML.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre la firma electrónica en tableta ni el envío por el portal. No cubre
 * el objeto `otorgamiento` en el MODELO de la nota (fecha, quién,
 * representante, testigos) sellado en el hash v3/v4 (REG-059): eso toca
 * `NotaMedica`, que es de otra rebanada, y queda en el handoff. No fija cuántos
 * testigos exige la norma ni si el representante debe acreditar parentesco:
 * NEEDS_CLINICAL_REVIEW / revisión legal contra NOM-004. No cubre la marca de
 * procedencia (dictado/IA) de la sección de riesgos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { construirNotaHTML } from '@/lib/nota-word'
import type { NotaMedica } from '@/types/expediente'
import { RENGLONES_DE_FIRMA, huellaDelTextoAceptado } from '@/lib/consentimiento-impreso'

const raiz = process.cwd()
const PAGINA = 'src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx'

function nota(tipo: NotaMedica['tipo']): NotaMedica {
  return {
    id: 'n-rep055', clinicId: 'c-sintetica', pacienteId: 'p-sintetico', pacienteNombre: 'Paciente Sintético',
    tipo,
    metadata: {
      id: 'n-rep055', tipoNota: tipo, clinicId: 'c-sintetica', pacienteId: 'p-sintetico',
      medicoId: 'm-sintetico', cedulaProfesional: '00000000', especialidad: 'Cirugía General',
      establecimiento: 'Consultorio sintético', fechaCreacion: '2026-09-06T10:00:00Z',
      fechaModificacion: '2026-09-06T10:00:00Z', hashIntegridad: '', version: 1,
      estado: 'firmada', fuenteGeneracion: 'manual',
    },
    fechaConsulta: '2026-09-06T10:00:00Z',
    secciones: [
      { key: 'procedimiento', label: 'Procedimiento o tratamiento', value: 'Procedimiento sintético' },
      { key: 'riesgos', label: 'Riesgos y complicaciones', value: 'Riesgos sintéticos' },
      { key: 'declaracion', label: 'Declaración del paciente', value: 'Comprende y acepta.' },
    ],
    diagnosticos: [], medicamentos: [], alergias: [],
  } as unknown as NotaMedica
}

const FIRMA_PACIENTE = /firma del paciente|firma del paciente o (su )?representante|nombre y firma del paciente/i
const TESTIGO = /testigo/i

describe('MC-003 · el consentimiento impreso lleva renglón de firma del paciente y de testigos', () => {
  it('el Word (construirNotaHTML) con tipo consentimiento trae «Firma del paciente» (hoy: sólo el médico)', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(FIRMA_PACIENTE.test(html), 'el Word sólo trae la firma del médico').toBe(true)
  })

  it('… y trae «Testigo»', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(TESTIGO.test(html), 'el Word no tiene renglón de testigos').toBe(true)
  })

  it('la página de impresión pinta el MISMO bloque de otorgamiento que el Word', () => {
    /**
     * La página no lleva las palabras escritas: las importa de
     * `consentimiento-impreso.ts`, que es el arreglo — cada impreso con su
     * propia redacción es lo que produjo MI-002. Así que aquí se exige el
     * consumo del módulo compartido, y las palabras se exigen en el módulo.
     */
    const src = readFileSync(path.join(raiz, PAGINA), 'utf8')
    expect(src, 'la página no pinta el bloque de otorgamiento').toContain('RENGLONES_DE_FIRMA')
    expect(src).toContain('TITULO_OTORGAMIENTO')
    expect(src).toContain("nota.tipo === 'consentimiento'")
    expect(src, 'la huella del texto aceptado no se imprime').toContain('huellaDelTextoAceptado(')
    const renglones = RENGLONES_DE_FIRMA.join(' | ')
    expect(FIRMA_PACIENTE.test(renglones), 'ningún renglón nombra al paciente').toBe(true)
    expect(TESTIGO.test(renglones), 'ningún renglón nombra a un testigo').toBe(true)
  })

  it('la huella del texto aceptado dice cuándo todavía no existe, en vez de callar', () => {
    // Un consentimiento sin firmar no tiene sello: decir «se genera al firmar»
    // es distinto de imprimir un hueco que parece un dato perdido.
    expect(huellaDelTextoAceptado('')).toContain('se genera al firmar')
    expect(huellaDelTextoAceptado('abc123')).toContain('abc123')
  })

  it('control: el médico sigue firmando (el bloque existente no se pierde)', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(html).toMatch(/Cédula Profesional 00000000/)
  })

  it('control: una nota de seguimiento se sigue construyendo sin error, y SIN bloque de otorgamiento', () => {
    const html = construirNotaHTML(nota('seguimiento'), null)
    expect(html).toContain('Paciente Sintético')
    // El bloque es del consentimiento y de nadie más: si apareciera en toda
    // nota, sería ruido en un documento que ya está firmado por quien debe.
    expect(FIRMA_PACIENTE.test(html)).toBe(false)
    expect(TESTIGO.test(html)).toBe(false)
  })
})
