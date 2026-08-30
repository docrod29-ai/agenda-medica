/**
 * ¿SE PUEDE CONCLUIR QUE ESTE USUARIO NO TIENE CONSULTORIO?
 *
 * Vive aparte del contexto de React por una razón: la decisión es **pura** —dos
 * booleanos entran, uno sale— y así se puede probar sin montar Firebase ni
 * renderizar nada. Lo que la envuelve (el listener, el estado, el redirect) es
 * fontanería; esto es la regla.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * Firestore entrega primero lo que tiene en cache y después lo que dice el
 * servidor. Un documento ausente en un snapshot `fromCache` **no significa que
 * no exista**: significa que todavía no se sabe, o que el servidor no contesta.
 *
 * El contexto trataba las dos cosas igual. Con el acceso a datos cortado, el
 * médico entraba y la aplicación lo mandaba a «Configura tu consultorio ·
 * ¡Bienvenido!»: su consultorio de siempre desaparecía y se le trataba como
 * usuario nuevo. Medido cortando la red de datos: las cuatro rutas probadas
 * acababan en el asistente de alta.
 *
 * Es la regla 4 de seguridad clínica en la puerta de entrada: **ausencia de
 * dato no es dato de ausencia**.
 */

/** Lo mínimo que hace falta saber de un snapshot para decidir. */
export type EstadoDelSnapshot = {
  /** ¿Existe el documento de membresía? */
  existe: boolean
  /** ¿Viene de cache, es decir, sin confirmar contra el servidor? */
  deCache: boolean
}

/**
 * `true` sólo cuando el servidor ha confirmado que la membresía no está.
 *
 * Un `false` NO quiere decir «sí tiene»: quiere decir «no se puede concluir que
 * no». Quien llame decide qué hacer con eso — aquí, esperar; y si el servidor
 * nunca contesta, la red de seguridad del contexto enseña la pantalla de fallo
 * de conexión, que es la verdad.
 */
export function seSabeQueNoTieneConsultorio(snap: EstadoDelSnapshot): boolean {
  return !snap.existe && !snap.deCache
}
