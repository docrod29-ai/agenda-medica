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
import {
  urgenciaDelMensaje, mensajeDeUrgencia,
  type MotivoUrgencia, type ClaseRespuestaPaciente, type CanalDelPaciente,
} from './urgencia'
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
  | 'saltarse_u_omitir_una_toma'
  | 'efecto_adverso_o_sintoma_nuevo'
  | 'suspender_o_iniciar_por_su_cuenta'
  | 'prescripcion_o_receta'
  | 'diagnostico_o_interpretacion_de_resultado'
  | 'documento_firmado'
  | 'pasar_por_encima_del_medico'
  | 'embarazo_o_lactancia'
  | 'dos_medicamentos_posibles'
  | 'no_esta_en_el_plan_liberado'
  | 'sin_plan_liberado'

/**
 * LA ETIQUETA ES LO QUE LEE EL CONSULTORIO, Y TIENE QUE SER LA VERDAD (PO-018).
 *
 * Todo lo que no encajaba salía rotulado «pregunta algo que no está en lo que
 * se le liberó», incluida una queja de efecto adverso y una petición de receta.
 * Quien abre el worklist a las ocho de la mañana ordena por esa etiqueta: una
 * etiqueta genérica manda al final de la lista lo que tenía que ir primero.
 */
export const MOTIVO_ESCALACION_LABEL: Record<MotivoEscalacion, string> = {
  cambio_de_dosis: 'pregunta por cambiar una dosis',
  saltarse_u_omitir_una_toma: 'pregunta si puede saltarse o retrasar una toma',
  efecto_adverso_o_sintoma_nuevo: 'cuenta un efecto o un síntoma nuevo con su tratamiento',
  suspender_o_iniciar_por_su_cuenta: 'dice que suspendió o quiere iniciar un medicamento',
  prescripcion_o_receta: 'pide una receta o un cambio de receta',
  diagnostico_o_interpretacion_de_resultado: 'pide interpretar un resultado o un diagnóstico',
  documento_firmado: 'pide un documento médico firmado (incapacidad, constancia, certificado)',
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
    /**
     * EMBARAZO Y LACTANCIA — escalan SIEMPRE, aunque el plan no los mencione.
     *
     * Es la regla 5 dicha en su caso más caro: «que el plan no mencione el
     * embarazo no significa que la paciente no lo esté». Si esto no estuviera
     * aquí, «estoy embarazada, ¿sigo con el metoprolol?» encontraría el
     * metoprolol en el plan y le contestaría cómo tomarlo — un plan que se
     * escribió, quizá, sin saber que estaba embarazada.
     *
     * ── MG-014 · «ESTOY DANDO PECHO» NO CASABA, Y ESO SÍ ERA INSEGURO ──────
     *
     * El vocabulario tenía UN verbo —«doy pecho»— y la mitad de las mujeres lo
     * dice de otra forma. «Estoy dando pecho, ¿cómo tomo el ibuprofeno?» no
     * casaba, caía al paso 4, encontraba el ibuprofeno en el plan y le
     * contestaba la pauta: un plan escrito, quizá, sin saber que amamanta.
     *
     * Este archivo se atribuía en su cabecera que «un vocabulario incompleto
     * pierde precisión, nunca seguridad». Era falso para este caso, porque el
     * hueco no caía a escalar: caía a responder. Por eso este acto va **el
     * primero de la lista**: cuando el embarazo o la lactancia están sobre la
     * mesa, ninguna otra etiqueta describe mejor lo que hay que mirar.
     */
    motivo: 'embarazo_o_lactancia',
    prueba: t =>
      /embarazad|embarazo|gestante|gestacion|en cinta|espero un bebe|voy a tener un bebe|estoy esperando/.test(t) ||
      /doy pecho|dando pecho|dar pecho|dandole pecho|le doy pecho|estoy lactando|lactando|lactancia|amamant|leche materna|le doy leche|sacandome leche|extraccion de leche/.test(t),
  },
  {
    motivo: 'cambio_de_dosis',
    prueba: t =>
      /(el doble|la mitad|mas dosis|menos dosis|subir la dosis|bajar la dosis|aumentar la dosis|reducir la dosis|dos pastillas en vez|otra pastilla mas)/.test(t) ||
      (/(puedo|podria|debo|deberia|le subo|le bajo|me subo|me bajo)/.test(t) &&
        /(dosis|mas pastilla|menos pastilla|doble|mitad)/.test(t)) ||
      /*
       * ── PO-018 · «¿CUÁNTO IBUPROFENO PUEDO TOMAR?» ES UNA DOSIS ─────────
       *
       * Escalaba —bien— pero con la etiqueta «no está en el plan», que en el
       * worklist se lee como una duda administrativa. La pregunta de CUÁNTA
       * cantidad tomar es una pregunta de dosis, y así se rotula.
       *
       * Y sigue escalando, no se contesta: aunque la instrucción liberada
       * llevara la cantidad, decirla aquí sería que este canal enuncie una
       * dosis por su cuenta (§3). Con un menor de por medio —«¿cuántos mL le
       * doy?»— eso es exactamente PL-C1.
       */
      (/(cuanto|cuanta|cuantos|cuantas|que cantidad|que dosis)/.test(t) &&
        /(tomar|tomo|me tomo|le doy|darle|dar|aplico|aplicarle|mg\b|ml\b|gotas|cucharad|pastilla|tableta|jarabe)/.test(t)) ||
      // «El doctor dijo 5 mg pero el frasco dice 10» — discrepancia entre lo
      // aprobado y lo que el paciente tiene en la mano. No decide cuál vale.
      (/(dijo|receto|indico|dice)/.test(t) && /(frasco|caja|etiqueta|bote)/.test(t) && /\d/.test(t)),
  },
  {
    /**
     * ── PI-001 · SALTARSE UNA TOMA ES UN CAMBIO DE TRATAMIENTO ─────────────
     *
     * «Si no como, ¿me tomo la metformina?» y «¿puedo saltarme el paracetamol
     * hoy?» encontraban el fármaco en el plan, casaban con la subcadena «como»
     * y recibían la pauta LITERAL con `avisarAlConsultorio: false`. O sea: se
     * contestaba una pregunta que nadie hizo (cómo se toma) y se dejaba sin
     * contestar la que sí se hizo (si hoy se la salta) — y nadie se enteraba.
     *
     * Omitir, retrasar o doblar una toma es de las cosas del §3 que este canal
     * no puede decidir. Va ANTES de mirar el plan, como todos los actos.
     */
    motivo: 'saltarse_u_omitir_una_toma',
    prueba: t =>
      /(saltar|saltarme|saltarmela|salto|brincar|brincarme|omitir|omito|me la salto|me lo salto)/.test(t) ||
      /(se me olvido|se me paso|olvide) (tomar|la pastilla|el medicamento|la dosis|tomarme|tomarla|tomarlo)/.test(t) ||
      /(si no como|sin comer|no he comido|no comi|no desayune|estoy en ayunas)/.test(t) ||
      /(hoy no (me )?(la|lo|las|los) tom|no (me )?(la|lo) tomo hoy|puedo no tomar|puedo dejar de tomarla hoy)/.test(t) ||
      /(mas tarde|mas temprano|otra hora|a otra hora) .{0,20}(tom|dosis)/.test(t),
  },
  {
    /**
     * ── PI-002 · UN EFECTO ADVERSO NO SE CONTESTA CON LA PAUTA ─────────────
     *
     * «Cuando tomo la furosemida me da mucha sed, ¿es normal?» no es una
     * pregunta de horario: es una queja. Casaba con la subcadena «cuando», se
     * contestaba «Una tableta por la mañana.» y la queja no llegaba a nadie.
     *
     * El fixture ya tenía el mismo caso dicho de otra forma
     * (`ai-11-duda-clinica-abierta`), así que esto no es vocabulario nuevo: es
     * una forma de decirlo que derrotaba la puerta.
     */
    motivo: 'efecto_adverso_o_sintoma_nuevo',
    prueba: t =>
      (/(me da|me dio|me esta dando|me causa|me provoca|me salio|me salieron|me siento|siento|tengo|me duele|me pasa)/.test(t) &&
        /(sed|nausea|nauseas|vomito|diarrea|estrenim|mareo|maread|sueno|cansanci|debil|comezon|ronchas|salpullido|urticaria|sabor|calambre|dolor de cabeza|acidez|palpitacion|hinchaz|hinchad|sangrado de encias|moretones|zumbido)/.test(t)) ||
      /(desde que (empece|tomo|uso|me tomo|inicie)|desde que me lo dieron|desde que lo tomo)/.test(t) ||
      /(me cayo mal|me hizo mal|me sento mal|reaccione mal|creo que soy alergic|me dio alergia)/.test(t),
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
      // PO-018: «¿me mandas otra receta?» no llevaba etiqueta de receta porque
      // la lista de verbos era corta. La palabra `receta` con cualquier verbo
      // de petición es una petición de receta.
      (/\breceta\b|\brecetas\b|prescripcion/.test(t) &&
        /(cambiame|cambia|cambiar|renuevame|renovar|renueva|hazme|haces|dame|das|mandame|mandas|manda|necesito|quiero|puedes|puedo pedir|me falta|se me acabo|otra)/.test(t)) ||
      /(recetame|prescribeme|que me recomiendas tomar|que puedo tomar para)/.test(t),
  },
  {
    motivo: 'diagnostico_o_interpretacion_de_resultado',
    prueba: t =>
      // «¿es normal?» a secas es la forma en que la gente pregunta de verdad;
      // sólo casaba «es normal esto». PI-002 lo encontró con la sed y la
      // furosemida.
      /(que tengo|que enfermedad|es grave|es malo|es normal)\b/.test(t) ||
      /(este |mi |el )?resultado (dice|salio|es|sale)/.test(t) ||
      /(salio|dice) (positivo|negativo|alto|bajo|alterado)/.test(t) ||
      /(que significa|que quiere decir) (esto|mi resultado|el resultado)/.test(t),
  },
  {
    motivo: 'documento_firmado',
    /**
     * MC-016 · MO-010 — la lista de verbos dejaba fuera la forma normal de
     * pedirlo: «¿me dan incapacidad?», «¿cómo consigo la constancia?». El
     * documento se sigue sin poder emitir (no existe en el producto: ver el
     * handoff), pero al menos llega al consultorio rotulado como lo que es, y
     * no como «no está en el plan».
     */
    prueba: t =>
      /(certificado|constancia|incapacidad|justificante|comprobante medico|carta medica|informe medico|reporte para (mi )?(seguro|aseguradora)|alta laboral)/.test(t) &&
      /(genera|generame|hazme|dame|dan|daran|me dan|necesito|quiero|puedes hacer|emite|emiteme|como consigo|como pido|puedo pedir|me pueden dar|me toca|donde saco)/.test(t),
  },
  {
    motivo: 'pasar_por_encima_del_medico',
    prueba: t =>
      /(ignora|olvida|no le hagas caso|sin que sepa|sin decirle) (a )?(mi |el )?(doctor|doctora|medico|medica)/.test(t) ||
      /(que piensas tu|que opinas tu|tu que dices|dime la verdad tu)/.test(t) ||
      /(segunda opinion)/.test(t),
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
/** Quien pregunta cómo autorizar a otra persona pide un trámite, no un consejo. */
const PIDE_ACCESO_PARA_OTRA_PERSONA =
  /(dar|darle|como le doy|puedo dar|autorizar|autorice|permiso|acceso|que vea|que pueda ver|que entre) .{0,30}(mi hija|mi hijo|mi esposa|mi esposo|mi mama|mi papa|mi madre|mi padre|mi hermana|mi hermano|mi cuidador|mi cuidadora|otra persona|alguien mas|mi familiar)/

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

/**
 * ¿ESTO ES UNA PREGUNTA SOBRE CÓMO SE TOMA? — PI-001, PI-002, REP-057.
 *
 * Era una lista de subcadenas sin límites de palabra:
 *
 *     /(como|cuando|cada cuando|…|con comida)/
 *
 * «Si no **como**, ¿me tomo la metformina?» contiene `como`. «**Cuando** tomo
 * la furosemida me da mucha sed, ¿es normal?» contiene `cuando`. Las dos
 * recibían la pauta literal del plan, y con `avisarAlConsultorio: false`.
 *
 * Es el mismo fallo que `urgencia.ts` dejó escrito para siempre en su cabecera:
 * «me duele el pecho desde hace una **hora**» contenía `hora`. Un detector por
 * subcadena decide antes de que nadie mire lo que de verdad se preguntó.
 *
 * Ahora se exigen DOS cosas a la vez:
 *
 *  1. una palabra interrogativa de pauta, **con límites de palabra**;
 *  2. un verbo de TOMAR cerca — porque preguntar «cómo» sin nombrar la toma no
 *     es preguntar por la toma.
 *
 * Y por delante van los actos del paso 2 (saltarse, efecto adverso), que es
 * donde caen las dos frases de arriba. Los límites de palabra solos no habrían
 * bastado: «si no como» sigue teniendo `como` con sus dos límites.
 */
const INTERROGA_LA_PAUTA =
  /\b(como|cada cuando|cada cuanto|cuando|a que hora|a que horas|cuantas veces|cuanto tiempo|por cuanto tiempo|hasta cuando|con que|en ayunas|con comida|con alimentos?|antes de comer|despues de comer)\b/

const VERBO_DE_TOMAR =
  /\b(tomo|tomas|toma|tomar|tomarme|tomarla|tomarlo|tomo la|me tomo|se toma|doy|darle|dar|aplico|aplicar|aplicarme|uso|usar|pongo|ponerme|inyecto|inyectarme|sigo con|continuo con)\b/

function preguntaPorLaToma(t: string): boolean {
  return INTERROGA_LA_PAUTA.test(t) && VERBO_DE_TOMAR.test(t)
}

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
  /**
   * POR DÓNDE ENTRÓ LA PREGUNTA.
   *
   * El mismo aviso no sirve en los dos sitios: en WhatsApp los asteriscos son
   * negritas y el número es texto; en el portal los asteriscos se pintan tal
   * cual y el número es un botón que marca (PC-005). Por omisión, `portal`:
   * este motor sólo lo llama la ruta del portal, y el bot de WhatsApp usa
   * `mensajeDeUrgencia` directamente.
   */
  canal?: CanalDelPaciente
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
  const tel = ctx.telefonoConsultorio ?? ''

  // ── 1 · LA URGENCIA GANA A TODO LO DEMÁS ──────────────────────────────────
  const urgencia = urgenciaDelMensaje(texto)
  if (urgencia) {
    return {
      clase: 'URGENT_REVIEW_REQUIRED',
      texto: mensajeDeUrgencia(tel, ctx.canal ?? 'portal'),
      motivo: urgencia.motivo,
      procedencia: null,
      avisarAlConsultorio: true,
    }
  }

  // Un mensaje vacío no es una pregunta. No dispara nada y no rompe nada.
  if (!t.trim()) {
    return escalar('no_esta_en_el_plan_liberado', false, tel)
  }

  // ── 2 · ¿PIDE UN ACTO QUE ESTE CANAL NO PUEDE HACER? ──────────────────────
  // Va ANTES de mirar el plan. Ver la cabecera: es la diferencia entre
  // contestar la pregunta que se hizo y contestar otra que se le parece.
  for (const a of ACTOS_PROHIBIDOS) {
    if (a.prueba(t)) return escalar(a.motivo, true, tel)
  }

  /*
   * ── PI-020 · «¿CÓMO LE DOY PERMISO A MI HIJA?» NO ES UNA PREGUNTA MÉDICA ──
   *
   * Se contestaba «esa pregunta la tiene que contestar tu médico», que es
   * absurdo: quien pregunta cómo autorizar a su hija está pidiendo un trámite,
   * no una opinión clínica. Y ahora hay respuesta de verdad que dar, porque el
   * cuidador autorizado existe (`lib/paciente/cuidador-autorizado.ts`).
   *
   * Va ANTES del resto de lo administrativo porque `esAdministrativa` es
   * deliberadamente estrecha y esto no encaja en ninguna de sus frases.
   */
  if (PIDE_ACCESO_PARA_OTRA_PERSONA.test(t)) {
    return {
      clase: 'ADMINISTRATIVE_ACTION',
      texto:
        'Eso no lo decide este canal: lo autoriza tu consultorio. Pídeles que den ' +
        'acceso a la persona que quieras, diciendo quién es y qué parentesco tiene ' +
        'contigo. Queda anotado quién entró y tú puedes quitarlo cuando quieras.',
      motivo: null,
      procedencia: null,
      avisarAlConsultorio: false,
    }
  }

  // ── 3 · ¿ES LOGÍSTICA? ────────────────────────────────────────────────────
  if (esAdministrativa(t)) {
    return {
      clase: 'ADMINISTRATIVE_ACTION',
      /*
       * PG-021: decía «tú mismo». La mitad de quien lee esto es una paciente de
       * ginecología, y el producto le hablaba en masculino. Se dice sin género:
       * no cuesta nada y no obliga a saber el sexo de nadie para escribir bien.
       */
      texto:
        'Eso lo puedes ver y cambiar desde «Hoy», donde están tus citas. ' +
        'Si no encuentras lo que buscas, llama a tu consultorio.',
      motivo: null,
      procedencia: null,
      avisarAlConsultorio: false,
    }
  }

  // ── 4 · ¿ESTÁ ESCRITO EN LO QUE SU MÉDICO LE LIBERÓ? ──────────────────────
  const plan = ctx.plan
  if (!plan) return escalar('sin_plan_liberado', true, tel)

  const procedenciaDe = (campo: ProcedenciaDeLaRespuesta['campo']): ProcedenciaDeLaRespuesta => ({
    nivel: 2,
    notaId: plan.notaId,
    fechaConsulta: plan.fechaConsulta,
    version: plan.version,
    campo,
  })

  const mencionados = medicamentosMencionados(t, plan)
  if (mencionados.length > 1) return escalar('dos_medicamentos_posibles', true, tel)
  if (mencionados.length === 1 && preguntaPorLaToma(t)) {
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
    return escalar('no_esta_en_el_plan_liberado', true, tel)
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
    return escalar('no_esta_en_el_plan_liberado', true, tel)
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
    if (cambios === null) return escalar('no_esta_en_el_plan_liberado', true, tel)
    const relevantes = cambios.filter(c => c.tipo !== 'sin-cambio')
    if (!relevantes.length) return escalar('no_esta_en_el_plan_liberado', true, tel)
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
  return escalar('no_esta_en_el_plan_liberado', true, tel)
}

/**
 * El destino por omisión. Se escribe una sola vez para que ninguna rama pueda
 * inventar una redacción distinta de «esto lo contesta un humano».
 */
function escalar(motivo: MotivoEscalacion, avisar: boolean, telefono = ''): RespuestaAlPaciente {
  return {
    clase: 'ESCALATE_TO_CLINICIAN',
    texto: textoDeEscalacion(telefono),
    motivo,
    procedencia: null,
    avisarAlConsultorio: avisar,
  }
}

/**
 * ── PC-003 · PP-021 · PO-020 — «LLÁMALES» SIN NÚMERO NO LLEVA A NINGÚN SITIO ─
 *
 * El texto de escalación decía «si es algo que no puede esperar, llámales» y
 * ahí acababa. A las dos de la mañana, con la herida abierta, eso es una
 * instrucción sin destino — y en un consultorio que no cargó su teléfono, ni
 * siquiera hay a quién llamar.
 *
 * Se dice lo que se puede sostener:
 *  · el número del consultorio CUANDO lo hay, escrito entero;
 *  · la vía de urgencias SIEMPRE, porque no depende de que nadie configure nada;
 *  · y NINGÚN PLAZO. Prometer «en 24 horas» sería comprometer a un consultorio
 *    que no se ha comprometido (PL-P7: no prometer plazo).
 */
export function textoDeEscalacion(telefonoConsultorio = ''): string {
  const tel = String(telefonoConsultorio ?? '').trim()
  return [
    TEXTO_ESCALACION,
    tel
      ? `Si no puede esperar, llama a tu consultorio al ${tel}.`
      : 'Tu consultorio no dejó aquí un teléfono: si no puede esperar, usa el número por el que agendaste tu cita.',
    'Y si es una urgencia, no esperes por aquí: acude al servicio de urgencias más cercano.',
  ].join(' ')
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
  'el consultorio la va a ver, aunque puede que no sea hoy mismo.'

/**
 * Tope de lo que se GUARDA de la pregunta. Sigue existiendo aunque el aviso de
 * WhatsApp ya no lleve el texto: la ruta recorta lo que entra al expediente.
 */
export const TOPE_TEXTO_PREGUNTA = 300

/**
 * LO QUE SE LE AVISA AL CONSULTORIO POR WHATSAPP — Y LO QUE YA NO VIAJA AHÍ.
 *
 * ── QUÉ PASABA (PG-005, P1) ─────────────────────────────────────────────────
 *
 * El aviso llevaba el NOMBRE de la paciente y su pregunta ÍNTEGRA: «tengo
 * sangrado desde ayer y me duele, ¿es normal con la pastilla?». Salía por el
 * WhatsApp del consultorio, o sea por Meta y por 360dialog.
 *
 * Al mismo tiempo, el aviso de privacidad que este producto publica en
 * `/privacidad/{clinicId}` declaraba, de Meta/WhatsApp: «No trata datos de
 * salud». Las dos cosas no podían ser verdad. Un aviso de privacidad que
 * describe un tratamiento que no es el real es lo primero que lee un regulador
 * (LFPDPPP art. 15-16), y lo leyó antes una paciente del panel.
 *
 * ── QUÉ SE HACE, Y POR QUÉ ES LO SEGURO ─────────────────────────────────────
 *
 * El aviso se vuelve GENÉRICO: dice que hay una pregunta en el portal y quién
 * la hizo, y **no puede** llevar el texto — no porque se recorte, sino porque
 * esta función ya no lo recibe. La prohibición vive en la firma, no en la
 * disciplina de quien la llama.
 *
 * Lo que sí viaja, además del nombre, es UNA señal: si el portal la marcó como
 * posible urgencia. Sin eso, el aviso de las 2 a.m. es indistinguible del de
 * «¿a qué hora abren?», y un aviso que no se puede priorizar es un aviso que se
 * lee mañana. Es una bandera de triage, no contenido clínico.
 *
 * La pregunta completa sigue estando donde tiene que estar: en el expediente,
 * en `preguntas_paciente`, y en la tarea de `/pendientes` que la escalación
 * abre — dentro del consultorio, protegida por las reglas, con bitácora.
 *
 * ── QUÉ CAMBIA RESPECTO DE D-034, Y QUIÉN PUEDE REVERTIRLO ──────────────────
 *
 * D-034 (5-sep-2026) decidió lo contrario: «la pregunta viaja COMPLETA por el
 * WhatsApp del consultorio, porque un aviso que obliga a abrir otra pantalla se
 * atiende tarde». La reparación del Panel de Lujo (PG-005, autorizada por el
 * dueño el 6-sep-2026) aplica el valor seguro. El coste queda dicho: el
 * consultorio tiene que abrir el portal o `/pendientes` para saber qué se
 * preguntó. Revertirlo es volver a pasar el texto por aquí — y entonces
 * `tocaDatosDeSalud` de Meta y 360dialog tiene que seguir en `true` igual.
 */
export function avisoDePreguntaAlConsultorio(
  nombrePaciente: string,
  posibleUrgencia: boolean,
): string {
  return [
    posibleUrgencia
      ? '🚨 *Posible urgencia: un paciente escribió por el portal*'
      : '💬 *Un paciente preguntó por el portal*',
    '',
    `👤 ${String(nombrePaciente ?? '').trim() || 'Paciente'}`,
    '',
    'La pregunta NO viaja por aquí: son datos de salud. Ábrela en Pendientes o en su expediente.',
    'Nadie le ha contestado. El portal sólo le dijo que usted la va a ver.',
  ].join('\n')
}
