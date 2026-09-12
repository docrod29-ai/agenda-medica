/**
 * PARÁMETROS DE LA LLAMADA DE LA NOTA — razonamiento y velocidad, POR MODELO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La nota 💎 Máxima pedía el razonamiento extendido con la forma antigua del
 * parámetro: `thinking: { type: 'enabled', budget_tokens: 6000 }`. Esa forma
 * la aceptaban Opus 4.5 y Sonnet 4.5; a partir de Opus 4.7 / 4.8 y Sonnet 5 el
 * proveedor **la rechaza con un 400** y sólo acepta `{ type: 'adaptive' }`.
 *
 * La ruta ya tenía un «modo seguro» para ese 400: repetir la MISMA llamada sin
 * razonamiento. Pensado para una cuenta rara con una política restrictiva
 * (así lo juzgó la auditoría B-003, «probabilidad baja»), en realidad se
 * disparaba en **todas** las notas Máxima del modelo de arriba de la cascada.
 * Resultado: la nota que el dueño decidió que «no escatima» se redactaba SIN
 * el razonamiento que la distingue, con un viaje al proveedor de más, y lo
 * único que lo decía era una línea de `safeLog.error` en el servidor.
 *
 * Es la hermana exacta de REG-167 y de la regla «el dato tiene que LLEGAR»:
 * el código *decía* razonamiento; el proveedor no lo *aceptaba*.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * La forma del parámetro sale del modelo que se va a llamar, y vive en UN sitio
 * puro y probado, no en un literal dentro de la ruta. Un literal en la ruta no
 * lo cuestiona nadie hasta que cambia el modelo — y el modelo cambia solo,
 * porque la cascada toma el mejor que la cuenta tenga.
 *
 * ── VELOCIDAD (misma calidad, más rápido) ────────────────────────────────────
 *
 * Opus 4.8 y Opus 5 admiten el «modo rápido» del proveedor: **el mismo modelo,
 * el mismo razonamiento y la misma salida**, servidos hasta 2.5× más rápido, a
 * un precio por token mayor (research preview, `speed: 'fast'` + cabecera
 * beta). No cambia lo que el médico firma; cambia cuánto espera y cuánto se
 * paga. Doblar el gasto de la llamada más cara de la plataforma no es una
 * decisión de código: nació apagado y el dueño lo encendió el 11-sep-2026
 * (D-060, «has esto»). Desde entonces va ENCENDIDO por omisión y se apaga con
 * `NOTA_MODO_RAPIDO=0`. Si el proveedor lo rechaza (400) o su cupo aparte se
 * agota (429), la ruta repite en velocidad normal: nunca deja al médico sin nota.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No comprueba contra el proveedor vivo que la forma sea aceptada: eso es
 *   `scripts/verificar-invariantes-de-datos.md`, con una llave real. Lo que sí
 *   garantiza es que la forma antigua no vuelva a salir hacia un modelo 4.6+.
 * · No decide el esfuerzo (`output_config.effort`): se deja el del proveedor
 *   por defecto, que es el alto. Bajarlo por velocidad sería bajar de calidad
 *   sin avisar, y eso está decidido en `CLAUDE.md`.
 * · Haiku no lleva razonamiento aquí (el perfil `live` nunca lo pidió); si un
 *   día se quisiera, se declara en este módulo y no en la ruta.
 * · `budgetLegado` es por ruta (la nota 6000, la corrección 4000, la evidencia
 *   5000) porque cada una tiene su propio `max_tokens`; sólo importa en los
 *   modelos 3.7–4.5, que son los únicos que todavía lo leen.
 */

export type Thinking =
  | { type: 'adaptive' }
  | { type: 'enabled'; budget_tokens: number }

export type Velocidad = 'fast' | 'standard'

/** Cabecera beta que exige el proveedor para `speed: 'fast'`. */
export const BETA_MODO_RAPIDO = 'fast-mode-2026-02-01'

/** Bandera de entorno del modo rápido: `0` lo apaga; cualquier otra cosa, encendido (D-060). */
export const ENV_MODO_RAPIDO = 'NOTA_MODO_RAPIDO'

/**
 * Presupuesto legado de razonamiento para los modelos que todavía lo piden en
 * tokens. Es el mismo 6000 que llevaba la ruta desde 2026-07.
 */
export const BUDGET_LEGADO = 6000

/**
 * Con velocidad rápida, estos estados significan «este modelo o este cupo no
 * la admiten»: se repite en velocidad normal, no se cae al parser local.
 */
export const ESTADOS_QUE_RETIRAN_LA_VELOCIDAD: ReadonlySet<number> = new Set([400, 429])

const FAMILIA = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/

/** `claude-opus-4-8` → { familia: 'opus', version: 4.8 }. `claude-3-7-sonnet` → sonnet 3.7. */
export function versionDe(model: string): { familia: string; version: number } | null {
  const m = FAMILIA.exec(model)
  if (m) {
    const mayor = Number(m[2])
    const menorCrudo = m[3]
    // Un sufijo de fecha (`claude-haiku-4-5-20251001`) no es versión menor.
    const menor = menorCrudo && menorCrudo.length <= 2 ? Number(menorCrudo) : 0
    return { familia: m[1], version: mayor + menor / 10 }
  }
  const viejo = /^claude-(\d)-(\d)-(opus|sonnet|haiku)/.exec(model)
  if (viejo) return { familia: viejo[3], version: Number(viejo[1]) + Number(viejo[2]) / 10 }
  return null
}

/**
 * La forma del razonamiento extendido que ACEPTA este modelo, o `null` si no
 * se le pide ninguno.
 *
 * · Fable / Mythos: el razonamiento va siempre encendido; `adaptive` es la
 *   única forma explícita que aceptan.
 * · Opus y Sonnet desde 4.6: `adaptive`. `budget_tokens` devuelve 400 desde
 *   4.7 y está retirado en 4.6.
 * · Opus y Sonnet de 3.7 a 4.5: la forma antigua con presupuesto en tokens.
 * · Haiku y cualquier cosa desconocida: sin razonamiento (como hasta ahora).
 */
export function thinkingPara(model: string, budgetLegado: number = BUDGET_LEGADO): Thinking | null {
  const v = versionDe(model)
  if (!v) return null
  if (v.familia === 'fable' || v.familia === 'mythos') return { type: 'adaptive' }
  if (v.familia !== 'opus' && v.familia !== 'sonnet') return null
  if (v.version >= 4.6) return { type: 'adaptive' }
  if (v.version >= 3.7) return { type: 'enabled', budget_tokens: budgetLegado }
  return null
}

/**
 * Lo que se le dice al médico cuando pidió la nota Máxima y el razonamiento
 * NO se hizo (el proveedor rechazó el parámetro, o el JSON se cortó y el
 * reintento fue sin razonar). Regla 3 de seguridad clínica: nada cambia en
 * silencio. Hallazgo B-003 del panel de sep-2026.
 */
export const AVISO_SIN_RAZONAMIENTO =
  'La nota se redactó con el modelo Máximo pero SIN el razonamiento extendido: ' +
  'el proveedor no lo aceptó en esta llamada. El texto es válido; revisa con más ' +
  'cuidado el diagnóstico diferencial y las dosis, que es lo que ese paso mejora.'

/**
 * Nombre legible del modelo que DE VERDAD contestó, para pintarlo en la
 * procedencia. Antes cada ruta decía «Claude Opus 4.8» a partir de `/opus/`,
 * y mentía en cuanto la cascada servía otro Opus (D-059).
 */
export function etiquetaDeModelo(model: string): string {
  const v = versionDe(model)
  if (!v) return 'Claude'
  const familia = v.familia[0].toUpperCase() + v.familia.slice(1)
  const version = Number.isInteger(v.version) ? String(v.version) : v.version.toFixed(1)
  return `Claude ${familia} ${version}`
}

/** Sólo Opus 4.8 y Opus 5 sirven el modo rápido; y sólo si el dueño lo encendió. */
export function admiteModoRapido(model: string): boolean {
  return /^claude-opus-(?:4-8|5)$/.test(model)
}

export function velocidadPara(model: string, habilitado: boolean): Velocidad {
  return habilitado && admiteModoRapido(model) ? 'fast' : 'standard'
}

/** Lo que se añade a las cabeceras y al cuerpo cuando se pide velocidad rápida. */
export function cabecerasDeVelocidad(velocidad: Velocidad): Record<string, string> {
  return velocidad === 'fast' ? { 'anthropic-beta': BETA_MODO_RAPIDO } : {}
}

export function cuerpoDeVelocidad(velocidad: Velocidad): Record<string, unknown> {
  return velocidad === 'fast' ? { speed: 'fast' } : {}
}

/**
 * ENCENDIDO por omisión (D-060): sólo `'0'` lo apaga. Se lee con el nombre
 * literal para que el inventario de entorno la vea.
 */
export function modoRapidoHabilitado(valor: string | undefined = process.env.NOTA_MODO_RAPIDO): boolean {
  return valor !== '0'
}
