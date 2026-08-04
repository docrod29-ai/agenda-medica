/**
 * EL COSTO DE IA DE LA CONTABILIDAD: MEDIDO, NO SUPUESTO.
 *
 * ── EL HALLAZGO (N5 de la auditoría del equipo, 3-ago-2026) ──────────────────
 *
 * `/api/superadmin/contabilidad` valoraba la IA así:
 *
 *     const COSTO_CREDITO_MXN = Number(process.env.COSTO_CREDITO_MXN ?? '1.5')
 *     const costoIA = creditos * COSTO_CREDITO_MXN
 *
 * Un crédito valía **1.5 pesos porque sí**. El comentario del propio código lo
 * confesaba: «Haiku/Sonnet/Opus rondan ~$1.5 MXN por crédito» — una cifra de
 * memoria, sin fuente y sin fecha.
 *
 * Y mientras tanto el **libro de costos** (`platform_cost_ledger`) lleva desde el
 * 30-jul-2026 anotando, llamada por llamada, los tokens y el costo real en
 * dólares. Nadie lo leía desde aquí. La utilidad, el margen y las decisiones de
 * precio salían de un supuesto teniendo el dato medido al lado.
 *
 * ── POR QUÉ NO SE ARREGLA «PONIENDO EL NÚMERO BUENO» ─────────────────────────
 *
 * Porque no hay un número bueno: **un crédito no cuesta lo mismo según el
 * modelo**. Una nota con Opus y razonamiento extendido y una corrección con
 * Haiku consumen créditos parecidos y cuestan órdenes de magnitud distintas.
 * Cualquier constante es falsa; lo que hay que hacer es sumar lo que costó.
 *
 * ── EL TIPO DE CAMBIO NO SE INVENTA ──────────────────────────────────────────
 *
 * El libro está en USD y la contabilidad en MXN. El tipo de cambio **no se
 * escribe aquí**: lo pone el dueño (o su contador, que usa el del DOF del día
 * que declara). Sin tipo de cambio configurado, este módulo **no convierte**: se
 * queda en el supuesto viejo y lo dice en pantalla, en vez de inventar una
 * conversión que se vería igual de exacta que la buena.
 *
 * Módulo PURO.
 */

/** Un asiento del libro, en lo que hace falta aquí. */
export interface AsientoCosto {
  clinicId?: string | null
  costoUsd?: number | null
  clase?: string
}

export type FuenteCostoIA = 'libro_de_costos' | 'supuesto'

export interface CostoIAContable {
  /** MXN. Lo que se lleva a la utilidad. */
  mxn: number
  fuente: FuenteCostoIA
  /** USD medidos (0 cuando la fuente es el supuesto). */
  usdMedido: number
  /** Llamadas del mes que SÍ tenían tarifa. */
  conCosto: number
  /** Llamadas del mes SIN tarifa cargada: no se suman ni como cero. */
  sinTarifa: number
  /** Qué se le dice al dueño sobre la calidad de esta cifra. */
  aviso: string
}

/**
 * Los asientos que son COSTO DE SERVIR.
 *
 * Lo que el fundador gasta probando módulos es I+D, no costo de operación:
 * cargarlo al margen de los clientes haría que el margen dejara de ser real —
 * la misma separación que ya hace la consola de costos (§CD).
 */
export const esDeCliente = (a: AsientoCosto) => a.clase !== 'rnd' && a.clase !== 'llave_propia'

/**
 * El costo de IA del mes, medido si se puede y supuesto si no.
 *
 * `tipoCambio` en MXN por USD. `null` o 0 significa «no configurado», y entonces
 * se devuelve el supuesto — nunca una conversión inventada.
 */
export function costoIADelMes(
  asientos: readonly AsientoCosto[],
  creditosDelMes: number,
  costoPorCreditoMXN: number,
  tipoCambio: number | null,
): CostoIAContable {
  const delCliente = asientos.filter(esDeCliente)
  const conCosto = delCliente.filter(a => typeof a.costoUsd === 'number').length
  const sinTarifa = delCliente.length - conCosto

  if (!tipoCambio || !Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    return {
      mxn: creditosDelMes * costoPorCreditoMXN,
      fuente: 'supuesto',
      usdMedido: 0,
      conCosto, sinTarifa,
      aviso: 'Cifra SUPUESTA: se valora cada crédito a un precio fijo, que no es lo que cuesta '
        + '(una nota con el motor máximo y una corrección rápida gastan créditos parecidos y cuestan '
        + 'muy distinto). El costo REAL está medido en el libro de costos; para usarlo hace falta '
        + 'configurar TIPO_CAMBIO_USD_MXN en Vercel.',
    }
  }

  /**
   * Los asientos sin tarifa NO se suman como cero.
   *
   * Sumarlos como cero daría un costo menor del real y, en una pantalla de
   * contabilidad, un **margen mejor del que hay** — que es justo la cifra sobre
   * la que se decide un precio.
   */
  const usdMedido = delCliente.reduce((s, a) => s + (typeof a.costoUsd === 'number' ? a.costoUsd : 0), 0)

  return {
    mxn: usdMedido * tipoCambio,
    fuente: 'libro_de_costos',
    usdMedido,
    conCosto, sinTarifa,
    aviso: sinTarifa > 0
      ? `Medido en el libro de costos, pero ${sinTarifa} de ${delCliente.length} llamadas del mes no tienen `
        + 'tarifa cargada y NO se suman como cero: el costo real es mayor que éste, y el margen menor.'
      : 'Medido en el libro de costos: es lo que costaron las llamadas de los clientes este mes, '
        + 'convertido al tipo de cambio configurado.',
  }
}

/** Lo mismo, por consultorio: para el renglón de cada cliente. */
export function costoPorClinica(
  asientos: readonly AsientoCosto[],
  tipoCambio: number | null,
): Map<string, number> {
  const m = new Map<string, number>()
  if (!tipoCambio || tipoCambio <= 0) return m
  for (const a of asientos) {
    if (!esDeCliente(a) || typeof a.costoUsd !== 'number') continue
    const id = String(a.clinicId ?? '')
    if (!id) continue
    m.set(id, (m.get(id) ?? 0) + a.costoUsd * tipoCambio)
  }
  return m
}

export const POR_QUE_NO_HAY_UN_PRECIO_POR_CREDITO =
  'Un crédito no cuesta lo mismo según el modelo: una nota con razonamiento ' +
  'extendido y una corrección rápida consumen créditos parecidos y cuestan ' +
  'órdenes de magnitud distintas. Cualquier constante es falsa; lo correcto es ' +
  'sumar lo que costó, que es lo que el libro de costos ya sabe.'

export const POR_QUE_EL_TIPO_DE_CAMBIO_NO_SE_ESCRIBE_AQUI =
  'El libro está en USD y la contabilidad en MXN. El tipo de cambio lo pone el ' +
  'dueño o su contador —que usa el del DOF del día que declara—, no un valor por ' +
  'omisión escrito de memoria. Sin él no se convierte: se dice que la cifra es ' +
  'un supuesto, en vez de inventar una conversión que se vería igual de exacta ' +
  'que la buena.'
