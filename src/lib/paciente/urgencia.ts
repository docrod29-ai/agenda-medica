/**
 * URGENCIA EN EL CANAL DEL PACIENTE — la pregunta que se hace ANTES que ninguna.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El bot de WhatsApp decidía primero «¿de qué tema habla?» con un detector de
 * preguntas frecuentes que trabaja por subcadena:
 *
 *     if (/horario|hora|atiende|.../.test(t)) return 'horario'
 *
 * «Me duele el pecho desde hace una **hora**» contiene `hora`. Al paciente con
 * dolor torácico se le contestaba el **horario de atención del consultorio**. Y
 * «no puedo respirar» no casaba con nada, así que caía al menú de bienvenida.
 *
 * El fallo no era de detección: era de ORDEN. Un detector de temas preguntado
 * primero decide antes de que nadie mire si el paciente se está muriendo. Por
 * eso este módulo se consulta **antes** que la pregunta frecuente, antes que la
 * intención de agenda y antes que la máquina de estados — incluso a mitad de un
 * agendado.
 *
 * ── DE DÓNDE SALE LA LISTA (no se inventa política clínica) ──────────────────
 *
 * Las cinco categorías son, literalmente, las del §6 de
 * `.claude/rules/patient-facing-ai.md`: dolor torácico, dificultad
 * respiratoria, síntomas neurológicos agudos, ingesta accidental por un tercero
 * y sobredosis. Y la vía de contacto —urgencias o 911— es la que el portal del
 * paciente (`app/mi/[token]`) le dice desde siempre a quien entra por ahí. La
 * política ya existía en el producto; lo que faltaba era aplicarla en el canal
 * por el que entra la mayoría.
 *
 * Aquí NO se decide gravedad, NO se triaja, NO se aconseja y NO se atiende.
 * Se ESCALA. La escalación es el producto, no el fallo.
 *
 * ── POR QUÉ NO HAY DETECCIÓN DE NEGACIÓN, Y ES DELIBERADO ───────────────────
 *
 * Tentador: «no me duele el pecho» no debería escalar. Pero la frase más
 * importante de toda la lista es **«no puedo respirar»**, que empieza por «no».
 * Una regla de negación ingenua callaría justo el caso que más importa.
 *
 * Así que se escala ante la coincidencia, sin mirar negaciones. Un falso
 * positivo le cuesta al paciente un mensaje diciéndole que llame; un falso
 * negativo le cuesta la vida. La asimetría decide.
 *
 * ── LO QUE ESTE MÓDULO NO VIGILA (clinical-safety.md §5) ────────────────────
 *
 * Esto es VOCABULARIO, no criterio. Que una forma de decirlo no esté aquí
 * significa que **ese caso no se vigila**, no que sea benigno. No cubre, entre
 * otros: hemorragia, trauma, dolor abdominal agudo, fiebre en el lactante,
 * reacción alérgica/anafilaxia, ideación suicida, complicaciones del embarazo,
 * ni ninguna lengua distinta del español. Ampliar la lista es trabajo con
 * nombre, no una regla que se pueda dar por hecha.
 *
 * Módulo PURO: sin Firestore, sin red, sin reloj.
 */
import { normalizar } from '@/lib/whatsapp/intencion'

/**
 * Las CINCO clases de respuesta del §2 de `patient-facing-ai.md`. La lista es
 * cerrada a propósito: «y ninguna sexta». Hoy este módulo sólo emite la última;
 * las otras cuatro se nombran aquí para que quien las implemente no invente un
 * nombre nuevo ni una clase sexta.
 */
export const CLASES_RESPUESTA_PACIENTE = [
  'ANSWER_FROM_APPROVED_PLAN',
  'EDUCATIONAL_EXPLANATION',
  'ADMINISTRATIVE_ACTION',
  'ESCALATE_TO_CLINICIAN',
  'URGENT_REVIEW_REQUIRED',
] as const

export type ClaseRespuestaPaciente = (typeof CLASES_RESPUESTA_PACIENTE)[number]

/** Las categorías del §6, con el nombre que se guarda en la bitácora. */
export type MotivoUrgencia =
  | 'dolor_toracico'
  | 'dificultad_respiratoria'
  | 'sintomas_neurologicos_agudos'
  | 'ingesta_accidental_o_sobredosis'

export const MOTIVO_LABEL: Record<MotivoUrgencia, string> = {
  dolor_toracico: 'dolor en el pecho',
  dificultad_respiratoria: 'dificultad para respirar',
  sintomas_neurologicos_agudos: 'síntomas neurológicos',
  ingesta_accidental_o_sobredosis: 'ingesta accidental o sobredosis',
}

export interface Urgencia {
  motivo: MotivoUrgencia
  /** Siempre la misma: la urgencia gana a cualquier otra clasificación. */
  clase: Extract<ClaseRespuestaPaciente, 'URGENT_REVIEW_REQUIRED'>
}

/**
 * Las reglas, en el orden del §6. Cada una pide **dos** señales cuando la
 * palabra suelta sería ambigua: `respirar` a secas no es una urgencia
 * («¿puedo respirar normal antes del estudio?»); `no puedo respirar` sí.
 */
const REGLAS: ReadonlyArray<{ motivo: MotivoUrgencia; prueba: (t: string) => boolean }> = [
  {
    motivo: 'dolor_toracico',
    prueba: t =>
      /dolor torac/.test(t) ||
      (/\bpecho\b/.test(t) &&
        /**
         * REG-439 · `doler`, `doliendo` y `apret` faltaban, y son tres formas
         * completamente normales de decirlo en español:
         *
         *   «me empezó a DOLER el pecho»   ·   «me está DOLIENDO el pecho»
         *   «se me APRETÓ el pecho»
         *
         * Las tres salían NO urgentes. Se vio añadiendo al fixture un caso que
         * cruza escalación y urgencia —«me tomé el doble y me empezó a doler el
         * pecho»— para vigilar el orden del §6; el orden estaba bien y lo que
         * falló fue el detector.
         *
         * `molestia` NO se añade: es demasiado inespecífico y es justo el ruido
         * contra el que advierte el §6. Declarado en `LO_QUE_NO_SE_VIGILA`.
         */
        /(dolor|duele|dolia|doler|doliendo|opresion|oprime|aprieta|apreta|apret|apretando|presion|arde|ardor|punzada|punzante|pesadez|quema)/.test(t)),
  },
  {
    motivo: 'dificultad_respiratoria',
    prueba: t =>
      (/respir/.test(t) && /(no puedo|no logro|me cuesta|dificultad|trabajo para|apenas|con dificultad)/.test(t)) ||
      /(me falta|falta de|no me llega|sin) (el )?aire/.test(t) ||
      /me ahog|estoy ahogand|asfixi|no puedo tomar aire/.test(t),
  },
  {
    motivo: 'sintomas_neurologicos_agudos',
    prueba: t =>
      /convulsion|convulsionand|ataque epileptic/.test(t) ||
      /desmay|perdi el conocimiento|perdio el conocimiento|no responde/.test(t) ||
      /derrame cerebral|embolia|infarto cerebral/.test(t) ||
      /(no puedo|no logro|no puede) (mover|caminar)/.test(t) ||
      /*
       * `hablar` y `ver` NO entran a secas, y cuesta caro que entren.
       *
       * «No puedo hablar ahora, agéndame para mañana» y «no puedo ver los
       * horarios en la página» son frases administrativas que la gente escribe
       * a diario. Contestarlas con el 911 rompe el canal y —peor— le enseña al
       * paciente a ignorar el aviso el día que sea de verdad. La asimetría que
       * justifica escalar ante la duda no es permiso para escalar lo común.
       */
      /no puedo hablar (bien|claro)|no me salen las palabras|se me traba la lengua|arrastro las palabras|hablo raro/.test(t) ||
      /no puedo ver (bien|nada|de un ojo|con un ojo)|perdi la vista|vision doble/.test(t) ||
      /se me (tuerce|torcio|chueca) la (boca|cara)/.test(t) ||
      /(no siento|se me durmio|entumid|adormecid) (el |la |mi )?(brazo|pierna|mano|cara|medio cuerpo|lado)/.test(t),
  },
  {
    motivo: 'ingesta_accidental_o_sobredosis',
    /**
     * ── EN PRIMERA PERSONA TAMBIÉN (REG-362) ─────────────────────────────────
     *
     * El verbo sólo cubría la TERCERA persona: `se tomó`, `se tragó`. La lista
     * nació pensando en «mi hijo se tomó mis pastillas», y con eso se quedó
     * fuera **una de las doce preguntas del §0 de V9**: *«me tomé por accidente
     * la medicina de otra persona»*.
     *
     * No es un caso raro: es la mitad de las veces que esto ocurre — el adulto
     * que se equivoca de frasco por la mañana. Lo encontró la puerta de
     * `evals/patient-ai/` la primera vez que se pudo correr.
     */
    prueba: t =>
      /sobredosis|se intoxic|me intoxiq|envenen/.test(t) ||
      (/((me |se )?(tome|tomo|trague|trago|bebi|bebio|comi|comio)|tome de mas|tomo de mas|tome todas|tomo todas)\b/.test(t) &&
        /(pastilla|medicamento|medicina|tableta|jarabe|frasco|cloro|veneno|pila|caja)/.test(t)),
  },
]

/**
 * ¿Lo que escribió el paciente es una de las urgencias del §6?
 *
 * Devuelve `null` cuando no coincide con NINGUNA regla — y eso significa
 * «no se vigila este caso», no «este caso es benigno».
 */
export function urgenciaDelMensaje(texto: string): Urgencia | null {
  const t = normalizar(texto)
  if (!t.trim()) return null
  for (const r of REGLAS) {
    if (r.prueba(t)) return { motivo: r.motivo, clase: 'URGENT_REVIEW_REQUIRED' }
  }
  return null
}

/**
 * Lo que se le contesta al paciente.
 *
 * El aviso va en la PRIMERA línea: «un aviso urgente que llega en el tercer
 * párrafo no llegó» (§6). No lleva diagnóstico, ni causa probable, ni qué hacer
 * mientras tanto: nada de eso puede salir de aquí sin un médico detrás.
 *
 * Y le dice explícitamente que **no espere respuesta por este canal**, porque
 * prometerle atención en un canal que nadie está mirando es lo que hace que se
 * quede esperando.
 */
export function mensajeDeUrgencia(telefonoConsultorio: string): string {
  const tel = String(telefonoConsultorio ?? '').trim()
  return [
    '🚨 *Esto puede ser una urgencia médica.*',
    '',
    'No espere respuesta por este medio: este canal es para citas y no hay nadie leyéndolo ahora mismo.',
    '',
    '📞 Llame al *911* o acuda al servicio de urgencias más cercano.',
    ...(tel ? [`📞 Consultorio: ${tel}`] : []),
    '',
    'Avisamos al consultorio de que usted escribió.',
  ].join('\n')
}

/**
 * Lo que se le avisa al CONSULTORIO. Lleva el teléfono completo —hace falta para
 * devolver la llamada— y lo que el paciente escribió, recortado: sin el texto,
 * quien lo lea no puede decidir nada.
 *
 * Va al WhatsApp del propio consultorio, dentro de su tenant. No es una
 * bitácora ni un log: `data-privacy.md` prohíbe PHI en logs, en URL y en
 * mensajes de error, y esto no es ninguna de las tres.
 */
export const TOPE_TEXTO_AVISO = 300

export function avisoDeUrgenciaAlConsultorio(
  telefonoPaciente: string,
  motivo: MotivoUrgencia,
  textoDelPaciente: string,
): string {
  const recorte = String(textoDelPaciente ?? '').trim().slice(0, TOPE_TEXTO_AVISO)
  return [
    '🚨 *Posible urgencia por WhatsApp*',
    '',
    `📱 ${telefonoPaciente}`,
    `🔎 Motivo detectado: ${MOTIVO_LABEL[motivo]}`,
    `💬 «${recorte}»`,
    '',
    'Se le respondió que llame al 911 o acuda a urgencias. Nadie lo ha atendido.',
  ].join('\n')
}

export const POR_QUE_VA_PRIMERO =
  'Porque el detector de preguntas frecuentes trabaja por subcadena y «me duele ' +
  'el pecho desde hace una hora» contiene «hora»: al paciente con dolor torácico ' +
  'se le contestaba el horario de atención. El fallo era de ORDEN, no de detección.'
