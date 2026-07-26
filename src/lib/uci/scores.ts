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

export const SCORES_UCI_VERSION = '1.1.0'
// SOFA: umbrales publicados (Vincent 1996) CONFIRMADOS por el Dr (2026-07).
export const SOFA_PENDIENTE_VALIDACION = false

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
    fuente: 'Vincent JL et al. SOFA score. Intensive Care Med 1996 (definición estándar). Umbrales confirmados por el médico.',
  }
}

/* ───────────────────────────── RASS ─────────────────────────────
 * Richmond Agitation-Sedation Scale: es un nivel OBSERVADO (−5 a +4), no un
 * cálculo. Aquí solo se describe/valida y se marca la meta de sedación ligera. */
export const RASS_ESCALA: Record<number, string> = {
  4: 'Combativo', 3: 'Muy agitado', 2: 'Agitado', 1: 'Inquieto',
  0: 'Alerta y tranquilo',
  [-1]: 'Somnoliento', [-2]: 'Sedación ligera', [-3]: 'Sedación moderada',
  [-4]: 'Sedación profunda', [-5]: 'No despertable',
}
export function rassValido(nivel: number): boolean { return Number.isInteger(nivel) && nivel >= -5 && nivel <= 4 }
export function descripcionRASS(nivel: number): string { return RASS_ESCALA[nivel] ?? 'Fuera de escala' }
/** Meta de sedación ligera −2 a +1 (PADIS 2018). */
export function esSedacionLigera(nivel: number): boolean { return rassValido(nivel) && nivel >= -2 && nivel <= 1 }

/* ─────────────────────────── CAM-ICU ────────────────────────────
 * Delirium: positivo si Rasgo 1 (inicio agudo/fluctuante) Y Rasgo 2 (inatención)
 * Y (Rasgo 3 (conciencia alterada, RASS≠0) O Rasgo 4 (pensamiento desorganizado)). */
export interface EntradaCAMICU {
  inicioAgudoOFluctuante?: boolean
  inatencion?: boolean
  nivelConcienciaAlterado?: boolean   // RASS ≠ 0
  pensamientoDesorganizado?: boolean
}
export interface ResultadoCAMICU { positivo: boolean | null; evaluable: boolean; faltan: string[]; explicacion: string; fuente: string }
export function camIcu(e: EntradaCAMICU): ResultadoCAMICU {
  const faltan: string[] = []
  if (e.inicioAgudoOFluctuante === undefined) faltan.push('Rasgo 1 (inicio agudo/fluctuante)')
  if (e.inatencion === undefined) faltan.push('Rasgo 2 (inatención)')
  // Rasgos 3 y 4 solo se necesitan si 1 y 2 son positivos.
  const base = e.inicioAgudoOFluctuante === true && e.inatencion === true
  if (base && e.nivelConcienciaAlterado === undefined && e.pensamientoDesorganizado === undefined) {
    faltan.push('Rasgo 3 (conciencia) o Rasgo 4 (pensamiento)')
  }
  if (faltan.length && (e.inicioAgudoOFluctuante === undefined || e.inatencion === undefined || base)) {
    return { positivo: null, evaluable: false, faltan, explicacion: 'No evaluable: faltan rasgos.', fuente: 'Ely EW et al. CAM-ICU. JAMA 2001.' }
  }
  const positivo = base && (e.nivelConcienciaAlterado === true || e.pensamientoDesorganizado === true)
  return {
    positivo, evaluable: true, faltan: [],
    explicacion: positivo ? 'CAM-ICU POSITIVO: delirium presente' : 'CAM-ICU negativo',
    fuente: 'Ely EW et al. CAM-ICU. JAMA 2001.',
  }
}

/* ─────────────────────────── APACHE II ──────────────────────────
 * Acute Physiology And Chronic Health Evaluation II (Knaus 1985). Rango 0–71.
 * Suma de 12 variables fisiológicas (0–4 c/u, PEOR valor de 24 h) + puntos por
 * edad + puntos por salud crónica. Si falta una variable, es `parcial` (no 0). */
export interface EntradaAPACHE {
  temperatura?: number | string  // °C
  pam?: number | string          // mmHg
  fc?: number | string
  fr?: number | string
  // Oxigenación: si FiO2 ≥ 0.5 usar A-aDO2; si no, PaO2.
  fio2?: number | string         // decimal
  aado2?: number | string        // si FiO2 ≥ 0.5
  pao2?: number | string         // si FiO2 < 0.5
  ph?: number | string
  sodio?: number | string
  potasio?: number | string
  creatinina?: number | string   // mg/dL
  fallaRenalAguda?: boolean       // duplica los puntos de creatinina
  hematocrito?: number | string   // %
  leucocitos?: number | string    // ×10³/µL
  glasgow?: number | string       // 3–15
  edad?: number | string
  saludCronica?: 'ninguna' | 'no_operatorio_o_urgencia' | 'postop_electivo'
}

const rango = (v: number, tabla: [number, number, number][]): number | null => {
  // tabla: [min inclusive, max inclusive, puntos]; devuelve puntos del primer match
  for (const [lo, hi, p] of tabla) if (v >= lo && v <= hi) return p
  return null
}

export interface ResultadoAPACHE {
  version: string
  total: number | null
  parcial: boolean
  faltantes: string[]
  fisiologia: number | null
  edadPuntos: number | null
  cronicaPuntos: number
  fuente: string
}

export function calcularAPACHE2(e: EntradaAPACHE): ResultadoAPACHE {
  const faltantes: string[] = []
  const add = (nombre: string, valor: number | string | null | undefined, fn: (v: number) => number | null): number | null => {
    const v = num(valor)
    if (v === null) { faltantes.push(nombre); return null }
    const p = fn(v)
    if (p === null) { faltantes.push(`${nombre} (fuera de tabla)`); return null }
    return p
  }
  const puntos: (number | null)[] = []
  puntos.push(add('temperatura', e.temperatura, v => v >= 41 ? 4 : v >= 39 ? 3 : v >= 38.5 ? 1 : v >= 36 ? 0 : v >= 34 ? 1 : v >= 32 ? 2 : v >= 30 ? 3 : 4))
  puntos.push(add('PAM', e.pam, v => v >= 160 ? 4 : v >= 130 ? 3 : v >= 110 ? 2 : v >= 70 ? 0 : v >= 50 ? 2 : 4))
  puntos.push(add('FC', e.fc, v => v >= 180 ? 4 : v >= 140 ? 3 : v >= 110 ? 2 : v >= 70 ? 0 : v >= 55 ? 2 : v >= 40 ? 3 : 4))
  puntos.push(add('FR', e.fr, v => v >= 50 ? 4 : v >= 35 ? 3 : v >= 25 ? 1 : v >= 12 ? 0 : v >= 10 ? 1 : v >= 6 ? 2 : 4))
  // Oxigenación
  const fio2 = num(e.fio2)
  if (fio2 !== null && fio2 >= 0.5) {
    puntos.push(add('A-aDO2', e.aado2, v => rango(v, [[500, 9999, 4], [350, 499, 3], [200, 349, 2], [-9999, 199, 0]])))
  } else {
    puntos.push(add('PaO2', e.pao2, v => v > 70 ? 0 : v >= 61 ? 1 : v >= 55 ? 3 : 4))
  }
  puntos.push(add('pH', e.ph, v => v >= 7.7 ? 4 : v >= 7.6 ? 3 : v >= 7.5 ? 1 : v >= 7.33 ? 0 : v >= 7.25 ? 2 : v >= 7.15 ? 3 : 4))
  puntos.push(add('Na', e.sodio, v => v >= 180 ? 4 : v >= 160 ? 3 : v >= 155 ? 2 : v >= 150 ? 1 : v >= 130 ? 0 : v >= 120 ? 2 : v >= 111 ? 3 : 4))
  puntos.push(add('K', e.potasio, v => v >= 7 ? 4 : v >= 6 ? 3 : v >= 5.5 ? 1 : v >= 3.5 ? 0 : v >= 3 ? 1 : v >= 2.5 ? 2 : 4))
  const creatP = add('creatinina', e.creatinina, v => v >= 3.5 ? 4 : v >= 2 ? 3 : v >= 1.5 ? 2 : v >= 0.6 ? 0 : 2)
  puntos.push(creatP === null ? null : (e.fallaRenalAguda ? creatP * 2 : creatP))
  puntos.push(add('hematocrito', e.hematocrito, v => v >= 60 ? 4 : v >= 50 ? 2 : v >= 46 ? 1 : v >= 30 ? 0 : v >= 20 ? 2 : 4))
  puntos.push(add('leucocitos', e.leucocitos, v => v >= 40 ? 4 : v >= 20 ? 2 : v >= 15 ? 1 : v >= 3 ? 0 : v >= 1 ? 2 : 4))
  const gcs = num(e.glasgow)
  if (gcs === null) { faltantes.push('Glasgow'); puntos.push(null) } else puntos.push(15 - gcs)

  const edad = num(e.edad)
  const edadPuntos = edad === null ? (faltantes.push('edad'), null) : edad >= 75 ? 6 : edad >= 65 ? 5 : edad >= 55 ? 3 : edad >= 45 ? 2 : 0
  const cronicaPuntos = e.saludCronica === 'no_operatorio_o_urgencia' ? 5 : e.saludCronica === 'postop_electivo' ? 2 : 0

  const disp = puntos.filter((p): p is number => p !== null)
  const fisiologia = disp.length ? disp.reduce((a, b) => a + b, 0) : null
  const parcial = faltantes.length > 0
  const total = fisiologia === null || edadPuntos === null ? null : fisiologia + edadPuntos + cronicaPuntos
  return {
    version: SCORES_UCI_VERSION, total, parcial, faltantes, fisiologia, edadPuntos, cronicaPuntos,
    fuente: 'Knaus WA et al. APACHE II. Crit Care Med 1985 (definición estándar).',
  }
}
