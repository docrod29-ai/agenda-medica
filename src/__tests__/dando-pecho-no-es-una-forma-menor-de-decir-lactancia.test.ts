/**
 * GOLDEN — «estoy dando pecho, ¿cómo tomo el ibuprofeno?» no escalaba: se
 * contestaba desde un plan que nunca consideró la lactancia.
 *
 * Nace como reproducción REP-019 del Panel de Lujo (sep-2026), hallazgo MG-014
 * de la auditora M-ginecologa, P1. Se movió aquí con su arreglo.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/paciente/pregunta-del-paciente.ts:208`:
 *   `/(estoy |sali |creo que estoy )?(embarazada|embarazo)|doy pecho|estoy lactando|lactancia|amamant/`
 * «dando pecho», «le doy leche», «en cinta», «gestante» no casan. Cuando el
 * patrón de ACTOS_PROHIBIDOS no casa, la pregunta NO cae a escalación: cae al
 * paso 4 (:355-367), encuentra el ibuprofeno en `medicationInstructions`,
 * `PREGUNTA_POR_TOMA` casa «como» y responde ANSWER_FROM_APPROVED_PLAN.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-ginecologa, MG-014; equipo rojo confirmado P1 con node siguiendo el
 * orden real del clasificador: las tres variantes → ANSWER_FROM_APPROVED_PLAN;
 * «estoy embarazada, ¿cómo tomo el ibuprofeno?» sí escala. Refuta el invariante
 * que el módulo se atribuye en :55-59 («un vocabulario incompleto pierde
 * precisión, nunca seguridad»).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Vocabulario de lactancia con un solo verbo, y un orden de pasos en que el
 * plan liberado contesta antes de que el hueco de vocabulario escale.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * patient-facing-ai §5: ante una pregunta cuya respuesta segura depende de un
 * dato que NO está en el plan aprobado (aquí, la lactancia), se escala, no se
 * completa con lo probable.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: importa `clasificarPregunta` con un plan sintético.
 *
 * ── EL ARREGLO ───────────────────────────────────────────────────────────────
 * El acto `embarazo_o_lactancia` de `ACTOS_PROHIBIDOS` pasa a ser **el primero
 * de la lista** y su vocabulario deja de tener un solo verbo: «dando pecho»,
 * «le doy leche», «amamanto», «en cinta», «gestante» y la raíz `embarazad`
 * entran. Va el primero a propósito: cuando el embarazo o la lactancia están
 * sobre la mesa, ninguna otra etiqueta describe mejor lo que hay que mirar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No decide el vocabulario final de «menciona lactancia»: sigue siendo
 * vocabulario y no criterio, y lo que no esté escrito no se detecta como acto
 * —aunque ahora el destino por omisión sí es escalar, porque la pregunta de
 * toma exige dos señales. No hace que el plan liberado SEPA de la lactancia
 * (MG-003, otra rebanada): eso es estado del paciente, no vocabulario. Los
 * casos permanentes viven en `evals/patient-ai/casos.json` (`pl-01`, `pl-02`).
 */
import { describe, it, expect } from 'vitest'
import { clasificarPregunta, type PlanLiberado } from '@/lib/paciente/pregunta-del-paciente'

const PLAN: PlanLiberado = {
  notaId: 'nota-sintetica-001',
  fechaConsulta: '2026-09-01',
  medicationInstructions: [
    { nombre: 'Ibuprofeno 400 mg', instruccion: 'Tomar 1 tableta cada 8 horas con alimentos, por 5 días.' },
  ],
  medicationChanges: null,
  orders: [],
  followUp: '',
  version: 1,
}

const ESCALA = new Set(['ESCALATE_TO_CLINICIAN', 'URGENT_REVIEW_REQUIRED'])

describe('lactancia + fármaco del plan se escala, nunca se contesta desde el plan', () => {
  it.each([
    'estoy dando pecho, ¿cómo tomo el ibuprofeno?',
    'le doy leche a mi bebé, ¿cada cuándo tomo el ibuprofeno?',
    'estoy en cinta, ¿cómo tomo el ibuprofeno?',
  ])('«%s» → escalación con motivo embarazo_o_lactancia', texto => {
    const r = clasificarPregunta(texto, { plan: PLAN })
    expect(ESCALA.has(r.clase), `clase=${r.clase} · motivo=${r.motivo} · texto=«${r.texto}»`).toBe(true)
    expect(r.clase).not.toBe('ANSWER_FROM_APPROVED_PLAN')
    expect(r.procedencia).toBeNull()
    expect(r.motivo).toBe('embarazo_o_lactancia')
  })

  it('control: «estoy embarazada, ¿cómo tomo el ibuprofeno?» ya escala (el plan y el motor son los correctos)', () => {
    const r = clasificarPregunta('estoy embarazada, ¿cómo tomo el ibuprofeno?', { plan: PLAN })
    expect(r.clase).toBe('ESCALATE_TO_CLINICIAN')
    expect(r.motivo).toBe('embarazo_o_lactancia')
  })

  it('control: sin mención de lactancia, «¿cómo tomo el ibuprofeno?» sí se contesta citando el plan', () => {
    const r = clasificarPregunta('¿cómo tomo el ibuprofeno?', { plan: PLAN })
    expect(r.clase).toBe('ANSWER_FROM_APPROVED_PLAN')
    expect(r.texto).toBe(PLAN.medicationInstructions[0].instruccion)
  })
})
