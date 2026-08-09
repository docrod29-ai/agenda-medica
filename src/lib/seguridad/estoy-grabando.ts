/**
 * «ESTOY GRABANDO» — EL LATIDO QUE FALTABA ENTRE DOS MÓDULOS QUE NO SE HABLAN.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * `AutoLogout` cierra la sesión a los 30 minutos sin `mousemove`, `mousedown`,
 * `keydown`, `touchstart` ni `scroll`. Y su propio comentario nombra el
 * escenario que lo rompe:
 *
 *   *«el médico DICTA, y dictar no genera mousemove ni teclas»*
 *
 * Lo conocía. Su defensa fue **guardar la nota antes de cerrar**. Eso salva el
 * texto, pero **sigue cerrando la sesión a mitad de frase** en un pase de UCI de
 * media hora.
 *
 * Guardar la nota no era el arreglo: era el consuelo.
 *
 * ── POR QUÉ UN EVENTO Y NO UNA REFERENCIA ───────────────────────────────────
 *
 * El grabador no debe saber que existe un cierre por inactividad, y el cierre
 * por inactividad no debe saber que existe un grabador. Si se conocieran, cada
 * pantalla nueva que grabe tendría que acordarse de avisar — y «acordarse» es
 * justo lo que este repositorio tiene documentado como la familia
 * `depende_de_recordar`.
 *
 * Con un evento, **cualquier** superficie que grabe queda cubierta el día que
 * exista, sin tocar nada.
 *
 * ── EL NOMBRE VIVE AQUÍ, NO EN LOS DOS LADOS ────────────────────────────────
 *
 * Una cadena literal repetida en dos archivos es una compuerta que se abre sola
 * el día que alguien corrige una errata en uno de los dos. Se declara una vez.
 */

/** Lo emite quien esté grabando; lo escucha quien cuente inactividad. */
export const EVENTO_GRABANDO = 'nx:grabando'

/**
 * Cada cuánto late.
 *
 * Un minuto: suficientemente frecuente frente a los 30 minutos del cierre, y lo
 * bastante raro como para no ser un coste. No se deriva del umbral de
 * `AutoLogout` a propósito — hacerlo obligaría a este módulo a conocerlo, que es
 * exactamente lo que se está evitando.
 */
export const LATIDO_MS = 60_000

export const POR_QUE_NO_BASTABA_GUARDAR_LA_NOTA =
  'Guardar la nota antes de cerrar salva el texto, pero la sesión se cerraba ' +
  'igual a mitad de un dictado de media hora. Era el consuelo, no el arreglo.'
