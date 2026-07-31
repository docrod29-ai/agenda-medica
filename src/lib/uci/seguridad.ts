import { num } from './num'

/**
 * num para ALERTAS de extremo (auditoría P1): un valor censurado ">500", "<50",
 * "≥6.5" daba num=null → CERO alerta justo en el valor crítico. Para estas alertas
 * de umbral, el número pelado es correcto porque el censurado es aún MÁS extremo en
 * la dirección del corte (">500" ≥ 500 > 250; "<50" ≤ 50 < 70). Solo aquí, no global.
 */
const numA = (v: unknown): number | null =>
  num(typeof v === 'string' ? v.replace(/^\s*[<>≤≥=]+\s*/, '') : v)
/**
 * MOTOR DE SEGURIDAD DE UCI — alertas jerarquizadas (iteración nexusmed-icu-012).
 *
 * Reglas DETERMINISTAS ancladas a guías reales (ver evidencia.ts). Cada alerta
 * lleva su `fuenteId`. Jerarquía: crítica > alta > moderada > informativa. No se
 * satura con alertas de baja relevancia. Es APOYO: el médico decide.
 *
 * Fuentes: ESICM 2025 (PAM), AHA-CICU 2020 / ARDSNet (Pplat, driving pressure,
 * glucosa), McClave/ASPEN 2016 (glucosa, GRV), PADIS 2018 + AHA-CICU 2020
 * (tabla de movilización), Nates 2016 (pH < 7.20).
 */

export const SEGURIDAD_UCI_VERSION = '1.1.0'  // icu-011: usa RASS (antes lo recibía y lo ignoraba)

export type NivelAlerta = 'critica' | 'alta' | 'moderada' | 'informativa'

export interface AlertaUCI {
  nivel: NivelAlerta
  parametro: string
  mensaje: string
  fuenteId?: string   // enlaza a FUENTES en evidencia.ts
}


export interface EstadoUCI {
  fc?: number | string
  pas?: number | string
  pad?: number | string
  pam?: number | string
  fr?: number | string
  spo2?: number | string
  fio2?: number | string        // decimal 0.21–1.0
  peep?: number | string
  pplat?: number | string
  drivingPressure?: number | string
  vtPorPbw?: number | string
  glucosa?: number | string     // mg/dL
  potasio?: number | string     // mmol/L
  sodio?: number | string       // mmol/L actual
  sodioPrevio?: number | string // para el ritmo de cambio (mismo periodo ~24 h)
  ph?: number | string
  lactato?: number | string
  residuoGastrico?: number | string // mL
  dosisSinUnidad?: boolean       // se dictó una dosis sin unidad
  vasopresorSinConcentracion?: boolean
  rass?: number | string         // opcional
}

const ordenNivel: Record<NivelAlerta, number> = { critica: 0, alta: 1, moderada: 2, informativa: 3 }

/** Analiza el estado y devuelve alertas ORDENADAS por severidad. */
export function analizarSeguridadUCI(e: EstadoUCI): AlertaUCI[] {
  const a: AlertaUCI[] = []
  const push = (nivel: NivelAlerta, parametro: string, mensaje: string, fuenteId?: string) => a.push({ nivel, parametro, mensaje, fuenteId })

  // Seguridad de la prescripción (regla del contrato: no asumir)
  if (e.dosisSinUnidad) push('alta', 'dosis', 'Dosis dictada SIN unidad: confirmar antes de registrar (no se asume).')
  if (e.vasopresorSinConcentracion) push('alta', 'vasopresor', 'Vasopresor sin concentración conocida: no se puede verificar la dosis.')

  // Ácido-base
  const ph = numA(e.ph)
  if (ph !== null) {
    if (ph < 7.20) push('critica', 'pH', `Acidemia severa (pH ${ph}): asociada a alta mortalidad; considerar UCI/manejo urgente.`, 'esicm2025')
    else if (ph < 7.30) push('moderada', 'pH', `Acidemia (pH ${ph}): vigilar causa y compensación.`)
    else if (ph > 7.55) push('alta', 'pH', `Alcalemia severa (pH ${ph}).`)
  }

  // Glucemia (McClave 2016)
  const glu = numA(e.glucosa)
  if (glu !== null) {
    if (glu < 70) push('critica', 'glucosa', `Hipoglucemia (${glu} mg/dL): tratar de inmediato.`, 'mcclave2016')
    else if (glu > 250) push('alta', 'glucosa', `Hiperglucemia grave (${glu} mg/dL).`, 'mcclave2016')
    else if (glu > 180) push('moderada', 'glucosa', `Glucosa ${glu}: por encima de la meta (140–180 mg/dL); iniciar/ajustar insulina.`, 'mcclave2016')
  }

  // Potasio (valores críticos estándar)
  const k = numA(e.potasio)
  if (k !== null) {
    if (k >= 6.5 || k < 2.5) push('critica', 'potasio', `Potasio crítico (${k} mmol/L): riesgo de arritmia; ECG y corrección.`)
    else if (k >= 6.0 || k < 3.0) push('alta', 'potasio', `Potasio ${k} mmol/L fuera de rango: corregir.`)
  }

  // Sodio: umbral ABSOLUTO (hipo/hipernatremia grave) — antes solo se evaluaba el
  // ritmo de cambio, así que un Na de 168 o 112 no generaba ninguna alerta.
  const na = numA(e.sodio), naPrev = numA(e.sodioPrevio)
  if (na !== null) {
    if (na >= 160 || na <= 120) push('critica', 'sodio', `Sodio ${na} mmol/L en rango crítico: riesgo neurológico; corregir vigilando el ritmo (evitar desmielinización osmótica).`)
    else if (na >= 150 || na < 130) push('moderada', 'sodio', `Sodio ${na} mmol/L fuera de rango (135–145): vigilar.`)
  }
  // Ritmo de cambio del sodio (riesgo de desmielinización osmótica)
  if (na !== null && naPrev !== null) {
    const delta = Math.abs(na - naPrev)
    if (delta > 10) push('alta', 'sodio', `Cambio de sodio ${delta} mmol/L (>10): riesgo de corrección demasiado rápida.`)
    else if (delta > 8) push('moderada', 'sodio', `Cambio de sodio ${delta} mmol/L: vigilar el ritmo de corrección.`)
  }

  // Hemodinamia (ESICM 2025)
  const pam = numA(e.pam)
  if (pam !== null && pam < 65) push('alta', 'PAM', `PAM ${pam} mmHg por debajo de la meta habitual (≥ 65).`, 'esicm2025')
  const lactato = numA(e.lactato)
  if (lactato !== null && lactato > 4) push('alta', 'lactato', `Lactato ${lactato} mmol/L: hipoperfusión marcada.`, 'esicm2025')
  else if (lactato !== null && lactato > 2) push('moderada', 'lactato', `Lactato ${lactato} mmol/L (> 2): signo de hipoperfusión.`, 'esicm2025')

  // Ventilación (AHA-CICU 2020 / ARDSNet)
  const pplat = numA(e.pplat)
  if (pplat !== null && pplat > 30) push('alta', 'Pplateau', `Pplateau ${pplat} cmH2O > 30: mayor riesgo de lesión pulmonar.`, 'ahaCicu2020')
  const dp = numA(e.drivingPressure)
  if (dp !== null && dp > 15) push('alta', 'driving pressure', `Driving pressure ${dp} cmH2O > 15: por encima de la meta protectora.`, 'ahaCicu2020')
  const vtpbw = numA(e.vtPorPbw)
  if (vtpbw !== null && vtpbw > 8) push('moderada', 'VT/PBW', `VT ${vtpbw} mL/kg PBW > 8: revisar protección pulmonar.`, 'ahaCicu2020')
  const spo2 = numA(e.spo2)
  if (spo2 !== null && spo2 < 88) push('alta', 'SpO2', `SpO2 ${spo2}% < 88: hipoxemia.`, 'ahaCicu2020')
  const fio2 = numA(e.fio2)
  if (fio2 !== null && fio2 >= 0.6) push('moderada', 'FiO2', `FiO2 ${fio2}: alta; vigilar toxicidad si se prolonga.`, 'ahaCicu2020')

  // Nutrición (McClave 2016)
  const grv = numA(e.residuoGastrico)
  if (grv !== null && grv >= 500) push('moderada', 'residuo gástrico', `Residuo gástrico ${grv} mL ≥ 500: valorar intolerancia antes de continuar NE.`, 'mcclave2016')

  // Sedación (RASS, PADIS 2018) — antes se RECIBÍA y se IGNORABA. La agitación
  // pone al paciente en riesgo de auto-retiro de dispositivos; la sedación profunda
  // se asocia a más días de ventilación y delirium (meta ligera 0 a −2 salvo indicación).
  const rass = numA(e.rass)
  if (rass !== null) {
    if (rass >= 2) push('alta', 'RASS', `RASS +${rass}: agitación; riesgo de auto-retiro de dispositivos. Descartar dolor, delirium, hipoxia o abstinencia.`, 'padis2018')
    else if (rass <= -4) push('moderada', 'RASS', `RASS ${rass}: sedación profunda; PADIS recomienda meta ligera (0 a −2) salvo indicación (HTIC, SDRA grave, estatus).`, 'padis2018')
  }

  return a.sort((x, y) => ordenNivel[x.nivel] - ordenNivel[y.nivel])
}

/**
 * ¿El paciente cumple los criterios de seguridad para INICIAR movilización?
 * Tabla PADIS 2018 + AHA-CICU 2020. Devuelve los criterios que NO se cumplen.
 */
export interface AptoMovilizacion {
  apto: boolean
  faltan: string[]
  fuenteId: string
}
export function aptoMovilizacion(e: EstadoUCI): AptoMovilizacion {
  const faltan: string[] = []
  const fc = numA(e.fc), pas = numA(e.pas), pam = numA(e.pam), fr = numA(e.fr), spo2 = numA(e.spo2), fio2 = numA(e.fio2), peep = numA(e.peep), rass = numA(e.rass)
  if (fc === null || fc < 60 || fc > 130) faltan.push('FC 60–130 lpm')
  if (pas === null || pas < 90 || pas > 180) faltan.push('PAS 90–180 mmHg')
  if (pam === null || pam < 60 || pam > 100) faltan.push('PAM 60–100 mmHg')
  if (fr === null || fr < 5 || fr > 40) faltan.push('FR 5–40 rpm')
  if (spo2 === null || spo2 < 88) faltan.push('SpO2 ≥ 88%')
  if (fio2 === null || fio2 >= 0.6) faltan.push('FiO2 < 0.6')
  if (peep === null || peep >= 10) faltan.push('PEEP < 10 cmH2O')
  // Conciencia (Hodgson 2014 / PADIS): un paciente con RASS documentado fuera de
  // −2 a +1 (sedación profunda o agitación) NO es candidato a movilización ACTIVA.
  // Si no hay RASS (paciente despierto sin sedación), no se bloquea por este criterio.
  if (rass !== null && (rass < -2 || rass > 1)) faltan.push('RASS −2 a +1 (consciente y colaborador)')
  return { apto: faltan.length === 0, faltan, fuenteId: 'padis2018' }
}
