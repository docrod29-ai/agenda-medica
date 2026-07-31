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
  /** De dónde salió y cuándo se miró. Sin esto la tarifa no se acepta. */
  fuente: string
  /** ISO. La tarifa se revisa periódicamente: los proveedores las cambian. */
  consultado: string
}

/**
 * Tarifas cargadas.
 *
 * **VACÍO A PROPÓSITO.** Para llenarlo: entrar a la página de precios del
 * proveedor, copiar la tarifa del modelo exacto que se usa, y añadir la entrada
 * con su `fuente` y su `consultado`. No se acepta una tarifa sin las dos cosas
 * — un test lo comprueba.
 *
 * Mientras esté vacío, el ledger registra tokens y deja el costo en `null`. Eso
 * es correcto y es visible: el dashboard dirá `sin_tarifa`, no `$0`.
 */
export const TARIFAS: readonly TarifaModelo[] = [
  // Ejemplo del formato — descomentar y CORREGIR con la tarifa real antes de usar:
  // {
  //   modelo: 'claude-opus-4-8', proveedor: 'anthropic',
  //   entradaUsdPorMillon: 0, salidaUsdPorMillon: 0,
  //   fuente: 'https://www.anthropic.com/pricing', consultado: '2026-07-30',
  // },
]

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
}

export interface CostoCalculado {
  usd: number | null
  /** Por qué no hay costo, cuando `usd` es null. */
  motivo?: 'sin_tarifa' | 'sin_uso'
  tarifa: TarifaModelo | null
}

/**
 * Costo en USD de una llamada.
 *
 * @returns `usd: null` con su motivo cuando no se puede calcular. **Nunca 0 por
 *   defecto**: un cero se suma en los totales y hace pasar por gratis lo que
 *   simplemente no se sabe.
 */
export function costoUsd(modelo: string, uso: Uso): CostoCalculado {
  const tarifa = tarifaDe(modelo)
  if (!tarifa) return { usd: null, motivo: 'sin_tarifa', tarifa: null }
  const ent = Math.max(0, uso.entrada || 0)
  const sal = Math.max(0, uso.salida || 0)
  const cache = Math.max(0, uso.entradaCache || 0)
  if (ent + sal + cache === 0) return { usd: null, motivo: 'sin_uso', tarifa }

  const tarifaCache = tarifa.entradaCacheUsdPorMillon ?? tarifa.entradaUsdPorMillon
  const usd =
    (ent / 1_000_000) * tarifa.entradaUsdPorMillon +
    (cache / 1_000_000) * tarifaCache +
    (sal / 1_000_000) * tarifa.salidaUsdPorMillon
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
