/**
 * LA MÁQUINA DE ESTADOS DE LA REMEDIACIÓN — para que no haya `.catch(reintentar)`.
 *
 * ── EL FALLO QUE EVITA ───────────────────────────────────────────────────────
 *
 * Un reintento suelto dentro de un `catch` no se puede contar, ni parar, ni
 * auditar. Repartidos por veinte archivos, no hay forma de contestar «¿cuántas
 * veces lo hemos intentado?» ni «¿por qué dejamos de intentarlo?». Y basta con
 * que dos de ellos se llamen entre sí para tener un bucle que nadie escribió.
 *
 * Aquí el ciclo de vida es UN dato, las transiciones legales son UNA tabla, y el
 * presupuesto de intentos es FINITO por construcción: `iniciarIntento()` devuelve
 * `null` cuando se acabó. No hay forma de pedir el intento número seis si el
 * presupuesto es de cinco, porque no hay a quién pedírselo.
 *
 * ── POR QUÉ CADA INTENTO GUARDA SU RAZÓN ─────────────────────────────────────
 *
 * Porque «falló tres veces» no sirve para reparar nada. «Falló tres veces con
 * `sin_saldo`» dice que el cuarto intento tampoco iba a salir y que el problema
 * es una factura, no un servidor. La razón es lo que convierte un contador en un
 * diagnóstico.
 *
 * Módulo PURO. No ejecuta acciones: lleva la cuenta de lo que se intentó.
 */

/** El ciclo de vida completo, de la detección a la prueba de regresión. */
export type FaseIncidente =
  | 'detectado'
  | 'clasificado'
  | 'agrupado'
  | 'evaluando'
  | 'remediacion_elegible'
  | 'requiere_humano'
  | 'remediacion_iniciada'
  | 'recuperado'
  | 'degradado'
  | 'fallido'
  | 'resuelto'
  | 'regresion_pendiente'
  | 'regresion_enlazada'

/**
 * Las transiciones LEGALES. Lo que no está aquí no puede pasar.
 *
 * `requiere_humano` no es un callejón sin salida: de ahí se sale a `resuelto`
 * cuando la persona lo arregla, y a `remediacion_elegible` si al reevaluar
 * resulta que sí había una acción segura. Lo que NO se puede es saltar de
 * `requiere_humano` a `recuperado` sin que nadie hiciera nada.
 */
const TRANSICIONES: Record<FaseIncidente, readonly FaseIncidente[]> = {
  detectado:             ['clasificado'],
  clasificado:           ['agrupado'],
  agrupado:              ['evaluando'],
  evaluando:             ['remediacion_elegible', 'requiere_humano', 'recuperado'],
  remediacion_elegible:  ['remediacion_iniciada', 'requiere_humano'],
  requiere_humano:       ['remediacion_elegible', 'resuelto', 'degradado'],
  remediacion_iniciada:  ['recuperado', 'degradado', 'fallido', 'remediacion_iniciada'],
  recuperado:            ['resuelto', 'detectado'],
  degradado:             ['remediacion_iniciada', 'requiere_humano', 'recuperado', 'resuelto'],
  fallido:               ['requiere_humano', 'remediacion_iniciada'],
  resuelto:              ['regresion_pendiente'],
  regresion_pendiente:   ['regresion_enlazada'],
  regresion_enlazada:    [],
}

export function transicionLegal(de: FaseIncidente, a: FaseIncidente): boolean {
  return (TRANSICIONES[de] ?? []).includes(a)
}

export type ResultadoIntento = 'recuperado' | 'degradado' | 'fallido' | 'abortado'

export interface IntentoRemediacion {
  /** 1, 2, 3… Nunca salta ni repite. */
  readonly numero: number
  readonly accion: string
  readonly iniciadoEn: string
  readonly terminadoEn?: string
  readonly resultado?: ResultadoIntento
  /** Etiqueta estable de por qué salió así. Nunca el mensaje crudo del proveedor. */
  readonly razon?: string
}

/**
 * El presupuesto. Finito, y con espera creciente.
 *
 * `maxIntentos: 3` no es un número mágico: es el punto donde este producto ya
 * sabe que reintentar deja de servir. `fallo-proveedor.ts` lo dice más fuerte
 * para dos clases —llave y saldo no se arreglan reintentando NUNCA— y esas ni
 * siquiera llegan aquí, porque `remediacion.ts` las para antes.
 */
export interface PresupuestoReintento {
  readonly maxIntentos: number
  readonly esperaBaseMs: number
  /** Tope de espera: sin él, el exponencial deja al médico esperando minutos. */
  readonly esperaMaxMs: number
}

export const PRESUPUESTO_POR_OMISION: PresupuestoReintento = {
  maxIntentos: 3,
  esperaBaseMs: 1000,
  esperaMaxMs: 15_000,
}

/**
 * Cuánto esperar antes del intento `n` (1-indexado).
 *
 * Exponencial con tope. **Sin jitter aquí a propósito**: la dispersión aleatoria
 * es una decisión de la capa de reintentos de #310/#342
 * (`src/lib/reliability/reintentos.ts`), y meter aquí un `Math.random()` haría
 * la máquina no determinista y no reproducible en un simulacro — además de
 * duplicar una decisión que ya tiene dueño.
 */
export function esperaAntesDe(n: number, p: PresupuestoReintento = PRESUPUESTO_POR_OMISION): number {
  const i = Math.max(1, Math.floor(n))
  return Math.min(p.esperaMaxMs, p.esperaBaseMs * 2 ** (i - 1))
}

export interface EstadoRemediacion {
  readonly firma: string
  readonly fase: FaseIncidente
  readonly intentos: readonly IntentoRemediacion[]
  readonly presupuesto: PresupuestoReintento
  /** ISO del primer fallo conocido. Origen del MTTD. */
  readonly primerFalloEn: string
  readonly detectadoEn?: string
  readonly recuperadoEn?: string
  readonly resueltoEn?: string
  /** Por qué se paró, cuando se paró. */
  readonly motivoDeParada?: string
}

export function nuevoEstado(
  firma: string,
  primerFalloEn: string,
  presupuesto: PresupuestoReintento = PRESUPUESTO_POR_OMISION,
): EstadoRemediacion {
  return { firma, fase: 'detectado', intentos: [], presupuesto, primerFalloEn }
}

/**
 * Mueve el estado a otra fase.
 *
 * @throws si la transición no es legal. Deliberado: un estado imposible que se
 * acepta en silencio se propaga a la consola, a las métricas y al informe del
 * simulacro, y ahí ya nadie sabe que era imposible.
 */
export function avanzar(e: EstadoRemediacion, a: FaseIncidente, cuandoISO: string): EstadoRemediacion {
  if (!transicionLegal(e.fase, a)) {
    throw new Error(`[incidents/maquina] transición ilegal: ${e.fase} → ${a}`)
  }
  return {
    ...e,
    fase: a,
    ...(a === 'clasificado' && !e.detectadoEn ? { detectadoEn: cuandoISO } : {}),
    ...(a === 'recuperado' ? { recuperadoEn: cuandoISO } : {}),
    ...(a === 'resuelto' ? { resueltoEn: e.resueltoEn ?? cuandoISO } : {}),
  }
}

/**
 * Abre un intento. `null` cuando ya no queda presupuesto — **y ése es el freno**.
 *
 * No hay parámetro para forzar uno más. Un `{ forzar: true }` sería la puerta
 * por la que vuelve el bucle infinito: siempre hay un llamador con una buena
 * razón para el intento número cien.
 */
export function iniciarIntento(
  e: EstadoRemediacion,
  accion: string,
  cuandoISO: string,
): { estado: EstadoRemediacion; intento: IntentoRemediacion } | null {
  if (e.intentos.length >= e.presupuesto.maxIntentos) return null
  const intento: IntentoRemediacion = {
    numero: e.intentos.length + 1,
    accion,
    iniciadoEn: cuandoISO,
  }
  const fase: FaseIncidente = e.fase === 'remediacion_iniciada' ? e.fase : 'remediacion_iniciada'
  if (!transicionLegal(e.fase, fase)) {
    throw new Error(`[incidents/maquina] no se puede intentar desde ${e.fase}`)
  }
  return { estado: { ...e, fase, intentos: [...e.intentos, intento] }, intento }
}

/** Cierra el último intento abierto con su resultado y su razón. */
export function cerrarIntento(
  e: EstadoRemediacion,
  resultado: ResultadoIntento,
  razon: string,
  cuandoISO: string,
): EstadoRemediacion {
  const intentos = [...e.intentos]
  const ultimo = intentos[intentos.length - 1]
  if (!ultimo || ultimo.terminadoEn) {
    throw new Error('[incidents/maquina] no hay intento abierto que cerrar')
  }
  intentos[intentos.length - 1] = { ...ultimo, terminadoEn: cuandoISO, resultado, razon }
  const base: EstadoRemediacion = { ...e, intentos }
  if (resultado === 'recuperado') return avanzar(base, 'recuperado', cuandoISO)
  if (resultado === 'degradado') return avanzar(base, 'degradado', cuandoISO)
  // Falló o se abortó: si queda presupuesto se puede volver a intentar; si no, humano.
  if (intentos.length >= e.presupuesto.maxIntentos) {
    return {
      ...avanzar(avanzar(base, 'fallido', cuandoISO), 'requiere_humano', cuandoISO),
      motivoDeParada: `presupuesto agotado tras ${intentos.length} intento(s); última razón: ${razon}`,
    }
  }
  return base
}

/** ¿Queda presupuesto? Para que la consola pueda decirlo sin abrir un intento. */
export function quedaPresupuesto(e: EstadoRemediacion): number {
  return Math.max(0, e.presupuesto.maxIntentos - e.intentos.length)
}

export const POR_QUE_EL_PRESUPUESTO_NO_TIENE_PUERTA_TRASERA =
  'Porque un `forzar: true` es la puerta por la que vuelve el bucle infinito. ' +
  'Siempre hay un llamador con una buena razón para el intento número cien, y ' +
  'esa razón siempre parece buena hasta que son diez mil llamadas contra un ' +
  'proveedor que ya dijo que no hay saldo.'
