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
  /** ISO date. `null` cuando no se pudo determinar. */
  ultimoActo: string | null
  /** `null` cuando no se pudo determinar. */
  diasDesdeUltimoActo: number | null
  /**
   * `no_evaluable` NO es un cuarto grado de antigüedad: es la ausencia de
   * veredicto. Significa que faltó un dato para calcularlo, no que el
   * expediente esté en algún punto intermedio.
   */
  estado: 'vigente' | 'cercano' | 'vencido' | 'no_evaluable'
  /** Total de notas firmadas que conserva. `null` cuando no se pudieron leer. */
  notasFirmadas: number | null
}

const DIAS_5_ANIOS = 5 * 365
const DIAS_ALERTA = 4 * 365 + 6 * 30  // 4 años 6 meses → cercano

/**
 * Evalúa el estado de retención de un paciente.
 * El "último acto" es la nota más reciente (firmada o no) o la última cita atendida.
 *
 * ── `notas: null` NO ES `notas: []` ─────────────────────────────────────────
 *
 * `[]` dice «este paciente no tiene notas». `null` dice «no se pudieron leer
 * sus notas». Son cosas distintas y este módulo las trata distinto, porque
 * confundirlas produce el peor resultado posible aquí: un expediente que
 * PARECE haber superado sus cinco años **porque falló una lectura**.
 *
 * La cuenta lo demuestra. Sin las notas, la fecha del último acto cae hasta
 * `ultimaCita` o `createdAt`; un paciente al que se le sigue escribiendo pero
 * cuyas citas no se registran aquí queda fechado en el día que se dio de alta,
 * y a los cinco años de eso sale marcado en rojo como **>5 años**. Al mismo
 * tiempo `notasFirmadas` valdría 0 y la pantalla dejaría de mostrar cuántas
 * notas conserva. O sea: la lectura que falló hace que el expediente parezca
 * a la vez viejo y vacío — justo las dos señales que invitan a archivarlo.
 *
 * Con `null` no se calcula nada: `estado: 'no_evaluable'`, y el veredicto se
 * queda sin emitir hasta que se pueda leer de verdad.
 */
export function evaluarRetencion(
  patient: Patient,
  notas: NotaMedica[] | null,
  ultimaCitaFecha?: string,
): PacienteRetencion {
  // Un motor que no puede calcular lo DICE; no estima. (Regla de seguridad
  // clínica 2, y la 4: ausencia de dato no es dato de ausencia.)
  if (notas === null) {
    return {
      patient,
      ultimoActo: null,
      diasDesdeUltimoActo: null,
      estado: 'no_evaluable',
      notasFirmadas: null,
    }
  }

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

/**
 * Solo pacientes que requieren atención del médico.
 *
 * Los `no_evaluable` van **primero**, y no por antigüedad —no la tienen— sino
 * porque son los únicos cuyo pendiente es del sistema y no del expediente: hasta
 * que se puedan leer, los totales de esta pantalla están incompletos y quien
 * los mira no tiene forma de saberlo. Esconderlos los convertiría en el hueco
 * silencioso de siempre.
 */
export function listarPacientesPorRevisar(evaluaciones: PacienteRetencion[]): PacienteRetencion[] {
  const noEvaluables = evaluaciones.filter(e => e.estado === 'no_evaluable')
  const resto = evaluaciones
    .filter(e => e.estado !== 'vigente' && e.estado !== 'no_evaluable')
    .sort((a, b) => (b.diasDesdeUltimoActo ?? 0) - (a.diasDesdeUltimoActo ?? 0))
  return [...noEvaluables, ...resto]
}

export const POR_QUE_NO_SE_ADIVINA_LA_ANTIGUEDAD =
  'Porque la lectura que falla hace que el expediente parezca a la vez viejo y ' +
  'vacío —fechado en su alta y con cero notas firmadas—, que son justo las dos ' +
  'señales que invitan a archivarlo. Un veredicto que sale de un hueco es peor ' +
  'que no tener veredicto: el segundo se ve, el primero no.'

/** Formato legible de "hace X años Y meses" */
export function formatearAntiguedad(dias: number): string {
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios > 0 && meses > 0) return `${anios} año${anios > 1 ? 's' : ''} ${meses} mes${meses > 1 ? 'es' : ''}`
  if (anios > 0) return `${anios} año${anios > 1 ? 's' : ''}`
  if (meses > 0) return `${meses} mes${meses > 1 ? 'es' : ''}`
  return `${dias} día${dias !== 1 ? 's' : ''}`
}
