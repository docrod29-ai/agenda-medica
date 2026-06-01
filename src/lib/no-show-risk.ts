/**
 * Predicción de riesgo de no-show por cita.
 *
 * Heurística basada en señales clínicamente conocidas (Dantas 2018, Norris 2014):
 *  - Historia de no-shows previos del paciente (señal más fuerte)
 *  - Cancelaciones recientes
 *  - Tiempo entre agendamiento y cita (lead time)
 *  - Tipo de cita (primera-vez tiene mayor no-show)
 *  - Día y hora (lunes mañana > martes tarde)
 *  - Confirmación recibida (reduce mucho el riesgo)
 *
 * Devuelve score 0-100 (0 = muy bajo riesgo, 100 = altísimo).
 * No es un modelo entrenado: es una heurística transparente, auditable y útil.
 * Se puede reemplazar por un modelo ML en el futuro sin cambiar la API.
 */
import type { Appointment, Patient } from '@/types'

export interface NoShowRisk {
  score: number              // 0-100
  nivel: 'bajo' | 'medio' | 'alto' | 'muy_alto'
  razones: string[]          // explicabilidad
  recomendacion: string
}

export function calcularRiesgoNoShow(
  cita: Appointment,
  paciente: Patient | null,
): NoShowRisk {
  let s = 5  // baseline
  const r: string[] = []

  // 1. Historia del paciente (señal más fuerte)
  if (paciente) {
    const ratio = paciente.noShowCount /
      Math.max(1, paciente.noShowCount + paciente.cancelacionCount + 3)
    if (paciente.noShowCount >= 3) {
      s += 35; r.push(`Historial: ${paciente.noShowCount} no-shows previos`)
    } else if (paciente.noShowCount >= 1) {
      s += 18; r.push(`Historial: ${paciente.noShowCount} no-show previo`)
    }
    if (paciente.cancelacionCount >= 3) {
      s += 12; r.push(`${paciente.cancelacionCount} cancelaciones previas`)
    } else if (paciente.cancelacionCount >= 1) {
      s += 6; r.push(`${paciente.cancelacionCount} cancelación previa`)
    }
    if (ratio > 0.4) { s += 8; r.push('Patrón consistente de inasistencia') }
  }

  // 2. Confirmación
  if (!cita.confirmadoPaciente && !['confirmada', 'recordatorio-enviado', 'en-sala', 'en-consulta', 'atendida', 'finalizada', 'pagada'].includes(cita.estado)) {
    s += 12; r.push('Sin confirmación del paciente')
  } else if (cita.confirmadoPaciente) {
    s -= 10; r.push('Confirmación recibida (–)')
  }

  // 3. Tiempo desde agendamiento (lead time)
  if (cita.createdAt) {
    const fechaCita = new Date(cita.fechaHora.replace(' ', 'T')).getTime()
    const fechaCreacion = new Date(cita.createdAt).getTime()
    const leadDays = (fechaCita - fechaCreacion) / 86400_000
    if (leadDays > 30) { s += 12; r.push(`Lead time largo (${Math.round(leadDays)} días)`) }
    else if (leadDays > 14) { s += 6; r.push(`Lead time medio (${Math.round(leadDays)} días)`) }
    else if (leadDays < 1) { s -= 4; r.push('Agendada hoy/mañana (–)') }
  }

  // 4. Tipo de cita
  if (cita.tipo === 'primera-vez') { s += 8; r.push('Primera vez (mayor riesgo)') }
  if (cita.tipo === 'seguimiento') { s -= 3 }

  // 5. Día / hora
  const dt = new Date(cita.fechaHora.replace(' ', 'T'))
  const dow = dt.getDay()                  // 0=dom, 1=lun
  const hour = dt.getHours()
  if (dow === 1 && hour < 11) { s += 5; r.push('Lunes por la mañana') }
  if (dow === 6) { s += 4; r.push('Sábado') }
  if (hour >= 18) { s += 3; r.push('Horario nocturno') }

  // 6. Recordatorio enviado
  if (cita.recordatorio24hEnviado) {
    s -= 7; r.push('Recordatorio enviado (–)')
  }

  // Acotar 0-100
  s = Math.max(0, Math.min(100, Math.round(s)))

  const nivel: NoShowRisk['nivel'] =
    s >= 70 ? 'muy_alto' : s >= 50 ? 'alto' : s >= 25 ? 'medio' : 'bajo'

  const recomendacion =
    nivel === 'muy_alto' ? 'Doble confirmación 48 h y 2 h antes. Considerar llamada directa.' :
    nivel === 'alto'     ? 'Activar doble confirmación 24 h y 2 h antes.' :
    nivel === 'medio'    ? 'Recordatorio estándar 24 h antes es suficiente.' :
                           'Riesgo bajo. Recordatorio simple basta.'

  return { score: s, nivel, razones: r, recomendacion }
}

export const NIVEL_LABEL: Record<NoShowRisk['nivel'], string> = {
  bajo: 'Bajo', medio: 'Medio', alto: 'Alto', muy_alto: 'Muy alto',
}
export const NIVEL_COLOR: Record<NoShowRisk['nivel'], string> = {
  bajo: '#4ade80', medio: '#fbbf24', alto: '#fb923c', muy_alto: '#ef4444',
}
