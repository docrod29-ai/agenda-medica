/**
 * QUÉ SE BORRA, QUÉ SE ANONIMIZA Y QUÉ SE CONSERVA AL SUPRIMIR (Panel de Lujo
 * ASE-015 · decisión PL-L5 aplicada por su recomendación por omisión).
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * La supresión ARCO borraba también las citas PASADAS del paciente y dejaba
 * los cobros con su nombre. Ni lo uno ni lo otro estaba decidido: la LFPDPPP
 * pide cancelar; la conservación fiscal pide guardar el cobro; la agenda
 * pasada es historia del consultorio, no del paciente.
 *
 * ── LA POLÍTICA (valor conservador, NEEDS_LEGAL_REVIEW) ──────────────────────
 *
 *   · cita FUTURA  → se borra: ya no va a ocurrir.
 *   · cita PASADA  → se conserva SIN nombre, teléfono, motivo ni notas.
 *   · cobro        → se conserva SIN nombre (importe, fecha, método y folio
 *                    son registro fiscal). El `patientId` se queda como
 *                    referencia opaca: el expediente ya no existe.
 *
 * El asesor fiscal-legal del consultorio puede cambiarla; aquí vive en un solo
 * sitio para que cambiarla sea cambiar una función, no una ruta.
 *
 * Módulo PURO: decide y arma parches; quien escribe es la ruta.
 */

export const NOMBRE_SUPRIMIDO = 'Paciente suprimido (ARCO)'

/** Marca que se deja en lo que se conserva anonimizado. */
export interface MarcaSupresion {
  arcoSuprimidaEn: string
  arcoSolicitudId: string
}

/** ¿La cita ya ocurrió? Se compara la FECHA de pared (`YYYY-MM-DD…`) con la de hoy. */
export function destinoDeCita(cita: { fechaHora?: string }, hoyIso: string): 'borrar' | 'anonimizar' {
  const fecha = String(cita.fechaHora ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'borrar'   // sin fecha legible no hay historia que conservar
  return fecha > hoyIso.slice(0, 10) ? 'borrar' : 'anonimizar'
}

/** Campos de la cita que identifican o describen al paciente: se vacían. */
export const CAMPOS_DE_CITA_QUE_SE_VACIAN = ['pacienteTelefono', 'motivo', 'notasInternas'] as const

export function citaAnonimizada(marca: MarcaSupresion): Record<string, unknown> {
  const out: Record<string, unknown> = { pacienteNombre: NOMBRE_SUPRIMIDO, ...marca }
  for (const c of CAMPOS_DE_CITA_QUE_SE_VACIAN) out[c] = ''
  return out
}

/** El cobro guarda el nombre como `patientNombre` (ver `Cobro` en cobros.ts). */
export function cobroAnonimizado(marca: MarcaSupresion): Record<string, unknown> {
  return { patientNombre: NOMBRE_SUPRIMIDO, ...marca }
}

export const POR_QUE_SE_CONSERVAN_LOS_COBROS =
  'Porque un cobro es registro fiscal del consultorio, no un dato del paciente: ' +
  'el importe, la fecha y el folio tienen que poder cuadrarse contra el corte y ' +
  'contra el SAT. Lo que sí es del paciente —su nombre— se quita.'
