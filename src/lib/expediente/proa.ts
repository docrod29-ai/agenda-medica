/**
 * PROA / Antimicrobial Stewardship — cierre del loop.
 *
 * Cuando una nota incluye antimicrobianos, el estándar de stewardship exige
 * REEVALUAR a las 48-72h: ¿sigue indicado?, ¿desescalar con el antibiograma?,
 * ¿switch IV→VO si el paciente está estable?, ¿duración total definida?
 *
 * Este módulo:
 *   1. Detecta los antimicrobianos prescritos (antibióticos, antifúngicos,
 *      antivirales) reusando los catálogos del vocabulario médico.
 *   2. Calcula la fecha sugerida de reevaluación (hoy + 2-3 días, zona MX).
 *   3. Devuelve los recordatorios de stewardship accionables.
 *
 * Apoyo decisional para infectología. No sustituye el juicio clínico.
 */
import { ANTIBIOTICOS, ANTIFUNGICOS, ANTIVIRALES } from './medical-vocabulary'
import { hoyISO, sumarDiasISO } from '../timezone'

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const CATALOGO_ANTIMICROBIANO: string[] = [...ANTIBIOTICOS, ...ANTIFUNGICOS, ...ANTIVIRALES]
  .map(t => norm(t.split('/')[0]))  // 'piperacilina/tazobactam' → 'piperacilina'
  .filter(t => t.length >= 5)

/** Detecta qué medicamentos prescritos son antimicrobianos. */
export function detectarAntimicrobianos(medicamentos: { nombre?: string }[]): string[] {
  const out: string[] = []
  const vistos = new Set<string>()
  for (const m of medicamentos) {
    const n = norm(m.nombre ?? '')
    if (!n) continue
    if (CATALOGO_ANTIMICROBIANO.some(a => n.includes(a))) {
      const clave = m.nombre ?? ''
      if (!vistos.has(clave)) { vistos.add(clave); out.push(clave) }
    }
  }
  return out
}

export interface PlanPROA {
  hayAntimicrobianos: boolean
  antimicrobianos: string[]
  /** Fecha sugerida de reevaluación (YYYY-MM-DD, hoy + 2 días, zona MX). */
  fechaReevaluacion: string
  /** Ventana textual de reevaluación. */
  ventana: string
  /** Recordatorios de stewardship. */
  recordatorios: string[]
}

/** Construye el plan PROA para los medicamentos de la nota. */
export function construirPlanPROA(medicamentos: { nombre?: string }[]): PlanPROA {
  const antimicrobianos = detectarAntimicrobianos(medicamentos)
  if (antimicrobianos.length === 0) {
    return { hayAntimicrobianos: false, antimicrobianos: [], fechaReevaluacion: '', ventana: '', recordatorios: [] }
  }
  const hoy = hoyISO()
  return {
    hayAntimicrobianos: true,
    antimicrobianos,
    fechaReevaluacion: sumarDiasISO(hoy, 2),
    ventana: `${sumarDiasISO(hoy, 2)} a ${sumarDiasISO(hoy, 3)}`,
    recordatorios: [
      'Reevaluar la INDICACIÓN: ¿sigue justificado el antimicrobiano? (suspender si no hay infección).',
      'DESESCALAR según antibiograma/cultivos en cuanto estén disponibles.',
      'Valorar SWITCH IV→VO si el paciente tolera vía oral, está estable y sin foco profundo.',
      'Definir DURACIÓN TOTAL del tratamiento (evitar cursos prolongados sin justificación).',
      'Registrar el DÍA de tratamiento y documentar la decisión en la nota.',
    ],
  }
}
