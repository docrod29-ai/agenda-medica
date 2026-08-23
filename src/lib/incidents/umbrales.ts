/**
 * UN FALLO NO ES UN INCIDENTE — dónde está la raya, y quién la pone.
 *
 * ── POR QUÉ HACE FALTA UNA RAYA ──────────────────────────────────────────────
 *
 * Un timeout suelto a media tarde es la vida normal de una red. Quinientos
 * timeouts en cinco minutos en la misma función es una caída. Si las dos cosas
 * despiertan a alguien, en dos semanas nadie mira los avisos y el sistema de
 * detección se ha convertido en ruido — que es la forma más común de que un
 * sistema de detección deje de funcionar sin que nadie lo apague.
 *
 * ── LAS DOS PALABRAS, Y LA DIFERENCIA ────────────────────────────────────────
 *
 *   EVENTO     — un fallo. Se anota, se agrupa, se cuenta. No despierta a nadie.
 *   INCIDENTE  — un grupo que cruzó una raya. Tiene dueño, runbook y reloj.
 *
 * ── DE DÓNDE SALEN LOS NÚMEROS, Y CUÁLES NO SON MÍOS ─────────────────────────
 *
 * Los de abajo son **defaults técnicos**, no objetivos de servicio. Sirven para
 * que el motor tenga con qué correr en el arnés y en las pruebas. Los que de
 * verdad definen el compromiso con un consultorio —cuánta latencia es
 * inaceptable en la nota, qué tasa de error se tolera en la agenda— son SLOs y
 * los fija el dueño: viven en el contrato de #310/#342
 * (`docs/reliability/SLO-SLI-CONTRACT.md`, TARGET separado de OBSERVED) y aquí
 * quedan como `null`, que significa **«no vigilado todavía»** y no «vale todo».
 *
 * Inventar aquí un umbral de latencia «clínicamente correcto» sería exactamente
 * la cifra plausible que la regla 1 de seguridad clínica prohíbe.
 *
 * Módulo PURO.
 */
import { NUNCA_SE_AGREGA_POR_RUIDO, nivelDeSeveridad } from './taxonomia'
import type { GrupoIncidente } from './agrupacion'

export interface PoliticaDeUmbral {
  /** Ventana de observación, en minutos. */
  readonly ventanaMin: number
  /** A partir de cuántos eventos en la ventana. */
  readonly minEventos: number
  /** A partir de cuántas operaciones distintas afectadas. */
  readonly minOperaciones: number
  /**
   * Tasa de error a partir de la cual es incidente, en 0..1.
   * `null` = no se vigila la tasa porque no hay denominador fiable.
   */
  readonly tasaError: number | null
  /** p95 de latencia intolerable, en ms. `null` = lo fija el dueño (SLO). */
  readonly latenciaP95Ms: number | null
  /** Minutos que tiene que durar el goteo para contar aunque no llegue al conteo. */
  readonly sostenidoMin: number
  /** Multiplicador sobre la línea base que cuenta como pico. */
  readonly factorPico: number
  /**
   * Severidad a partir de la cual UN SOLO evento ya es incidente.
   *
   * Por omisión `sev1`, que en la taxonomía es sólo el aislamiento entre
   * consultorios. Ponerlo en `sev2` haría que un timeout suelto del proveedor
   * despertara a alguien, que es exactamente el ruido que esta raya evita.
   */
  readonly severidadInmediata: 'sev1' | 'sev2'
}

/**
 * Los defaults técnicos.
 *
 * · `ventanaMin: 5` — la ventana que usan casi todas las alertas de tasa; corta
 *   para no tardar en ver una caída, larga para que no la dispare un hipo.
 * · `minEventos: 20` — por debajo de veinte en cinco minutos, un fallo en este
 *   producto cabe dentro de lo que un reintento resuelve solo.
 * · `minOperaciones: 5` — cinco operaciones distintas separan «a un médico le
 *   pasó cinco veces» de «le está pasando a cinco».
 * · `sostenidoMin: 15` — un goteo que dura un cuarto de hora ya no es un hipo,
 *   aunque nunca llegue a veinte por ventana.
 * · `factorPico: 10` — diez veces la línea base es un cambio de régimen.
 * · `severidadInmediata: 'sev1'` — sólo el aislamiento entre consultorios entra
 *   con un evento. Un timeout suelto del proveedor NO despierta a nadie.
 * · `tasaError` y `latenciaP95Ms` en `null` — son SLO y los fija el dueño.
 */
export const POLITICA_POR_OMISION: PoliticaDeUmbral = {
  ventanaMin: 5,
  minEventos: 20,
  minOperaciones: 5,
  tasaError: null,
  latenciaP95Ms: null,
  sostenidoMin: 15,
  factorPico: 10,
  severidadInmediata: 'sev1',
}

/** Lo que el motor mide fuera del grupo, cuando puede medirlo. */
export interface SenalesDeImpacto {
  /** Operaciones TOTALES de esa función en la ventana. Sin esto no hay tasa. */
  readonly operacionesTotales?: number
  /** p95 observado de la función en la ventana, en ms. */
  readonly latenciaP95Ms?: number
  /** Eventos por minuto que esta firma tenía antes. Sin esto no hay pico. */
  readonly lineaBasePorMinuto?: number
}

export type RazonDeIncidente =
  | 'invariante_de_seguridad'
  | 'severidad_alta'
  | 'conteo'
  | 'operaciones_afectadas'
  | 'tasa_de_error'
  | 'latencia'
  | 'sostenido'
  | 'pico'

export interface Veredicto {
  /** `true` = INCIDENTE. `false` = evento, se anota y se calla. */
  readonly esIncidente: boolean
  readonly razones: readonly RazonDeIncidente[]
  /** Una frase para la consola. Sin PHI: habla de cifras, no de personas. */
  readonly porQue: string
  /** Lo que NO se pudo evaluar por falta de denominador. Se declara. */
  readonly noEvaluado: readonly string[]
}

/** Minutos entre dos ISO. Negativo imposible: se toma el valor absoluto. */
function minutosEntre(a: string, b: string): number {
  const ms = Math.abs(Date.parse(b) - Date.parse(a))
  return Number.isFinite(ms) ? ms / 60000 : 0
}

/**
 * ¿Este grupo cruzó la raya?
 *
 * El orden importa: primero lo que no admite umbral, después lo que sí. Un
 * incidente de aislamiento entre consultorios no espera a la vigésima
 * repetición — cuando llegara la vigésima, ya habría veinte expedientes
 * cruzados.
 */
export function evaluarUmbral(
  g: GrupoIncidente,
  senales: SenalesDeImpacto = {},
  politica: PoliticaDeUmbral = POLITICA_POR_OMISION,
): Veredicto {
  const razones: RazonDeIncidente[] = []
  const noEvaluado: string[] = []

  // 1. Lo que nunca se agrega por ruido. Un evento basta.
  if (NUNCA_SE_AGREGA_POR_RUIDO.includes(g.categoria)) {
    razones.push('invariante_de_seguridad')
  }

  // 2. Severidad. Un sev1 con un evento es un incidente con un evento.
  if (nivelDeSeveridad(g.dimensiones.severidad) >= nivelDeSeveridad(politica.severidadInmediata)) {
    razones.push('severidad_alta')
  }

  // 3. Conteo dentro de la ventana.
  const duracionMin = minutosEntre(g.firstSeen, g.lastSeen)
  if (g.count >= politica.minEventos && duracionMin <= politica.ventanaMin) {
    razones.push('conteo')
  }

  // 4. Cuántas operaciones distintas. Aquí «distinto» es lo que separa uno de todos.
  if (g.operacionesAfectadas >= politica.minOperaciones) {
    razones.push('operaciones_afectadas')
  }

  // 5. Tasa de error. Sin denominador NO se estima: se declara que no se evaluó.
  if (politica.tasaError === null) {
    noEvaluado.push('tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY)')
  } else if (typeof senales.operacionesTotales !== 'number' || senales.operacionesTotales <= 0) {
    noEvaluado.push('tasa de error: no hay total de operaciones en la ventana')
  } else if (g.count / senales.operacionesTotales >= politica.tasaError) {
    razones.push('tasa_de_error')
  }

  // 6. Latencia. Mismo trato: sin umbral aprobado, no se inventa uno.
  if (politica.latenciaP95Ms === null) {
    noEvaluado.push('latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY)')
  } else if (typeof senales.latenciaP95Ms !== 'number') {
    noEvaluado.push('latencia: no hay p95 observado en la ventana')
  } else if (senales.latenciaP95Ms >= politica.latenciaP95Ms) {
    razones.push('latencia')
  }

  // 7. Goteo sostenido: poco volumen, mucho rato.
  if (duracionMin >= politica.sostenidoMin && g.count >= 2) {
    razones.push('sostenido')
  }

  // 8. Pico brusco contra la línea base.
  if (typeof senales.lineaBasePorMinuto === 'number' && senales.lineaBasePorMinuto > 0) {
    const porMinuto = g.count / Math.max(1, duracionMin)
    if (porMinuto >= senales.lineaBasePorMinuto * politica.factorPico) razones.push('pico')
  } else {
    noEvaluado.push('pico: no hay línea base de esta firma')
  }

  const esIncidente = razones.length > 0
  const porQue = esIncidente
    ? `${g.count} evento(s) en ${duracionMin.toFixed(1)} min sobre ${g.operacionesAfectadas} operación(es); cruzó: ${razones.join(', ')}`
    : `${g.count} evento(s) en ${duracionMin.toFixed(1)} min: por debajo de toda raya (${politica.minEventos} eventos / ${politica.ventanaMin} min, ${politica.minOperaciones} operaciones)`

  return { esIncidente, razones, porQue, noEvaluado }
}

export const POR_QUE_UN_EVENTO_SUELTO_NO_DESPIERTA_A_NADIE =
  'Porque un sistema de avisos que suena por todo deja de mirarse en dos ' +
  'semanas, y entonces no avisa de nada. La raya no existe para tolerar fallos: ' +
  'existe para que el aviso que suena signifique algo. Por eso el aislamiento ' +
  'entre consultorios no tiene raya — ahí una vez ya es demasiadas.'
