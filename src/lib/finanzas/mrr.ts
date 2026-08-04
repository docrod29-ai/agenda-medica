/**
 * EL MRR CONTABA EL PRECIO DE LISTA, NO LO QUE ENTRA CADA MES.
 *
 * ── EL HALLAZGO (N7 de la auditoría del equipo, 3-ago-2026) ──────────────────
 *
 * La consola calculaba así el ingreso recurrente de cada consultorio:
 *
 *     const mrr = activa ? precioPlan(plan) : 0
 *
 * O sea: el precio mensual de lista del plan. Dos errores, y **en direcciones
 * opuestas**, lo cual es peor que un sesgo — se compensan y el total parece
 * razonable mientras cada línea está mal.
 *
 * ── 1. EL ANUAL SE SOBRESTIMA ────────────────────────────────────────────────
 *
 * El catálogo del propio repositorio lo dice: `MESES_ANUAL = 10` — «12 meses al
 * precio de 10». Un cliente anual paga **diez** mensualidades al año, así que su
 * ingreso mensual real es `precio × 10/12`, no `precio`. Contarlo entero infla
 * su MRR un 20 %.
 *
 * Y el dato estaba ahí: el webhook guarda `ciclo: 'anual' | 'mensual'` en el
 * documento de la clínica desde que se pueden comprar anualidades. Nadie lo leía.
 *
 * ── 2. EL MULTI-MÉDICO SE SUBESTIMA ──────────────────────────────────────────
 *
 * Los asientos adicionales se cobran aparte (`MEDICO_EXTRA`), y `medicosContratados`
 * guarda cuántos cobra la suscripción. El MRR no los sumaba: un consultorio Pro
 * con tres médicos factura el plan más dos asientos, y la consola decía sólo el
 * plan.
 *
 * ── POR QUÉ SE USAN LOS CONTRATADOS Y NO LOS PRESENTES ───────────────────────
 *
 * Porque esto es **contabilidad**, no capacidad. Los médicos presentes gobiernan
 * el cupo de IA —a propósito, para no repetir el corte de v944—, pero el ingreso
 * es lo que la suscripción cobra. Contar médicos que Stripe no está cobrando
 * sería inventar ingreso: exactamente el error que este módulo viene a cerrar,
 * pero al revés.
 *
 * La fuga entre unos y otros ya tiene su propio vigilante (la conciliación
 * nocturna de asientos). Aquí se cuenta lo que entra.
 *
 * Módulo PURO. No inventa precios: todos salen del catálogo.
 */
import { PLANES, MEDICO_EXTRA, MESES_ANUAL, type ClavePlan } from '@/lib/planes-ia'
import type { NivelIA } from '@/lib/ai-keys'

export type Ciclo = 'mensual' | 'anual'

export interface EntradaMRR {
  plan: string
  /** `'anual'` si la suscripción se cobra una vez al año. */
  ciclo?: string | null
  /** Médicos que la suscripción está COBRANDO (no los presentes). */
  medicosContratados?: number | null
}

export interface DesgloseMRR {
  /** Lo que entra cada mes, prorrateado. Es la cifra que va al tablero. */
  mensual: number
  /** La parte del plan base. */
  base: number
  /** La parte de los asientos adicionales. */
  asientos: number
  /** Cuántos asientos adicionales se cobran. */
  extras: number
  ciclo: Ciclo
  /**
   * Cuánto se descuenta por pagar al año, en pesos al mes.
   *
   * Se devuelve aparte para que el tablero pueda enseñar que la diferencia con
   * el precio de lista es un descuento, no un error de cuentas.
   */
  descuentoAnual: number
}

/** El nivel de IA del plan decide el precio del asiento adicional. */
function nivelDe(plan: string): NivelIA | null {
  return PLANES[plan as ClavePlan]?.nivelIA ?? null
}

/**
 * Ingreso recurrente MENSUAL de un consultorio, prorrateado y con asientos.
 *
 * Un plan que no existe en el catálogo vale 0: es lo mismo que hacía antes
 * `precioPlan`, y suponer un precio para una clave desconocida sería inventar
 * ingreso.
 */
export function mrrDe(e: EntradaMRR): DesgloseMRR {
  const p = PLANES[e.plan as ClavePlan]
  const ciclo: Ciclo = e.ciclo === 'anual' ? 'anual' : 'mensual'
  if (!p) return { mensual: 0, base: 0, asientos: 0, extras: 0, ciclo, descuentoAnual: 0 }

  const nivel = nivelDe(e.plan)
  const porAsiento = nivel ? MEDICO_EXTRA[nivel].precioMXN : 0

  /**
   * El primer médico va incluido en el plan. `medicosContratados` cuenta el
   * total, así que los adicionales son uno menos — y nunca negativo: un
   * documento viejo sin el campo vale 1, no 0.
   */
  const contratados = Math.max(1, Math.floor(Number(e.medicosContratados ?? 1)) || 1)
  const extras = Math.max(0, contratados - 1)

  const listaBase = p.precioMXN
  const listaAsientos = extras * porAsiento
  const listaTotal = listaBase + listaAsientos

  // Anual = 12 meses al precio de MESES_ANUAL. El factor sale del catálogo.
  const factor = ciclo === 'anual' ? MESES_ANUAL / 12 : 1
  const base = listaBase * factor
  const asientos = listaAsientos * factor

  return {
    mensual: Math.round(base + asientos),
    base: Math.round(base),
    asientos: Math.round(asientos),
    extras,
    ciclo,
    descuentoAnual: Math.round(listaTotal - (base + asientos)),
  }
}

export const POR_QUE_EL_ANUAL_NO_VALE_EL_PRECIO_DE_LISTA =
  'El catálogo dice MESES_ANUAL = 10: doce meses al precio de diez. Un cliente ' +
  'anual paga diez mensualidades al año, así que contar el precio de lista ' +
  'infla su ingreso mensual un 20 %.'

export const POR_QUE_CONTRATADOS_Y_NO_PRESENTES =
  'Esto es contabilidad, no capacidad. Los médicos presentes gobiernan el cupo ' +
  'de IA a propósito; el ingreso es lo que la suscripción cobra. Contar médicos ' +
  'que Stripe no cobra sería inventar ingreso — el mismo error, al revés.'
