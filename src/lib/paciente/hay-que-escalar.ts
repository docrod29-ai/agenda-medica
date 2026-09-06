/**
 * LA SEGUNDA CLASE CON CLASIFICADOR: `ESCALATE_TO_CLINICIAN`.
 *
 * ── QUÉ FALTABA (WS-12.doce-preguntas) ──────────────────────────────────────
 *
 * REG-362 creó la puerta de las doce preguntas y su fixture. El censo dejó
 * apuntado lo que quedaba: **de las cinco clases del §2, sólo una tenía
 * clasificador** — la urgencia.
 *
 * Y el §2 no admite huecos: *«Toda respuesta se clasifica ANTES de redactarse, y
 * la clase se guarda con la respuesta. Una respuesta sin clase es un defecto, no
 * un caso raro.»*
 *
 * Sin esta clase, ocho de los doce casos del fixture salían sólo como
 * `no_urgente`, que es lo que **no** son, no lo que son. «¿Puedo tomarme el
 * doble?» y «no puedo ver los horarios en la página» quedaban indistinguibles.
 *
 * ── POR QUÉ ÉSTA Y NO OTRA ──────────────────────────────────────────────────
 *
 * De las cuatro que faltaban, ésta es la única que se puede decidir **sin el
 * paquete aprobado y sin un umbral del médico**, y es la que el §3 exige que
 * viva en el servidor:
 *
 *   *«No es una lista de cosas a evitar: es una lista de cosas que el código no
 *    debe poder hacer. Si una ruta lo permite y sólo el prompt lo impide, está
 *    mal construida. La prohibición vive en el servidor, no en la instrucción.»*
 *
 * `ANSWER_FROM_APPROVED_PLAN` necesita el paquete liberado y el orden de fuentes
 * del §1. `EDUCATIONAL_EXPLANATION` necesita juzgar que la pregunta es genérica,
 * que es un juicio de modelo con su umbral. `ADMINISTRATIVE_ACTION` se podría
 * intentar, y **no se intenta**: confundir una pregunta clínica con una
 * administrativa la sacaría del camino que la protege, y el error caro va en esa
 * dirección. Ver `LO_QUE_NO_SE_CLASIFICA`.
 *
 * ── EL ORDEN, Y NO ES NEGOCIABLE ────────────────────────────────────────────
 *
 * La urgencia va **primero** (§6: «la urgencia gana a todo lo demás»). Este
 * módulo no la reimplementa: llama a `urgenciaDelMensaje`. Dos detectores de
 * urgencia serían dos criterios distintos sobre el mismo hecho.
 *
 * ── EL SUELO: LO QUE NO SE SABE CLASIFICAR, SE ESCALA ───────────────────────
 *
 * `claseSegura` convierte «no lo sé» en `ESCALATE_TO_CLINICIAN`, y eso **no es
 * una invención**: es el §1 dicho en código. *«Si un dato específico no se
 * sostiene en un nivel 1-8, no hay respuesta: hay escalación.»* Y el §3: *«En
 * lugar de eso, se escala. La escalación es el producto, no el fallo.»*
 *
 * Es el suelo, no el destino: cuando existan las otras tres clases, ellas
 * decidirán antes y este suelo sólo recogerá lo que ninguna reclame.
 *
 * Módulo PURO.
 */
import { normalizar } from '@/lib/whatsapp/intencion'
import {
  urgenciaDelMensaje,
  type ClaseRespuestaPaciente, type Urgencia,
} from '@/lib/paciente/urgencia'

/**
 * Por qué hay que escalar. Cada uno sale de una línea del §3 y **se guarda con
 * la respuesta**: «se escaló» sin decir por qué no se puede auditar.
 */
export type MotivoEscalacion =
  /** Pide cambiar una dosis, o tomar de más o de menos. */
  | 'cambio_de_dosis'
  /** Dice que dejó, o quiere dejar, un medicamento. */
  | 'suspender_medicamento'
  /** Pide una receta, un cambio de receta o un tratamiento nuevo. */
  | 'prescripcion'
  /** Pide un certificado, una incapacidad o una nota médica firmada. */
  | 'documento_firmado'
  /** Pide un diagnóstico, o que se interprete un resultado. */
  | 'diagnostico_o_resultado'
  /** Lo que tiene delante no coincide con lo aprobado. */
  | 'discrepancia_con_lo_aprobado'
  /** Pide expresamente pasar por encima de lo que dijo su médico. */
  | 'pasar_por_encima_del_medico'
  /** Aporta un dato que el plan aprobado puede no contemplar (regla 5). */
  | 'dato_que_el_plan_puede_no_tener'

export const MOTIVO_ESCALACION_LABEL: Record<MotivoEscalacion, string> = {
  cambio_de_dosis: 'un cambio de dosis',
  suspender_medicamento: 'suspender un medicamento',
  prescripcion: 'una receta o un tratamiento',
  documento_firmado: 'un documento médico firmado',
  diagnostico_o_resultado: 'un diagnóstico o la lectura de un resultado',
  discrepancia_con_lo_aprobado: 'una discrepancia con lo que se le indicó',
  pasar_por_encima_del_medico: 'pasar por encima de su médico',
  dato_que_el_plan_puede_no_tener: 'un dato que su plan puede no contemplar',
}

export interface Escalacion {
  readonly motivo: MotivoEscalacion
  readonly clase: Extract<ClaseRespuestaPaciente, 'ESCALATE_TO_CLINICIAN'>
}

/**
 * Las reglas del §3, en orden. Vocabulario, no criterio: **lo que no esté aquí
 * no se vigila** — y por eso el suelo escala igualmente lo no clasificado.
 *
 * El orden importa cuando un mensaje casa con dos: se devuelve el primero, y
 * están puestos de más específico a más general.
 */
const REGLAS: ReadonlyArray<{ motivo: MotivoEscalacion; prueba: (t: string) => boolean }> = [
  {
    motivo: 'pasar_por_encima_del_medico',
    prueba: t =>
      /(ignora|no le hagas caso|olvidate|olvida)( a)? (mi|el|la)? ?(doctor|doctora|medic|especialista)/.test(t) ||
      /(sin|no) (decirle|que sepa|avisarle) (a )?(mi|el|la) ?(doctor|doctora|medic)/.test(t) ||
      /(que|dime que) (piensas|opinas|crees) tu/.test(t),
  },
  {
    motivo: 'documento_firmado',
    prueba: t =>
      /(certificado|incapacidad|constancia|justificante|receta|nota) (medic|de incapacidad|de reposo)/.test(t) ||
      /(generame|hazme|dame|necesito|quiero) (un|una) (certificado|incapacidad|constancia|justificante)/.test(t) ||
      /\bincapacidad\b/.test(t),
  },
  {
    motivo: 'prescripcion',
    prueba: t =>
      /(cambia|cambiame|modifica|modificame|ajusta|ajustame|renueva|renuevame) (mi|la|el) ?(receta|tratamiento|medicament)/.test(t) ||
      /(recetame|prescribeme|mandame) /.test(t) ||
      /(que|cual) (medicament|antibiotic|pastilla|farmaco) (tomo|me tomo|deberia)/.test(t),
  },
  {
    motivo: 'suspender_medicamento',
    prueba: t =>
      /(deje|dejé|dejar|suspend|suspender|corte|cortar|quite|quitar|abandon)[a-z]* de tomar/.test(t) ||
      /(ya )?(deje|dejé) de tomarlo/.test(t) ||
      /(puedo|debo) (dejar|suspender|quitar)(lo|la|me)?\b/.test(t),
  },
  {
    motivo: 'cambio_de_dosis',
    prueba: t =>
      /(el |la )?(doble|triple|mitad|media pastilla|dos pastillas|mas dosis|menos dosis)/.test(t) ||
      /(subir|bajar|aumentar|disminuir|duplicar|partir) (la |mi )?(dosis|pastilla|medicament)/.test(t) ||
      /(puedo|debo) (tomar|tomarme) (mas|menos|el doble|dos)/.test(t),
  },
  {
    motivo: 'discrepancia_con_lo_aprobado',
    prueba: t =>
      /(dijo|indico|receto|puso).{0,40}(pero|y).{0,40}(dice|es|son|trae|viene)/.test(t) ||
      /(no coincide|no cuadra|no es lo mismo|es distinto|es diferente)/.test(t),
  },
  {
    motivo: 'diagnostico_o_resultado',
    prueba: t =>
      /(este |mi |el )?resultado .{0,20}(dice|sale|salio|es)/.test(t) ||
      /(que (tengo|significa)|es grave|es malo|es normal)\b/.test(t) ||
      /\b(positivo|negativo|alterado|fuera de rango)\b/.test(t),
  },
  {
    motivo: 'dato_que_el_plan_puede_no_tener',
    prueba: t =>
      /(estoy|creo que estoy|puede que este) embarazad/.test(t) ||
      /(estoy )?(dando pecho|lactando|amamantando)/.test(t) ||
      /soy alergic|me da alergia/.test(t),
  },
]

/** El resultado de clasificar, con la clase y por qué se llegó a ella. */
export interface Clasificacion {
  readonly clase: ClaseRespuestaPaciente
  /** La razón, del vocabulario cerrado de cada motor. Vacía sólo en el suelo. */
  readonly porQue: string
  readonly comoSeDecidio: 'urgencia' | 'escalacion' | 'suelo'
  readonly urgencia?: Urgencia
  readonly escalacion?: Escalacion
}

/** ¿Hay que escalar esto? `null` = ninguna regla del §3 casó. PURO. */
export function escalacionDelMensaje(texto: string): Escalacion | null {
  const t = normalizar(texto)
  if (!t.trim()) return null
  for (const r of REGLAS) {
    if (r.prueba(t)) return { motivo: r.motivo, clase: 'ESCALATE_TO_CLINICIAN' }
  }
  return null
}

/**
 * La clase de una respuesta, **antes de redactarla** (§2).
 *
 * Nunca devuelve «sin clase»: el §2 dice que una respuesta sin clase es un
 * defecto. Lo que no se sabe clasificar cae al suelo, que es escalación — el §1
 * y el §3 dicen exactamente eso, así que no se está inventando una política.
 */
export function claseSegura(texto: string): Clasificacion {
  /* La urgencia gana a todo lo demás (§6). No se reimplementa aquí. */
  const u = urgenciaDelMensaje(texto)
  if (u) {
    return { clase: u.clase, porQue: u.motivo, comoSeDecidio: 'urgencia', urgencia: u }
  }
  const e = escalacionDelMensaje(texto)
  if (e) {
    return { clase: e.clase, porQue: e.motivo, comoSeDecidio: 'escalacion', escalacion: e }
  }
  return {
    clase: 'ESCALATE_TO_CLINICIAN',
    porQue: '',
    comoSeDecidio: 'suelo',
  }
}

export const POR_QUE_EL_SUELO_ES_ESCALAR =
  'Porque el §1 lo dice: «si un dato específico no se sostiene en un nivel 1-8, '
  + 'no hay respuesta: hay escalación», y el §3 remata: «la escalación es el '
  + 'producto, no el fallo». Devolver «sin clase» sería el defecto que el §2 '
  + 'nombra, y contestar por defecto sería dejar que el silencio del clasificador '
  + 'autorice una respuesta que nadie aprobó.'

export const POR_QUE_LA_URGENCIA_VA_PRIMERO =
  'Porque el §6 lo dice y porque un aviso urgente que llega en el tercer párrafo '
  + 'no llegó. Este módulo NO reimplementa la urgencia: la llama. Dos detectores '
  + 'serían dos criterios distintos sobre el mismo hecho, que es el patrón que '
  + 'este repositorio persigue por todas partes.'

export const POR_QUE_NO_SE_CLASIFICA_LO_ADMINISTRATIVO =
  'Porque el error caro va en una sola dirección. Tomar una pregunta '
  + 'administrativa por clínica sólo cuesta que la vea una persona; tomar una '
  + 'clínica por administrativa la saca del camino que la protege. Mientras la '
  + 'clase administrativa no tenga su propio motor y su fixture, todo lo no '
  + 'clasificado escala.'

export const LO_QUE_NO_SE_CLASIFICA: readonly string[] = [
  '`ANSWER_FROM_APPROVED_PLAN`: necesita el PatientVisitPackage liberado y el orden de fuentes del §1. Sin paquete aprobado no hay nada de dónde responder.',
  '`EDUCATIONAL_EXPLANATION`: exige juzgar que la pregunta es genérica y no específica de este paciente, que es un juicio de modelo con su conjunto y su umbral — y el umbral lo fija el médico.',
  '`ADMINISTRATIVE_ACTION`: se podría intentar y NO se intenta, a propósito. Ver `POR_QUE_NO_SE_CLASIFICA_LO_ADMINISTRATIVO`.',
  'Lo que no esté en el vocabulario del §3: no se vigila, y por eso cae al suelo, que escala. Un motivo que falta significa que ese caso se escala SIN nombre, no que se conteste.',
  'El idioma: las reglas están escritas para el español de México. Un mensaje en otro idioma cae al suelo.',
]


/**
 * Lo que se le dice al PACIENTE cuando su mensaje hay que escalarlo.
 *
 * Tres cosas y en este orden: que su médico tiene que verlo, que **no cambie
 * nada por su cuenta mientras tanto**, y que este canal no es una consulta. La
 * segunda es la que importa: alguien que pregunta «¿puedo tomarme el doble?» y
 * no recibe respuesta puede tomárselo igual.
 *
 * NO se le dice qué hacer con su tratamiento, ni se le desaconseja con un
 * criterio propio: eso es el §3, y sería exactamente lo que este módulo existe
 * para impedir.
 */
export function mensajeDeEscalacion(motivo: MotivoEscalacion, telefonoConsultorio: string): string {
  const tel = String(telefonoConsultorio ?? '').trim()
  return [
    `Esto lo tiene que ver su médico: su mensaje es sobre ${MOTIVO_ESCALACION_LABEL[motivo]}.`,
    '',
    '⚠️ *Mientras tanto, no cambie nada de su tratamiento por su cuenta.*',
    '',
    'Este canal es para citas y no sustituye una consulta. Avisamos al consultorio de que usted escribió.',
    ...(tel ? ['', `📞 Consultorio: ${tel}`] : []),
  ].join('\n')
}

/**
 * Lo que se le avisa al CONSULTORIO. Misma forma que el aviso de urgencia y con
 * el mismo tope: sin el texto, quien lo lea no puede decidir nada; con el texto
 * entero, esto se convertiría en un canal de PHI sin medida.
 */
export function avisoDeEscalacionAlConsultorio(
  telefonoPaciente: string,
  motivo: MotivoEscalacion,
  textoDelPaciente: string,
  tope = 300,
): string {
  return [
    '📋 *Un paciente preguntó algo que necesita a un médico*',
    '',
    `📱 ${telefonoPaciente}`,
    `Motivo: ${MOTIVO_ESCALACION_LABEL[motivo]}`,
    '',
    `«${String(textoDelPaciente ?? '').trim().slice(0, tope)}»`,
    '',
    'El bot NO le contestó nada de esto: sólo le dijo que su médico lo verá.',
  ].join('\n')
}

export const POR_QUE_EL_BOT_NO_USA_EL_SUELO =
  'Porque el suelo escala TODO lo que no clasifica, y el bot de citas tiene una '
  + 'máquina de estados acotada que no genera respuestas clínicas: mandarle al '
  + 'médico un «agéndame para mañana» dejaría el producto muerto y llenaría su '
  + 'teléfono de ruido. El bot usa las reglas NOMBRADAS del §3. El suelo es la '
  + 'política de la IA de paciente que redacta texto —la que el §2 clasifica '
  + 'antes de escribir—, y ésa todavía no existe.'
