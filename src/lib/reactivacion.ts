import type { Patient } from '@/types'
import { estaBloqueadoArco, type MarcaBloqueo } from '@/lib/arco/cancelacion'

/**
 * Núcleo puro para reactivación de pacientes (Lote 11): identifica pacientes que
 * no han vuelto y arma el mensaje de WhatsApp. Sin efectos secundarios; la fecha
 * "hoy" se inyecta para poder testear.
 */

/** Solo la parte YYYY-MM-DD de un ISO/fecha. */
function soloDia(iso?: string): string | null {
  if (!iso) return null
  const m = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : null
}

/** Días transcurridos entre dos fechas YYYY-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export interface CandidatoReactivacion {
  paciente: Patient
  /** Días desde la última cita (o desde que se dio de alta si nunca ha vuelto). */
  dias: number
  /** true si tiene ultimaCita; false si nunca ha tenido cita registrada. */
  tuvoCita: boolean
}

/**
 * POR QUÉ UN PACIENTE QUE LLEVA TIEMPO SIN VOLVER **NO** SALE EN LA LISTA.
 *
 * `null` = sale (es candidato). Los demás valores son las cuatro razones por
 * las que este producto deja fuera a alguien que sí lleva tiempo sin volver, y
 * ninguna de ellas se veía en pantalla: la lista salía vacía y el médico leía
 * «¡Buen seguimiento!» sobre un consultorio en el que, por ejemplo, tres
 * pacientes habían pedido no recibir mensajes.
 *
 * Que no aparezca no es que no exista — regla 4 de seguridad clínica, dicha
 * aquí en el lenguaje de la continuidad del paciente.
 */
export type MotivoFueraDeReactivacion =
  /** No hay por dónde escribirle. No es que esté bien: es que no se puede. */
  | 'sin-telefono'
  /** Ejerció su derecho ARCO: no vuelve a recibir reactivación ni campañas. */
  | 'bloqueo-arco'
  /** Lo excluyó la política de quien llama (baja de WhatsApp, cita ya agendada). */
  | 'excluido'
  /** Lleva tiempo sin volver, pero todavía no llega al umbral seleccionado. */
  | 'bajo-el-umbral'

export interface ClasificacionDeReactivacion {
  paciente: Patient
  /** Días desde la última cita, o desde el alta si nunca ha vuelto. */
  dias: number
  tuvoCita: boolean
  /** `null` cuando es candidato. */
  fuera: MotivoFueraDeReactivacion | null
}

/**
 * Clasifica a CADA paciente del que se puede saber cuánto lleva sin volver.
 *
 * Quien no tiene ni `ultimaCita` ni `createdAt` legibles no entra en el
 * resultado: de ése no se sabe cuánto lleva, y contarlo como «fuera» sería
 * inventarle una antigüedad. La conducta es la misma que tenía la función de
 * siempre (lo saltaba); lo que cambia es que ahora se dice por qué.
 *
 * Las condiciones son una conjunción, así que el conjunto de candidatos no
 * depende del orden en que se comprueben — ésa es la razón por la que este
 * módulo puede reordenarlas para poder CONTAR sin cambiar a quién saca.
 */
export function clasificarParaReactivar(
  pacientes: Patient[],
  hoy: string,
  umbralDias = 90,
  excluir?: (p: Patient) => boolean,
): ClasificacionDeReactivacion[] {
  const out: ClasificacionDeReactivacion[] = []
  for (const p of pacientes) {
    const ult = soloDia(p.ultimaCita)
    const alta = soloDia(p.createdAt)
    const base = ult ?? alta
    if (!base) continue
    const dias = diasEntre(base, hoy)
    const tuvoCita = !!ult

    /*
      EL UMBRAL PRIMERO: quien volvió la semana pasada no está «fuera por no
      tener teléfono». Sólo se explica la ausencia de quien de verdad lleva
      tiempo sin volver — si no, el desglose contaría a media clínica.
    */
    if (dias < umbralDias) { out.push({ paciente: p, dias, tuvoCita, fuera: 'bajo-el-umbral' }); continue }
    if (!(p.telefono || p.whatsapp)) { out.push({ paciente: p, dias, tuvoCita, fuera: 'sin-telefono' }); continue }
    /**
     * BLOQUEO ARCO — y por qué NO es política del llamador.
     *
     * Al ejecutar una cancelación ARCO por bloqueo, al médico y al titular se
     * les dice, con estas palabras, que el paciente «no vuelve a recibir
     * recordatorios, ni reactivación, ni campañas». El campo `arcoBloqueo` se
     * escribía y no lo miraba NADIE: `estaBloqueadoArco` no tenía un solo
     * llamador en producción, así que lo único que mordía era la baja de
     * WhatsApp — y sólo si el paciente tenía teléfono.
     *
     * Va aquí dentro y no en el predicado `excluir` a propósito: un derecho
     * ejercido no puede depender de que cada pantalla se acuerde de aplicarlo.
     */
    if (estaBloqueadoArco(p as { arcoBloqueo?: MarcaBloqueo | null })) { out.push({ paciente: p, dias, tuvoCita, fuera: 'bloqueo-arco' }); continue }
    if (excluir?.(p)) { out.push({ paciente: p, dias, tuvoCita, fuera: 'excluido' }); continue }
    out.push({ paciente: p, dias, tuvoCita, fuera: null })
  }
  return out
}

/**
 * Pacientes a reactivar: última cita más antigua que `umbralDias`, o dados de
 * alta hace más de `umbralDias` sin ninguna cita. Ordenados por más tiempo sin
 * volver. Excluye a quien no tenga teléfono (no se puede contactar).
 *
 * Desde 15-ago-2026 es una VISTA de `clasificarParaReactivar` — el mismo
 * conjunto, filtrado. Una sola fuente de verdad sobre a quién se reactiva: si
 * el desglose que se pinta en pantalla y la lista que se enseña se calcularan
 * por separado, el día que uno cambie el otro mentiría.
 */
export function pacientesParaReactivar(
  pacientes: Patient[],
  hoy: string,
  umbralDias = 90,
  /**
   * Predicado de EXCLUSIÓN (se mantiene puro: el llamador decide la política).
   * Se usa para no molestar a quien pidió BAJA (opt-out de WhatsApp) ni a quien
   * YA tiene una cita futura agendada — a ese no se le dice "notamos que ha pasado
   * un tiempo, ¿desea agendar?" cuando ya tiene lugar reservado.
   */
  excluir?: (p: Patient) => boolean,
): CandidatoReactivacion[] {
  return clasificarParaReactivar(pacientes, hoy, umbralDias, excluir)
    .filter(c => c.fuera === null)
    .map(({ paciente, dias, tuvoCita }) => ({ paciente, dias, tuvoCita }))
    .sort((a, b) => b.dias - a.dias)
}

/**
 * EL DESGLOSE QUE LA PANTALLA NECESITA PARA NO MENTIR (RTC-30).
 *
 * `/reactivacion` decía, con la lista vacía: «Nadie pendiente de reactivar ·
 * No hay pacientes con más de 365 días sin volver. ¡Buen seguimiento!» —
 * felicitando al médico. Eso es cierto sólo en UN caso de cinco. En los otros
 * cuatro hay gente que lleva meses sin volver y la pantalla no la enseña:
 * porque la píldora está en un umbral más alto, porque pidió la baja, porque
 * ejerció ARCO o porque no hay teléfono al que escribir.
 *
 * Los recuentos se cortan por el umbral MÍNIMO, no por el seleccionado: si se
 * contaran con el seleccionado, quien volvió la semana pasada entraría en
 * «llevan menos tiempo» y el número dejaría de significar nada. Y no se
 * solapan — `total` es exactamente la suma de los cinco.
 */
export interface DesgloseDeReactivacion {
  /** Pacientes que llevan al menos `umbralMinimo` días sin volver, se les pueda escribir o no. */
  total: number
  /** Los que la pantalla enseña con el umbral SELECCIONADO. */
  candidatos: CandidatoReactivacion[]
  /** Contactables a los que sólo la píldora del umbral deja fuera. */
  bajoElUmbral: number
  sinTelefono: number
  bloqueoArco: number
  conBaja: number
  conCitaFutura: number
}

export function desgloseDeReactivacion(
  pacientes: Patient[],
  hoy: string,
  umbralDias: number,
  umbralMinimo: number,
  /** `null` = no se excluye. Separa la baja de la cita futura: no se dicen igual. */
  razonDeExclusion?: (p: Patient) => 'baja' | 'cita-futura' | null,
): DesgloseDeReactivacion {
  const base = clasificarParaReactivar(pacientes, hoy, umbralMinimo, p => !!razonDeExclusion?.(p))
  const desglose: DesgloseDeReactivacion = {
    total: 0,
    candidatos: pacientesParaReactivar(pacientes, hoy, umbralDias, p => !!razonDeExclusion?.(p)),
    bajoElUmbral: 0,
    sinTelefono: 0,
    bloqueoArco: 0,
    conBaja: 0,
    conCitaFutura: 0,
  }
  for (const c of base) {
    if (c.fuera === 'bajo-el-umbral') continue // no llega ni al mínimo: no es de quien habla esta pantalla
    desglose.total++
    if (c.fuera === 'sin-telefono') desglose.sinTelefono++
    else if (c.fuera === 'bloqueo-arco') desglose.bloqueoArco++
    else if (c.fuera === 'excluido') {
      if (razonDeExclusion?.(c.paciente) === 'cita-futura') desglose.conCitaFutura++
      else desglose.conBaja++
    } else if (c.dias < umbralDias) desglose.bajoElUmbral++
  }
  return desglose
}

/** Primer nombre, para un saludo cálido. */
function primerNombre(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] || ''
}

/** Mensaje de reactivación (el médico lo revisa antes de enviar; no se auto-envía). */
export function msgReactivacion(nombrePaciente: string, nombreMedico?: string): string {
  const hola = primerNombre(nombrePaciente)
  const firma = nombreMedico ? `\n\n— ${nombreMedico}` : ''
  return [
    `Hola ${hola} 👋`,
    ``,
    `Le escribimos del consultorio${nombreMedico ? ` de ${nombreMedico}` : ''}. Notamos que ha pasado un tiempo desde su última visita y queremos saber cómo sigue.`,
    ``,
    `Si desea agendar una cita de control o seguimiento, con gusto le apartamos un espacio. Solo responda a este mensaje.${firma}`,
  ].join('\n')
}

/** Mensaje de seguimiento posconsulta (check-in cálido tras una visita reciente). */
export function msgSeguimiento(nombrePaciente: string, nombreMedico?: string): string {
  const hola = primerNombre(nombrePaciente)
  const firma = nombreMedico ? `\n\n— ${nombreMedico}` : ''
  return [
    `Hola ${hola} 👋`,
    ``,
    `Le escribimos para saber cómo ha seguido tras su consulta. ¿Ha notado mejoría? ¿Alguna duda con su tratamiento?`,
    ``,
    `Estamos al pendiente; responda por aquí si necesita algo.${firma}`,
  ].join('\n')
}

/** Mensaje para que un paciente refiera al consultorio (comparte el enlace de reserva). */
export function msgReferido(nombreMedico: string | undefined, urlReserva: string): string {
  return [
    `Te recomiendo al consultorio${nombreMedico ? ` de ${nombreMedico}` : ''} 🩺`,
    ``,
    `Puedes agendar tu cita en línea aquí:`,
    urlReserva,
  ].join('\n')
}
