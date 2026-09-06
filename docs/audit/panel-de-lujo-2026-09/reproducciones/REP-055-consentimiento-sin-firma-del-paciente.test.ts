/**
 * REP-055 · MC-003 (M-cirujano) — el consentimiento informado se imprime sólo
 * con la firma del médico: no hay renglón para el paciente (o representante)
 * ni para los testigos.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:548`
 *   `<div style={{ borderTop: '1px solid #1a1a1a', … }}><strong>{medico}</strong>`
 * es el ÚNICO bloque de firma, para todos los tipos incluido 'consentimiento'
 * (templates.ts:99-106). `src/lib/nota-word.ts:75-79` repite el mismo bloque
 * único en el Word. La sección 'declaracion' es prosa libre («nombre de
 * testigos» va en el placeholder). `grep -rn 'firma.*paciente|testigo' src/`
 * no devuelve ningún bloque de otorgamiento.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-cirujano, MC-003; equipo rojo confirmado P1 buscando la vía
 * alterna (portal, /legal, huella SHA-256) y no existe: la única huella de un
 * texto aceptado es la del aviso de privacidad (REG-107).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El consentimiento es «una nota más»: mismo impreso, misma firma, sin acto de
 * otorgamiento.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md, misión: «que lo escrito sea correcto, rastreable y revisable». Un
 * consentimiento que sólo firma el médico no demuestra que el paciente
 * consintió. El formato exacto: NEEDS_CLINICAL_REVIEW / revisión legal contra
 * NOM-004 (cartas de consentimiento informado) — lo dice el hallazgo.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `construirNotaHTML` (función pura, el Word) y CONTRATO
 * TEXTUAL declarado sobre la página de impresión (JSX). Es la prueba que el
 * hallazgo pide: «exigir “Firma del paciente” y “Testigo” en el HTML».
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre la firma electrónica en tableta ni el envío por el portal. No
 * cubre el objeto `otorgamiento` sellado en el hash v3/v4 (REG-059: campo
 * nuevo exige sello nuevo). No cubre la marca de procedencia (dictado/IA) de la
 * sección de riesgos. No decide cuántos testigos: sólo que el renglón exista.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { construirNotaHTML } from '@/lib/nota-word'
import type { NotaMedica } from '@/types/expediente'

const raiz = path.resolve(__dirname, '../../../..')
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

describe('REP-055 · el consentimiento impreso lleva renglón de firma del paciente y de testigos', () => {
  it('el Word (construirNotaHTML) con tipo consentimiento trae «Firma del paciente» (hoy: sólo el médico)', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(FIRMA_PACIENTE.test(html), 'el Word sólo trae la firma del médico').toBe(true)
  })

  it('… y trae «Testigo»', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(TESTIGO.test(html), 'el Word no tiene renglón de testigos').toBe(true)
  })

  it('la página de impresión de la nota contempla la firma del paciente y los testigos (hoy: un solo bloque, page.tsx:548)', () => {
    const src = readFileSync(path.join(raiz, PAGINA), 'utf8')
    expect(FIRMA_PACIENTE.test(src), 'no hay «Firma del paciente» en la página').toBe(true)
    expect(TESTIGO.test(src), 'no hay «Testigo» en la página').toBe(true)
  })

  it('control: el médico sigue firmando (el bloque existente no se pierde)', () => {
    const html = construirNotaHTML(nota('consentimiento'), null)
    expect(html).toMatch(/Cédula Profesional 00000000/)
  })

  it('control: una consulta externa se sigue construyendo sin error', () => {
    expect(construirNotaHTML(nota('consulta_externa'), null)).toContain('Paciente Sintético')
  })
})
