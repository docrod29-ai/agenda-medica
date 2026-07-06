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
  conciencia?: 'alerta' | 'alterada'   // ACVPU: alerta=0, cualquier alteración=3
  oxigeno?: boolean    // recibe O2 suplementario → +2
}

export interface News2Param { param: string; valor: string; puntos: number }
export interface News2Result {
  total: number
  riesgo: 'bajo' | 'medio' | 'alto'
  color: string
  parcial: boolean
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
    add('SpO₂', `${v}%`, v >= 96 ? 0 : v >= 94 ? 1 : v >= 92 ? 2 : 3)
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
  if (s.conciencia === 'alterada') add('Conciencia', 'alterada', 3)

  if (!algunSigno) return null

  const riesgo: News2Result['riesgo'] = total >= 7 ? 'alto' : (total >= 5 || algun3) ? 'medio' : 'bajo'
  const recomendacion = riesgo === 'alto'
    ? 'Respuesta urgente: valoración médica inmediata y monitoreo continuo.'
    : algun3
      ? 'Parámetro individual en rojo: requiere revisión médica urgente.'
      : riesgo === 'medio'
        ? 'Revisión por médico y aumento de la frecuencia de monitoreo.'
        : 'Continuar monitoreo de rutina.'

  const parcial = s.conciencia === undefined || s.oxigeno === undefined
  return { total, riesgo, color: COLOR[riesgo], parcial, parametroRojo: algun3, detalle: det, recomendacion }
}
