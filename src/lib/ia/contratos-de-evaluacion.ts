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
    umbral: pendiente('Cuánta pérdida de medicamentos y diagnósticos es tolerable, y a partir de qué proporción de alucinación se bloquea la redacción. Lo fija el médico responsable sobre su propio corpus.'),
    politicaDeFallo: 'degrada_y_lo_dice',
  }),
  C({
    capacidad: 'transcribir', ruta: 'src/app/api/expediente/transcribir/route.ts',
    queDecide: 'Convierte el audio de la consulta en texto. Es la fuente de todo lo demás.',
    consecuenciaDelError: 'Una palabra mal oída en una cifra o una unidad viaja a la nota, a la receta y al expediente. El error se lee bien.',
    conjunto: 'No existe gold de voz. Y no puede nacer de audio real: la voz es biométrica (regla de datos). El gold nace sintético o actuado, y todavía no está.',
    metrica: 'WER ponderado por consecuencia clínica, no WER a secas (TR-VOZ.error-clinicamente-pesado)',
    umbral: pendiente('Qué tasa de error es aceptable, y sobre todo con qué peso entra un error de cifra o de unidad frente a uno de relleno. Es una decisión clínica, no de ingeniería.'),
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
    conjunto: 'No existe. Ninguna hoja real puede entrar sin ser sintética (regla de datos).',
    metrica: 'exactitud por analito, con la unidad',
    umbral: pendiente('Cuántos analitos mal leídos por hoja son tolerables. Como toda lectura de cifras, tiende a cero.'),
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

/** ¿Este umbral lo tiene que fijar todavía alguien con cédula? */
export function esperaAlMedico(u: Umbral): boolean {
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
