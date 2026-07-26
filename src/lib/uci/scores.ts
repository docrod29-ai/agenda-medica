/**
 * ESCALAS DE UCI — SOFA (iteración nexusmed-icu-010).
 *
 * SOFA (Sequential Organ Failure Assessment) con los cortes PUBLICADOS
 * (Vincent 1996 / uso estándar internacional). Es una definición FIJA — no es
 * "mi criterio" —, pero se entrega marcada `pendienteValidacion: true`: el
 * médico debe CONFIRMAR los umbrales antes de confiarla clínicamente (igual que
 * los breakpoints del antibiograma). El LLM nunca calcula esto.
 *
 * Honestidad de datos: si falta un dato de un aparato, ese subscore es null y el
 * total se marca `parcial` con la lista de faltantes — NO se asume 0 (un dato
 * ausente no es "sin disfunción"). Igual criterio que NEWS2.
 */

export const SCORES_UCI_VERSION = '1.0.0'
export const SOFA_PENDIENTE_VALIDACION = true

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

export interface EntradaSOFA {
  pafi?: number | string          // PaO2/FiO2 (mmHg)
  soporteRespiratorio?: boolean   // VM/CPAP (necesario para puntos 3–4 de respiratorio)
  plaquetas?: number | string     // ×10³/µL
  bilirrubina?: number | string   // mg/dL
  pam?: number | string           // mmHg
  // Vasopresores en mcg/kg/min (≥1 h):
  dopamina?: number | string
  dobutamina?: number | string    // cualquier dosis
  epinefrina?: number | string
  norepinefrina?: number | string
  glasgow?: number | string       // 3–15
  creatinina?: number | string    // mg/dL
  uresis24h?: number | string     // mL/día (alternativa renal)
}

export interface SubscoreSOFA { sistema: string; puntos: number | null; motivo: string }
export interface ResultadoSOFA {
  version: string
  total: number | null
  parcial: boolean
  faltantes: string[]
  subscores: SubscoreSOFA[]
  interpretacion: string
  pendienteValidacion: boolean
  fuente: string
}

function respiratorio(pafi: number | null, soporte?: boolean): SubscoreSOFA {
  if (pafi === null) return { sistema: 'Respiratorio', puntos: null, motivo: 'Falta PaO2/FiO2' }
  let p = 0
  if (pafi < 100 && soporte) p = 4
  else if (pafi < 200 && soporte) p = 3
  else if (pafi < 300) p = 2
  else if (pafi < 400) p = 1
  const nota = (pafi < 200 && !soporte) ? ' (con soporte respiratorio serían 3–4 pts; no se asume soporte)' : ''
  return { sistema: 'Respiratorio', puntos: p, motivo: `PaO2/FiO2 ${pafi}${nota}` }
}
function coagulacion(plq: number | null): SubscoreSOFA {
  if (plq === null) return { sistema: 'Coagulación', puntos: null, motivo: 'Faltan plaquetas' }
  const p = plq < 20 ? 4 : plq < 50 ? 3 : plq < 100 ? 2 : plq < 150 ? 1 : 0
  return { sistema: 'Coagulación', puntos: p, motivo: `Plaquetas ${plq} ×10³/µL` }
}
function higado(bili: number | null): SubscoreSOFA {
  if (bili === null) return { sistema: 'Hígado', puntos: null, motivo: 'Falta bilirrubina' }
  const p = bili >= 12 ? 4 : bili >= 6 ? 3 : bili >= 2 ? 2 : bili >= 1.2 ? 1 : 0
  return { sistema: 'Hígado', puntos: p, motivo: `Bilirrubina ${bili} mg/dL` }
}
function cardiovascular(e: EntradaSOFA): SubscoreSOFA {
  const pam = num(e.pam), dopa = num(e.dopamina), dobu = num(e.dobutamina), epi = num(e.epinefrina), nore = num(e.norepinefrina)
  // Sin ningún dato hemodinámico → no evaluable
  if (pam === null && dopa === null && dobu === null && epi === null && nore === null) {
    return { sistema: 'Cardiovascular', puntos: null, motivo: 'Faltan PAM y vasopresores' }
  }
  if ((dopa !== null && dopa > 15) || (epi !== null && epi > 0.1) || (nore !== null && nore > 0.1)) return { sistema: 'Cardiovascular', puntos: 4, motivo: 'Vasopresor a dosis alta' }
  if ((dopa !== null && dopa > 5) || (epi !== null && epi <= 0.1 && epi > 0) || (nore !== null && nore <= 0.1 && nore > 0)) return { sistema: 'Cardiovascular', puntos: 3, motivo: 'Vasopresor a dosis media' }
  if ((dopa !== null && dopa > 0 && dopa <= 5) || (dobu !== null && dobu > 0)) return { sistema: 'Cardiovascular', puntos: 2, motivo: 'Dopamina baja o dobutamina' }
  if (pam !== null && pam < 70) return { sistema: 'Cardiovascular', puntos: 1, motivo: `PAM ${pam} < 70` }
  return { sistema: 'Cardiovascular', puntos: 0, motivo: pam !== null ? `PAM ${pam} ≥ 70, sin vasopresor` : 'Sin vasopresor' }
}
function neurologico(gcs: number | null): SubscoreSOFA {
  if (gcs === null) return { sistema: 'Neurológico', puntos: null, motivo: 'Falta Glasgow' }
  const p = gcs < 6 ? 4 : gcs < 10 ? 3 : gcs < 13 ? 2 : gcs < 15 ? 1 : 0
  return { sistema: 'Neurológico', puntos: p, motivo: `Glasgow ${gcs}` }
}
function renal(creat: number | null, uresis: number | null): SubscoreSOFA {
  if (creat === null && uresis === null) return { sistema: 'Renal', puntos: null, motivo: 'Faltan creatinina y uresis' }
  let p = 0
  if ((creat !== null && creat >= 5) || (uresis !== null && uresis < 200)) p = 4
  else if ((creat !== null && creat >= 3.5) || (uresis !== null && uresis < 500)) p = 3
  else if (creat !== null && creat >= 2) p = 2
  else if (creat !== null && creat >= 1.2) p = 1
  return { sistema: 'Renal', puntos: p, motivo: creat !== null ? `Creatinina ${creat} mg/dL` : `Uresis ${uresis} mL/día` }
}

/** Calcula SOFA. Total = suma de subscores disponibles; `parcial` si falta alguno. */
export function calcularSOFA(e: EntradaSOFA): ResultadoSOFA {
  const subs = [
    respiratorio(num(e.pafi), e.soporteRespiratorio),
    coagulacion(num(e.plaquetas)),
    higado(num(e.bilirrubina)),
    cardiovascular(e),
    neurologico(num(e.glasgow)),
    renal(num(e.creatinina), num(e.uresis24h)),
  ]
  const faltantes = subs.filter(s => s.puntos === null).map(s => s.sistema)
  const disponibles = subs.filter(s => s.puntos !== null) as (SubscoreSOFA & { puntos: number })[]
  const total = disponibles.length ? disponibles.reduce((a, s) => a + s.puntos, 0) : null
  const parcial = faltantes.length > 0
  return {
    version: SCORES_UCI_VERSION,
    total, parcial, faltantes, subscores: subs,
    interpretacion: total === null
      ? 'No calculable: faltan todos los aparatos.'
      : `SOFA ${total}${parcial ? ` (PARCIAL — faltan: ${faltantes.join(', ')}; el total real puede ser mayor)` : ''}. Mayor SOFA = mayor disfunción orgánica.`,
    pendienteValidacion: SOFA_PENDIENTE_VALIDACION,
    fuente: 'Vincent JL et al. SOFA score. Intensive Care Med 1996 (definición estándar). PENDIENTE de validación del médico.',
  }
}
