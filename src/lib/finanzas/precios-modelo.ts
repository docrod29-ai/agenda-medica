/**
 * PRECIO POR TOKEN DE CADA MODELO — configurable, nunca inventado.
 *
 * ── LA REGLA QUE ORDENA ESTE ARCHIVO ─────────────────────────────────────────
 *
 * Los proveedores publican sus tarifas y **las cambian**. Escribir aquí un número
 * «de memoria» produciría un dashboard financiero que parece exacto y miente, y
 * el Master Loop V3 lo prohíbe en dos sitios (§Y «nunca inventar», §V «no fijar
 * margen sin conocer costos reales»).
 *
 * Así que este archivo **nace vacío a propósito**. Cada tarifa se carga desde la
 * página de precios del proveedor, con la fecha en que se consultó. Mientras un
 * modelo no tenga tarifa:
 *
 *   · los TOKENS se registran igual — son un hecho que devuelve la API;
 *   · el COSTO sale `null` y el evento queda marcado `sin_tarifa`.
 *
 * Un hueco declarado se llena. Una cifra inventada se cita, se copia a una
 * proyección, y acaba sosteniendo una decisión de precio.
 *
 * Módulo PURO.
 */

/** Tarifa de un modelo, en USD por MILLÓN de tokens. */
export interface TarifaModelo {
  /** Id del modelo tal como lo devuelve el proveedor. */
  modelo: string
  proveedor: 'anthropic' | 'openai' | 'otro'
  /** USD por millón de tokens de entrada. */
  entradaUsdPorMillon: number
  /** USD por millón de tokens de salida. */
  salidaUsdPorMillon: number
  /** USD por millón de tokens de entrada servidos desde caché. Opcional. */
  entradaCacheUsdPorMillon?: number
  /**
   * USD por MINUTO de audio. Sólo para modelos de transcripción.
   *
   * ── POR QUÉ HAY DOS UNIDADES EN LA MISMA TABLA ───────────────────────────
   *
   * La transcripción **no se cobra por token, se cobra por minuto**: Whisper y
   * `gpt-4o-transcribe` van a $0.006 el minuto. Un motor que sólo sabe de
   * tokens no puede representar eso, y el resultado era que el audio no
   * aparecía en ningún lado — con cada consulta dictada, probablemente el
   * renglón más grande del consultorio.
   *
   * Se resuelve con un campo más y no con una tabla aparte porque el ledger ya
   * indexa por `modelo`: dos tablas obligarían a cada llamador a saber de
   * antemano qué clase de modelo está usando, y ésa es exactamente la clase de
   * decisión que se olvida en una ruta nueva.
   */
  usdPorMinuto?: number
  /**
   * PRECIO PROMOCIONAL CON FECHA DE CADUCIDAD.
   *
   * Sonnet 5 está a $2/$10 de introducción hasta el 31-ago-2026, y después pasa
   * a $3/$15. El motor no sabía de vigencias, así que la tabla llevaba el precio
   * de LISTA: el costo salía por encima del real y el margen se veía peor de lo
   * que es — justo al revés del error habitual, pero igual de malo para decidir
   * a cuánto vender el crédito.
   *
   * Se modela como una ventana con fecha en vez de cambiar el número porque las
   * dos cosas son verdad, cada una en su periodo: una nota de agosto costó $2 y
   * una de septiembre costará $3. Sin la fecha, corregirlo hoy rompería el
   * histórico, y no corregirlo rompe el presente.
   */
  promocion?: {
    entradaUsdPorMillon: number
    salidaUsdPorMillon: number
    entradaCacheUsdPorMillon?: number
    /** ISO. Último día INCLUIDO en la promoción. */
    hasta: string
    fuente: string
  }
  /** De dónde salió y cuándo se miró. Sin esto la tarifa no se acepta. */
  fuente: string
  /** ISO. La tarifa se revisa periódicamente: los proveedores las cambian. */
  consultado: string
}

/**
 * Tarifas cargadas — 31-jul-2026, leídas de la página de cada proveedor.
 *
 * Nació vacío a propósito y se llenó con la regla intacta: cada cifra viene de
 * la página del proveedor, con su URL y la fecha en que se miró. Ninguna se
 * dedujo, se recordó ni se promedió.
 *
 * Para añadir un modelo: entrar a la página de precios, copiar la tarifa del id
 * EXACTO que se usa, y poner `fuente` y `consultado`. Sin las dos, un test lo
 * rechaza. Un modelo sin tarifa registra sus tokens igual y deja el costo en
 * `null`, marcado `sin_tarifa` — nunca `$0`.
 *
 * **Los proveedores cambian precios.** `consultado` existe para que se note
 * cuándo esta tabla envejeció.
 */
const FUENTE_ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/models/overview'
const FUENTE_OPENAI = 'https://developers.openai.com/api/docs/pricing'
const CONSULTADO = '2026-07-31'

export const TARIFAS: readonly TarifaModelo[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  { modelo: 'claude-opus-4-8', proveedor: 'anthropic', entradaUsdPorMillon: 5, salidaUsdPorMillon: 25, entradaCacheUsdPorMillon: 0.5, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO },
  { modelo: 'claude-opus-5', proveedor: 'anthropic', entradaUsdPorMillon: 5, salidaUsdPorMillon: 25, entradaCacheUsdPorMillon: 0.5, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO },
  /**
   * Sonnet 5 va al PRECIO DE LISTA, no al de lanzamiento.
   *
   * Anthropic cobra hoy $2/$10 como promoción y sube a $3/$15 el 1-sep-2026.
   * Es el modelo más usado de la app (16 sitios), y este motor no sabe de
   * fechas de vigencia.
   *
   * Cargar el precio promocional dejaría el tablero exacto hoy y **mintiendo en
   * silencio desde septiembre**, justo cuando empiece a haber clientes. Con el
   * de lista pasa lo contrario: hoy el margen se ve PEOR de lo que es, y en
   * septiembre queda exacto sin que nadie tenga que acordarse de nada.
   *
   * Equivocarse hacia el margen pesimista no produce una mala decisión de
   * precio. Hacia el optimista, sí.
   */
  // Lista $3/$15; introducción $2/$10 hasta el 31-ago-2026 inclusive. Las dos
  // cifras están en la misma página del proveedor.
  { modelo: 'claude-sonnet-5', proveedor: 'anthropic', entradaUsdPorMillon: 3, salidaUsdPorMillon: 15, entradaCacheUsdPorMillon: 0.3, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO,
    promocion: { entradaUsdPorMillon: 2, salidaUsdPorMillon: 10, entradaCacheUsdPorMillon: 0.2, hasta: '2026-08-31', fuente: FUENTE_ANTHROPIC } },
  { modelo: 'claude-sonnet-4-6', proveedor: 'anthropic', entradaUsdPorMillon: 3, salidaUsdPorMillon: 15, entradaCacheUsdPorMillon: 0.3, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO },
  { modelo: 'claude-sonnet-4-5', proveedor: 'anthropic', entradaUsdPorMillon: 3, salidaUsdPorMillon: 15, entradaCacheUsdPorMillon: 0.3, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO },
  { modelo: 'claude-haiku-4-5', proveedor: 'anthropic', entradaUsdPorMillon: 1, salidaUsdPorMillon: 5, entradaCacheUsdPorMillon: 0.1, fuente: FUENTE_ANTHROPIC, consultado: CONSULTADO },

  // ── OpenAI: texto ────────────────────────────────────────────────────────
  /**
   * OJO CON LA CACHÉ: aquí la proporción NO es la de Anthropic.
   *
   * En Anthropic la lectura de caché es 0.1× la entrada en todos los modelos, y
   * es tentador dar por hecho que en OpenAI pasa igual. No pasa: `gpt-5` sí va a
   * 0.1× ($0.125 sobre $1.25), pero `gpt-4o` va a **0.5×** ($1.25 sobre $2.50).
   *
   * Deducir la proporción en vez de leerla habría metido un error de 5× en
   * gpt-4o. Las dos cifras están verificadas en la página de precios, y por eso
   * se leen una por una en lugar de calcularse.
   */
  { modelo: 'gpt-5', proveedor: 'openai', entradaUsdPorMillon: 1.25, salidaUsdPorMillon: 10, entradaCacheUsdPorMillon: 0.125, fuente: FUENTE_OPENAI, consultado: CONSULTADO },
  { modelo: 'gpt-4o', proveedor: 'openai', entradaUsdPorMillon: 2.5, salidaUsdPorMillon: 10, entradaCacheUsdPorMillon: 1.25, fuente: FUENTE_OPENAI, consultado: CONSULTADO },

  // ── OpenAI: transcripción — POR MINUTO, no por token ─────────────────────
  // Los tres llevan las tarifas de token en 0 a propósito: el cobro real es por
  // minuto de audio. Poner aquí una cifra por token sería inventar.
  { modelo: 'whisper-1', proveedor: 'openai', entradaUsdPorMillon: 0, salidaUsdPorMillon: 0, usdPorMinuto: 0.006, fuente: FUENTE_OPENAI, consultado: CONSULTADO },
  { modelo: 'gpt-4o-transcribe', proveedor: 'openai', entradaUsdPorMillon: 0, salidaUsdPorMillon: 0, usdPorMinuto: 0.006, fuente: FUENTE_OPENAI, consultado: CONSULTADO },
  { modelo: 'gpt-4o-mini-transcribe', proveedor: 'openai', entradaUsdPorMillon: 0, salidaUsdPorMillon: 0, usdPorMinuto: 0.003, fuente: FUENTE_OPENAI, consultado: CONSULTADO },
]

/**
 * LA CACHÉ DE ANTHROPIC, CARGADA — y por qué importa aquí.
 *
 * La lectura de caché cuesta **0.1× la entrada** (verificado en la página de
 * precios, 31-jul-2026). Sin esta tarifa se cobraba al precio de entrada
 * COMPLETO: un error de 10× sobre los tokens cacheados.
 *
 * Y no es un detalle: el prompt del sistema de la nota va con `cache_control`,
 * así que **desde la segunda nota casi toda la entrada es lectura de caché**.
 * El renglón más grande del costo de texto se estaba contando diez veces más
 * caro de lo que vale.
 *
 * OpenAI también está cargada, y con una lección: **su proporción no es la
 * misma**. `gpt-5` va a 0.1× como Anthropic, pero `gpt-4o` va a 0.5×. Deducirla
 * de la regla de Anthropic habría metido un error de 5× en gpt-4o — la razón
 * exacta por la que cada cifra se lee de su página en vez de calcularse.
 */
export const POR_QUE_LA_CACHE_ESTABA_INFLANDO_EL_COSTO =
  'La lectura de caché cuesta una fracción de la entrada. Sin su tarifa se ' +
  'cobraba completa, y como el prompt de la nota va cacheado, desde la segunda ' +
  'nota casi toda la entrada es caché: el renglón grande del costo de texto ' +
  'salía muy por encima de lo que vale. Y la fracción NO es la misma en los dos ' +
  'proveedores: 0.1x en Anthropic y en gpt-5, pero 0.5x en gpt-4o.'

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Busca la tarifa de un modelo.
 *
 * Coincidencia exacta primero; después por prefijo, porque los proveedores
 * devuelven ids con sufijo de fecha (`claude-haiku-4-5-20251001`) mientras la
 * tarifa se publica por familia. El prefijo se acepta sólo si es **inequívoco**:
 * si dos tarifas casan, no se elige ninguna.
 */
export function tarifaDe(modelo: string): TarifaModelo | null {
  if (!modelo?.trim()) return null
  const m = norm(modelo)
  const exacta = TARIFAS.find(t => norm(t.modelo) === m)
  if (exacta) return exacta
  const porPrefijo = TARIFAS.filter(t => m.startsWith(norm(t.modelo)))
  return porPrefijo.length === 1 ? porPrefijo[0] : null
}

export interface Uso {
  entrada: number
  salida: number
  /** Entrada servida desde caché, si el proveedor la reporta aparte. */
  entradaCache?: number
  /**
   * Minutos de audio transcritos. La transcripción se cobra por minuto, no por
   * token: sin este campo el gasto de dictado no existía para el motor.
   */
  minutosAudio?: number
}

export interface CostoCalculado {
  usd: number | null
  /** Por qué no hay costo, cuando `usd` es null. */
  motivo?: 'sin_tarifa' | 'sin_uso'
  tarifa: TarifaModelo | null
}

/**
 * La tarifa que estaba vigente EN LA FECHA DE LA LLAMADA.
 *
 * Se compara sólo la parte `YYYY-MM-DD` para no meter husos horarios en una
 * decisión de precio: la promoción de un proveedor caduca por día de calendario,
 * no a una hora concreta de un meridiano.
 *
 * **Sin fecha se cae al precio de LISTA, no al promocional.** Es el lado
 * conservador: sobrestimar el costo puede hacer que se cobre de más, y
 * subestimarlo hace vender por debajo del costo sin enterarse. Sólo uno de los
 * dos errores quiebra un negocio.
 */
export function tarifaVigente(t: TarifaModelo, fechaISO?: string): TarifaModelo {
  const p = t.promocion
  if (!p || !fechaISO) return t
  const dia = String(fechaISO).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > p.hasta) return t
  return {
    ...t,
    entradaUsdPorMillon: p.entradaUsdPorMillon,
    salidaUsdPorMillon: p.salidaUsdPorMillon,
    entradaCacheUsdPorMillon: p.entradaCacheUsdPorMillon ?? t.entradaCacheUsdPorMillon,
    fuente: p.fuente,
  }
}

/**
 * Costo en USD de una llamada.
 *
 * @returns `usd: null` con su motivo cuando no se puede calcular. **Nunca 0 por
 *   defecto**: un cero se suma en los totales y hace pasar por gratis lo que
 *   simplemente no se sabe.
 */
export function costoUsd(modelo: string, uso: Uso, fechaISO?: string): CostoCalculado {
  const tarifaBase = tarifaDe(modelo)
  if (!tarifaBase) return { usd: null, motivo: 'sin_tarifa', tarifa: null }
  const tarifa = tarifaVigente(tarifaBase, fechaISO)
  const ent = Math.max(0, uso.entrada || 0)
  const sal = Math.max(0, uso.salida || 0)
  const cache = Math.max(0, uso.entradaCache || 0)
  const min = Math.max(0, uso.minutosAudio || 0)
  /**
   * Los MINUTOS cuentan como uso.
   *
   * Sin ellos en esta comprobación, una transcripción —que no tiene tokens,
   * sólo minutos— salía como `sin_uso` y su costo se perdía entero. Es el
   * gasto de cada consulta dictada.
   */
  if (ent + sal + cache + min === 0) return { usd: null, motivo: 'sin_uso', tarifa }

  const tarifaCache = tarifa.entradaCacheUsdPorMillon ?? tarifa.entradaUsdPorMillon
  const usd =
    (ent / 1_000_000) * tarifa.entradaUsdPorMillon +
    (cache / 1_000_000) * tarifaCache +
    (sal / 1_000_000) * tarifa.salidaUsdPorMillon +
    // Los modelos de texto no traen `usdPorMinuto` y los de audio traen 0 en las
    // tarifas por token: cada uno aporta sólo su propio término.
    min * (tarifa.usdPorMinuto ?? 0)
  // 6 decimales: una llamada barata cuesta millonésimas y redondear a centavos
  // las borra. El total mensual se redondea al presentarlo, no al guardarlo.
  return { usd: Number(usd.toFixed(6)), tarifa }
}

/** Modelos que se han visto sin tarifa. Para saber qué falta cargar. */
export function modelosSinTarifa(vistos: readonly string[]): string[] {
  return [...new Set(vistos.filter(m => m && !tarifaDe(m)))]
}

export const POR_QUE_NACE_VACIO =
  'Los proveedores publican sus tarifas y las cambian. Escribir aquí un número de ' +
  'memoria daría un dashboard que parece exacto y miente. Mientras un modelo no ' +
  'tenga tarifa cargada con su fuente y su fecha, los TOKENS se registran igual ' +
  '—son un hecho que devuelve la API— y el costo sale null, no cero. Un cero se ' +
  'suma en los totales y hace pasar por gratis lo que simplemente no se sabe.'
