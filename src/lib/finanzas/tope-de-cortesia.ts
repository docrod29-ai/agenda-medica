/**
 * EL TOPE DE CORTESÍA ES PARA QUIEN TODAVÍA NO PAGA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `LIMITE_PRUEBA = 30` son los usos de IA gratis al mes con la llave de la
 * plataforma. `pruebaAgotada()` los contaba **sin mirar si el consultorio
 * paga**, y `resolverClaveIA` marca `fuente: 'prueba'` a **cualquiera** que no
 * haya pegado su propia API key — pague o no, porque nada le provisiona una
 * llave al suscribirse.
 *
 * La aritmética es la que duele: una consulta dictada gasta ~4 usos
 * (`transcribir` + `procesar` + `verificar-nota` + `evidencia`, cada una
 * registra el suyo). **30 ÷ 4 ≈ 7 consultas al mes.**
 *
 * Así que un cliente de Clínica —que pagó por decenas de consultas con IA—
 * recibía en la segunda semana, con un paciente enfrente:
 *
 *   «Se acabó la IA incluida en tu prueba. **Activa un plan** para seguir
 *    usándola»
 *
 * …a alguien que ya activó un plan. Y como el corte va **antes** de mirar
 * créditos y **ignora** `permiteEconomico`, el modo económico que la página de
 * precios promete —«sigue en Rápida sin costo hasta 120 notas más»— nunca se
 * alcanzaba.
 *
 * Todo el sistema de créditos existe, está probado y estaba gobernado por un
 * contador de otra época que se disparaba primero. No se había notado porque
 * todavía no hay un cliente de pago que haya corrido un mes completo — se
 * habría notado con el primer reembolso.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * El tope de cortesía **sólo** aplica mientras el consultorio no tiene plan
 * vigente. En cuanto paga, lo gobiernan los créditos y el modo económico, que es
 * el sistema diseñado para eso.
 *
 * Módulo PURO.
 */

/** Lo mínimo del consultorio para decidir. Se pide poco a propósito. */
export interface EstadoConsultorio {
  /** `active`, `trial`, `past_due`, `unpaid`, `cancelled`… */
  status?: string
  /** Clave del plan. `cortesia` es una cuenta regalada por el dueño. */
  plan?: string
  /** Pase libre del dueño: nunca se le corta nada. */
  paseLibre?: boolean
}

/**
 * Estados en los que hay un plan detrás que respalda el gasto.
 *
 * `past_due` entra a propósito: el cobro falló pero el plan sigue vivo y el
 * *dunning* de Stripe está corriendo. Cortarle la IA a alguien mientras su banco
 * reintenta el cargo es castigar dos veces por lo mismo — y el webhook ya tiene
 * decidido que `past_due` NO suspende, sólo `unpaid`/`canceled`.
 */
const CON_PLAN_VIGENTE = ['active', 'trialing', 'past_due']

/**
 * ¿Se le aplica a este consultorio el tope de cortesía?
 *
 * @param c estado del consultorio, o `null` si no se pudo leer.
 *
 * ── QUÉ PASA SI NO SE PUEDE LEER ─────────────────────────────────────────────
 *
 * Se aplica el tope, igual que antes. Es la única de las dos opciones que no
 * regala la llave del dueño ante un fallo de red: quien tiene plan y se topa por
 * una lectura fallida ve un mensaje y vuelve a intentar; quien no lo tiene y se
 * saltara el tope gastaría contra la tarjeta del Dr. sin límite.
 *
 * El mensaje que devuelve `gateCreditos` se encarga del resto: dice qué hacer.
 */
export function aplicaTopeDeCortesia(c: EstadoConsultorio | null | undefined): boolean {
  if (!c) return true
  if (c.paseLibre === true) return false          // el dueño, nunca
  if (c.plan === 'cortesia') return false         // cuenta regalada, tampoco
  return !CON_PLAN_VIGENTE.includes(String(c.status ?? ''))
}

export const POR_QUE_NO_APLICA_A_QUIEN_PAGA =
  'El tope de 30 usos es la cortesía de la llave de la plataforma para quien ' +
  'todavía no paga. A un consultorio con plan vigente lo gobiernan sus créditos ' +
  'y el modo económico —el sistema diseñado para eso—, no un contador de ' +
  'cortesía. Aplicárselo le cortaba la IA en la segunda semana del mes con el ' +
  'mensaje «activa un plan», a alguien que ya lo activó.'
