/**
 * LO QUE EL PACIENTE LLEVA PUESTO.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La valoración del inmunocomprometido captura **dispositivos invasivos** —CVC,
 * PICC, port-a-cath, sonda urinaria, ostomía, prótesis articular, prótesis
 * valvular, marcapaso/DAI, derivación ventricular, tubo, drenaje— y los guarda
 * en el expediente (`patient.txValoracion`, con la clave `hc_cb_disp_<x>`).
 *
 * Medido sobre el árbol: el **único** lector de ese grupo es `compose.ts`, que
 * arma el texto de esa misma valoración. Fuera de su pestaña, **nadie sabe que
 * el paciente lleva una prótesis valvular**.
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────
 *
 * Son los antecedentes que más cambian conducta sin aparecer en ningún
 * diagnóstico: una prótesis valvular o articular cambia la profilaxis y la
 * sospecha ante una bacteriemia; un marcapaso/DAI cambia qué estudio de imagen
 * se puede pedir; un catéter central cambia dónde se busca el foco.
 *
 * El médico los capturó una vez, están escritos en el expediente, y en la
 * consulta siguiente tiene que acordarse de abrir una pestaña para verlos.
 *
 * ── LA REGLA: SÓLO SE AFIRMA LO MARCADO ──────────────────────────────────────
 *
 * Un dispositivo **no marcado no es un dispositivo negado**: puede que nadie
 * abriera la valoración. Este módulo devuelve **lo que está marcado y nada
 * más**, y con la lista vacía no dice «sin dispositivos»: no dice nada. Regla 4
 * de seguridad clínica.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No alimenta ningún motor.** No hay reglas clínicas sobre dispositivos en
 * este producto —ni de profilaxis, ni de imagen, ni de foco infeccioso— y
 * escribirlas aquí sería inventar criterio clínico. Lo que hace es que el dato
 * que el médico ya capturó **esté delante cuando decide**.
 *
 * **No los mueve de sitio.** `txValoracion` es uno de los campos que E0-06 tiene
 * pendientes de mudar fuera de `Patient`; leerlos no adelanta ni cambia esa
 * migración, que sigue bloqueada por su acción externa.
 *
 * Módulo PURO.
 */
import { TX_CHIPS } from '@/lib/inmuno/catalogos'

/** El prefijo con el que la valoración guarda cada casilla marcada. */
const PREFIJO = 'hc_cb_disp_'

/** Lo que la valoración escribe cuando la casilla está marcada. */
const MARCADO = '1'

export interface DispositivoDelPaciente {
  /** La clave del catálogo (`protval`, `marcapaso`…). */
  clave: string
  /** Cómo se llama, tal como lo nombra el catálogo. No se traduce ni se abrevia. */
  etiqueta: string
}

export interface LoQueLleva {
  dispositivos: DispositivoDelPaciente[]
  /**
   * Cuándo se registró la valoración de la que sale esto.
   *
   * Va siempre que exista: un catéter central puesto hace dos años puede haberse
   * retirado, y quien lo lee tiene que poder ver de cuándo es el dato. Es la
   * misma procedencia que REG-368 le puso a los laboratorios.
   */
  registradoEn?: string
}

/**
 * Los dispositivos invasivos MARCADOS en la valoración del paciente.
 *
 * @param paciente El paciente tal como está guardado.
 */
export function dispositivosQueTrae(
  paciente: { txValoracion?: Record<string, string>; txValoracionAt?: string } | null | undefined,
): LoQueLleva {
  const v = paciente?.txValoracion
  if (!v) return { dispositivos: [] }

  const catalogo = TX_CHIPS.disp?.items ?? {}
  const dispositivos: DispositivoDelPaciente[] = []

  /* Se recorre el CATÁLOGO y no las llaves guardadas: así una llave suelta o
     renombrada en la base no se convierte en un dispositivo con nombre de clave
     técnica delante del médico. Y el orden es el del catálogo, estable. */
  for (const [clave, etiqueta] of Object.entries(catalogo)) {
    if (v[PREFIJO + clave] !== MARCADO) continue
    dispositivos.push({ clave, etiqueta })
  }

  return {
    dispositivos,
    ...(paciente?.txValoracionAt ? { registradoEn: paciente.txValoracionAt } : {}),
  }
}

/**
 * Cómo se dice en una línea. Vacío cuando no hay ninguno marcado.
 *
 * Nunca «sin dispositivos invasivos»: que no haya ninguno marcado no significa
 * que el paciente no lleve ninguno — significa que nadie marcó ninguno.
 */
export function comoSeDicenLosDispositivos(lo: LoQueLleva): string {
  if (!lo.dispositivos.length) return ''
  return lo.dispositivos.map(d => d.etiqueta).join(' · ')
}

export const POR_QUE_EL_VACIO_NO_DICE_NADA =
  'Porque un dispositivo no marcado no es un dispositivo negado: puede que nadie ' +
  'abriera la valoración. Escribir «sin dispositivos invasivos» a partir de una ' +
  'lista vacía convertiría la ausencia de dato en dato de ausencia, que es la ' +
  'regla 4 de seguridad clínica.'

export const POR_QUE_NO_ALIMENTA_UN_MOTOR =
  'Porque en este producto no hay reglas clínicas sobre dispositivos —ni de ' +
  'profilaxis, ni de imagen, ni de foco infeccioso— y escribirlas aquí sería ' +
  'inventar criterio clínico. Lo que hace falta es que el dato que el médico ya ' +
  'capturó esté delante cuando decide.'
