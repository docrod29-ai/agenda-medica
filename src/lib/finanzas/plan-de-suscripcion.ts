/**
 * DE QUÉ PLAN ES UNA SUSCRIPCIÓN DE STRIPE.
 *
 * ── EL FALLO QUE ESTO CIERRA: LA ANUAL SE LEÍA COMO OTRO PLAN ────────────────
 *
 * El webhook deducía el plan comparando el importe cobrado contra una tabla de
 * centavos **de plan MENSUAL**, con un margen de ±15 %. Una suscripción ANUAL
 * cobra el año entero de una vez, así que el importe de la anual de un plan
 * barato cae de lleno en el rango del mensual de un plan caro:
 *
 *   Agenda anual (12 meses al precio de 10 = 349 000 ¢) → «cerca de 349 900 ¢»
 *   → se deducía **hospital**.
 *
 * Y desde que «manda el precio, no el metadato» —correcto para el caso que ese
 * cambio resolvía: la baja de plan hecha desde el portal de Stripe— esa
 * deducción equivocada **pisa el metadato correcto**. El cliente que paga Agenda
 * al año se queda con Hospital: módulos que no compró y la llave de IA cara del
 * dueño. En el sentido contrario, un Hospital anual (importe fuera de todo
 * rango) no deduce nada y sí conserva su plan — el daño va sólo hacia arriba,
 * pero va.
 *
 * ── LA REGLA: PRIMERO LO EXACTO, DESPUÉS LO DEDUCIBLE, NUNCA LO ADIVINADO ────
 *
 *  1. **El price id.** Es una igualdad, no una estimación: si el precio que
 *     Stripe está cobrando es uno de los configurados —mensual o anual—, el plan
 *     se sabe con certeza y no hay nada que deducir.
 *  2. **El importe, sólo si el ciclo es MENSUAL.** La tabla de centavos es
 *     mensual por construcción; aplicarla a un cobro anual es comparar dos cosas
 *     distintas. Con cualquier otro intervalo no se deduce.
 *  3. **El metadato**, que se escribe en el checkout y nadie actualiza después.
 *  4. Y si nada de eso resuelve, **no se toca el plan**.
 *
 * Módulo PURO: no habla con Stripe ni con Firestore.
 */

/** Las claves de plan, tal como las usa el resto de la aplicación. */
export type ClavePlan = 'agenda' | 'clinica' | 'premium' | 'hospital'

export const CLAVES_PLAN: readonly ClavePlan[] = ['agenda', 'clinica', 'premium', 'hospital']

export const esClavePlan = (p: unknown): p is ClavePlan =>
  typeof p === 'string' && (CLAVES_PLAN as readonly string[]).includes(p)

/**
 * Importes MENSUALES de lista, en centavos.
 *
 * Son los precios comerciales que ya vivían en el webhook; aquí no se inventa
 * ninguno ni se derivan los anuales a partir de ellos: el precio anual es el que
 * el dueño configure en Stripe, y se reconoce por su price id, no por su cifra.
 */
export const IMPORTE_MENSUAL: Record<ClavePlan, number> = {
  agenda: 34_900,
  clinica: 89_900,
  premium: 159_000,
  hospital: 349_900,
}

/** Margen para promociones y prorrateos. Fuera de él no se afirma nada. */
const MARGEN = 0.15

export type ComoSeDedujo = 'price-id' | 'importe-mensual' | 'metadato' | 'sin-resolver'

export interface PlanDeducido {
  plan: ClavePlan | null
  como: ComoSeDedujo
}

export interface EntradaSuscripcion {
  /** El price id que Stripe está cobrando. */
  priceId?: string | null
  /** Importe del ítem, en centavos. */
  importe?: number | null
  /** `month`, `year`… tal como lo manda Stripe. */
  intervalo?: string | null
  /** Cuántos intervalos por periodo (2 = bimestral). */
  intervalos?: number | null
  /** Lo que dijo el checkout, hace meses. */
  metadatoPlan?: unknown
  /** price id → plan, de la configuración: mensuales Y anuales. */
  preciosConocidos: Readonly<Record<string, ClavePlan>>
}

/** El plan de una suscripción, y por qué camino se supo. */
export function planDeSuscripcion(e: EntradaSuscripcion): PlanDeducido {
  // 1. Igualdad exacta contra lo configurado. No hay nada que deducir.
  const porId = e.preciosConocidos[String(e.priceId ?? '')]
  if (porId) return { plan: porId, como: 'price-id' }

  // 2. El importe, y SÓLO si el cobro es mensual: la tabla es mensual.
  if (esMensual(e.intervalo, e.intervalos)) {
    const importe = Number(e.importe ?? 0)
    const porImporte = CLAVES_PLAN.find(p =>
      importe >= IMPORTE_MENSUAL[p] * (1 - MARGEN) &&
      importe <= IMPORTE_MENSUAL[p] * (1 + MARGEN))
    if (porImporte) return { plan: porImporte, como: 'importe-mensual' }
  }

  // 3. La nota que dejó el checkout.
  if (esClavePlan(e.metadatoPlan)) return { plan: e.metadatoPlan, como: 'metadato' }

  // 4. No se sabe, y eso se dice.
  return { plan: null, como: 'sin-resolver' }
}

/**
 * ¿El cobro es de un mes exacto?
 *
 * Si Stripe no manda intervalo se ASUME mensual: es lo que hacía el webhook
 * antes de existir este módulo, y todas las suscripciones que hay hoy son
 * mensuales. Lo que no se asume es lo contrario —tratar una anual como mensual—,
 * que es el fallo que esto viene a cerrar.
 */
function esMensual(intervalo?: string | null, intervalos?: number | null): boolean {
  const i = String(intervalo ?? '').trim()
  if (i !== '' && i !== 'month') return false
  const n = Number(intervalos ?? 1)
  return !Number.isFinite(n) || n === 1
}

export const POR_QUE_NO_SE_DEDUCE_LA_ANUAL =
  'Porque la tabla de importes es MENSUAL: la anual de un plan barato cae en el ' +
  'rango del mensual de uno caro. Agenda al año se leía como Hospital, y desde ' +
  'que manda el precio sobre el metadato, esa lectura le daba módulos que no ' +
  'compró. El price id sí es exacto; el importe anual no dice nada.'
