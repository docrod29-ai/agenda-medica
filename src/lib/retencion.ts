/**
 * Política de retención NOM-004 numeral 5.7:
 * "El expediente clínico debe conservarse por un periodo mínimo de 5 años
 *  contados a partir de la fecha del último acto médico"
 *
 * Este módulo calcula qué pacientes están cerca de ese límite y permite
 * decidir qué hacer con su expediente:
 *  - Conservar (default, lo más seguro)
 *  - Archivar (mover a colección de solo-lectura)
 *  - Anonimizar (eliminar PII manteniendo estadísticas)
 *
 * No borra automáticamente NADA: el médico debe decidir conscientemente.
 */

import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

export interface PacienteRetencion {
  patient: Patient
  ultimoActo: string  // ISO date
  diasDesdeUltimoActo: number
  estado: 'vigente' | 'cercano' | 'vencido'
  /** Total de notas firmadas que conserva */
  notasFirmadas: number
}

const DIAS_5_ANIOS = 5 * 365
const DIAS_ALERTA = 4 * 365 + 6 * 30  // 4 años 6 meses → cercano

/**
 * Evalúa el estado de retención de un paciente.
 * El "último acto" es la nota más reciente (firmada o no) o la última cita atendida.
 */
export function evaluarRetencion(
  patient: Patient,
  notas: NotaMedica[],
  ultimaCitaFecha?: string,
): PacienteRetencion {
  // Buscar la fecha más reciente de cualquier "acto médico"
  const fechasNotas = notas.map(n => n.fechaConsulta).filter(Boolean)
  const todasFechas = [
    ...fechasNotas,
    ultimaCitaFecha,
    patient.ultimaCita,
    patient.createdAt,
  ].filter((f): f is string => !!f)

  if (todasFechas.length === 0) {
    return {
      patient,
      ultimoActo: patient.createdAt || new Date().toISOString(),
      diasDesdeUltimoActo: 0,
      estado: 'vigente',
      notasFirmadas: notas.filter(n => n.estado === 'firmada').length,
    }
  }

  const ultimoActo = todasFechas.reduce((m, f) => f > m ? f : m, '0')
  const dias = Math.floor((Date.now() - new Date(ultimoActo).getTime()) / (1000 * 60 * 60 * 24))

  let estado: PacienteRetencion['estado'] = 'vigente'
  if (dias >= DIAS_5_ANIOS) estado = 'vencido'
  else if (dias >= DIAS_ALERTA) estado = 'cercano'

  return {
    patient,
    ultimoActo,
    diasDesdeUltimoActo: dias,
    estado,
    notasFirmadas: notas.filter(n => n.estado === 'firmada').length,
  }
}

/** Solo pacientes que requieren atención del médico (cercanos o vencidos al límite) */
export function listarPacientesPorRevisar(evaluaciones: PacienteRetencion[]): PacienteRetencion[] {
  return evaluaciones
    .filter(e => e.estado !== 'vigente')
    .sort((a, b) => b.diasDesdeUltimoActo - a.diasDesdeUltimoActo)
}

/** Formato legible de "hace X años Y meses" */
export function formatearAntiguedad(dias: number): string {
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios > 0 && meses > 0) return `${anios} año${anios > 1 ? 's' : ''} ${meses} mes${meses > 1 ? 'es' : ''}`
  if (anios > 0) return `${anios} año${anios > 1 ? 's' : ''}`
  if (meses > 0) return `${meses} mes${meses > 1 ? 'es' : ''}`
  return `${dias} día${dias !== 1 ? 's' : ''}`
}
