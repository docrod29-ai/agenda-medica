/**
 * COST LEDGER — lo que cuesta cada operación variable.
 *
 * Master Loop V3 §W. Y el P0-1 de la auditoría de fase 0: hasta hoy
 * `registrarUso()` contaba LLAMADAS, no tokens, así que el costo real de
 * Ausculta era literalmente desconocido y ninguna de las catorce cifras de §BG
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

/**
 * De dónde salió la llave, que decide de quién es el costo.
 *
 * **Definición canónica.** `ClaveResuelta['fuente']` en `ai-keys.ts` es este
 * mismo tipo, importado: antes eran dos uniones escritas a mano con los mismos
 * tres valores, y el día que a una le creció `'fundador'` la otra no se enteró.
 * El compilador lo cazó, pero sólo porque los valores se cruzan por un
 * parámetro; una divergencia entre dos listas que nunca se tocan pasa callada.
 *
 * La dirección de la dependencia es a propósito: este módulo es PURO, así que
 * puede ser la fuente de verdad de un módulo de servidor sin arrastrarlo.
 */
export type FuenteLlave = 'clinica' | 'fundador' | 'prueba' | 'ninguna'

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
  /**
   * La traza que viene del navegador del médico (WS-13). NO es `requestId`: éste
   * lleva el proveedor pegado porque cada intento se cobra aparte, y una traza
   * necesita ser la MISMA de punta a punta. Opaca por forma: sin uid ni PHI.
   */
  correlacion?: string
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
  /** La traza del navegador (WS-13). Ver `EventoCosto.correlacion`. */
  correlacion?: string
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
  /**
   * Los dos caminos dicen lo mismo y por eso se aceptan los dos, en OR.
   *
   * `fuente === 'fundador'` sale de resolver el uid contra Firebase Auth, y esa
   * resolución falla CERRADO: si Auth no responde, el dueño llega aquí como
   * `'prueba'`. El booleano viene del correo verificado del token, que el
   * llamador ya tiene en la mano.
   *
   * Preferir el OR sobre elegir uno es deliberado: el error caro en esta función
   * es clasificar el gasto de I+D del dueño como COGS —§CD: infla el costo de
   * servir y las decisiones de precio salen mal— y no al revés.
   */
  return (fuente === 'fundador' || esFundador) ? 'rnd' : 'customer'
}

/** Convierte una llamada en un asiento del libro. */
export function asiento(e: EntradaLedger): EventoCosto {
  // La FECHA de la llamada decide la tarifa: hay precios de introducción con
  // caducidad (Sonnet 5, $2/$10 hasta el 31-ago-2026). Sin ella, un asiento de
  // agosto se valoraría con el precio de septiembre.
  const c = costoUsd(e.modelo, e.uso, e.ts)
  return {
    requestId: e.requestId,
    /* Si no se copia aquí, el asiento se escribe sin traza y todo lo anterior no
       sirve de nada: es el paso donde este dato se pierde. */
    ...(e.correlacion ? { correlacion: e.correlacion } : {}),
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
  /**
   * ── EL P99, QUE YA EXISTÍA AL LADO — REG-417 ─────────────────────────────
   *
   * El censo decía «no hay p99 en ningún sitio del repositorio», y era falso:
   * `observabilidad/latencias.ts` lo calcula desde hace tiempo sobre los asientos
   * de este mismo libro. Lo que faltaba aquí era exponerlo en el resumen del
   * libro de costos, y sobre todo que las dos cifras salieran del MISMO cálculo.
   *
   * Para el desglose por función y por modelo manda `latencias.ts` —`porFeature`,
   * `porModelo`—, que además da `n` y `max`. Aquí sólo se resume la tanda.
   */
  latenciaP99: number | null
  /** Cuántas llamadas midieron latencia. Sin esto, un percentil no se puede leer. */
  muestrasDeLatencia: number
  /**
   * ── LA TASA DE ERROR, QUE YA SE REGISTRABA Y NADIE SUMABA ────────────────
   *
   * `EventoCosto.fallo` existe desde que existe el libro —«un fallo cuesta
   * tokens igual»— y sólo se usaba para no contar consultas fallidas. La cifra
   * que dice si una función está rota nunca se calculaba.
   */
  fallos: number
  /** Fracción de llamadas que fallaron. `null` sin llamadas: dividir entre cero no es 0. */
  tasaDeFallo: number | null
}

/**
 * ── HAY DOS PERCENTILES EN EL ÁRBOL, Y ES UNA DECISIÓN PENDIENTE — REG-417 ──
 *
 * Éste calcula por **rango más cercano**: devuelve siempre una muestra que
 * ocurrió de verdad. `src/lib/observabilidad/latencias.ts` calcula por
 * **interpolación lineal**, sobre los asientos de este mismo libro. No dan lo
 * mismo — con veinte muestras de 100 a 290 ms:
 *
 *     p50: 190 aquí,  195 allí
 *     p95: 280 aquí,  280.5 allí
 *     p99: 290 aquí,  288.1 allí
 *
 * **Ninguno de los dos métodos está mal**, y los dos están razonados y probados:
 * aquí, porque «con pocas muestras interpolar sugiere una precisión que no hay»
 * y porque un p95 que señala una llamada REAL es más fácil de defender ante el
 * médico que la sufrió; allí, porque interpola suave y `percentil([0, 10], 0.5)`
 * da 5 en vez de 0, que se lee mejor.
 *
 * Lo que está mal es que existan los dos sin que nadie lo haya decidido: dos
 * tableros del mismo periodo enseñan cifras distintas y las dos parecen ciertas.
 *
 * **NO se unifica aquí por iniciativa propia**: la cifra sale en el tablero de
 * costos que mira el dueño, y elegir método cambia números que él ya ha visto.
 * Es una decisión de qué se reporta, no de cómo se programa. Queda anotada en
 * los dos archivos y en el censo (`WS-12.p99`) para que ninguno de los dos se
 * edite sin ver al otro, y su guardián comprueba que las dos notas siguen ahí.
 */
const percentil = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
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
    latenciaP99: percentil(lat, 99),
    muestrasDeLatencia: lat.length,
    fallos: eventos.filter(e => e.fallo).length,
    tasaDeFallo: eventos.length > 0
      ? Number((eventos.filter(e => e.fallo).length / eventos.length).toFixed(4))
      : null,
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
 * ── LA CADENA DE UNA CONSULTA DICTADA ────────────────────────────────────────
 *
 * Las funciones que corren cuando el médico dicta una consulta de principio a
 * fin. No es una lista nueva: es la que ya estaba escrita en el módulo del tope
 * de cortesía —«una consulta dictada gasta ~4 usos: transcribir + procesar +
 * verificar-nota + evidencia»—, más las que se le añadieron después.
 *
 * Se declara AQUÍ y en un solo sitio porque si dos partes del sistema cuentan
 * «lo que cuesta una consulta» con listas distintas, las dos cifras serán
 * plausibles y una estará mal.
 */
export const CADENA_CONSULTA: readonly string[] = [
  'transcribir', 'transcribir-diarizado', 'transcribir-chunk', 'transcripcion',
  'corregir-transcripcion', 'atribuir-roles',
  'nota-consulta', 'verificar-nota', 'evidencia', 'extraer-entidades', 'entidades',
]

/**
 * Las funciones que marcan **una consulta**: la transcripción final.
 *
 * Se cuenta por aquí y no por la nota porque la nota se re-genera sola cada
 * ~30 segundos mientras se graba —la «nota en vivo»—, así que contar notas
 * contaría una consulta muchas veces. La transcripción final ocurre al detener.
 */
export const MARCAN_CONSULTA: readonly string[] = ['transcribir', 'transcribir-diarizado', 'transcripcion']

export interface CostoPorConsulta {
  /** Cuántas consultas dictadas se detectaron. */
  consultas: number
  /** USD de toda la cadena, sólo lo que tiene tarifa. */
  totalUsd: number
  /** USD por consulta. `null` si no hubo ninguna: dividir entre cero no es 0. */
  usdPorConsulta: number | null
  /** Llamadas de la cadena que se quedaron sin tarifa. */
  sinTarifa: number
  /** Lo que hay que saber para leer la cifra sin equivocarse. */
  supuesto: string
}

/**
 * Cuánto cuesta de IA una consulta dictada, en promedio.
 *
 * @param eventos los asientos del periodo (ya filtrados a COGS si se quiere).
 */
export function costoPorConsulta(eventos: readonly EventoCosto[]): CostoPorConsulta {
  const cadena = eventos.filter(e => CADENA_CONSULTA.includes(e.feature))
  const consultas = eventos.filter(e => MARCAN_CONSULTA.includes(e.feature) && !e.fallo).length
  const r = resumir(cadena)
  return {
    consultas,
    totalUsd: r.totalUsd,
    usdPorConsulta: consultas > 0 ? Number((r.totalUsd / consultas).toFixed(6)) : null,
    sinTarifa: r.sinTarifa,
    supuesto:
      'Una consulta = una transcripción final. Un dictado grabado en dos tandas ' +
      'cuenta como dos, y una consulta escrita a mano no cuenta como ninguna.',
  }
}

export const POR_QUE_NO_SE_CUENTAN_NOTAS =
  'La nota se re-genera sola cada ~30 segundos mientras se graba —la nota en ' +
  'vivo—, así que contar notas contaría una consulta muchas veces. La ' +
  'transcripción final ocurre una vez, al detener.'

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
