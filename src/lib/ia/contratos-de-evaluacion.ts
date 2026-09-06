/**
 * EL CONTRATO DE EVALUACIÓN DE CADA CAPACIDAD DE IA — WS-12.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `ia/evaluacion.ts` es un buen instrumento: mide exactitud por campo, campos
 * faltantes y una proxy de alucinación. Lo que faltaba es lo que convierte una
 * medición en una compuerta:
 *
 *     ¿qué conjunto se mide? · ¿con qué métrica? · ¿a partir de qué número está
 *     bien? · ¿y qué hace el producto cuando NO lo está?
 *
 * **Sin umbral con significado, una métrica es decorativa.** Un 0,87 no dice
 * nada si nadie dijo qué pasa por debajo de qué.
 *
 * ── LA REGLA QUE MANDA AQUÍ, Y QUE NO SE NEGOCIA ────────────────────────────
 *
 * **El umbral de una capacidad clínica es una decisión del médico, no de quien
 * escribe el código.** Cuánta pérdida de medicamentos es tolerable al extraer
 * una nota es exactamente la clase de cifra que la regla 1 de seguridad clínica
 * prohíbe inventar.
 *
 * Así que aquí un umbral es **un número con fuente** o es
 * `NEEDS_CLINICAL_REVIEW` con quién tiene que decidirlo. Nunca «lo habitual».
 * Poner 0,95 porque suena bien sería el fallo más caro posible: no rompe nada,
 * no falla ninguna prueba, y convierte una decisión clínica no tomada en una
 * compuerta que parece acordada.
 *
 * ── LO QUE SÍ SE PUEDE DECIDIR SIN EL MÉDICO ────────────────────────────────
 *
 * Todo lo demás, y no es poco: **qué capacidades existen**, qué decide cada una,
 * **qué cuesta que se equivoque**, si hay conjunto de referencia o no lo hay, y
 * **qué hace el producto cuando falla**. Eso último es una propiedad del código
 * y se puede comprobar hoy.
 *
 * De hecho, la consecuencia del error es lo que hace *discutible* el umbral: sin
 * ella, un número es una preferencia; con ella, se puede argumentar.
 *
 * ── EL NOMBRE DE LA CAPACIDAD ES UNO SOLO ───────────────────────────────────
 *
 * Este archivo es también el censo de nombres. Hacía falta: tres rutas usaban
 * **dos nombres distintos para la misma capacidad** —uno para el libro de costos
 * y otro para el registro de incidencias—, así que «qué está fallando» y «qué
 * está costando» no se podían cruzar. Ver REG-399.
 */

/** Un umbral que nadie con cédula ha fijado todavía. */
export const PENDIENTE_DEL_MEDICO = 'NEEDS_CLINICAL_REVIEW' as const

export interface UmbralDecidido {
  readonly valor: number
  /** De dónde sale. Un número sin esto es una preferencia disfrazada. */
  readonly fuente: string
  /**
   * CUANDO UNA CAPACIDAD TIENE DOS EJES DE ERROR CON COSTES DISTINTOS — REG-594.
   *
   * `nota-consulta` es el caso que lo obligó. Sus dos errores no cuestan lo
   * mismo, y el médico dueño los fijó distintos a propósito:
   *
   *  · **perder** un medicamento que se dictó → lo notas al leer la nota.
   *  · **añadir** uno que nadie dictó → sale impreso con cédula profesional, y
   *    nadie lo busca porque nadie sabe que está.
   *
   * Meter los dos en un solo número habría borrado justo la asimetría que él
   * decidió. `valor` sigue siendo el umbral principal —el más laxo de los dos,
   * para que quien lea sólo ese campo no se lleve una impresión mejor de la
   * real— y aquí van los ejes con su nombre.
   */
  readonly ejes?: readonly { readonly nombre: string; readonly valor: number; readonly porQue: string }[]
}

export type Umbral =
  | UmbralDecidido
  | { readonly [PENDIENTE_DEL_MEDICO]: string }

/** Qué hace el producto cuando la capacidad falla o no alcanza. */
export type PoliticaDeFallo =
  /** Se sigue sin ella y se DICE en pantalla. */
  | 'degrada_y_lo_dice'
  /** Se le pregunta al médico en vez de adivinar. */
  | 'pregunta_al_medico'
  /** No se produce salida: mejor nada que algo inventado. */
  | 'no_produce_salida'
  /** Se reintenta o se rechaza al momento, sin encolar. */
  | 'rechaza_al_momento'

export interface ContratoDeEvaluacion {
  /** El nombre canónico. El MISMO que se manda al libro de costos y al registro
   *  de incidencias: dos nombres para una capacidad rompen los dos registros. */
  readonly capacidad: string
  readonly ruta: string
  /** Qué decide, en términos de lo que le pasa al paciente o a la nota. */
  readonly queDecide: string
  /** Qué cuesta que se equivoque. Es lo que hace discutible el umbral. */
  readonly consecuenciaDelError: string
  /** Dónde vive el conjunto de referencia, o por qué no existe. */
  readonly conjunto: string
  readonly metrica: string
  readonly umbral: Umbral
  readonly politicaDeFallo: PoliticaDeFallo
}

const C = (c: ContratoDeEvaluacion) => c

/** Cuando el umbral lo tiene que fijar el médico, se dice QUÉ hay que decidir. */
const pendiente = (que: string): Umbral => ({ [PENDIENTE_DEL_MEDICO]: que })

export const CONTRATOS: readonly ContratoDeEvaluacion[] = Object.freeze([
  C({
    capacidad: 'nota-consulta', ruta: 'src/app/api/expediente/procesar/route.ts',
    queDecide: 'Redacta la nota estructurada a partir del dictado: secciones, diagnósticos y medicamentos.',
    consecuenciaDelError: 'Un medicamento perdido al extraer no aparece en la receta ni en la lista activa. Un medicamento AÑADIDO acaba impreso con cédula profesional.',
    conjunto: 'src/lib/ia/casos-oro.ts (sintético). El estudio sobre dictados reales de-identificados es del dueño y no existe todavía.',
    metrica: 'exactitud por campo y proxy de alucinación (`ia/evaluacion.ts`)',
    umbral: {
      /**
       * DECIDIDO por el médico dueño el 31-ago-2026 (D-042). Dos ejes, porque
       * sus dos errores no cuestan lo mismo — ver `UmbralDecidido.ejes`.
       *
       * `valor` es el más LAXO de los dos, a propósito: quien lea sólo este
       * campo no puede llevarse una impresión mejor que la real.
       */
      valor: 0.01,
      fuente:
        'DECIDIDO por el médico dueño el 31-ago-2026 (D-042), sobre la métrica de '
        + '`ia/evaluacion.ts` y el conjunto sintético de `casos-oro.ts`. Se le '
        + 'plantearon 0 %, 1 %, 5 % y «no reprueba, sólo se mide» para cada eje, y '
        + 'la advertencia de que un umbral inalcanzable deja la compuerta siempre '
        + 'en rojo y se deja de mirar.',
      ejes: [
        {
          nombre: 'perdida',
          valor: 0.01,
          porQue:
            'Hasta 1 de cada 100 medicamentos o diagnósticos dictados puede faltar. '
            + 'Exigente pero medible: deja margen para el caso raro —un fármaco dicho '
            + 'a medias, un nombre que el léxico no tiene— sin normalizar la pérdida. '
            + 'Se descartó el 0 % porque un umbral inalcanzable deja la compuerta '
            + 'siempre en rojo, y una compuerta siempre roja se deja de mirar.',
        },
        {
          nombre: 'alucinacion',
          valor: 0,
          porQue:
            'CERO. Aquí la asimetría sí justifica el cero: un medicamento perdido se '
            + 'nota al leer la nota; uno AÑADIDO sale impreso con cédula profesional '
            + 'y nadie lo busca, porque nadie sabe que está. Es el fallo más caro que '
            + 'este producto puede cometer, y coincide con la regla 1 — nada se '
            + 'inventa.',
        },
      ],
    },
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'transcribir', ruta: 'src/app/api/expediente/transcribir/route.ts',
    queDecide: 'Convierte el audio de la consulta en texto. Es la fuente de todo lo demás.',
    consecuenciaDelError: 'Una palabra mal oída en una cifra o una unidad viaja a la nota, a la receta y al expediente. El error se lee bien.',
    conjunto: 'CORRECCIÓN DEL CENSO (REG-596): esto decía «no existe gold de voz… todavía no está», y sí existe — `synthetic-data/dialogos-consulta/`: 12 diálogos actuados con guion (el oro) y la salida real del motor. Sigue sin poder nacer de audio real: la voz es biométrica (regla de datos). 532 palabras de oro: pequeño, y por eso lo que NO cubre se declara en `LO_QUE_ESTE_CONJUNTO_NO_MIDE`.',
    metrica: 'WER ponderado por consecuencia clínica, no WER a secas (TR-VOZ.error-clinicamente-pesado)',
    umbral: {
      /**
       * El valor suelto es el MÁS LAXO de los tres ejes, igual que en D-042:
       * quien lea sólo este campo no puede llevarse mejor impresión que la real.
       */
      valor: 0.05,
      fuente:
        'TRES ejes, y sólo UNO lo decidió el médico. Los dos ceros salen de una regla YA ESCRITA '
        + '(`src/lib/asr/politica-critica.ts`): un cambio de cifra, de unidad o de lateralidad está '
        + 'PROHIBIDO, no penalizado — no entra en ninguna media, porque una media se compensa con '
        + 'volumen. El tercero, el error ordinario, lo fijó el médico dueño el 1-sep-2026 (D-043) sobre '
        + 'la medición real de `synthetic-data/dialogos-consulta`, que ese día daba 1,7 %.',
      ejes: [
        {
          nombre: 'criticos', valor: 0,
          porQue:
            'CERO, y no es una preferencia: `politica-critica.ts` dice que estas sustituciones están '
            + 'prohibidas, no penalizadas. Un peso —por alto que sea— se compensa con frases buenas.',
        },
        {
          nombre: 'sinClasificar', valor: 0,
          porQue:
            'CERO por la misma razón, y por una más: si «no sé qué es esto» no reprobara, el módulo '
            + 'saldría tanto más limpio cuanto menos supiera reconocer. Ausencia de dato no es dato de '
            + 'ausencia, también en una métrica.',
        },
        {
          nombre: 'ordinario', valor: 0.05,
          porQue:
            'DECIDIDO por el médico dueño el 1-sep-2026 (D-043), con la medición delante: 1,7 % ese día. '
            + 'Se plantearon 2 %, 5 %, 10 % y ninguno. Eligió 5 % —tres veces lo medido— porque esto no '
            + 'vigila la calidad de la redacción: vigila un DERRUMBE. Si el proveedor degrada el modelo '
            + 'en silencio (ya pasó: REG-167) el error ordinario sube y los críticos siguen en cero, así '
            + 'que sin este techo no se entera nadie. Se descartó el 2 % por quedar tan pegado a la '
            + 'medición que un solo diálogo malo lo pondría rojo, y una compuerta que se pone roja por '
            + 'ruido se deja de mirar.',
        },
      ],
    },
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'transcribir-diarizado', ruta: 'src/app/api/expediente/transcribir-diarizado/route.ts',
    queDecide: 'Transcribe separando quién habla. Es el camino preferente; Whisper es el respaldo.',
    consecuenciaDelError: 'Atribuir al paciente lo que dijo el médico —o al revés— cambia el sentido de la nota entera.',
    conjunto: 'Mismo hueco que la transcripción: sin gold actuado no hay medida.',
    metrica: 'error de atribución de hablante',
    umbral: pendiente('Cuántas atribuciones cruzadas por consulta son tolerables antes de preferir la transcripción sin separar.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'transcribir-chunk', ruta: 'src/app/api/expediente/transcribir-chunk/route.ts',
    queDecide: 'Transcribe un trozo de una consulta larga. Mismo contrato que la transcripción entera.',
    consecuenciaDelError: 'El mismo de la transcripción entera, más el riesgo propio de esta forma: perder o duplicar lo dicho justo en la costura entre dos trozos, que es donde nadie mira.',
    conjunto: 'Sin gold, igual que los otros dos caminos de voz.',
    metrica: 'WER ponderado + continuidad entre trozos',
    umbral: pendiente('Igual que la transcripción, más cuánta pérdida en la costura es aceptable.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'corregir-transcripcion', ruta: 'src/app/api/expediente/corregir/route.ts',
    queDecide: 'Corrige el texto ya transcrito con el léxico del consultorio.',
    consecuenciaDelError: 'Una corrección equivocada CAMBIA lo que dijo el médico. Por eso toda corrección automática es visible y reversible (seguridad clínica §3).',
    conjunto: 'Los pares corregidos del propio consultorio; no hay conjunto de referencia externo.',
    metrica: 'correcciones aceptadas por el médico frente a deshechas',
    umbral: pendiente('A partir de qué proporción de correcciones deshechas se deja de sugerir. Toca la autoridad del médico sobre su dictado.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'atribuir-roles', ruta: 'src/app/api/expediente/atribuir-roles/route.ts',
    queDecide: 'Decide qué frase es del médico y cuál del paciente cuando el reconocedor no separó voces.',
    consecuenciaDelError: 'Un antecedente del acompañante atribuido al paciente entra al expediente como suyo.',
    conjunto: 'No existe. Haría falta un diálogo actuado con la atribución marcada por quien lo actuó; ningún audio de paciente puede entrar (la voz es biométrica).',
    metrica: 'exactitud de atribución por frase',
    umbral: pendiente('Igual que la diarización: cuántas atribuciones cruzadas se toleran.'),
    politicaDeFallo: 'pregunta_al_medico',
  }),
  C({
    capacidad: 'extraer-entidades', ruta: 'src/app/api/expediente/extraer-entidades/route.ts',
    queDecide: 'Saca del texto los medicamentos, diagnósticos, alergias y estudios.',
    consecuenciaDelError: 'Una alergia que no se extrae no vigila nada. Una que se inventa bloquea un tratamiento correcto.',
    conjunto: 'src/lib/ia/casos-oro.ts (sintético).',
    metrica: 'sensibilidad y precisión por tipo de entidad',
    umbral: pendiente('El umbral no puede ser uno solo: perder una alergia no cuesta lo mismo que perder un estudio. Hace falta un número por tipo de entidad, y lo fija el médico.'),
    politicaDeFallo: 'pregunta_al_medico',
  }),
  C({
    capacidad: 'verificar-nota', ruta: 'src/app/api/expediente/verificar-nota/route.ts',
    queDecide: 'Revisa la nota redactada contra el dictado antes de que el médico firme.',
    consecuenciaDelError: 'Un falso negativo deja pasar el error que venía a cazar; un falso positivo entrena a ignorar el aviso.',
    conjunto: 'Sin conjunto propio: se apoya en los casos oro de la nota.',
    metrica: 'sensibilidad a discrepancias introducidas a propósito',
    umbral: pendiente('Cuántos avisos falsos por nota son tolerables antes de que el médico deje de leerlos. Es una decisión de uso clínico.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'evidencia', ruta: 'src/app/api/expediente/evidencia/route.ts',
    queDecide: 'Trae y resume evidencia para el caso que el médico tiene delante.',
    consecuenciaDelError: 'Una cita que no sostiene lo que se afirma es una afirmación sin respaldo con aspecto de tenerlo.',
    conjunto: 'Las doce preguntas de V9 son fixture del lado del paciente; para el lado del médico no hay conjunto.',
    metrica: 'entailment: la cita SOSTIENE la afirmación, no sólo la contiene (WS-12.entailment, sin implementar)',
    umbral: pendiente('Qué proporción de citas no sostenidas hace inutilizable el módulo. Necesita antes el medidor de entailment.'),
    politicaDeFallo: 'no_produce_salida',
  }),
  C({
    capacidad: 'evidencia-consultas', ruta: 'src/app/api/expediente/evidencia/route.ts',
    queDecide: 'Traduce el caso clínico a las consultas con las que se busca en PubMed.',
    consecuenciaDelError: 'Una consulta mal formada devuelve vacío, y un vacío se lee como «no hay evidencia».',
    conjunto: 'No existe. Haría falta una lista de casos clínicos con las consultas que un documentalista habría escrito para cada uno.',
    metrica: 'proporción de búsquedas que devuelven al menos un artículo pertinente',
    umbral: pendiente('A partir de qué proporción de búsquedas vacías conviene decirle al médico que busque él.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'consultor-evidencia', ruta: 'src/app/api/consultor-evidencia/route.ts',
    queDecide: 'Responde una pregunta clínica citando los artículos que la respaldan.',
    consecuenciaDelError: 'Una cifra de dosis sin respaldo, o un PMID inventado. El prompt lo prohíbe; la comprobación de citas es determinista en el cliente.',
    conjunto: 'No existe conjunto de preguntas clínicas con respuesta de referencia.',
    metrica: 'citas verificables + ausencia de cifras de dosis sin fuente',
    umbral: { valor: 0, fuente: 'Regla 1 de seguridad clínica: ninguna cifra de dosis sin fuente citada. El umbral es CERO y no es una preferencia — está escrito en `.claude/rules/clinical-safety.md`.' },
    politicaDeFallo: 'no_produce_salida',
  }),
  C({
    capacidad: 'receta-detectar-campos', ruta: 'src/app/api/receta/detectar-campos/route.ts',
    queDecide: 'Detecta dónde van los campos en el papel membretado del médico.',
    consecuenciaDelError: 'Un campo mal colocado imprime una receta ilegible o con el dato en el sitio de otro.',
    conjunto: 'No existe; son los membretes de cada consultorio.',
    metrica: 'campos colocados correctamente sobre membretes de prueba',
    umbral: pendiente('Cuánto desajuste es tolerable antes de pedirle al médico que lo coloque a mano.'),
    politicaDeFallo: 'pregunta_al_medico',
  }),
  C({
    capacidad: 'laboratorio-vision', ruta: 'src/app/api/expediente/laboratorio-vision/route.ts',
    queDecide: 'Lee una hoja de laboratorio fotografiada y saca los valores.',
    consecuenciaDelError: 'Un valor mal leído es una cifra clínica falsa en el expediente, con su unidad y su rango.',
    conjunto: '`synthetic-data/laboratorio-hojas/HOJAS.jsonl` (REG-597): 8 hojas sintéticas, 46 filas, escritas como se imprimen en México — abreviaturas («Glu», «TGO», «Hto»), coma decimal, valores censurados («>400»), unidades del SI y analitos fuera del catálogo. Ninguna hoja real puede entrar sin ser sintética (regla de datos). MIDE EL FOSO DETERMINISTA, NO LA VISIÓN: las filas entran como si el modelo las hubiera leído perfectas, así que dos de los tres ejes sólo se ejercen al revés. Medir la visión de verdad pide imágenes y llamadas de API, y es la mitad que falta.',
    metrica: 'exactitud por analito, con la unidad',
    umbral: {
      /** El más LAXO de los tres ejes, igual que en D-042 y D-043. */
      valor: 0.05,
      fuente:
        'DECIDIDO por el médico dueño el 1-sep-2026 (D-044), sobre `synthetic-data/laboratorio-hojas`. TRES ejes, '
        + 'porque los errores no cuestan lo mismo. Y queda UNA pregunta sin hacerle, declarada a propósito en '
        + 'LO_QUE_NO_SE_LE_PREGUNTO_DEL_LABORATORIO: cuántos analitos INVENTADOS se toleran. Se mide y se reporta, '
        + 'pero no se le pone umbral, porque no se lo pregunté y no se adivina.',
      ejes: [
        {
          nombre: 'valorMalLeido', valor: 0,
          porQue:
            'CERO. Una creatinina de 1,2 que sale 12 es una cifra clínica FALSA en el expediente, y no se ve al leer '
            + 'el panel porque tiene la forma correcta: entra a la gráfica de tendencia y a los cálculos renales. '
            + 'Se plantearon 1 %, 1 ‰ y «cero para la unidad, 1 % para el valor»; eligió cero para los dos.',
        },
        {
          nombre: 'unidadMalLeida', valor: 0,
          porQue:
            'CERO por la misma razón y una peor: la unidad cambia el significado entero. Es el fallo que la auditoría '
            + 'de julio de 2026 ya había cazado —un valor de pánico en una unidad rara archivado como normal—, y por '
            + 'eso existe `noEvaluable`.',
        },
        {
          nombre: 'perdido', valor: 0.05,
          porQue:
            'MÁS LAXO que los otros dos a propósito, y el médico lo eligió sabiendo por qué: lo que falta SE NOTA '
            + '—la hoja sigue adjunta y el panel se ve corto— mientras que lo mal leído no. Además la fila perdida no '
            + 'desaparece: sobrevive como texto en `noReconocidas`. Se plantearon 1 %, 5 %, 10 % y «sólo se cuenta».',
        },
      ],
    },
    politicaDeFallo: 'pregunta_al_medico',
  }),
  C({
    capacidad: 'antibiograma-vision', ruta: 'src/app/api/expediente/antibiograma-vision/route.ts',
    queDecide: 'Lee un antibiograma fotografiado: microorganismo y sensibilidades.',
    consecuenciaDelError: 'Leer «sensible» donde dice «resistente» elige el antibiótico equivocado para una infección grave.',
    conjunto: 'No existe; sería sintético o actuado.',
    metrica: 'exactitud por par fármaco–interpretación',
    umbral: pendiente('Tiende a cero por la consecuencia, pero el número y el uso permitido los fija el médico infectólogo.'),
    politicaDeFallo: 'pregunta_al_medico',
  }),
  C({
    capacidad: 'antibiograma-razonar', ruta: 'src/app/api/expediente/antibiograma-razonar/route.ts',
    queDecide: 'Razona sobre el antibiograma ya leído para sugerir opciones.',
    consecuenciaDelError: 'Una sugerencia sobre una lectura equivocada arrastra el error del paso anterior.',
    conjunto: 'No existe. Serían antibiogramas sintéticos con la elección que haría un infectólogo anotada al lado, y esa anotación sólo la puede hacer un infectólogo.',
    metrica: 'concordancia con la elección del infectólogo sobre casos sintéticos',
    umbral: pendiente('Qué concordancia hace útil la sugerencia sin que sustituya el criterio. Decisión clínica.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'inmuno-redactar', ruta: 'src/app/api/inmuno/redactar/route.ts',
    queDecide: 'Redacta el apartado del paciente inmunocomprometido.',
    consecuenciaDelError: 'El mismo de la nota, en la población donde un error cuesta más.',
    conjunto: 'Casos oro de inmunocomprometido; hoy comparten los de la nota.',
    metrica: 'exactitud por campo y proxy de alucinación',
    umbral: pendiente('Igual que la nota, y previsiblemente más exigente por la población.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'ayuda-bot', ruta: 'src/app/api/ayuda-bot/route.ts',
    queDecide: 'Contesta dudas del médico sobre CÓMO USAR el producto. No es una capacidad clínica.',
    consecuenciaDelError: 'Una instrucción de uso equivocada hace perder tiempo. No toca la nota ni al paciente.',
    conjunto: 'src/lib/ayuda/conocimiento.ts',
    metrica: 'respuestas ancladas en el material de ayuda',
    umbral: { valor: 0, fuente: 'No es umbral clínico: la regla es que no invente funciones que el producto no tiene, y eso es cero, no un porcentaje.' },
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
])

/** Los nombres canónicos. Es lo que el guardián compara contra el árbol. */
export function nombresCanonicos(): readonly string[] {
  return CONTRATOS.map(c => c.capacidad)
}

/**
 * ¿Este umbral lo tiene que fijar todavía alguien con cédula?
 *
 * Es un predicado de tipo a propósito (REG-595): la compuerta que aplica el
 * umbral necesita ESTRECHAR el tipo para leer `valor` y `ejes`, y si esto
 * devolviera un `boolean` a secas haría falta un `as` en el sitio exacto donde
 * un `as` mal puesto convertiría un umbral pendiente en un número.
 */
export function esperaAlMedico(u: Umbral): u is { readonly [PENDIENTE_DEL_MEDICO]: string } {
  return PENDIENTE_DEL_MEDICO in u
}

/** Las capacidades cuyo umbral sigue sin decidir. No es una vergüenza: es la lista de trabajo. */
export function sinUmbral(): readonly ContratoDeEvaluacion[] {
  return CONTRATOS.filter(c => esperaAlMedico(c.umbral))
}

export const POR_QUE_NO_SE_INVENTA_UN_UMBRAL =
  'Cuánta pérdida de medicamentos es tolerable al extraer una nota es una cifra ' +
  'clínica, y la regla 1 prohíbe inventarlas. Poner 0,95 porque suena bien sería ' +
  'el fallo más caro posible: no rompe nada, no falla ninguna prueba, y convierte ' +
  'una decisión clínica no tomada en una compuerta que parece acordada.'

export const POR_QUE_EL_NOMBRE_IMPORTA =
  'El nombre de la capacidad es la clave con la que se agrupan el libro de costos ' +
  'y el registro de incidencias. Tres rutas usaban DOS nombres para la misma ' +
  'capacidad —uno por registro—, así que «qué está fallando» y «qué está ' +
  'costando» no se podían cruzar. Un solo censo de nombres lo cierra de raíz.'

/* ═══════════════════════════════════════════════════════════════════════════
   LA COMPUERTA DEL UMBRAL — el número decidido se APLICA, no sólo se declara.

   ── POR QUÉ EXISTE (REG-595) ────────────────────────────────────────────────

   El 31-ago-2026 el médico dueño fijó el primer umbral (D-042, REG-594). Quedó
   escrito arriba, con su fuente y sus ejes… y **nadie corría nada contra él**:
   el arnés medía por un lado, el número vivía por otro, y entre los dos no había
   una sola función. Un umbral que no reprueba nada es exactamente lo que este
   archivo llama una métrica decorativa — sólo que la decoración la habríamos
   puesto nosotros, encima de una decisión que el médico sí tomó.

   Es la familia «escrito y sin conectar» de la regla *el dato tiene que LLEGAR*,
   aplicada a un número en vez de a un campo.

   ── POR QUÉ VIVE AQUÍ Y NO EN EL ARNÉS (REG-596) ────────────────────────────

   Nació dentro de `ia/evaluacion.ts`, pegada al único arnés que existía. Al día
   siguiente el médico fijó el umbral de `transcribir` (D-043) y ese se mide con
   OTRO instrumento —`asr/lo-que-pesa-de-un-error.ts`, que cuenta errores
   pesados, no campos—. Dos instrumentos, un solo tipo `Umbral`: la compuerta
   pertenece al tipo, no a uno de los dos medidores. Cada arnés traduce lo suyo a
   `LoMedido` y la comparación se hace UNA vez, en un sitio.

   La alternativa era una segunda compuerta para voz, con su propia idea de qué
   es «verde». Eso es exactamente lo que la política de este repositorio prohíbe.

   ── LO QUE NO ES VERDE ──────────────────────────────────────────────────────

   Tres cosas que un lector distraído leería como «pasa» y aquí no lo son:

    1. **Un umbral que todavía espera al médico.** `NEEDS_CLINICAL_REVIEW` no es
       permiso: es una decisión sin tomar.
    2. **Un conjunto vacío.** Cero casos dan cero errores. Si borrar el corpus
       pusiera la compuerta en verde, la compuerta mediría el corpus y no el
       producto.
    3. **Un eje que el arnés no sabe medir.** Si el contrato declara un eje que
       la medición no trae, se dice en vez de ignorarlo. Ausencia de medida no es
       medida de ausencia (seguridad clínica §4).
   ═════════════════════════════════════════════════════════════════════════ */

/** Lo que un arnés le entrega a la compuerta. Cada uno traduce lo suyo. */
export interface LoMedido {
  /** `false` cuando no se midió nada. Un conjunto vacío no es un aprobado. */
  readonly hayConjunto: boolean
  /** Nombre de eje → valor medido. Los nombres son los del contrato. */
  readonly ejes: Record<string, number>
  /** Nombre de eje → escalón mínimo distinto de cero que el conjunto distingue. */
  readonly resolucion: Record<string, number>
}

export interface EjeMedido {
  readonly nombre: string
  /** `null` cuando el arnés no sabe medir el eje que el contrato declara. */
  readonly medido: number | null
  readonly umbral: number
  readonly veredicto: 'pasa' | 'reprueba' | 'no_se_puede_medir'
  readonly resolucion: number
  /** El conjunto es tan pequeño que no puede distinguir el umbral del cero. */
  readonly elConjuntoNoAlcanzaElUmbral: boolean
}

export type Veredicto =
  /** Todos los ejes medidos quedan en o por debajo de su umbral. */
  | 'pasa'
  /** Al menos un eje se pasó. */
  | 'reprueba'
  /** El umbral lo tiene que fijar alguien con cédula. No es permiso. */
  | 'sin_umbral_decidido'
  /** No se midió nada. No es permiso. */
  | 'sin_conjunto'
  /** El contrato declara un eje que el arnés no sabe medir. No es permiso. */
  | 'sin_ejes_medibles'

export interface LecturaDeLaCompuerta {
  readonly veredicto: Veredicto
  readonly ejes: readonly EjeMedido[]
  readonly porQue: string
}

export const UN_SOLO_NUMERO_CUBRE_TODOS_LOS_EJES =
  'El contrato declara un umbral único, sin ejes. Se aplica el MISMO número a '
  + 'todos los que el arnés midió: repartirlo sería inventar una asimetría que nadie decidió.'

export const PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE =
  'El umbral de esta capacidad todavía lo tiene que fijar alguien con cédula. '
  + 'NEEDS_CLINICAL_REVIEW no es permiso: es una decisión sin tomar, y una '
  + 'compuerta que la leyera como aprobada convertiría el hueco en un visto bueno.'

export const PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE =
  'Cero casos dan cero errores. Si borrar el corpus pusiera la compuerta en '
  + 'verde, la compuerta mediría el corpus y no el producto.'

/**
 * Aplica el umbral decidido a lo que un arnés midió.
 *
 * Nunca devuelve `pasa` por omisión: si falta el umbral, falta el conjunto o
 * falta la medida de un eje, lo dice con su propio veredicto.
 */
export function aplicarUmbral(umbral: Umbral, medido: LoMedido): LecturaDeLaCompuerta {
  if (esperaAlMedico(umbral)) {
    return { veredicto: 'sin_umbral_decidido', ejes: [], porQue: PORQUE_UN_UMBRAL_PENDIENTE_NO_ES_VERDE }
  }
  if (!medido.hayConjunto) {
    return { veredicto: 'sin_conjunto', ejes: [], porQue: PORQUE_UN_CONJUNTO_VACIO_NO_ES_VERDE }
  }

  const declarados = umbral.ejes ?? Object.keys(medido.ejes).map(nombre => ({
    nombre, valor: umbral.valor, porQue: UN_SOLO_NUMERO_CUBRE_TODOS_LOS_EJES,
  }))

  const ejes: EjeMedido[] = declarados.map(e => {
    const m = medido.ejes[e.nombre]
    if (m === undefined) {
      return {
        nombre: e.nombre, medido: null, umbral: e.valor,
        veredicto: 'no_se_puede_medir', resolucion: 1, elConjuntoNoAlcanzaElUmbral: false,
      }
    }
    const res = medido.resolucion[e.nombre] ?? 1
    return {
      nombre: e.nombre,
      medido: m,
      umbral: e.valor,
      veredicto: m <= e.valor ? 'pasa' : 'reprueba',
      resolucion: res,
      elConjuntoNoAlcanzaElUmbral: e.valor > 0 && e.valor < res,
    }
  })

  const reprobados = ejes.filter(e => e.veredicto === 'reprueba')
  if (reprobados.length > 0) {
    return {
      veredicto: 'reprueba',
      ejes,
      porQue: reprobados.map(e => `${e.nombre}: ${e.medido} > ${e.umbral}`).join('; '),
    }
  }

  const sinMedir = ejes.filter(e => e.veredicto === 'no_se_puede_medir')
  if (sinMedir.length > 0) {
    return {
      veredicto: 'sin_ejes_medibles',
      ejes,
      porQue:
        `El contrato declara ${sinMedir.map(e => `«${e.nombre}»`).join(', ')} y el arnés no lo midió. `
        + 'Ausencia de medida no es medida de ausencia: no se da por bueno.',
    }
  }

  const noEjercidos = ejes.filter(e => e.elConjuntoNoAlcanzaElUmbral)
  return {
    veredicto: 'pasa',
    ejes,
    porQue: noEjercidos.length === 0
      ? 'Todos los ejes quedan en o por debajo de su umbral.'
      : `Pasa, pero el conjunto es demasiado pequeño para ejercer ${noEjercidos.map(e => `«${e.nombre}»`).join(', ')}: `
        + `el escalón mínimo medible (${noEjercidos.map(e => e.resolucion).join(', ')}) es mayor que el umbral. `
        + 'De hecho se está aplicando como si fuera cero.',
  }
}

/**
 * EL ÚNICO SITIO DONDE SE DEFINE «VERDE».
 *
 * Existe para que ningún llamador escriba `veredicto !== 'reprueba'` y convierta
 * los tres huecos —umbral pendiente, conjunto vacío, eje sin medir— en un visto
 * bueno por descuido.
 */
export function esVerde(l: LecturaDeLaCompuerta): boolean {
  return l.veredicto === 'pasa'
}

export const LO_QUE_LA_COMPUERTA_NO_HACE: readonly string[] = Object.freeze([
  'No mide ningún producto con pacientes reales: los conjuntos son sintéticos y nuestros. Los números que da NO son las tasas de error de Ausculta con pacientes.',
  'No corre en producción ni bloquea una nota. Es una compuerta del CI: dice si las defensas deterministas siguen en pie entre una versión y la siguiente.',
  'No ejerce un umbral más fino que la resolución del conjunto que lo mide. Cuando eso pasa lo DECLARA en cada lectura, y de hecho aplica el umbral como si fuera cero — más estricto, no más laxo.',
  'No sabe si la traducción de eje a métrica es la que el médico tenía en la cabeza. Cada arnés elige la lectura más estricta y la deja escrita para que él la pueda desmentir.',
])

/**
 * LA PREGUNTA QUE NO SE LE HIZO AL MÉDICO SOBRE EL LABORATORIO — REG-597.
 *
 * Un analito INVENTADO —una fila en el panel que no está en la hoja— es la
 * cuarta cosa que puede salir mal, y no tiene umbral porque no se la pregunté.
 * Se mide y se reporta; no se le pone número.
 *
 * Poner cero «porque es obvio» sería exactamente lo que la regla 1 prohíbe: una
 * decisión clínica que nadie tomó, con aspecto de acordada. Que en la nota
 * decidiera 0 % de alucinación (D-042) no lo decide aquí — son dos capacidades,
 * y extender una decisión de una a otra es adivinar con papeleo.
 */
export const LO_QUE_NO_SE_LE_PREGUNTO_DEL_LABORATORIO =
  'NEEDS_CLINICAL_REVIEW: cuántos analitos INVENTADOS por hoja se toleran. Se '
  + 'cuenta en cada lectura y no reprueba. Lo decide el médico dueño, no este archivo.'

