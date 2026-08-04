/**
 * CUÁNTOS SE VAN — la cifra que faltaba al lado del MRR.
 *
 * ── POR QUÉ IMPORTA MÁS QUE EL MRR ───────────────────────────────────────────
 *
 * El MRR dice cuánto entra este mes. La tasa de bajas dice si eso se sostiene.
 * Un producto con MRR creciente y 15 % de bajas mensuales está reemplazando
 * clientes tan rápido como los pierde, y eso no se ve en ninguna suma: se ve
 * dividiendo.
 *
 * ── LA REGLA QUE ORDENA EL CÁLCULO ───────────────────────────────────────────
 *
 * **La tasa se mide contra quienes PODÍAN irse, no contra el total de hoy.**
 * Dividir las bajas del mes entre los consultorios que quedan infla la cifra
 * justo cuando peor van las cosas —el denominador encoge con cada baja— y
 * dividirla entre los de hoy incluye a los que se dieron de alta ayer y no han
 * tenido oportunidad de irse. El denominador correcto es «los que estaban
 * activos al empezar el mes» = los activos de hoy + los que se fueron en él.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No inventa el pasado. Los consultorios cancelados antes de que existiera
 * `canceladaEn` no tienen fecha, así que no se pueden asignar a un mes: se
 * cuentan aparte y se declaran, en vez de repartirlos a ojo o de esconderlos.
 *
 * Módulo PURO.
 */

/** Lo que hace falta saber de un consultorio para medir bajas. */
export interface ConsultorioParaChurn {
  status?: string
  /** ISO. Ausente en las bajas anteriores a que se empezara a registrar. */
  canceladaEn?: string | null
  /** MXN al mes que aportaba. Para el MRR perdido. */
  mrr?: number
  /**
   * Fin de la prueba (ISO). Lo escribe `clinic/crear` desde siempre.
   *
   * Sin esto, la prueba abandonada era invisible: se queda en `status: 'trial'`
   * **para siempre** —nadie la cancela, porque nadie llegó a pagar— así que no
   * aparecía ni como baja ni como conversión. En un producto que vive de
   * convertir pruebas, ése era el número que faltaba.
   */
  trialEndsAt?: string | null
}

export interface Churn {
  /** Consultorios que se fueron dentro del mes pedido. */
  bajasDelMes: number
  /** Los que estaban activos al empezar el mes (activos de hoy + bajas del mes). */
  base: number
  /** 0..1. `null` si no había base: dividir entre cero no es 0 %, es «no se sabe». */
  tasa: number | null
  /** MXN mensuales que se fueron con ellos. */
  mrrPerdido: number
  /**
   * Bajas SIN fecha, que no se pueden asignar a ningún mes.
   *
   * Se declara en vez de repartirse: una cifra que incluye lo que no se sabe
   * cuándo pasó no es una tasa mensual.
   */
  bajasSinFecha: number
  /**
   * Pruebas que VENCIERON en el mes sin convertirse.
   *
   * Va **aparte de la tasa de bajas**, no sumada. Mezclar «un cliente que
   * pagaba se fue» con «una prueba no cuajó» vuelve las dos cifras inútiles:
   * la primera mide retención y la segunda, conversión. Son dos problemas
   * distintos y se arreglan de maneras distintas.
   */
  pruebasVencidas: number
  /**
   * Pruebas en curso: vivas y sin vencer todavía.
   *
   * Es el contexto sin el que «3 pruebas vencidas» no dice nada — tres de
   * cuatro es un producto que no convence; tres de cuarenta es martes.
   */
  pruebasEnCurso: number
}

/**
 * @param consultorios todos, con su estado actual.
 * @param mes `YYYY-MM`.
 */
export function churnDelMes(consultorios: readonly ConsultorioParaChurn[], mes: string): Churn {
  const cancelados = consultorios.filter(c => c.status === 'cancelled')
  const delMes = cancelados.filter(c => String(c.canceladaEn ?? '').slice(0, 7) === mes)
  const activosHoy = consultorios.filter(c => c.status === 'active').length

  /**
   * LA PRUEBA ABANDONADA, QUE NO LA CONTABA NADIE.
   *
   * Sigue en `status: 'trial'` para siempre: nadie la cancela porque nadie
   * llegó a pagar. Se reconoce por su propia fecha de fin —la que escribe
   * `clinic/crear`—, no por una suposición sobre cuánto dura una prueba.
   *
   * Una prueba SIN fecha de fin no se cuenta: no se puede saber si venció.
   */
  const pruebas = consultorios.filter(c => c.status === 'trial')
  const pruebasVencidas = pruebas.filter(c => String(c.trialEndsAt ?? '').slice(0, 7) === mes).length
  const pruebasEnCurso = pruebas.filter(c => {
    const f = String(c.trialEndsAt ?? '')
    return !!f && f.slice(0, 7) > mes
  }).length

  const base = activosHoy + delMes.length
  return {
    bajasDelMes: delMes.length,
    base,
    tasa: base > 0 ? delMes.length / base : null,
    mrrPerdido: delMes.reduce((a, c) => a + (Number(c.mrr) || 0), 0),
    bajasSinFecha: cancelados.filter(c => !c.canceladaEn).length,
    pruebasVencidas,
    pruebasEnCurso,
  }
}

/** La tasa en palabras. `null` se dice, no se pinta como 0 %. */
export function tasaLegible(t: number | null): string {
  return t == null ? 'sin base' : `${(t * 100).toFixed(1)} %`
}

export const POR_QUE_ESE_DENOMINADOR =
  'Porque dividir las bajas del mes entre los que quedan infla la cifra justo ' +
  'cuando peor van las cosas —el denominador encoge con cada baja— y dividirla ' +
  'entre los de hoy incluye a quien se dio de alta ayer y no ha tenido ' +
  'oportunidad de irse. El denominador es quien PODÍA irse.'

export const POR_QUE_LAS_PRUEBAS_VAN_APARTE =
  'Mezclar «un cliente que pagaba se fue» con «una prueba no cuajó» vuelve las ' +
  'dos cifras inútiles: la primera mide retención y la segunda, conversión. Son ' +
  'dos problemas distintos y se arreglan de maneras distintas.'

export const POR_QUE_NO_SE_SUPONE_LA_DURACION =
  'La prueba vencida se reconoce por su propia fecha de fin, la que escribe ' +
  'clinic/crear. Suponer «catorce días desde el alta» daría por vencida una ' +
  'prueba que se extendió a mano, y por viva una que se acortó.'
