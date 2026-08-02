/**
 * QUÉ SIGNIFICA UN PAGO EN LÍNEA: ¿SALDA LA CONSULTA O ES UN ABONO?
 *
 * ── EL AGUJERO ───────────────────────────────────────────────────────────────
 *
 * Cuando el consultorio no tiene tarifa fijada para ese tipo de cita, el
 * checkout escribe el ANTICIPO en `pagoMonto` y lo marca con
 * `pagoMontoEsAnticipoSinTarifa`. Luego el webhook comparaba lo pagado contra
 * `pagoMonto`… que era el propio anticipo. El paciente pagaba $200 de anticipo,
 * la comparación daba «cubre», y la cita quedaba **pagada** con `cobroId`:
 * el botón «Cobrar» desaparecía, las cuentas por cobrar la excluían y el resto
 * de la consulta no se reclamaba en ninguna pantalla.
 *
 * El comentario del propio webhook ya decía lo correcto —«el sistema NO sabe
 * cuánto vale la consulta, así que no puede afirmar que quede saldada»— y el
 * código hacía lo contrario. Esta función es esa frase, ejecutable.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **Sin tarifa conocida no se puede saldar nada.** Un pago que no se puede
 * comparar contra un precio es un abono, y el saldo pendiente es DESCONOCIDO —
 * que no es lo mismo que cero. Escribir cero ahí volvería a decir «ya no debe
 * nada» por otra vía.
 *
 * Módulo PURO.
 */

export interface EntradaAnticipo {
  /** Lo que el servidor esperaba cobrar. Si no había tarifa, es el anticipo. */
  esperado: number
  /** Lo que Stripe confirmó. */
  monto: number
  /** `true` si `esperado` es en realidad el anticipo, no el precio. */
  sinTarifaConocida: boolean
}

export interface DecisionAnticipo {
  /** ¿Queda saldada la consulta? */
  cubre: boolean
  concepto: 'consulta' | 'abono'
  estadoCita: 'pagada' | 'pendiente-pago'
  /**
   * Lo que falta. `null` = NO SE SABE (no había tarifa contra la cual restar).
   * Un cero aquí se leería como «no debe nada».
   */
  saldoPendiente: number | null
  descripcion: string
}

/** Tolerancia de un centavo: Stripe redondea y no se puede exigir igualdad exacta. */
const CENTAVO = 0.01

export function decidirCobroAnticipo(e: EntradaAnticipo): DecisionAnticipo {
  const esperado = Number(e.esperado) || 0
  const monto = Number(e.monto) || 0

  if (e.sinTarifaConocida) {
    return {
      cubre: false,
      concepto: 'abono',
      estadoCita: 'pendiente-pago',
      saldoPendiente: null,
      descripcion:
        'Anticipo pagado en línea. El consultorio no tenía tarifa fijada para esta cita, ' +
        'así que NO se sabe cuánto falta: cóbralo al cerrar la consulta.',
    }
  }

  const cubre = esperado <= 0 || monto + CENTAVO >= esperado
  return cubre
    ? {
        cubre: true,
        concepto: 'consulta',
        estadoCita: 'pagada',
        saldoPendiente: 0,
        descripcion: 'Pago en línea del paciente',
      }
    : {
        cubre: false,
        concepto: 'abono',
        estadoCita: 'pendiente-pago',
        saldoPendiente: Math.max(0, esperado - monto),
        descripcion: 'Abono parcial pagado en línea por el paciente',
      }
}

export const POR_QUE_SIN_TARIFA_NO_SALDA =
  'Porque un pago que no se puede comparar contra un precio no demuestra que la ' +
  'consulta esté pagada. Marcarla como saldada esconde el botón de cobrar, la ' +
  'saca de las cuentas por cobrar y el resto del dinero no se reclama en ninguna ' +
  'pantalla. Y el saldo queda en «no se sabe», no en cero: un cero se lee como ' +
  '«no debe nada».'
