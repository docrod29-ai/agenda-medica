/**
 * COST LEDGER — lo que cuesta cada operación variable.
 *
 * Master Loop V3 §W. Y el P0-1 de la auditoría de fase 0: hasta hoy
 * `registrarUso()` contaba LLAMADAS, no tokens, así que el costo real de
 * NexusMED era literalmente desconocido y ninguna de las catorce cifras de §BG
 * se podía calcular.
 *
 * ── LO QUE ESTE MÓDULO NO GUARDA ─────────────────────────────────────────────
 *
 * **Nada clínico.** §AZ lo exige y aquí es literal: se registran tokens,
 * modelo, latencia y costo. No entra el prompt, ni la respuesta, ni el
 * `patientId`, ni el nombre de nadie. Un libro de costos no necesita saber de
 * qué paciente se hablaba, y mezclarlo convertiría el registro financiero —que
 * se consulta para cuadrar dinero— en otro sitio donde vive el expediente.
 *
 * El `feature` sí se guarda («nota», «copilot-uci»): dice qué se cobró sin decir
 * de quién se hablaba.
 *
 * ── COSTO NULO ≠ COSTO CERO ──────────────────────────────────────────────────
 *
 * Cuando el modelo no tiene tarifa cargada, el costo va `null` y el evento
 * queda marcado `sin_tarifa`. Nunca `0`: un cero se suma en los totales y hace
 * pasar por gratis lo que sólo es desconocido. El dashboard tiene que poder
 * decir «de estas 300 llamadas, 40 no sé cuánto costaron».
 *
 * Módulo PURO. La escritura vive en `cost-ledger-server.ts`.
 */

import { costoUsd, type Uso } from '@/lib/finanzas/precios-modelo'

/** De dónde salió la llave, que decide de quién es el costo. */
export type FuenteLlave = 'clinica' | 'prueba' | 'ninguna'

/**
 * A quién se le carga el gasto.
 *
 * §CD lo exige y no es un detalle contable: si el gasto que el fundador genera
 * PROBANDO UCI se atribuye al margen de los usuarios de Consulta, las unit
 * economics dejan de ser reales y las decisiones de precio salen mal.
 */
export type ClaseCosto =
  /** Uso de un consultorio de pago. Entra en COGS. */
  | 'customer'
  /** El fundador probando módulos internos. Es I+D, no COGS. */
  | 'rnd'
  /** El consultorio paga su propia API: no nos cuesta. */
  | 'llave_propia'

export interface EventoCosto {
  /** Identificador de la petición, para poder cruzar con los logs. */
  requestId: string
  clinicId: string | null
  /** uid del médico. Nunca el nombre. */
  uid: string | null
  /** Qué se hizo: `nota`, `copilot-uci`, `transcribir`, `antibiograma-vision`… */
  feature: string
  proveedor: string
  modelo: string
  entrada: number
  salida: number
  entradaCache: number
  /** Milisegundos de la llamada. §N mide latencia con esto. */
  latenciaMs: number
  /** USD. `null` cuando el modelo no tiene tarifa cargada. */
  costoUsd: number | null
  /** Por qué no hay costo. */
  motivoSinCosto?: 'sin_tarifa' | 'sin_uso'
  /** Créditos cobrados al consultorio por esta operación. */
  creditos: number
  clase: ClaseCosto
  /** ISO-8601. Se pasa: nada de relojes escondidos en un registro contable. */
  ts: string
  /** `true` si la llamada falló. Un fallo cuesta tokens igual. */
  fallo?: boolean
}

export interface EntradaLedger {
  requestId: string
  clinicId: string | null
  uid: string | null
  feature: string
  proveedor: string
  modelo: string
  uso: Uso
  latenciaMs: number
  creditos: number
  fuente: FuenteLlave
  /** ¿El que ejecuta es el dueño probando módulos internos? */
  esFundador?: boolean
  fallo?: boolean
  ts: string
}

/**
 * Decide a quién se carga el gasto.
 *
 * Con llave propia del consultorio, el costo NO es nuestro: paga su API. Meterlo
 * en COGS inflaría el costo y haría ver un margen peor del real.
 */
export function claseDe(fuente: FuenteLlave, esFundador?: boolean): ClaseCosto {
  if (fuente === 'clinica') return 'llave_propia'
  return esFundador ? 'rnd' : 'customer'
}

/** Convierte una llamada en un asiento del libro. */
export function asiento(e: EntradaLedger): EventoCosto {
  const c = costoUsd(e.modelo, e.uso)
  return {
    requestId: e.requestId,
    clinicId: e.clinicId,
    uid: e.uid,
    feature: e.feature,
    proveedor: e.proveedor,
    modelo: e.modelo,
    entrada: Math.max(0, e.uso.entrada || 0),
    salida: Math.max(0, e.uso.salida || 0),
    entradaCache: Math.max(0, e.uso.entradaCache || 0),
    latenciaMs: Math.max(0, e.latenciaMs || 0),
    costoUsd: c.usd,
    ...(c.motivo ? { motivoSinCosto: c.motivo } : {}),
    creditos: e.creditos,
    clase: claseDe(e.fuente, e.esFundador),
    ts: e.ts,
    ...(e.fallo ? { fallo: true } : {}),
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Agregados — lo que el dashboard necesita
   ════════════════════════════════════════════════════════════════════════ */

export interface ResumenCosto {
  llamadas: number
  /** Sólo las que SÍ tienen tarifa. Los totales nunca mezclan lo desconocido. */
  conCosto: number
  sinTarifa: number
  totalUsd: number
  tokensEntrada: number
  tokensSalida: number
  creditos: number
  /** Modelos vistos sin tarifa cargada. Es la lista de deberes. */
  modelosSinTarifa: string[]
  latenciaP50: number | null
  latenciaP95: number | null
}

const percentil = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  // Índice por el método del más cercano: con pocas muestras interpolar sugiere
  // una precisión que no hay.
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))]
}

/**
 * Resume una tanda de asientos.
 *
 * `totalUsd` suma **sólo** lo que tiene tarifa, y `sinTarifa` dice cuántos
 * quedaron fuera. Sumar los desconocidos como cero daría un total que parece
 * completo y no lo está.
 */
export function resumir(eventos: readonly EventoCosto[]): ResumenCosto {
  const conCosto = eventos.filter(e => e.costoUsd != null)
  const lat = eventos.map(e => e.latenciaMs).filter(x => x > 0)
  return {
    llamadas: eventos.length,
    conCosto: conCosto.length,
    sinTarifa: eventos.filter(e => e.motivoSinCosto === 'sin_tarifa').length,
    totalUsd: Number(conCosto.reduce((s, e) => s + (e.costoUsd ?? 0), 0).toFixed(6)),
    tokensEntrada: eventos.reduce((s, e) => s + e.entrada + e.entradaCache, 0),
    tokensSalida: eventos.reduce((s, e) => s + e.salida, 0),
    creditos: Number(eventos.reduce((s, e) => s + e.creditos, 0).toFixed(2)),
    modelosSinTarifa: [...new Set(eventos.filter(e => e.motivoSinCosto === 'sin_tarifa').map(e => e.modelo))],
    latenciaP50: percentil(lat, 50),
    latenciaP95: percentil(lat, 95),
  }
}

/** Sólo lo que es COGS de cliente: fuera I+D del fundador y llaves propias. */
export function soloCogs(eventos: readonly EventoCosto[]): EventoCosto[] {
  return eventos.filter(e => e.clase === 'customer')
}

/** Agrupa por lo que se quiera mirar: feature, modelo, clinicId… */
export function porClave(
  eventos: readonly EventoCosto[],
  clave: (e: EventoCosto) => string,
): { clave: string; resumen: ResumenCosto }[] {
  const m = new Map<string, EventoCosto[]>()
  for (const e of eventos) {
    const k = clave(e) || '(sin clave)'
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(e)
  }
  return [...m.entries()]
    .map(([k, xs]) => ({ clave: k, resumen: resumir(xs) }))
    .sort((a, b) => b.resumen.totalUsd - a.resumen.totalUsd)
}

/**
 * ¿Se puede afirmar el costo de esta tanda?
 *
 * §Y: «si no existe información suficiente, INSUFFICIENT_DATA. Nunca inventar.»
 * Un total calculado sobre la mitad de las llamadas no es un total.
 */
export function suficiente(r: ResumenCosto, minimoCobertura = 0.9): boolean {
  return r.llamadas > 0 && r.conCosto / r.llamadas >= minimoCobertura
}

export const POR_QUE_NO_HAY_PHI =
  'El libro de costos guarda tokens, modelo, latencia y precio. No el prompt, ni ' +
  'la respuesta, ni el paciente. Un registro financiero se consulta para cuadrar ' +
  'dinero, y meterle el expediente lo convertiría en otro sitio donde vive el ' +
  'dato clínico — con otras reglas, otros lectores y otra retención.'
