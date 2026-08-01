/**
 * EN QUÉ SITUACIÓN DE COBRO ESTÁ UNA CONSULTA — y cuánto falta.
 *
 * ── EL HUECO QUE ESTO CIERRA ─────────────────────────────────────────────────
 *
 * El abono en el mostrador ya funcionaba a medias: se registra, y a propósito NO
 * marca la cita como saldada, así que sigue apareciendo «por cobrar». Correcto.
 *
 * Lo que no existía es el resto de la frase. **Nadie calculaba cuánto falta.**
 * Un paciente deja $300 de una consulta de $800 y vuelve el jueves; la asistente
 * ve «por cobrar», que es lo mismo que ve en una consulta donde nadie ha pagado
 * nada, y cobra los $800. El paciente pagó $1,100 por una consulta de $800.
 *
 * `saldoPendiente` sí existía… pero SÓLO para los anticipos por Stripe, escrito
 * dentro del webhook. El dinero que entra por la puerta del consultorio —que es
 * casi todo— no tenía ese número por ninguna parte.
 *
 * ── POR QUÉ SE DERIVA Y NO SE GUARDA ─────────────────────────────────────────
 *
 * Un campo `estadoPago` en la cita es una segunda verdad: se escribe en un sitio,
 * se olvida en otro, y el día que discrepa del libro de cobros gana el que esté
 * en pantalla. Aquí el estado se CALCULA de los cobros cada vez. Los cobros son
 * el registro contable —inmutables, con folio y autor— y una cifra derivada de
 * ellos no puede mentir más que ellos.
 *
 * ── LOS ESTADOS ──────────────────────────────────────────────────────────────
 *
 * Los siete del charter, más uno que su consultorio ya usaba y que no cabía en
 * ninguno: la CORTESÍA. Una consulta exenta no es «pendiente» —nadie va a
 * cobrarla— ni «anulada» —sí se dio—. Meterla en cualquiera de los dos ensucia
 * el corte de caja, que es exactamente lo que la exención existe para evitar.
 *
 * Módulo PURO. Decide y devuelve.
 */

export type EstadoFinanciero =
  /** Aún no hay precio: no se puede deber lo que no se ha puesto. */
  | 'borrador'
  /** Hay precio y no ha entrado nada. */
  | 'pendiente'
  /** Entró algo, falta el resto. **El estado que no existía.** */
  | 'parcial'
  /** Cubierto. */
  | 'pagado'
  /** Se devolvió lo cobrado. */
  | 'reembolsado'
  /** Se anuló el cobro (error de captura). No es una devolución. */
  | 'anulado'
  /** El banco retiró el dinero. Es el único que exige mirar hoy. */
  | 'contracargo'
  /** Cortesía: decisión deliberada de no cobrar, auditada. */
  | 'exento'

/** Lo mínimo que se necesita de un cobro para saber qué pasó con el dinero. */
export interface CobroParaEstado {
  monto?: number | null
  /** `'abono'` es un pago parcial; el resto de conceptos saldan. */
  concepto?: string | null
  tipo?: string | null
  cancelado?: boolean | null
}

export interface SituacionCobro {
  estado: EstadoFinanciero
  /** Lo que de verdad entró (los anulados no cuentan). */
  pagado: number
  /** Lo que falta. Nunca negativo: si se pagó de más, ver `excedente`. */
  saldo: number
  /** Lo pagado por encima del precio. Casi siempre 0; cuando no, hay que mirarlo. */
  excedente: number
  /** Una línea para la pantalla. Vacía cuando no hay nada que decir. */
  resumen: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Redondeo a centavos: sumar decimales de coma flotante deja restos de 0.0000001. */
const centavos = (n: number): number => Math.round(n * 100) / 100

const mxn = (n: number): string =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })

export interface OpcionesSituacion {
  /** Cortesía: decisión auditada de no cobrar esta consulta. */
  exento?: boolean | null
}

/**
 * La situación de cobro de UNA consulta.
 *
 * `precio` es lo que se esperaba cobrar. Sin precio (`null`, `0` o ausente) no
 * hay deuda posible: se devuelve `borrador`, porque afirmar que alguien debe
 * algo cuando nadie ha dicho cuánto es peor que no decir nada.
 */
export function situacionDeCobro(
  precio: number | null | undefined,
  cobros: readonly CobroParaEstado[],
  opciones: OpcionesSituacion = {},
): SituacionCobro {
  const vivos = cobros.filter(c => c.cancelado !== true)

  // El contracargo manda por encima de todo: el banco ya retiró el dinero y eso
  // no lo compensa ningún otro cobro. Es el único estado que pide acción hoy.
  if (vivos.some(c => String(c.tipo ?? '') === 'CHARGEBACK')) {
    return { estado: 'contracargo', pagado: 0, saldo: 0, excedente: 0, resumen: 'Contracargo: el banco retiró el pago' }
  }

  const entradas = vivos.filter(c => String(c.tipo ?? 'PAYMENT') === 'PAYMENT')
  const devoluciones = vivos.filter(c => ['REFUND', 'CREDIT'].includes(String(c.tipo ?? '')))
  const cobrado = centavos(entradas.reduce((s, c) => s + Math.abs(num(c.monto)), 0))
  const devuelto = centavos(devoluciones.reduce((s, c) => s + Math.abs(num(c.monto)), 0))
  const pagado = centavos(cobrado - devuelto)

  // Devuelto todo lo que había entrado: el dinero ya no está, y decirlo importa
  // más que el precio de lista.
  if (cobrado > 0 && devuelto >= cobrado) {
    return { estado: 'reembolsado', pagado: 0, saldo: 0, excedente: 0, resumen: `Reembolsado ${mxn(devuelto)}` }
  }

  /**
   * La CORTESÍA se comprueba después del dinero, no antes.
   *
   * Si alguien marcó cortesía sobre una consulta que ya tenía un pago —no debería
   * pasar, `exentarCobro` lo impide, pero los datos viejos existen— enseñar
   * «cortesía» escondería un dinero que sí entró. Manda lo que ocurrió.
   */
  if (opciones.exento === true && pagado === 0) {
    return { estado: 'exento', pagado: 0, saldo: 0, excedente: 0, resumen: 'Cortesía — no se cobra' }
  }

  // Todo lo que entró está anulado: la consulta vuelve a estar sin cobrar, pero
  // el motivo NO es el mismo que «nadie ha pagado». Se distingue.
  if (pagado === 0 && cobros.length > 0 && vivos.length === 0) {
    return { estado: 'anulado', pagado: 0, saldo: centavos(num(precio)), excedente: 0, resumen: 'El cobro fue anulado' }
  }

  const esperado = centavos(num(precio))
  if (esperado <= 0) {
    return {
      estado: pagado > 0 ? 'pagado' : 'borrador',
      pagado,
      saldo: 0,
      excedente: 0,
      resumen: pagado > 0 ? `Cobrado ${mxn(pagado)}` : 'Sin precio asignado',
    }
  }

  const saldo = centavos(Math.max(0, esperado - pagado))
  const excedente = centavos(Math.max(0, pagado - esperado))

  if (pagado <= 0) {
    return { estado: 'pendiente', pagado: 0, saldo, excedente: 0, resumen: `Por cobrar ${mxn(saldo)}` }
  }
  if (saldo > 0) {
    /**
     * EL RENGLÓN QUE FALTABA. Sin él, «por cobrar» dice lo mismo tanto si el
     * paciente no ha pagado nada como si ya dejó la mitad.
     */
    return { estado: 'parcial', pagado, saldo, excedente: 0, resumen: `Abonó ${mxn(pagado)} · faltan ${mxn(saldo)}` }
  }
  return {
    estado: 'pagado',
    pagado,
    saldo: 0,
    excedente,
    resumen: excedente > 0 ? `Pagado · ${mxn(excedente)} de más` : 'Pagado',
  }
}

/** ¿Hay dinero por cobrar? Lo que decide si la consulta sale en el worklist. */
export function faltaCobrar(s: SituacionCobro): boolean {
  return s.estado === 'pendiente' || s.estado === 'parcial'
}

/** Los que piden que alguien los mire hoy, no que alguien cobre. */
export function pideAtencion(s: SituacionCobro): boolean {
  return s.estado === 'contracargo' || s.excedente > 0
}

export const POR_QUE_EL_ESTADO_NO_SE_GUARDA =
  'Porque un campo `estadoPago` en la cita sería una segunda verdad: se escribe ' +
  'en un sitio, se olvida en otro, y el día que discrepe del libro de cobros gana ' +
  'el que esté en pantalla. Los cobros son el registro contable —inmutables, con ' +
  'folio y autor—; una cifra derivada de ellos no puede mentir más que ellos.'
