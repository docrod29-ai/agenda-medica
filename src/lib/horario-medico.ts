/**
 * QUÉ HORARIO MANDA CUANDO HAY VARIOS MÉDICOS.
 *
 * ── EL FÓSIL ─────────────────────────────────────────────────────────────────
 *
 * Al dar de alta a un médico se guardaba una COPIA del horario del consultorio
 * dentro de `doctors/{id}`: horario, duraciones, intervalo y zona horaria. La
 * intención era buena —cada médico atiende distinto— pero el editor por médico
 * nunca se construyó, así que esa copia no se volvió a escribir jamás: los
 * únicos `updateDoctor` del producto tocan `botConfig` y `activo`.
 *
 * Y los cuatro caminos que agendan la preferían: `doctor.horario ?? clinica`.
 * Resultado: el consultorio cambiaba su horario en Configuración, la pantalla
 * confirmaba «guardado», y la agenda seguía usando el horario del día en que se
 * dio de alta al médico. Es la peor forma de fallar —silenciosa y creíble— y se
 * llevó por delante todo cambio de horario desde entonces, incluidos los
 * descansos del horario partido.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **Una copia que el producto no puede editar no es una preferencia: es un
 * fósil.** Manda el horario del consultorio, que es el único que alguien puede
 * mantener, salvo que el médico esté marcado explícitamente como que lleva
 * horario propio (`horarioPropio`).
 *
 * Ese interruptor existe para que el día que se construya el editor por médico
 * baste con encenderlo, sin volver a tocar los cuatro llamadores. Hoy nadie lo
 * escribe, así que todos caen al horario del consultorio — que es justo lo que
 * el médico ve en su pantalla de Configuración.
 *
 * Módulo PURO.
 */
import type { ClinicConfig } from '@/types'

/** Lo que hace falta saber de un médico para resolver su agenda. */
export interface HorarioDeMedico {
  horarioPropio?: boolean
  horario?: ClinicConfig['horario']
  duraciones?: ClinicConfig['duraciones']
  intervaloMinutos?: number
  zonaHoraria?: string
}

/**
 * La configuración de agenda que aplica a este médico.
 *
 * Sin médico —o sin horario propio declarado— devuelve la del consultorio TAL
 * CUAL, sin clonar: así el llamador no puede confundir «no hay nada que
 * cambiar» con «hay una copia distinta».
 */
export function configParaMedico<T extends ClinicConfig>(
  clinica: T,
  medico?: HorarioDeMedico | null,
): T {
  if (!medico?.horarioPropio) return clinica
  return {
    ...clinica,
    horario: medico.horario ?? clinica.horario,
    duraciones: medico.duraciones ?? clinica.duraciones,
    intervaloMinutos: medico.intervaloMinutos ?? clinica.intervaloMinutos,
    zonaHoraria: medico.zonaHoraria ?? clinica.zonaHoraria,
  }
}

export const POR_QUE_MANDA_EL_CONSULTORIO =
  'Porque una copia que el producto no puede editar no es una preferencia: es ' +
  'un fósil. El horario del médico se copiaba al darlo de alta y no se volvía a ' +
  'escribir nunca, así que cada cambio en Configuración decía «guardado» y no ' +
  'llegaba a la agenda. Manda el horario que alguien puede mantener.'
