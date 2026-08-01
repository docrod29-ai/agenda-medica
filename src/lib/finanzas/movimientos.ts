/**
 * MOVIMIENTOS DE DINERO DE LA PLATAFORMA — una sola definición de «cuánto entró».
 *
 * ── EL HUECO (PRACTICE-GA-001, P0-3) ─────────────────────────────────────────
 *
 * El webhook de Stripe manejaba diez eventos y **ninguno era un reembolso ni un
 * contracargo**. Si un cliente pedía el dinero de vuelta, o lo reclamaba a su
 * banco, Stripe se lo devolvía y en NexusMED no pasaba nada: la suscripción
 * seguía activa y el ingreso seguía contado. Le devuelves el dinero y se queda
 * con el producto.
 *
 * ── Y UNA INCONSISTENCIA QUE HABÍA QUE ARREGLAR ANTES ────────────────────────
 *
 * La consola del dueño sumaba `platform_payments` de dos formas distintas:
 *
 *     ingresoTotalHist   →  if (!(monto > 0)) return      // descarta negativos
 *     pagadoPorClinica   →  suma Number(p.monto ?? 0)     // los incluye
 *
 * Con esa asimetría, escribir los reembolsos en negativo los habría dejado
 * INVISIBLES justo en el número grande —el ingreso total— mientras corregían el
 * de cada cliente. Dos respuestas a la misma pregunta, y la que se mira primero
 * habría sido la falsa. Por eso la suma vive aquí, en un sitio, y con pruebas.
 *
 * ── QUÉ CUENTA COMO DINERO QUE SALE ──────────────────────────────────────────
 *
 * Se cuenta CAJA, no promesas. Stripe retiene el importe de una disputa **en el
 * momento en que se abre** y lo devuelve sólo si se gana, así que una disputa
 * abierta ya es dinero que no está. Si se gana, vuelve; si se pierde, se queda
 * fuera. Contar la disputa sólo al perderla haría ver un saldo que el banco no
 * tiene.
 *
 * Módulo PURO: clasifica y suma. No lee Firestore ni habla con Stripe.
 */

export type TipoMovimiento = 'cobro' | 'reembolso' | 'contracargo'

/** Estado de una disputa. Sólo aplica a `contracargo`. */
export type EstadoDisputa = 'abierta' | 'ganada' | 'perdida'

export interface Movimiento {
  tipo: TipoMovimiento
  /** SIEMPRE positivo: el signo lo decide el tipo, no quien escribe el dato. */
  monto: number
  /** `true` sólo para dinero real. Stripe en modo prueba manda `false`. */
  livemode?: boolean
  estadoDisputa?: EstadoDisputa
  fecha?: string
}

/**
 * ¿Es dinero de verdad?
 *
 * Los pagos de Stripe en modo prueba llegan con `livemode: false`, y antes de
 * que existiera este filtro la consola los contaba como ingreso real. Se exige
 * el `true` explícito: un campo ausente NO es dinero real.
 */
export function esDineroReal(m: Pick<Movimiento, 'livemode'>): boolean {
  return m.livemode === true
}

/**
 * Cuánto mueve la caja este movimiento, con su signo.
 *
 * Una disputa GANADA vale 0: Stripe retuvo el importe al abrirla y lo devolvió
 * al cerrarla, así que el efecto neto sobre la caja es nulo. (La comisión de
 * disputa sí se pierde, pero la cobra Stripe aparte y no viaja en este evento;
 * no se inventa aquí un número que no tenemos.)
 */
export function efectivoDe(m: Movimiento): number {
  const monto = Math.abs(Number(m.monto) || 0)
  switch (m.tipo) {
    case 'cobro':
      return monto
    case 'reembolso':
      return -monto
    case 'contracargo':
      return m.estadoDisputa === 'ganada' ? 0 : -monto
  }
}

export interface ResumenMovimientos {
  /** Lo que de verdad queda: cobros menos reembolsos menos contracargos. */
  neto: number
  cobrado: number
  reembolsado: number
  /** Dinero retenido por disputas que siguen abiertas o ya se perdieron. */
  encontracargo: number
  /** Cuántos COBROS hubo. Un reembolso no es un pago y no engorda esta cuenta. */
  numCobros: number
  /** Disputas todavía sin resolver: dinero en el aire que el dueño debe ver. */
  disputasAbiertas: number
}

/**
 * Resume una lista de movimientos. Descarta lo que no es dinero real.
 *
 * `numCobros` cuenta sólo cobros a propósito: mezclarlo con los reembolsos daría
 * un «número de pagos del mes» que sube cuando se devuelve dinero.
 */
export function resumirMovimientos(movs: Movimiento[]): ResumenMovimientos {
  const r: ResumenMovimientos = {
    neto: 0, cobrado: 0, reembolsado: 0, encontracargo: 0,
    numCobros: 0, disputasAbiertas: 0,
  }
  for (const m of movs) {
    if (!esDineroReal(m)) continue
    const monto = Math.abs(Number(m.monto) || 0)
    r.neto += efectivoDe(m)
    if (m.tipo === 'cobro') { r.cobrado += monto; r.numCobros++ }
    else if (m.tipo === 'reembolso') r.reembolsado += monto
    else {
      if (m.estadoDisputa !== 'ganada') r.encontracargo += monto
      if (m.estadoDisputa === 'abierta') r.disputasAbiertas++
    }
  }
  return r
}

/**
 * Tipo de un asiento guardado. Los documentos anteriores a este cambio no llevan
 * `tipo`: eran todos cobros, y así se leen — nunca como «desconocido», que los
 * dejaría fuera del ingreso histórico y haría ver una caída que no existió.
 */
export function tipoDeAsiento(dato: { tipo?: unknown }): TipoMovimiento {
  const t = String(dato?.tipo ?? '')
  return t === 'reembolso' || t === 'contracargo' ? t : 'cobro'
}

export const POR_QUE_LA_DISPUTA_ABIERTA_YA_RESTA =
  'Porque Stripe retiene el importe en el momento en que se abre la disputa y ' +
  'sólo lo devuelve si se gana. Contarla apenas al perderla mostraría un saldo ' +
  'que el banco no tiene, y el dueño decidiría sobre dinero que no está.'
