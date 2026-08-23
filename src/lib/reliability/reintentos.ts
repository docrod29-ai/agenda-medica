/**
 * REINTENTAR SIN CAUSAR UNA TORMENTA — presupuesto, retroceso y jitter.
 *
 * ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────
 *
 * Hoy el repositorio tiene UNA política de reintentos: la de WhatsApp
 * (`src/lib/whatsapp/reintentos.ts`), escrita para mensajes salientes y con
 * base de 5 minutos. Sirve para lo suyo y aquí no se toca. Pero el resto del
 * producto —IA, evidencia, documentos, guardado de borrador— reintenta cada uno
 * a su manera o no reintenta.
 *
 * Dos cosas faltan y ésas son las que matan a escala:
 *
 *  1. **Jitter.** Sin él, mil consultorios que fallan por la misma caída de
 *     proveedor reintentan TODOS en el mismo milisegundo. El proveedor, que se
 *     estaba recuperando, se vuelve a caer con el reintento sincronizado. La
 *     política de WhatsApp no tiene jitter porque un cron en serie no lo
 *     necesitaba; a 10 000 médicos sí.
 *  2. **Presupuesto de reintentos.** «Reintentar 3 veces» no acota nada si cada
 *     intento puede tardar 60 s: son tres minutos de trabajo colgado. El
 *     presupuesto acota el NÚMERO y el TIEMPO TOTAL, y el que se agote primero
 *     manda.
 *
 * ── LO QUE NO SE REINTENTA ───────────────────────────────────────────────────
 *
 * Un 401 no mejora repitiéndolo. Una llave revocada tampoco. Reintentar un
 * fallo permanente convierte un error claro en una espera larga que acaba en el
 * mismo error — con un paciente enfrente. La clasificación de fallo de
 * proveedor ya existe (`src/lib/ia/fallo-proveedor.ts`) y aquí se respeta su
 * mismo criterio en vez de inventar otro.
 *
 * Módulo PURO: el reloj y el azar se INYECTAN. Sin eso una prueba de backoff no
 * puede ser determinista, y una prueba de backoff no determinista no prueba nada.
 */

/** Cómo se decide si un fallo merece otro intento. */
export type VeredictoDeFallo =
  /** Transitorio: la siguiente vez puede salir bien (503, timeout, red). */
  | 'transitorio'
  /** Saturación: se puede reintentar, pero MÁS despacio (429, sobrecarga). */
  | 'saturacion'
  /** Permanente: repetirlo da el mismo resultado (401, 403, 400, llave muerta). */
  | 'permanente'

export interface PoliticaDeReintentos {
  /** Cuántos intentos EXTRA como máximo (0 = un solo intento, sin reintentos). */
  reintentosMaximos: number
  /** Espera base del primer reintento, en milisegundos. */
  baseMs: number
  /** Techo de una espera individual. Sin él, 2^n se va a horas. */
  topeMs: number
  /**
   * Techo del TIEMPO TOTAL de la cadena de reintentos, esperas incluidas.
   * El que se agote primero —intentos o tiempo— cierra el presupuesto.
   */
  presupuestoTotalMs: number
  /** Multiplicador de la espera cuando el fallo es saturación (429). */
  factorSaturacion: number
}

/**
 * La política por defecto. Conservadora a propósito: cuando se duda, se
 * reintenta menos. Un reintento de más en el camino clínico es tiempo de
 * pantalla parada; un reintento de menos es un mensaje de error honesto.
 */
export const POLITICA_POR_DEFECTO: PoliticaDeReintentos = {
  reintentosMaximos: 3,
  baseMs: 500,
  topeMs: 30_000,
  presupuestoTotalMs: 90_000,
  factorSaturacion: 4,
}

/**
 * Retroceso exponencial con **jitter completo** (full jitter).
 *
 * La espera calculada es el TECHO, no el valor: se devuelve un número uniforme
 * en `[0, techo]`. Es la variante que mejor dispersa una manada sincronizada,
 * a costa de que algún reintento salga muy pronto — un intercambio que a escala
 * sale a favor.
 *
 * @param intento 1-based: 1 es la espera ANTES del primer reintento.
 * @param azar función que devuelve [0,1). Se inyecta para poder probar.
 */
export function esperaMs(
  intento: number,
  politica: PoliticaDeReintentos = POLITICA_POR_DEFECTO,
  veredicto: VeredictoDeFallo = 'transitorio',
  azar: () => number = Math.random,
): number {
  const n = Math.max(1, Math.floor(intento))
  const factor = veredicto === 'saturacion' ? politica.factorSaturacion : 1
  const techo = Math.min(politica.baseMs * factor * Math.pow(2, n - 1), politica.topeMs)
  // Se acota el azar a [0,1) aunque la fuente inyectada mienta: una prueba que
  // devuelva 2 no debe poder producir una espera del doble del tope.
  const r = Math.min(Math.max(azar(), 0), 0.999999)
  return Math.round(techo * r)
}

/** Estado vivo de una cadena de reintentos. Se pasa entero, no se muta fuera. */
export interface EstadoDeReintento {
  /** Intentos YA realizados (1 tras el primer intento). */
  intentos: number
  /** Milisegundos consumidos por la cadena hasta ahora (trabajo + esperas). */
  gastadoMs: number
}

export type Decision =
  | { reintentar: true; esperarMs: number; intentoSiguiente: number }
  | { reintentar: false; motivo: 'permanente' | 'intentos-agotados' | 'presupuesto-agotado' }

/**
 * ¿Se reintenta, y cuánto se espera?
 *
 * Única función de decisión: quien llama no vuelve a razonar sobre topes. Si
 * dos sitios deciden esto por su cuenta, uno de los dos acabará reintentando un
 * 401 para siempre.
 */
export function decidirReintento(
  estado: EstadoDeReintento,
  veredicto: VeredictoDeFallo,
  politica: PoliticaDeReintentos = POLITICA_POR_DEFECTO,
  azar: () => number = Math.random,
): Decision {
  if (veredicto === 'permanente') return { reintentar: false, motivo: 'permanente' }
  if (estado.intentos >= politica.reintentosMaximos + 1) {
    return { reintentar: false, motivo: 'intentos-agotados' }
  }
  if (estado.gastadoMs >= politica.presupuestoTotalMs) {
    return { reintentar: false, motivo: 'presupuesto-agotado' }
  }
  const espera = esperaMs(estado.intentos, politica, veredicto, azar)
  // La espera no puede cruzar el presupuesto: esperar más de lo que queda es
  // agotar el presupuesto DURMIENDO, que es la peor forma de gastarlo.
  if (estado.gastadoMs + espera >= politica.presupuestoTotalMs) {
    return { reintentar: false, motivo: 'presupuesto-agotado' }
  }
  return { reintentar: true, esperarMs: espera, intentoSiguiente: estado.intentos + 1 }
}

/**
 * Clasifica un fallo HTTP/red en veredicto.
 *
 * Deliberadamente pequeño y explícito. Los códigos que no aparecen caen en
 * `permanente`: ante la duda NO se reintenta, porque reintentar de más gasta el
 * tiempo del médico y puede duplicar efectos, mientras que reintentar de menos
 * sólo produce un error honesto y temprano.
 */
export function veredictoDeHttp(estado: number | null, esTimeoutDeRed = false): VeredictoDeFallo {
  if (esTimeoutDeRed) return 'transitorio'
  if (estado === null) return 'transitorio'          // sin respuesta: red
  if (estado === 429) return 'saturacion'
  if (estado === 408 || estado === 425) return 'transitorio'
  if (estado >= 500 && estado <= 599) return 'transitorio'
  return 'permanente'
}
