/**
 * QUÉ SOBREVIVE A UN FALLO — la degradación de la consulta, como decisión.
 *
 * ── POR QUÉ EXISTE ESTE MÓDULO ──────────────────────────────────────────────
 *
 * La política ya se cumplía: cuando la IA o la evidencia fallan, la consulta
 * degrada el trabajo secundario y **no toca el contenido clínico**. Lo que no
 * existía era una forma de comprobarlo que no fuera **leer el código fuente**.
 *
 * `consultorio-degradacion-segura` lo hacía así: recortaba la rama de error del
 * archivo de la pantalla y comprobaba que ese trozo no contuviera
 * `setDiagnosticos([])`. Eso vigila la FORMA del código, no la propiedad:
 *
 *  · pasa a verde si alguien mueve el borrado dos líneas más abajo del corte;
 *  · se pone rojo si alguien reformatea sin cambiar nada;
 *  · y no dice nada de las ramas de error que se escriban mañana.
 *
 * El censo lo llamó por su nombre: «la degradación de la CONSULTA se comprueba
 * hoy por substring y no por comportamiento».
 *
 * ── LA DECISIÓN, SEPARADA DE LA PANTALLA ────────────────────────────────────
 *
 * Aquí vive la respuesta a una pregunta: **ante este fallo, qué se detiene y qué
 * se conserva**. Con eso, la propiedad se prueba ejecutándola —para cada clase de
 * fallo, sin excepción— en vez de mirando cómo está escrito el manejador.
 *
 * ── POR QUÉ `conserva` ES LA MISMA LISTA PARA TODAS ─────────────────────────
 *
 * Porque la respuesta correcta a «¿qué contenido clínico puede borrar un fallo
 * técnico?» es **ninguno**, y no depende de qué haya fallado. Que la lista sea
 * constante no es pereza: es la política. Si algún día una clase de fallo
 * necesitara conservar menos, tendría que escribirlo aquí y explicarlo — que es
 * exactamente la conversación que hay que tener antes, no después.
 *
 * Módulo PURO.
 */

/** Lo que un fallo técnico NUNCA puede borrar. */
export type CampoClinico =
  | 'secciones' | 'diagnosticos' | 'medicamentos'
  | 'transcripcion' | 'signos' | 'alergias'

export const LO_QUE_NUNCA_SE_PIERDE: readonly CampoClinico[] = Object.freeze([
  'secciones', 'diagnosticos', 'medicamentos', 'transcripcion', 'signos', 'alergias',
])

/**
 * Las clases de fallo que la consulta sabe degradar.
 *
 * Lista CERRADA: una clase nueva no puede colarse sin decidir qué detiene. El
 * `switch` de abajo es exhaustivo y TypeScript lo comprueba.
 */
export type ClaseDeFallo =
  | 'ia_respuesta_ilegible'
  | 'ia_red'
  | 'evidencia_http'
  | 'evidencia_red'

/** Qué trabajo SECUNDARIO se detiene. Nunca la nota: la nota no es secundaria. */
export type QueSeDetiene = 'procesamiento_de_la_nota' | 'analisis_de_evidencia'

export interface Degradacion {
  readonly clase: ClaseDeFallo
  /** Lo que se le dice al médico. */
  readonly mensaje: string
  readonly detiene: QueSeDetiene
  /** El contenido clínico que sigue intacto. */
  readonly conserva: readonly CampoClinico[]
}

export interface DetalleDelFallo {
  /** Código HTTP, cuando el fallo viene de una respuesta. */
  readonly estado?: number
  /** Lo que dijo el servidor o la excepción, ya recortado por quien llama. */
  readonly dijo?: string
}

/**
 * ── EL MENSAJE DE «RESPUESTA ILEGIBLE» DICE ALGO QUE LOS OTROS NO ───────────
 *
 * «Tu nota NO se modificó» sólo aparece ahí, y es deliberado: ése es el fallo que
 * ocurre DESPUÉS de que la petición saliera con la nota dentro, así que es el
 * único donde el médico puede razonablemente temer que le hayan tocado el texto.
 *
 * En los otros tres el trabajo ni siquiera empezó, y añadir la misma frase sería
 * sembrar una duda que nadie tenía.
 */
export function comoSeDegrada(clase: ClaseDeFallo, detalle: DetalleDelFallo = {}): Degradacion {
  const base = { clase, conserva: LO_QUE_NUNCA_SE_PIERDE }
  switch (clase) {
    case 'ia_respuesta_ilegible':
      return {
        ...base,
        mensaje: 'La IA no respondió correctamente. Tu nota NO se modificó; intenta de nuevo.',
        detiene: 'procesamiento_de_la_nota',
      }
    case 'ia_red':
      return { ...base, mensaje: 'Error al conectar con la IA', detiene: 'procesamiento_de_la_nota' }
    case 'evidencia_http':
      return {
        ...base,
        mensaje: detalle.dijo || `No se pudo analizar (HTTP ${detalle.estado ?? '—'})`,
        detiene: 'analisis_de_evidencia',
      }
    case 'evidencia_red':
      return {
        ...base,
        mensaje: `Error de red al analizar (${detalle.dijo ?? ''})`,
        detiene: 'analisis_de_evidencia',
      }
  }
}

export const POR_QUE_NO_SE_COMPRUEBA_LEYENDO_EL_CODIGO =
  'Recortar la rama de error del archivo y comprobar que ese trozo no contiene '
  + '`setDiagnosticos([])` vigila la FORMA del código, no la propiedad: pasa a '
  + 'verde si alguien mueve el borrado dos líneas más abajo del corte, se pone '
  + 'rojo si alguien reformatea sin cambiar nada, y no dice nada de las ramas de '
  + 'error que se escriban mañana.'

export const POR_QUE_LA_LISTA_NO_CAMBIA_POR_CLASE =
  'La respuesta correcta a «¿qué contenido clínico puede borrar un fallo '
  + 'técnico?» es NINGUNO, y no depende de qué haya fallado. Si una clase '
  + 'necesitara conservar menos, tendría que escribirse aquí y explicarse — que '
  + 'es la conversación que hay que tener antes, no después.'
