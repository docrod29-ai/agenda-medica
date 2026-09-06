/**
 * UN DICTADO NO SE ARCHIVA POR TENER UN EXPEDIENTE ABIERTO.
 *
 * Panel de Lujo (sep-2026), auditor B-ingeniero-ia: B-013 (P2, confirmado).
 * Decisión del dueño aplicada por omisión: PL-C17 («preguntar, igual que el
 * laboratorio»).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * Existía una compuerta de sujeto para los laboratorios (`vinculoDeSujeto`,
 * REG-323). Para el dictado no había equivalente: con el expediente de A
 * abierto y la consulta de B dictada, transcripción, nota, receta y estudios se
 * archivaban bajo A sin una sola comprobación.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * El auditor vio la asimetría; el rojo buscó un guardián equivalente para el
 * dictado (`paciente-equivocado-guardia.test.ts` cubre CITA→expediente, no la
 * consulta) y no lo encontró.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * `identidadDe` e `identifica` sólo se usaban para filtrar el aprendizaje; nadie
 * comparaba el dictado con el paciente abierto.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * clinical-safety §6: se pregunta, no se adivina. `dictaminarSujetoDelDictado`
 * reutiliza `identidadDe`/`identifica` y el motivo declarado en
 * `politica-critica.ts` (`paciente_nombrado_no_coincide`). Pide confirmación;
 * no bloquea.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 * El mismo dictado con el paciente correcto abierto no pregunta.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No detecta el caso sin nombres dictados, que es el frecuente: `sin_nombre` lo
 * dice con todas las letras. No cubre apellidos compartidos entre el abierto y
 * el otro (se excluyen a propósito). Que la consulta LLAME a la compuerta antes
 * de guardar y pinte la pregunta es handoff a CONSULTA.
 */
import { describe, it, expect } from 'vitest'
import { dictaminarSujetoDelDictado, POR_QUE_ES_UNA_RED } from '@/lib/asr/sujeto-del-dictado'
import { identidadDe, IDENTIDAD_DESCONOCIDA } from '@/lib/asr/aprendizaje'
import { MOTIVOS_CONFIRMACION } from '@/lib/asr/politica-critica'
import { TEXTO_MOTIVO } from '@/lib/expediente/motivos-confirmacion-texto'

/* Pacientes SINTÉTICOS. */
const ABIERTA = identidadDe('Ernestina Quintanilla Robledo')
const OTROS = [{ nombre: 'Baltasar Ocampo Villaseñor', patientId: 'p-b' }, { nombre: 'Rosaura Quintanilla Ferrer', patientId: 'p-r' }]

describe('B-013 · el dictado que nombra a otro paciente conocido pregunta', () => {
  it('EL CASO: expediente de Ernestina abierto, consulta de Baltasar Ocampo dictada', () => {
    const d = dictaminarSujetoDelDictado('el señor Baltasar Ocampo viene por tos de tres días', ABIERTA, OTROS)
    expect(d.veredicto).toBe('nombra_a_otro')
    expect(d.motivo).toBe('paciente_nombrado_no_coincide')
    expect(d.requiereConfirmacion).toBe(true)
    expect(d.otro?.patientId).toBe('p-b')
    expect(d.texto).toMatch(/no es el paciente del expediente abierto/)
  })

  it('aunque el reconocedor oiga mal el apellido (parecido, no igual)', () => {
    const d = dictaminarSujetoDelDictado('paciente baltazar ocampo con fiebre', ABIERTA, OTROS)
    expect(d.veredicto).toBe('nombra_a_otro')
  })

  it('un apellido COMPARTIDO con el abierto no cuenta como «otro»', () => {
    // Rosaura comparte «Quintanilla» con Ernestina: sólo «Quintanilla» no la nombra a ella.
    const d = dictaminarSujetoDelDictado('la paciente quintanilla refiere cefalea', ABIERTA, OTROS)
    expect(d.veredicto).not.toBe('nombra_a_otro')
  })

  it('probado al revés: el mismo dictado con el paciente correcto abierto no pregunta', () => {
    const d = dictaminarSujetoDelDictado('el señor Baltasar Ocampo viene por tos', identidadDe('Baltasar Ocampo Villaseñor'), [{ nombre: 'Ernestina Quintanilla Robledo' }])
    expect(d.veredicto).toBe('coincide')
    expect(d.requiereConfirmacion).toBe(false)
  })
})

describe('B-013 · la muletilla «paciente Fulano Mengano» también pregunta', () => {
  it('nombre desconocido tras «paciente», sin que el abierto aparezca', () => {
    const d = dictaminarSujetoDelDictado('paciente Leocadio Arrieta de sesenta años acude por disnea', ABIERTA, [])
    expect(d.veredicto).toBe('nombra_a_otro')
    expect(d.nombrado).toBe('leocadio arrieta')
  })

  it('«paciente masculino de 45 años» NO es un nombre', () => {
    const d = dictaminarSujetoDelDictado('paciente masculino de cuarenta y cinco años acude por tos', ABIERTA, [])
    expect(d.veredicto).toBe('sin_nombre')
    expect(d.requiereConfirmacion).toBe(false)
  })

  it('«paciente Ernestina Quintanilla» con Ernestina abierta coincide', () => {
    expect(dictaminarSujetoDelDictado('paciente ernestina quintanilla acude a control', ABIERTA, []).veredicto).toBe('coincide')
  })
})

describe('B-013 · lo que la red NO promete', () => {
  it('sin nombres en el dictado el veredicto es «sin_nombre», nunca «coincide»', () => {
    const d = dictaminarSujetoDelDictado('acude por dolor abdominal de dos días, afebril', ABIERTA, OTROS)
    expect(d.veredicto).toBe('sin_nombre')
    expect(d.texto).toMatch(/no prueba que sea de este paciente/)
    expect(POR_QUE_ES_UNA_RED).toMatch(/Ausencia de nombre no es dato de identidad/)
  })

  it('sin identidad conocida del abierto tampoco se afirma nada', () => {
    const d = dictaminarSujetoDelDictado('paciente baltasar ocampo con tos', IDENTIDAD_DESCONOCIDA, [])
    expect(d.veredicto).toBe('sin_nombre')
  })

  it('el motivo vive en la política crítica y tiene texto para la pantalla', () => {
    expect(MOTIVOS_CONFIRMACION).toContain('paciente_nombrado_no_coincide')
    expect(TEXTO_MOTIVO.paciente_nombrado_no_coincide).toMatch(/Confirma de quién es esta consulta/)
  })
})
