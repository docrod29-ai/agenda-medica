// ══════════════════════════════════════════════════════════════
// NEWS2 — National Early Warning Score 2 (Royal College of Physicians, NHS).
// Detecta deterioro clínico a partir de los signos vitales. Estándar mundial
// de seguridad del paciente hospitalizado.
// NOTA: se calcula con los parámetros disponibles (FR, SpO2, T°, TA sistólica,
// FC). Asume "alerta" y "aire ambiente" si no se capturan → parcial=true.
// ══════════════════════════════════════════════════════════════

export interface SignosNews2 {
  fr?: number
  spo2?: number
  temp?: number
  ta?: string          // "120/80" → se usa la sistólica
  fc?: number
  // ACVPU completo o legado alerta/alterada. NEWS2: Alert (A/'alerta') = 0;
  // cualquier alteración (C/V/P/U/'alterada') = 3 (RCP). Ver esAlerta().
  conciencia?: 'A' | 'C' | 'V' | 'P' | 'U' | 'alerta' | 'alterada'
  oxigeno?: boolean    // recibe O2 suplementario → +2
  /**
   * Escala de SpO₂ (validado por el Dr, auditoría 2026-07):
   *  1 = por defecto.
   *  2 = SOLO para insuficiencia respiratoria hipercápnica con objetivo prescrito
   *      de 88–92%. NO se activa automáticamente por tener diagnóstico de EPOC;
   *      es una indicación clínica explícita.
   */
  escalaSpo2?: 1 | 2
}

/**
 * Puntos de SpO₂ en la Escala 2 (objetivo 88–92%). Tabla del Royal College,
 * validada por el Dr. En ≥93% el puntaje depende de si respira aire u O₂.
 */
export function puntosSpo2Escala2(spo2: number, conOxigeno: boolean): number {
  if (spo2 <= 83) return 3
  if (spo2 <= 85) return 2
  if (spo2 <= 87) return 1
  if (spo2 <= 92) return 0
  // ≥93%
  if (!conOxigeno) return 0            // ≥93% en aire ambiente
  if (spo2 <= 94) return 1
  if (spo2 <= 96) return 2
  return 3                              // ≥97% con O₂
}

export interface News2Param { param: string; valor: string; puntos: number }
export interface News2Result {
  total: number
  riesgo: 'bajo' | 'medio' | 'alto'
  color: string
  /** Falta al menos un parámetro del score: el total SUBESTIMA el riesgo. */
  parcial: boolean
  /** Cuáles faltan, para poder decirlo en pantalla. */
  faltantes: string[]
  parametroRojo: boolean   // algún parámetro individual = 3 (criterio de escalamiento NEWS2)
  detalle: News2Param[]
  recomendacion: string
}

const COLOR = { bajo: '#0d9488', medio: '#d97706', alto: '#dc2626' }

function sistolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const n = parseInt(String(ta).split('/')[0], 10)
  return isNaN(n) ? undefined : n
}

/** Calcula NEWS2. Devuelve null si no hay ningún signo válido. */
export function calcularNews2(s: SignosNews2): News2Result | null {
  const det: News2Param[] = []
  let total = 0
  let algun3 = false
  const add = (param: string, valor: string, puntos: number) => { det.push({ param, valor, puntos }); total += puntos; if (puntos === 3) algun3 = true }

  const sys = sistolica(s.ta)
  let algunSigno = false

  if (typeof s.fr === 'number') {
    algunSigno = true
    const v = s.fr
    add('FR', `${v}/min`, v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3)
  }
  if (typeof s.spo2 === 'number') {
    algunSigno = true
    const v = s.spo2
    const pts = s.escalaSpo2 === 2
      ? puntosSpo2Escala2(v, !!s.oxigeno)
      : (v >= 96 ? 0 : v >= 94 ? 1 : v >= 92 ? 2 : 3)   // Escala 1 (por defecto)
    add(`SpO₂${s.escalaSpo2 === 2 ? ' (escala 2)' : ''}`, `${v}%`, pts)
  }
  if (s.oxigeno) add('O₂ suplementario', 'sí', 2)
  if (typeof s.temp === 'number') {
    algunSigno = true
    const v = s.temp
    add('T°', `${v}°C`, v <= 35 ? 3 : v <= 36 ? 1 : v <= 38 ? 0 : v <= 39 ? 1 : 2)
  }
  if (typeof sys === 'number') {
    algunSigno = true
    add('TA sistólica', `${sys} mmHg`, sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3)
  }
  if (typeof s.fc === 'number') {
    algunSigno = true
    const v = s.fc
    add('FC', `${v}/min`, v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3)
  }
  // Conciencia (ACVPU): Alert = 0; cualquier otra (Confusion/Voice/Pain/Unresponsive
  // o el legado 'alterada') = 3. Se deriva de la letra real conservada.
  if (s.conciencia !== undefined && s.conciencia !== 'A' && s.conciencia !== 'alerta') {
    add('Conciencia', String(s.conciencia), 3)
  }

  if (!algunSigno) return null

  const riesgo: News2Result['riesgo'] = total >= 7 ? 'alto' : (total >= 5 || algun3) ? 'medio' : 'bajo'
  const recomendacion = riesgo === 'alto'
    ? 'Respuesta urgente: valoración médica inmediata y monitoreo continuo.'
    : algun3
      ? 'Parámetro individual en rojo: requiere revisión médica urgente.'
      : riesgo === 'medio'
        ? 'Revisión por médico y aumento de la frecuencia de monitoreo.'
        : 'Continuar monitoreo de rutina.'

  /**
   * `parcial` = FALTA ALGÚN PARÁMETRO DEL SCORE, no solo conciencia y oxígeno.
   *
   * Un parámetro ausente no suma puntos, así que un NEWS2 construido sobre 1 de 7
   * parámetros da un total BAJO y se presentaba con la misma autoridad visual que
   * uno completo: badge verde, "continuar monitoreo de rutina", ninguna alerta.
   *
   * El caso real: enfermería registra solo FC y conciencia —el formulario no exige
   * ningún campo— y el paciente puede estar en insuficiencia respiratoria sin FR
   * ni SpO₂. El score decía 0 y `parcial` decía false, porque solo miraba
   * conciencia y oxígeno.
   *
   * Es exactamente la subestimación del deterioro que el score existe para evitar.
   */
  const faltantes: string[] = []
  if (typeof s.fr !== 'number') faltantes.push('FR')
  if (typeof s.spo2 !== 'number') faltantes.push('SpO₂')
  if (typeof s.temp !== 'number') faltantes.push('T°')
  if (typeof sys !== 'number') faltantes.push('TA sistólica')
  if (typeof s.fc !== 'number') faltantes.push('FC')
  if (s.conciencia === undefined) faltantes.push('conciencia')
  if (s.oxigeno === undefined) faltantes.push('O₂ suplementario')

  const parcial = faltantes.length > 0
  const recomendacionFinal = parcial
    ? `${recomendacion} ⚠️ SCORE INCOMPLETO: falta ${faltantes.join(', ')}. Un parámetro ausente NO suma puntos, así que este total SUBESTIMA el riesgo — complétalo antes de decidir.`
    : recomendacion

  return { total, riesgo, color: COLOR[riesgo], parcial, faltantes, parametroRojo: algun3, detalle: det, recomendacion: recomendacionFinal }
}
