/**
 * LO QUE EL PACIENTE PREGUNTA — «ASK NEXUS», y por qué no es un chatbot.
 *
 * V9 · `PATIENT-AI-001`. La especificación lo dice con todas las letras:
 *
 *     ASK NEXUS is NOT a generic medical chatbot.
 *     It is CARE-PLAN-BOUNDED PATIENT INTELLIGENCE.
 *
 * ── LA DECISIÓN CENTRAL: AQUÍ NO HAY MODELO DE LENGUAJE ─────────────────────
 *
 * Ninguno. Este módulo clasifica y, cuando puede, **cita**. Nunca redacta un
 * dato del paciente.
 *
 * El §1 de `.claude/rules/patient-facing-ai.md` ordena las fuentes del 1 al 9 y
 * dice que el nivel 9 —el modelo general— «nunca origina un dato del paciente».
 * La forma más barata de garantizar eso no es instruir a un modelo para que se
 * porte bien: es **no tener modelo**. Lo que este motor devuelve como respuesta
 * es, literalmente, una cadena que ya venía dentro del paquete que el médico
 * liberó. Si no la encuentra, escala.
 *
 * El README de `evals/patient-ai/` ya lo había escrito, hablando de la puerta:
 * «una compuerta que dependa de que el modelo se porte bien mide el humor del
 * modelo, no el producto». Vale igual para el producto.
 *
 * ── EL ORDEN ES LA DEFENSA, IGUAL QUE EN `urgencia.ts` ──────────────────────
 *
 *     1. urgencia (§6)              → URGENT_REVIEW_REQUIRED
 *     2. acto prohibido (§3)        → ESCALATE_TO_CLINICIAN
 *     3. administrativa             → ADMINISTRATIVE_ACTION
 *     4. está en el plan liberado   → ANSWER_FROM_APPROVED_PLAN  (con procedencia)
 *     5. todo lo demás              → ESCALATE_TO_CLINICIAN
 *
 * **El paso 2 va ANTES del 4, y es lo más importante de este archivo.** Si la
 * búsqueda en el plan fuera primero, «¿puedo tomarme el doble del metoprolol?»
 * encontraría el metoprolol en la lista del paciente y le contestaría cómo
 * tomarlo — contestando una pregunta que nadie hizo y dejando sin contestar la
 * que sí se hizo. La pregunta era sobre **cambiar la dosis**, que es de las
 * cosas que este canal no puede hacer por su cuenta.
 *
 * Es la misma lección que dejó escrita `urgencia.ts`: «el fallo no era de
 * detección: era de ORDEN».
 *
 * ── LA QUINTA CLASE NO SE EMITE, Y SE DECLARA ───────────────────────────────
 *
 * `EDUCATIONAL_EXPLANATION` existe en el §2 y este motor **nunca la devuelve**.
 * Explicar en palabras más simples es justamente el trabajo del nivel 9, y el
 * nivel 9 no está aquí. Fingir que se cubre —devolviendo una explicación
 * enlatada— sería el verde falso que la puerta de `evals/patient-ai/` existe
 * para impedir.
 *
 * Queda declarado y con nombre: `CLASES_QUE_ESTE_MOTOR_NO_EMITE`.
 *
 * ── LO QUE ESTE MÓDULO NO VIGILA (clinical-safety §5) ───────────────────────
 *
 * Los patrones de abajo son **vocabulario, no criterio**. Que una forma de
 * pedir un cambio de dosis no esté escrita aquí significa que **ese caso no se
 * detecta como acto prohibido** — y entonces cae al paso 5, que escala. Ése es
 * el diseño: el destino por omisión es escalar, no responder. Un vocabulario
 * incompleto pierde precisión, nunca seguridad.
 *
 * Tampoco cubre ninguna lengua distinta del español.
 *
 * Módulo PURO: sin Firestore, sin red, sin reloj, sin modelo.
 */
import { normalizar } from '@/lib/whatsapp/intencion'
import { urgenciaDelMensaje, mensajeDeUrgencia, type MotivoUrgencia, type ClaseRespuestaPaciente } from './urgencia'
import type { PaqueteDeVisita } from './paquete-de-visita'

/**
 * Las clases que este motor determinista NO puede emitir, con su razón. Se
 * exporta para que la puerta de `evals/patient-ai/` pueda comprobar que la
 * cobertura declarada y la real coinciden — y no al revés.
 */
export const CLASES_QUE_ESTE_MOTOR_NO_EMITE = {
  EDUCATIONAL_EXPLANATION:
    'Explicar en palabras más simples es trabajo del nivel 9 (modelo general), y aquí no hay modelo. ' +
    'Una explicación enlatada sería un dato del paciente originado fuera de las fuentes 1-8.',
} as const

/** Por qué se escala. Se guarda con la pregunta: sin esto nadie sabe qué pasó. */
export type MotivoEscalacion =
  | 'cambio_de_dosis'
  | 'suspender_o_iniciar_por_su_cuenta'
  | 'prescripcion_o_receta'
  | 'diagnostico_o_interpretacion_de_resultado'
  | 'documento_firmado'
  | 'pasar_por_encima_del_medico'
  | 'embarazo_o_lactancia'
  | 'dos_medicamentos_posibles'
  | 'no_esta_en_el_plan_liberado'
  | 'sin_plan_liberado'

export const MOTIVO_ESCALACION_LABEL: Record<MotivoEscalacion, string> = {
  cambio_de_dosis: 'pregunta por cambiar una dosis',
  suspender_o_iniciar_por_su_cuenta: 'dice que suspendió o quiere iniciar un medicamento',
  prescripcion_o_receta: 'pide una receta o un cambio de receta',
  diagnostico_o_interpretacion_de_resultado: 'pide interpretar un resultado o un diagnóstico',
  documento_firmado: 'pide un documento médico firmado',
  pasar_por_encima_del_medico: 'pide una opinión que contradiga a su médico',
  embarazo_o_lactancia: 'menciona embarazo o lactancia',
  dos_medicamentos_posibles: 'su pregunta encaja con más de un medicamento suyo',
  no_esta_en_el_plan_liberado: 'pregunta algo que no está en lo que se le liberó',
  sin_plan_liberado: 'todavía no tiene ninguna consulta liberada',
}

/**
 * DE DÓNDE SALIÓ LA RESPUESTA. Sin esto, una cita textual y una invención se
 * ven exactamente igual en la pantalla.
 *
 * Es el principio de PROCEDENCIA del sistema de diseño, aplicado al lado del
 * paciente: «lo que escribió la IA enseña de dónde salió».
 */
export interface ProcedenciaDeLaRespuesta {
  /** Nivel del §1 de la regla. 2 = plan liberado. Nunca 9. */
  nivel: number
  /** La nota firmada de la que cuelga el paquete. */
  notaId: string
  /** ISO de la consulta, para que el paciente sepa DE QUÉ visita le hablan. */
  fechaConsulta: string
  /** Versión del paquete liberado. Un paquete corregido es otra versión. */
  version: number
  /** Qué campo del paquete se citó. */
  campo: 'medicationInstructions' | 'followUp' | 'orders' | 'medicationChanges'
}

export interface RespuestaAlPaciente {
  clase: ClaseRespuestaPaciente
  /** Lo que se le enseña al paciente. Para las clases 1 y 5, texto ya compuesto. */
  texto: string
  motivo: MotivoUrgencia | MotivoEscalacion | null
  /** Sólo en `ANSWER_FROM_APPROVED_PLAN`. En las demás es `null` por construcción. */
  procedencia: ProcedenciaDeLaRespuesta | null
  /**
   * ¿Esto tiene que llegarle a un humano del consultorio?
   *
   * Es un campo y no una deducción del llamador a propósito: «la escalación es
   * el producto, no el fallo», y quien decide si alguien tiene que enterarse es
   * este motor, no la ruta que lo llama. Una ruta que se olvide de mirar la
   * clase dejaría la escalación en un cajón.
   */
  avisarAlConsultorio: boolean
}

/* ────────────────────────────────────────────────────────────────────────────
   PASO 2 · LOS ACTOS QUE ESTE CANAL NO PUEDE HACER POR SU CUENTA (§3)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * La lista del §3 de la regla, dicha en las palabras con las que la gente
 * pregunta. Cada entrada exige que la frase hable de un ACTO, no de un tema:
 * «me tomo la pastilla a las 8» no es pedir un cambio de dosis.
 */
const ACTOS_PROHIBIDOS: ReadonlyArray<{ motivo: MotivoEscalacion; prueba: (t: string) => boolean }> = [
  {
    motivo: 'cambio_de_dosis',
    prueba: t =>
      /(el doble|la mitad|mas dosis|menos dosis|subir la dosis|bajar la dosis|aumentar la dosis|reducir la dosis|dos pastillas en vez|otra pastilla mas)/.test(t) ||
      (/(puedo|podria|debo|deberia|le subo|le bajo|me subo|me bajo)/.test(t) &&
        /(dosis|mas pastilla|menos pastilla|doble|mitad)/.test(t)) ||
      // «El doctor dijo 5 mg pero el frasco dice 10» — discrepancia entre lo
      // aprobado y lo que el paciente tiene en la mano. No decide cuál vale.
      (/(dijo|receto|indico|dice)/.test(t) && /(frasco|caja|etiqueta|bote)/.test(t) && /\d/.test(t)),
  },
  {
    motivo: 'suspender_o_iniciar_por_su_cuenta',
    prueba: t =>
      /(deje de tomar|ya no lo tomo|ya no la tomo|ya deje|lo suspendi|la suspendi|deje el tratamiento|puedo dejar de tomar|puedo suspender|dejo de tomar)/.test(t) ||
      /(puedo|podria) (empezar|iniciar|tomar) (a tomar )?(otro|otra|un|una)/.test(t),
  },
  {
    motivo: 'prescripcion_o_receta',
    prueba: t =>
      /(cambiame|cambia|cambiar|renuevame|renovar|hazme|dame|mandame|necesito) (mi |la |una |el )?(receta|prescripcion)/.test(t) ||
      /(recetame|prescribeme|que me recomiendas tomar|que puedo tomar para)/.test(t),
  },
  {
    motivo: 'diagnostico_o_interpretacion_de_resultado',
    prueba: t =>
      /(que tengo|que enfermedad|es grave|es malo|es normal esto)\b/.test(t) ||
      /(este |mi |el )?resultado (dice|salio|es|sale)/.test(t) ||
      /(salio|dice) (positivo|negativo|alto|bajo|alterado)/.test(t) ||
      /(que significa|que quiere decir) (esto|mi resultado|el resultado)/.test(t),
  },
  {
    motivo: 'documento_firmado',
    prueba: t =>
      /(certificado|constancia|incapacidad|justificante|comprobante medico|carta medica)/.test(t) &&
      /(genera|generame|hazme|dame|necesito|quiero|puedes hacer|emite|emiteme)/.test(t),
  },
  {
    motivo: 'pasar_por_encima_del_medico',
    prueba: t =>
      /(ignora|olvida|no le hagas caso|sin que sepa|sin decirle) (a )?(mi |el )?(doctor|doctora|medico|medica)/.test(t) ||
      /(que piensas tu|que opinas tu|tu que dices|dime la verdad tu)/.test(t) ||
      /(segunda opinion)/.test(t),
  },
  {
    /**
     * EMBARAZO Y LACTANCIA — escalan SIEMPRE, aunque el plan no los mencione.
     *
     * Es la regla 5 dicha en su caso más caro: «que el plan no mencione el
     * embarazo no significa que la paciente no lo esté». Si esto no estuviera
     * aquí, «estoy embarazada, ¿sigo con el metoprolol?» encontraría el
     * metoprolol en el plan y le contestaría cómo tomarlo — un plan que se
     * escribió, quizá, sin saber que estaba embarazada.
     */
    motivo: 'embarazo_o_lactancia',
    prueba: t => /(estoy |sali |creo que estoy )?(embarazada|embarazo)|doy pecho|estoy lactando|lactancia|amamant/.test(t),
  },
]

/* ────────────────────────────────────────────────────────────────────────────
   PASO 3 · LO ADMINISTRATIVO
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Preguntas de logística. No tocan tratamiento, así que no hace falta escalar a
 * un clínico: el portal ya tiene la pantalla que las contesta.
 *
 * Deliberadamente ESTRECHO. Ante la duda entre administrativo y clínico, gana
 * clínico — porque el coste de mandar una duda de tratamiento a la pantalla de
 * citas es que nadie la conteste nunca.
 */
function esAdministrativa(t: string): boolean {
  if (/(medicamento|pastilla|dosis|tratamiento|receta|resultado|estudio|analisis|sintoma|dolor)/.test(t)) return false
  return (
    /(cuando es mi cita|a que hora es mi cita|mi proxima cita|cuando me toca|tengo cita)/.test(t) ||
    /(cambiar|mover|reagendar|cancelar) (mi |la )?cita/.test(t) ||
    /(agendame|agendar|hazme una cita|quiero una cita|dame una cita|apartame)/.test(t) ||
    /(donde queda|donde esta|como llego|direccion|ubicacion|estacionamiento)/.test(t) ||
    /(cuanto cuesta|precio|costo|cuanto es la consulta|formas de pago)/.test(t) ||
    /(telefono|numero) (del|de la|de) (consultorio|clinica|doctor)/.test(t) ||
    /(horario|a que hora abren|a que hora cierran)/.test(t)
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   PASO 4 · LO QUE SÍ SE PUEDE CONTESTAR, PORQUE YA ESTÁ ESCRITO
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * El paquete tal como lo necesita este motor. No es `PaqueteDeVisita` entero a
 * propósito: lo que este motor puede mirar es exactamente lo que aquí se
 * enumera, y ampliar la vista obliga a decidirlo. Mismo criterio que
 * `NotaParaElPaquete`.
 */
export type PlanLiberado = Pick<
  PaqueteDeVisita,
  'notaId' | 'fechaConsulta' | 'medicationInstructions' | 'medicationChanges' | 'orders' | 'followUp' | 'version'
>

/** Nombre de medicamento → la primera palabra significativa, normalizada. */
function raizDelNombre(nombre: string): string {
  const n = normalizar(nombre).replace(/[^a-z0-9 ]/g, ' ').trim()
  return n.split(/\s+/)[0] ?? ''
}

/**
 * ¿De qué medicamento del plan habla el paciente?
 *
 * Devuelve **todas** las coincidencias, no la primera. Que devuelva dos no es
 * un detalle de implementación: es la señal de que hay que preguntar en vez de
 * adivinar (clinical-safety §6, «dos fármacos plausibles»).
 *
 * El tope de 4 caracteres evita que una raíz corta —«te», «sal»— case con media
 * frase. Una raíz más corta que eso no identifica un fármaco.
 */
function medicamentosMencionados(t: string, plan: PlanLiberado): PlanLiberado['medicationInstructions'] {
  return plan.medicationInstructions.filter(m => {
    const raiz = raizDelNombre(m.nombre)
    if (raiz.length < 4) return false
    return new RegExp(`\\b${raiz}`).test(t)
  })
}

const PREGUNTA_POR_TOMA = /(como|cuando|cada cuando|cada cuanto|a que hora|cuantas veces|cuanto tiempo|hasta cuando|con que|en ayunas|con comida)/

/* ────────────────────────────────────────────────────────────────────────────
   EL CLASIFICADOR
   ──────────────────────────────────────────────────────────────────────────── */

export interface ContextoDeLaPregunta {
  /**
   * El paquete liberado MÁS RECIENTE, o `null` si el paciente no tiene ninguno.
   *
   * `null` no es «no hay nada que decirle»: es «no hay fuente de nivel 1-8», y
   * por eso la única salida es escalar. Quien llama NO debe pasar aquí un
   * paquete en `DRAFT`: la compuerta es `visibleParaElPaciente`, y vive en el
   * servidor antes de llegar a este módulo.
   */
  plan: PlanLiberado | null
  /** Teléfono del consultorio, para el mensaje de urgencia. Puede ir vacío. */
  telefonoConsultorio?: string
}

/**
 * Clasifica lo que preguntó el paciente y, cuando puede, lo contesta CITANDO.
 *
 * Nunca devuelve `null` y nunca lanza: una pregunta que no encaja en nada cae
 * en `ESCALATE_TO_CLINICIAN`, que es el destino por omisión de este diseño.
 * «Una respuesta sin clase es un defecto, no un caso raro» (§2).
 */
export function clasificarPregunta(texto: string, ctx: ContextoDeLaPregunta): RespuestaAlPaciente {
  const t = normalizar(texto)

  // ── 1 · LA URGENCIA GANA A TODO LO DEMÁS ──────────────────────────────────
  const urgencia = urgenciaDelMensaje(texto)
  if (urgencia) {
    return {
      clase: 'URGENT_REVIEW_REQUIRED',
      texto: mensajeDeUrgencia(ctx.telefonoConsultorio ?? ''),
      motivo: urgencia.motivo,
      procedencia: null,
      avisarAlConsultorio: true,
    }
  }

  // Un mensaje vacío no es una pregunta. No dispara nada y no rompe nada.
  if (!t.trim()) {
    return escalar('no_esta_en_el_plan_liberado', false)
  }

  // ── 2 · ¿PIDE UN ACTO QUE ESTE CANAL NO PUEDE HACER? ──────────────────────
  // Va ANTES de mirar el plan. Ver la cabecera: es la diferencia entre
  // contestar la pregunta que se hizo y contestar otra que se le parece.
  for (const a of ACTOS_PROHIBIDOS) {
    if (a.prueba(t)) return escalar(a.motivo, true)
  }

  // ── 3 · ¿ES LOGÍSTICA? ────────────────────────────────────────────────────
  if (esAdministrativa(t)) {
    return {
      clase: 'ADMINISTRATIVE_ACTION',
      texto:
        'Eso lo puedes ver y cambiar tú mismo en «Hoy», donde están tus citas. ' +
        'Si no encuentras lo que buscas, llama a tu consultorio.',
      motivo: null,
      procedencia: null,
      avisarAlConsultorio: false,
    }
  }

  // ── 4 · ¿ESTÁ ESCRITO EN LO QUE SU MÉDICO LE LIBERÓ? ──────────────────────
  const plan = ctx.plan
  if (!plan) return escalar('sin_plan_liberado', true)

  const procedenciaDe = (campo: ProcedenciaDeLaRespuesta['campo']): ProcedenciaDeLaRespuesta => ({
    nivel: 2,
    notaId: plan.notaId,
    fechaConsulta: plan.fechaConsulta,
    version: plan.version,
    campo,
  })

  const mencionados = medicamentosMencionados(t, plan)
  if (mencionados.length > 1) return escalar('dos_medicamentos_posibles', true)
  if (mencionados.length === 1 && PREGUNTA_POR_TOMA.test(t)) {
    return {
      clase: 'ANSWER_FROM_APPROVED_PLAN',
      // La instrucción TAL CUAL viene del paquete. Aquí no se reescribe ni se
      // resume: reescribir la indicación de un médico es editarla.
      texto: mencionados[0].instruccion,
      motivo: null,
      procedencia: procedenciaDe('medicationInstructions'),
      avisarAlConsultorio: false,
    }
  }

  if (/(seguimiento|proxima consulta|cuando vuelvo|cuando regreso|cita de control|volver a verlo|revision)/.test(t)) {
    const f = String(plan.followUp ?? '').trim()
    if (f) {
      return {
        clase: 'ANSWER_FROM_APPROVED_PLAN',
        texto: f,
        motivo: null,
        procedencia: procedenciaDe('followUp'),
        avisarAlConsultorio: false,
      }
    }
    // Vacío no es «no hay seguimiento»: es que no se escribió. Se escala.
    return escalar('no_esta_en_el_plan_liberado', true)
  }

  if (/(estudio|analisis|laboratorio|examen|radiograf|ultrasonido|me pidio|me mando a hacer)/.test(t)) {
    const ordenes = (plan.orders ?? []).map(o => String(o ?? '').trim()).filter(Boolean)
    if (ordenes.length) {
      return {
        clase: 'ANSWER_FROM_APPROVED_PLAN',
        texto: ordenes.map(o => `• ${o}`).join('\n'),
        motivo: null,
        procedencia: procedenciaDe('orders'),
        avisarAlConsultorio: false,
      }
    }
    return escalar('no_esta_en_el_plan_liberado', true)
  }

  if (/(que me cambio|que cambio|cambios en mi tratamiento|que es nuevo|que quito|que me quito)/.test(t)) {
    /**
     * `null` ES DISTINTO DE LISTA VACÍA, Y AQUÍ SE NOTA.
     *
     * El tipo lo dice: «`null` = no se pudo determinar. NO es lo mismo que "no
     * hubo cambios"». Contestar «no hubo cambios» sobre un `null` convierte un
     * fallo de cálculo en una afirmación clínica, y el lector no puede detectar
     * el error. Regla 4 de seguridad clínica.
     */
    const cambios = plan.medicationChanges
    if (cambios === null) return escalar('no_esta_en_el_plan_liberado', true)
    const relevantes = cambios.filter(c => c.tipo !== 'sin-cambio')
    if (!relevantes.length) return escalar('no_esta_en_el_plan_liberado', true)
    return {
      clase: 'ANSWER_FROM_APPROVED_PLAN',
      texto: relevantes
        .map(c => `• ${c.nombre}: ${c.tipo === 'nuevo' ? 'nuevo' : 'suspendido'}`)
        .join('\n'),
      motivo: null,
      procedencia: procedenciaDe('medicationChanges'),
      avisarAlConsultorio: false,
    }
  }

  // ── 5 · TODO LO DEMÁS ESCALA ──────────────────────────────────────────────
  return escalar('no_esta_en_el_plan_liberado', true)
}

/**
 * El destino por omisión. Se escribe una sola vez para que ninguna rama pueda
 * inventar una redacción distinta de «esto lo contesta un humano».
 */
function escalar(motivo: MotivoEscalacion, avisar: boolean): RespuestaAlPaciente {
  return {
    clase: 'ESCALATE_TO_CLINICIAN',
    texto: TEXTO_ESCALACION,
    motivo,
    procedencia: null,
    avisarAlConsultorio: avisar,
  }
}

/**
 * Lo que ve el paciente cuando se escala.
 *
 * No dice «no puedo ayudarte»: dice quién va a contestar y qué pasó con su
 * pregunta. Una escalación que se lee como un rechazo hace que el paciente deje
 * de preguntar, y entonces el canal deja de servir para lo que existe.
 *
 * Y no repite el motivo: al paciente no le sirve saber que su frase encajó en
 * `cambio_de_dosis`. El motivo va al consultorio, que es quien decide.
 */
export const TEXTO_ESCALACION =
  'Esta pregunta la tiene que contestar tu médico, no yo. Ya quedó registrada y ' +
  'el consultorio la va a ver. Si es algo que no puede esperar, llámales.'

/**
 * Lo que se le avisa al consultorio. Sin diagnóstico y sin opinión: qué preguntó y por qué llegó.
 *
 * D-033 (dueño, 5-sep-2026): la pregunta viaja COMPLETA (hasta el tope) por el
 * WhatsApp del consultorio, con el nombre del paciente. Se planteó mandar sólo
 * motivo + enlace al portal; el dueño decidió que el consultorio lea la
 * pregunta tal cual, porque un aviso que obliga a abrir otra pantalla para
 * saber qué pasa es un aviso que se atiende tarde. WA-9 del registro de riesgos
 * de WhatsApp queda resuelto con esta decisión, no con un cambio de código.
 */
export const TOPE_TEXTO_PREGUNTA = 300

export function avisoDePreguntaAlConsultorio(
  nombrePaciente: string,
  motivo: MotivoUrgencia | MotivoEscalacion | null,
  textoDelPaciente: string,
): string {
  const recorte = String(textoDelPaciente ?? '').trim().slice(0, TOPE_TEXTO_PREGUNTA)
  const etiqueta = motivo && motivo in MOTIVO_ESCALACION_LABEL
    ? MOTIVO_ESCALACION_LABEL[motivo as MotivoEscalacion]
    : 'pregunta sin clasificar'
  return [
    '💬 *Un paciente preguntó por el portal*',
    '',
    `👤 ${String(nombrePaciente ?? '').trim() || 'Paciente'}`,
    `🔎 ${etiqueta}`,
    `💬 «${recorte}»`,
    '',
    'Nadie le ha contestado. El portal sólo le dijo que usted la va a ver.',
  ].join('\n')
}
