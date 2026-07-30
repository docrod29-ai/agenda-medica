/**
 * ESTADOS DE CAMA — charter §2, los 7 estados.
 *
 * El tipo `EstadoCama` ya pasó de 4 a 7 en ICU-002. Este módulo es la otra
 * mitad: **qué significa cada estado para la capacidad** y **qué transiciones
 * tienen sentido**.
 *
 * ── EL DEFECTO QUE CIERRA ────────────────────────────────────────────────────
 *
 * `ESTADOS_CAMA_NO_DISPONIBLE` existía en los tipos y **no lo usaba nadie**. El
 * tablero contaba como ocupadas sólo las camas en `ocupada`, así que una cama en
 * **mantenimiento**, en **limpieza** o **bloqueada** se sumaba a «camas libres».
 * Un jefe de guardia que lee «4 libres» y sólo puede usar 1 toma decisiones de
 * ingreso sobre un número que no existe.
 *
 * ── POR QUÉ «DISPONIBLE» NO ES UN SÍ/NO ──────────────────────────────────────
 *
 * Dos estados no caben en el binario:
 *
 *  · **reservada** — la cama está libre y **no** se le puede meter a cualquiera:
 *    ese es justamente el flujo B del charter (reservar antes de que llegue el
 *    paciente). Contarla como libre anula la reserva.
 *  · **aislamiento** — puede recibir paciente, pero **sólo uno que requiera
 *    aislamiento**. Quién lo requiere es criterio médico, no de este módulo, así
 *    que la cama sale como `condicionada` y la decisión queda con quien la toma.
 *
 * ── LO QUE NO SE ASUME ───────────────────────────────────────────────────────
 *
 * Si una cama puede pasar de **ocupada a libre sin limpieza** es una política de
 * la unidad. El módulo no la impone ni la omite: se pasa como parámetro
 * obligatorio. Ver `FALTA_POLITICA_LIMPIEZA`.
 *
 * Módulo PURO.
 */

import type { EstadoCama } from '@/types/hospital'
import { ESTADOS_CAMA_NO_DISPONIBLE } from '@/types/hospital'

export type Disponibilidad =
  /** Puede recibir a cualquier paciente. */
  | 'disponible'
  /** Hay un paciente dentro. */
  | 'ocupada'
  /** Libre, pero apartada para alguien. NO cuenta como libre. */
  | 'reservada'
  /** Puede recibir, pero sólo a quien cumpla una condición clínica. */
  | 'condicionada'
  /** No puede recibir a nadie. */
  | 'no_disponible'

export interface EstadoDisponibilidad {
  disponibilidad: Disponibilidad
  /** Por qué. Siempre presente: un número de capacidad sin explicación no se audita. */
  motivo: string
}

/**
 * Qué significa el estado de la cama para la capacidad.
 *
 * @param hayOcupante si el censo dice que hay un paciente dentro. Manda sobre el
 *   estado guardado: el estado es una etiqueta, el ocupante es un hecho.
 */
export function disponibilidad(estado: EstadoCama, hayOcupante = false): EstadoDisponibilidad {
  if (hayOcupante) {
    return { disponibilidad: 'ocupada', motivo: 'Hay un internamiento activo en esta cama.' }
  }
  switch (estado) {
    case 'ocupada':
      return { disponibilidad: 'ocupada', motivo: 'Marcada como ocupada.' }
    case 'reservada':
      return {
        disponibilidad: 'reservada',
        motivo: 'Apartada para un ingreso previsto: no se le puede asignar otro paciente.',
      }
    case 'aislamiento':
      return {
        disponibilidad: 'condicionada',
        motivo: 'Designada para aislamiento: sólo puede recibir a quien lo requiera. ' +
          'Quién lo requiere es criterio médico.',
      }
    case 'limpieza':
      return { disponibilidad: 'no_disponible', motivo: 'En limpieza.' }
    case 'mantenimiento':
      return { disponibilidad: 'no_disponible', motivo: 'Fuera de servicio por mantenimiento.' }
    case 'bloqueada':
      return { disponibilidad: 'no_disponible', motivo: 'Bloqueada por decisión de la unidad.' }
    case 'libre':
      return { disponibilidad: 'disponible', motivo: 'Libre.' }
  }
}

/** ¿Se le puede asignar un paciente CUALQUIERA ahora mismo? */
export function puedeRecibir(estado: EstadoCama, hayOcupante = false): boolean {
  return disponibilidad(estado, hayOcupante).disponibilidad === 'disponible'
}

// ═══════════════════════════════════════════════════════════════════════
// Conteo — para que el tablero deje de mentir
// ═══════════════════════════════════════════════════════════════════════

export interface ConteoCamas {
  total: number
  ocupadas: number
  /** Libres de verdad: asignables ahora a cualquiera. */
  disponibles: number
  reservadas: number
  condicionadas: number
  noDisponibles: number
}

/**
 * Cuenta camas por disponibilidad real.
 *
 * `disponibles` NO incluye reservadas, condicionadas ni fuera de servicio: es el
 * número sobre el que se decide un ingreso, y tiene que ser el número que de
 * verdad se puede usar.
 */
export function contarCamas(
  camas: readonly { estado: EstadoCama; hayOcupante?: boolean }[],
): ConteoCamas {
  const c: ConteoCamas = {
    total: camas.length, ocupadas: 0, disponibles: 0,
    reservadas: 0, condicionadas: 0, noDisponibles: 0,
  }
  for (const cama of camas) {
    switch (disponibilidad(cama.estado, cama.hayOcupante ?? false).disponibilidad) {
      case 'ocupada': c.ocupadas++; break
      case 'disponible': c.disponibles++; break
      case 'reservada': c.reservadas++; break
      case 'condicionada': c.condicionadas++; break
      case 'no_disponible': c.noDisponibles++; break
    }
  }
  return c
}

// ═══════════════════════════════════════════════════════════════════════
// Transiciones
// ═══════════════════════════════════════════════════════════════════════

/**
 * Transiciones con sentido estructural. No es una política clínica: es qué
 * cambios de estado describen algo que pasa en la realidad.
 *
 * `ocupada → libre` está aquí pero **sujeta a política** (ver `transicionar`).
 */
export const TRANSICIONES: Record<EstadoCama, readonly EstadoCama[]> = {
  libre: ['ocupada', 'reservada', 'limpieza', 'bloqueada', 'mantenimiento', 'aislamiento'],
  ocupada: ['limpieza', 'libre'],
  reservada: ['ocupada', 'libre', 'bloqueada'],
  limpieza: ['libre', 'mantenimiento', 'bloqueada'],
  bloqueada: ['libre', 'mantenimiento', 'limpieza'],
  mantenimiento: ['libre', 'bloqueada', 'limpieza'],
  aislamiento: ['ocupada', 'limpieza', 'libre'],
}

export const FALTA_POLITICA_LIMPIEZA =
  'NEEDS_CLINICAL_REVIEW: si una cama puede pasar de OCUPADA a LIBRE sin pasar ' +
  'por limpieza es una política de la unidad (control de infecciones y logística ' +
  'de hotelería). El módulo no la inventa: se pasa como parámetro.'

export interface ResultadoTransicion {
  permitida: boolean
  motivo: string
}

/**
 * ¿Se puede pasar de un estado a otro?
 *
 * @param exigeLimpiezaEntrePacientes política de la unidad. **Obligatoria** —
 *   ver `FALTA_POLITICA_LIMPIEZA`.
 */
export function transicionar(
  desde: EstadoCama,
  hacia: EstadoCama,
  exigeLimpiezaEntrePacientes: boolean,
): ResultadoTransicion {
  if (desde === hacia) return { permitida: true, motivo: 'Sin cambio.' }

  if (desde === 'ocupada' && hacia === 'libre' && exigeLimpiezaEntrePacientes) {
    return {
      permitida: false,
      motivo: 'La política de la unidad exige pasar por limpieza antes de liberar una ' +
        'cama que estuvo ocupada.',
    }
  }

  if (!TRANSICIONES[desde].includes(hacia)) {
    return {
      permitida: false,
      motivo: `No hay paso de «${desde}» a «${hacia}».`,
    }
  }
  return { permitida: true, motivo: `De «${desde}» a «${hacia}».` }
}

/** Estados a los que se puede pasar desde uno dado, con la política aplicada. */
export function siguientes(desde: EstadoCama, exigeLimpiezaEntrePacientes: boolean): EstadoCama[] {
  return TRANSICIONES[desde].filter(
    h => transicionar(desde, h, exigeLimpiezaEntrePacientes).permitida)
}

/**
 * Comprobación de coherencia con el tipo: los estados que este módulo declara
 * `no_disponible` son exactamente los de `ESTADOS_CAMA_NO_DISPONIBLE`, salvo
 * `ocupada`, que allí se lista y aquí tiene bucket propio.
 *
 * Se exporta para que un caso del golden la ejecute: si alguien añade un estado
 * a un lado y no al otro, la capacidad y el tipo empiezan a discrepar.
 */
export function coherenteConElTipo(): boolean {
  const declarados = new Set(ESTADOS_CAMA_NO_DISPONIBLE)
  for (const e of Object.keys(TRANSICIONES) as EstadoCama[]) {
    const d = disponibilidad(e).disponibilidad
    const esperado = d === 'no_disponible' || d === 'ocupada'
    if (declarados.has(e) !== esperado) return false
  }
  return true
}
