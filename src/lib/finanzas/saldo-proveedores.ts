/**
 * CUÁNTO SALDO QUEDA CON CADA PROVEEDOR, Y CUÁNDO SE ACABA.
 *
 * ── LO QUE PIDIÓ EL DR. (3-ago-2026) ─────────────────────────────────────────
 *
 * «Estar al pendiente cuánto saldo tengo, para estarle abonando y los clientes
 * no se queden sin IA.»
 *
 * Es una preocupación operativa, no contable: si el saldo de AssemblyAI llega a
 * cero, **todas** las consultas pierden la separación de voces a la vez. Hasta
 * la v973 eso ocurría además en silencio; ahora al menos se dice, pero decirlo
 * después no sirve de nada — el médico ya está con el paciente enfrente.
 *
 * ── POR QUÉ NO SE CONSULTA EL SALDO AL PROVEEDOR ─────────────────────────────
 *
 * Se buscó: la API de AssemblyAI **no publica** un endpoint de saldo ni de
 * consumo. Así que el saldo no se lee, se LLEVA: el dueño registra lo que abona
 * y el libro de costos ya sabe exactamente lo que se ha gastado.
 *
 * Eso tiene una ventaja que un endpoint no daría: funciona igual para los tres
 * proveedores, con una sola pantalla y un solo aviso.
 *
 * ── LA CIFRA ES UNA ESTIMACIÓN, Y SE DICE ────────────────────────────────────
 *
 * Lo consumido sale de nuestros propios asientos, no del estado de cuenta del
 * proveedor. Puede diferir por llamadas que no pasaron por el libro, impuestos o
 * redondeos. Se llama **estimado** en todas partes: un saldo que se presenta como
 * exacto y no lo es acaba dejando a alguien sin servicio con el tablero en verde.
 *
 * Módulo PURO.
 */

/** Un abono al proveedor, tal como lo registra el dueño. */
export interface Recarga {
  proveedor: string
  /** USD abonados. */
  montoUsd: number
  /** ISO. */
  fecha: string
  /** Referencia del cargo, para poder conciliar con el estado de cuenta. */
  referencia?: string
}

/** Lo gastado con un proveedor, leído del libro de costos. */
export interface ConsumoProveedor {
  proveedor: string
  usdGastado: number
  /** Días del periodo sobre el que se midió el gasto. */
  diasMedidos: number
}

export interface SaldoProveedor {
  proveedor: string
  cargadoUsd: number
  gastadoUsd: number
  /** Estimado: lo cargado menos lo que dicen NUESTROS asientos. */
  restanteUsd: number
  /** Gasto medio por día en el periodo medido. `null` si no hay periodo. */
  usdPorDia: number | null
  /** Días que aguanta al ritmo actual. `null` si no se puede proyectar. */
  diasRestantes: number | null
  nivel: 'ok' | 'avisar' | 'critico' | 'agotado'
}

/**
 * Cuándo avisar, en DÍAS de autonomía y no en dólares.
 *
 * Un umbral en dólares no dice nada: veinte dólares son un mes para un
 * consultorio y dos días para veinte. Lo que el dueño necesita saber es cuánto
 * tiempo le queda para abonar sin que nadie se quede sin servicio.
 */
export const DIAS_AVISO = 14
export const DIAS_CRITICO = 5

export function saldoDe(
  proveedor: string,
  recargas: readonly Recarga[],
  consumo: ConsumoProveedor | null,
): SaldoProveedor {
  const cargadoUsd = recargas
    .filter(r => r.proveedor === proveedor)
    .reduce((a, r) => a + (Number.isFinite(r.montoUsd) ? r.montoUsd : 0), 0)
  const gastadoUsd = consumo?.usdGastado ?? 0
  const restanteUsd = cargadoUsd - gastadoUsd

  const dias = consumo?.diasMedidos ?? 0
  const usdPorDia = dias > 0 && gastadoUsd > 0 ? gastadoUsd / dias : null
  const diasRestantes = usdPorDia && usdPorDia > 0 ? Math.floor(restanteUsd / usdPorDia) : null

  /**
   * Sin recargas registradas NO se declara «agotado».
   *
   * Un consultorio que todavía no ha anotado ningún abono tendría `cargado = 0`
   * y saldría en rojo con el proveedor lleno de saldo. Un aviso falso enseña a
   * ignorar los avisos, que es peor que no tenerlos.
   */
  if (cargadoUsd <= 0) return { proveedor, cargadoUsd, gastadoUsd, restanteUsd, usdPorDia, diasRestantes: null, nivel: 'ok' }

  const nivel: SaldoProveedor['nivel'] =
    restanteUsd <= 0 ? 'agotado'
    : diasRestantes === null ? 'ok'
    : diasRestantes <= DIAS_CRITICO ? 'critico'
    : diasRestantes <= DIAS_AVISO ? 'avisar'
    : 'ok'

  return { proveedor, cargadoUsd, gastadoUsd, restanteUsd, usdPorDia, diasRestantes, nivel }
}

/**
 * El aviso, escrito para que se pueda actuar sin abrir nada más.
 *
 * Dice el proveedor, cuánto queda, cuántos días aguanta **y qué se rompe** si se
 * acaba. Sin lo último, un aviso de saldo se confunde con un recordatorio de
 * facturación y se pospone.
 */
export function avisoDeSaldo(s: SaldoProveedor): string | null {
  if (s.nivel === 'ok') return null
  const queSeRompe = s.proveedor === 'assemblyai'
    ? 'Si se agota, TODAS las consultas pierden la separación de voces a la vez y las notas se arman con el motor alterno.'
    : 'Si se agota, las funciones de IA dejan de responder para todos los consultorios.'
  if (s.nivel === 'agotado') {
    return `🔴 ${s.proveedor}: SALDO AGOTADO (estimado). ${queSeRompe} Abona ya.`
  }
  const icono = s.nivel === 'critico' ? '🔴' : '🟠'
  return `${icono} ${s.proveedor}: quedan ~$${s.restanteUsd.toFixed(2)} USD (estimado), `
    + `unos ${s.diasRestantes} día(s) al ritmo actual de $${(s.usdPorDia ?? 0).toFixed(2)}/día. ${queSeRompe}`
}

export const POR_QUE_SE_LLEVA_Y_NO_SE_CONSULTA =
  'La API de AssemblyAI no publica endpoint de saldo ni de consumo. Así que el ' +
  'saldo no se lee, se LLEVA: el dueño registra lo que abona y el libro de ' +
  'costos ya sabe lo que se gastó. Y eso funciona igual para los tres ' +
  'proveedores, con una sola pantalla y un solo aviso.'

export const POR_QUE_SE_LLAMA_ESTIMADO =
  'Lo consumido sale de NUESTROS asientos, no del estado de cuenta del ' +
  'proveedor: puede diferir por llamadas que no pasaron por el libro, impuestos ' +
  'o redondeos. Un saldo que se presenta como exacto y no lo es acaba dejando a ' +
  'alguien sin servicio con el tablero en verde.'

export const POR_QUE_EL_UMBRAL_ES_EN_DIAS =
  'Un umbral en dólares no dice nada: veinte dólares son un mes para un ' +
  'consultorio y dos días para veinte. Lo que hace falta saber es cuánto tiempo ' +
  'queda para abonar sin que nadie se quede sin servicio.'
