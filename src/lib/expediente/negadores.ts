/**
 * EL VOCABULARIO DE LA NEGACIÓN — ESCRITO UNA SOLA VEZ.
 *
 * ── EL CASO (7-ago-2026) ─────────────────────────────────────────────────────
 *
 * «No padece alergia a penicilina» quedaba registrado como un alérgeno llamado
 * literalmente **«No padece alergia a penicilina»**. El cruce alergia↔fármaco
 * busca el nombre del fármaco DENTRO del texto del alérgeno, así que esa cadena
 * contiene «penicilina» y dispara la alerta crítica —la que apaga el botón de
 * Firmar— justo en el paciente que acababa de negar la alergia.
 *
 * En el mismo dictado, «No padece diabetes» salía como **antecedente positivo**:
 * una enfermedad crónica que nadie tiene y que se arrastra a todas las notas
 * siguientes.
 *
 * ── POR QUÉ PASABA ───────────────────────────────────────────────────────────
 *
 * Había **cuatro** listas de negadores, cada una en su archivo, y ninguna sabía
 * de las otras:
 *
 * | Archivo | Tenía | Le faltaba |
 * |---|---|---|
 * | `expediente/negaciones.ts` | `padece`, `padezco` | `presenta`, `nunca` |
 * | `expediente/parser-clinico.ts` | `presenta`, `nunca` | `padece`, `sufre` |
 * | `seguridad/alergias.ts` | `no refiere`, `no conocidas` | `padece`, `sufre`, `nunca` |
 * | `asr/guardian-sustituciones.ts` | `observa`, `palpa`, `ausculta` | `padece`, `nunca` |
 *
 * Cada una creció el día que un defecto la tocó a ella. El verbo que se añadía
 * para cerrar un fallo no llegaba a los otros tres sitios, así que el MISMO
 * defecto seguía vivo en las otras tres pantallas. «Padece» —el verbo con el que
 * un paciente mexicano contesta el interrogatorio— sólo lo conocía uno.
 *
 * ── QUÉ RESUELVE ESTE MÓDULO Y QUÉ NO ────────────────────────────────────────
 *
 * Resuelve el vocabulario: los verbos viven aquí y se comparten. **No resuelve
 * el anclaje**, que es política de cada sitio y no puede ser común: el campo de
 * alergias exige que la negación abra el fragmento (`^`), mientras el parser la
 * busca en una ventana hacia atrás. Por eso cada llamador arma su propia
 * expresión con los grupos que le tocan, a la vista.
 *
 * Es **vocabulario, no criterio**: que falte una forma significa que ese caso no
 * se vigila, no que se dé por bueno.
 *
 * Módulo PURO, sin dependencias.
 */

/**
 * «Niega», «negado», «descarta». El grupo que nadie discute: son verbos cuya
 * única lectura posible es la negación, vengan donde vengan.
 */
export const NIEGA_EXPLICITO = String.raw`nieg[ao]n?|negad[ao]s?|descart[ao]n?|descartad[ao]s?|se\s+descarta`

/**
 * «No» + verbo — EL GRUPO QUE SE DESINCRONIZÓ.
 *
 * Aquí estaban los cuatro huecos. `padece`/`padezco` es la forma con la que se
 * contesta el interrogatorio dirigido en México («no padece diabetes»), y sólo
 * la conocía uno de los cuatro archivos; `sufre`/`sufro` y `cuenta con` no las
 * conocía ninguno.
 */
export const NO_MAS_VERBO = String.raw`no\s+(?:tiene|tengo|padece|padezco|presenta|presento|refiere|refiero|sufre|sufro|hay|cuenta\s+con|conocid[ao]s?|ha\s+tenido|ha\s+padecido|ha\s+presentado)`

/** «Nunca ha tenido», «nunca tuvo». La forma larga va primero por claridad. */
export const NUNCA = String.raw`nunca\s+(?:ha\s+tenido|ha\s+padecido|ha|tuvo)`

/** Ausencia declarada: la forma escrita, la de quien redacta la nota. */
export const AUSENCIA = String.raw`ausencia\s+de|ausente[s]?|negativo\s+para|sin\s+antecedente[s]?\s+de`

/**
 * `sin` a secas — APARTE, y a propósito.
 *
 * No entra en el grupo común porque suelto niega de más: «sin control de la
 * diabetes» y «sin apego al tratamiento» hablan de una diabetes que **sí**
 * existe. Lo usan los sitios que ya lo tenían y que miran sólo hacia atrás en
 * una ventana corta; ninguno lo hereda por accidente.
 */
export const SIN_SUELTO = String.raw`sin`

/** «Ninguna», «ninguno» — respuesta entera al campo de alergias. */
export const NINGUNO = String.raw`ningun[ao]s?`

/**
 * Lo que el explorador no encuentra: «no se observa», «no se palpa».
 *
 * Es negación de EXPLORACIÓN, no de antecedente. Vive aquí para que el
 * vocabulario esté completo en un solo sitio, pero sólo lo compone quien vigila
 * texto de exploración —el guardián de sustituciones—; a un campo de alergias no
 * le aporta nada y le ensancharía el filtro sin motivo.
 */
export const NO_SE_EXPLORA = String.raw`no\s+se\s+(?:observa|palpa|ausculta|aprecia|evidencia)`

/**
 * Los verbos que AFIRMAN, y que por tanto cierran una negación anterior.
 *
 * Van en el mismo archivo que los negadores porque son la otra cara de la misma
 * moneda y se desincronizaron igual: `parser-clinico` conocía `tiene` pero no
 * `padece`, así que «niega tabaquismo, **padece diabetes**» borraba una diabetes
 * REAL —la negación del tabaquismo se derramaba sobre la enfermedad siguiente—
 * mientras «niega tabaquismo, tiene diabetes» funcionaba. Dos frases que un
 * médico escribe indistintamente, con desenlaces opuestos.
 *
 * Quien los use debe descartar el afirmador que va precedido de `no`/`nunca`/
 * `sin`, porque ahí el verbo forma parte del negador y no lo cierra.
 */
export const AFIRMA = String.raw`presenta|refiere|tiene|tuvo|padece|padecio|sufre|cursa\s+con|acude\s+por|en\s+tratamiento|con\s+diagnostico|diagnosticad[oa]`

/**
 * Une varios grupos en una alternancia. No pone anclas ni banderas: eso lo
 * decide el llamador, porque el anclaje es política suya (ver cabecera).
 */
export function unir(...grupos: readonly string[]): string {
  return grupos.join('|')
}
