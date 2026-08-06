/**
 * LA VERSIÓN DEL PROMPT, Y UN CANDADO PARA QUE NO SE QUEDE ATRÁS.
 *
 * ── EL DEFECTO (6-ago-2026, REG-191) ─────────────────────────────────────────
 *
 * `PROMPT_VERSION` se sella en cada nota (`_promptVersion`) y es lo único que
 * permite responder a la pregunta que importa cuando algo sale mal: **«¿qué
 * notas se generaron con el prompt que tenía el fallo?»**.
 *
 * En la noche del 5 al 6 de agosto el prompt cambió **siete veces** —regla 1-bis,
 * 6-bis, 6-ter, 19-bis, la 22 reescrita, la 17 acotada, dos campos retirados— y
 * la versión siguió diciendo `nota-2026-08`. Dos notas con la misma etiqueta
 * podían venir de prompts distintos, así que el lote afectado por un fallo
 * clínico **no se podía acotar**. Es un requisito de IEC 62304, y era humo.
 *
 * Y el único test que la miraba la **pineaba al literal**, así que subirla
 * rompía la suite: el candado estaba puesto justo del lado que impedía hacerlo
 * bien.
 *
 * ── CÓMO SE IMPIDE QUE VUELVA ────────────────────────────────────────────────
 *
 * Aquí vive la versión **y una huella del contenido** de los dos archivos que le
 * llegan al modelo. Una prueba compara la huella real con la declarada: si el
 * prompt cambia y la versión no, la suite se pone roja con el número nuevo
 * delante.
 *
 * ── POR QUÉ LA HUELLA ES DEL ARCHIVO ENTERO, COMENTARIOS INCLUIDOS ───────────
 *
 * Un comentario no cambia lo que ve el modelo, así que obligar a subir versión
 * por un comentario parece de más. Se hace igualmente, y a propósito:
 *
 * · La alternativa —intentar hashear «sólo lo que llega al modelo»— exige
 *   ejecutar la construcción del prompt para cada tipo de nota, cada
 *   especialidad y cada conjunto de instrucciones. Un candado que no se puede
 *   calcular con certeza no es un candado.
 * · En un sistema regulado la versión identifica **el artefacto**, no sólo su
 *   comportamiento. Dos builds con el mismo `PROMPT_VERSION` deberían ser el
 *   mismo archivo, punto.
 * · El coste de versionar de más es una línea. El de versionar de menos es no
 *   poder acotar un lote de notas clínicas.
 *
 * Módulo PURO.
 */

/**
 * La versión que se sella en cada nota.
 *
 * Formato `nota-AAAA-MM-DD-N`: la fecha del cambio y un contador dentro del día,
 * porque en una noche de trabajo puede cambiar varias veces.
 */
export const PROMPT_VERSION = 'nota-2026-08-06-1'

/**
 * Los archivos cuyo contenido ES el prompt.
 *
 * `confianza-audio.ts` está aquí porque es **la otra ruta** por la que le llegan
 * instrucciones al modelo, y por la que se coló REG-180: arreglar sólo el prompt
 * principal dejó viva la orden vieja por este lado.
 */
export const ARCHIVOS_DEL_PROMPT: readonly string[] = [
  'src/lib/expediente/prompts.ts',
  'src/lib/expediente/confianza-audio.ts',
]

/**
 * La huella declarada para esta versión.
 *
 * La calcula y la comprueba `src/__tests__/la-version-del-prompt-no-miente.test.ts`.
 * Cuando falla, el mensaje trae la huella nueva: se copia aquí **junto con** una
 * versión nueva arriba. Copiar sólo la huella es saltarse el candado.
 */
export const HUELLA_DEL_PROMPT = '84afed59b482cd66'

export const POR_QUE_IMPORTA =
  'Es lo único que permite responder «¿qué notas se generaron con el prompt que ' +
  'tenía el fallo?». Sin ella el lote afectado no se puede acotar, y eso en un ' +
  'expediente clínico no es un detalle de proceso.'

export const POR_QUE_LA_HUELLA_ES_DEL_ARCHIVO =
  'Hashear «sólo lo que llega al modelo» exigiría construir el prompt para cada ' +
  'tipo de nota, especialidad e instrucciones. Un candado que no se puede ' +
  'calcular con certeza no es un candado. Y en un sistema regulado la versión ' +
  'identifica el artefacto: dos builds con la misma versión deberían ser el ' +
  'mismo archivo.'

export const COMO_SE_SUBE =
  'Cuando la prueba falla trae la huella nueva. Se copia aquí JUNTO CON una ' +
  'versión nueva arriba. Copiar sólo la huella es saltarse el candado — y deja ' +
  'notas distintas con la misma etiqueta, que es el defecto original.'
