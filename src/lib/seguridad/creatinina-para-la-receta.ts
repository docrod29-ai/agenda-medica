/**
 * LA CREATININA CON LA QUE LA RECETA AJUSTA — Y DE DÓNDE SALE. REG-527.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * La consulta ya ve los laboratorios del expediente (REG-368) y decide si la
 * creatinina sigue sirviendo para dosificar con la política del dueño
 * (REG-375). La pantalla de RECETA —donde se imprime lo que se dispensa— no:
 * su campo «Creatinina (mg/dL)» nacía vacío y nada lo precargaba. La
 * creatinina 2.4 del panel del mes pasado no llegaba al ajuste renal en la
 * superficie que más importa.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Decide con qué creatinina se ajusta, en este orden:
 *
 *   1. la que el médico TECLEA hoy — está mirando un resultado nuevo;
 *   2. la más reciente del EXPEDIENTE, **con su fecha y su vigencia** según
 *      la política de REG-375. Fuera de ventana se marca `STALE_RENAL_FUNCTION`
 *      y se sigue calculando: la política dice «pide una actual», no «apaga
 *      el ajuste»;
 *   3. ninguna.
 *
 * Y lo DICE: quien pinta la receta tiene que poder escribir «creatinina 2.4
 * del expediente (12-ago-2026), fuera de la ventana de 7 días».
 *
 * La receta no conoce el internamiento ni los diagnósticos del cuadro, así
 * que no pasa señales de contexto y rige la ventana **conservadora** (7 días).
 * Pedir de más, nunca dosificar de menos. Módulo puro.
 */
import { labsDelCuadro, type PanelParaMotores } from '@/lib/expediente/laboratorio/lo-que-ya-esta-medido'
import {
  vigenciaDeLaFuncionRenal, avisoDeFuncionRenalCaduca, type VigenciaRenal,
} from '@/lib/expediente/laboratorio/vigencia-de-la-funcion-renal'

export interface CreatininaDelExpediente {
  valor: number
  /** YYYY-MM-DD del panel del que salió. */
  medidoEn: string
}

/** La creatinina más reciente de los paneles del paciente, o `null`. */
export function creatininaDelExpediente(paneles: readonly PanelParaMotores[] | undefined): CreatininaDelExpediente | null {
  const { labs, medidoEn } = labsDelCuadro(undefined, paneles)
  const valor = labs.creatinina
  const fecha = medidoEn.creatinina
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || !fecha) return null
  return { valor, medidoEn: fecha }
}

export type CreatininaParaDosificar =
  | { origen: 'tecleada'; valor: number }
  | { origen: 'expediente'; valor: number; medidoEn: string; vigencia: VigenciaRenal }
  | { origen: 'ninguna' }

export function creatininaParaDosificar(
  tecleada: string,
  delExpediente: CreatininaDelExpediente | null,
  ahoraISO: string,
): CreatininaParaDosificar {
  const cr = parseFloat(tecleada)
  if (Number.isFinite(cr) && cr > 0) return { origen: 'tecleada', valor: cr }
  if (delExpediente) {
    return {
      origen: 'expediente',
      valor: delExpediente.valor,
      medidoEn: delExpediente.medidoEn,
      // Sin señales de contexto: ventana conservadora. La receta no sabe si el
      // paciente está hospitalizado ni qué diagnósticos tiene.
      vigencia: vigenciaDeLaFuncionRenal(delExpediente.medidoEn, ahoraISO),
    }
  }
  return { origen: 'ninguna' }
}

/** La frase que va debajo del campo. Vacía si el médico tecleó o no hay nada. */
export function comoSeDiceLaCreatinina(c: CreatininaParaDosificar): string {
  if (c.origen !== 'expediente') return ''
  const base = `Creatinina ${c.valor} mg/dL del expediente (${c.medidoEn}).`
  if (c.vigencia.vigente) return `${base} Se usa para el ajuste; teclea una más reciente si la tienes.`
  return `${base} ${avisoDeFuncionRenalCaduca(c.vigencia)}`
}
