/**
 * HASTA DÓNDE MIRA UNA CONSULTA, Y CÓMO SE DICE.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La consola del dueño hacía esto, en las dos pantallas que se abren primero:
 *
 *     adminDb.collection('clinics').get(),
 *     adminDb.collection('platform_payments').get(),
 *
 * **Sin `limit`, sin `where`.** `platform_payments` crece un documento por cada
 * cargo de Stripe, **para siempre**. Y después, por cada consultorio, una
 * lectura más de `secretos/ia` — un N+1 sobre una lista sin techo.
 *
 * Es la página por omisión del panel: la primera que dará *timeout*.
 *
 * ── LA TRAMPA DE ACOTARLO ────────────────────────────────────────────────────
 *
 * Poner un `limit` y ya está convierte «ingreso total» en «ingreso de lo que
 * cupo», con el mismo nombre y el mismo aspecto. Ése es el fallo que este
 * repositorio ha perseguido toda la sesión: **el recorte que nadie ve se lee
 * como el total**.
 *
 * Así que aquí no se acota sin más: se acota **y se devuelve el alcance**, para
 * que la pantalla pueda decir «últimos 12 meses» en vez de «total» — y para que,
 * si algún día se toca el tope, se note.
 *
 * Módulo PURO.
 */

/**
 * Cuánto histórico de cobros se lee.
 *
 * Doce meses cubren el año fiscal y la comparación interanual, que es para lo
 * que se mira esta pantalla. El histórico completo vive en Stripe, que es su
 * sitio: la consola no es el libro mayor.
 */
export const MESES_VENTANA = 12

/**
 * Tope de consultorios por página.
 *
 * No es un límite de producto: es el freno para que la pantalla no intente
 * pintar miles de filas ni disparar miles de lecturas. Si se alcanza, **se
 * declara**.
 */
export const TOPE_CLINICAS = 500

/** Tope de cobros leídos. Con la ventana de 12 meses, sobra de largo. */
export const TOPE_PAGOS = 20_000

export interface Alcance {
  /** Fecha ISO desde la que se leyó, o `null` si no hubo ventana. */
  desde: string | null
  /** ¿Se llegó al tope? Entonces falta información y hay que decirlo. */
  recortado: boolean
  /** Qué se está enseñando, en las palabras que van en la pantalla. */
  etiqueta: string
}

/** El instante desde el que se leen los cobros. PURO: se le pasa el ahora. */
export function desdeVentana(ahoraMs: number, meses = MESES_VENTANA): string {
  const d = new Date(ahoraMs)
  d.setMonth(d.getMonth() - meses)
  return d.toISOString()
}

/**
 * El alcance de una lectura de cobros, listo para viajar en la respuesta.
 *
 * `recortado` no es un detalle técnico: es la diferencia entre «esto es lo que
 * hay» y «esto es lo que cupo».
 */
export function alcanceDePagos(desde: string, leidos: number, tope = TOPE_PAGOS): Alcance {
  const recortado = leidos >= tope
  return {
    desde,
    recortado,
    etiqueta: recortado
      ? `últimos ${MESES_VENTANA} meses — SE ALCANZÓ EL TOPE DE ${tope.toLocaleString('es-MX')} COBROS: faltan datos`
      : `últimos ${MESES_VENTANA} meses`,
  }
}

/** Ídem para la lista de consultorios. */
export function alcanceDeClinicas(leidas: number, tope = TOPE_CLINICAS): Alcance {
  const recortado = leidas >= tope
  return {
    desde: null,
    recortado,
    etiqueta: recortado
      ? `primeros ${tope} consultorios — hay más que no se están enseñando`
      : `${leidas} consultorio(s)`,
  }
}

export const POR_QUE_SE_DEVUELVE_EL_ALCANCE =
  'Poner un `limit` y ya está convierte «ingreso total» en «ingreso de lo que ' +
  'cupo», con el mismo nombre y el mismo aspecto. Un recorte que nadie ve se ' +
  'lee como el total, y sobre ese número se toman decisiones de precio. Por eso ' +
  'el alcance viaja en la respuesta y la pantalla lo enseña.'
