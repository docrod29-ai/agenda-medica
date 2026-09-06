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
 * significa que **ese caso no se vigila**, no que sea benigno.
 *
 * ── PL-C9 · LO QUE CINCO ESPECIALIDADES PIDIERON EL MISMO DÍA ───────────────
 *
 * El Panel de Lujo (sep-2026) trajo el mismo hallazgo por cinco caminos
 * distintos: obstetricia (MG-013, PG-001), pediatría (PP-001, PP-002),
 * postoperatorio (PC-003), ortopedia/vascular (PO-003) e interna (PI-011).
 * Todos decían lo mismo: a las 2 a.m. la paciente escribe «estoy sangrando» o
 * «no siento al bebé» y el sistema le contesta que «el consultorio la va a
 * ver».
 *
 * Ampliar ESTE vocabulario es el lado seguro y no inventa ninguna cifra: lo
 * único que hace escalar de más es un mensaje diciéndole a alguien que llame.
 * Por eso se amplía sin esperar a nadie. **Lo que sí dependería de una cifra
 * —la temperatura y la edad exactas del lactante febril, el corte de glucosa
 * baja— NO se fija aquí**: la regla se dispara por la MENCIÓN (fiebre en un
 * bebé, glucosa con síntomas), no por un umbral, y el umbral queda marcado
 * `NEEDS_CLINICAL_REVIEW` para el internista real. Una regla que espera a un
 * número que nadie ha dado es una regla que no vigila nada.
 *
 * ── LO QUE SIGUE SIN VIGILARSE, Y HAY QUE DECIRLO ───────────────────────────
 *
 * No cubre, entre otros: trauma craneal, dolor abdominal agudo, reacción
 * alérgica/anafilaxia, ideación suicida, deshidratación del lactante,
 * convulsión febril dicha con otras palabras, contracciones antes de término,
 * ni ninguna lengua distinta del español. Ampliar la lista sigue siendo
 * trabajo con nombre.
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

/**
 * Las categorías. Las cuatro primeras son las del §6 de `patient-facing-ai.md`;
 * las seis siguientes las pidió el Panel de Lujo por cinco especialidades
 * distintas (PL-C9) y **amplían el vocabulario, no el criterio**: todas acaban
 * en la misma acción —escalar y enseñar la vía— y ninguna calcula nada.
 */
export type MotivoUrgencia =
  | 'dolor_toracico'
  | 'dificultad_respiratoria'
  | 'sintomas_neurologicos_agudos'
  | 'ingesta_accidental_o_sobredosis'
  /* PL-C9 · obstetricia (MG-013, PG-001) */
  | 'sangrado_que_no_para'
  | 'urgencia_del_embarazo'
  /* PL-C9 · pediatría (PP-001) */
  | 'no_despierta_o_no_reacciona'
  | 'fiebre_en_un_bebe'
  /* PL-C9 · postoperatorio (PC-003) */
  | 'herida_con_pus_o_fiebre'
  /* PL-C9 · ortopedia y vascular (PO-003) */
  | 'extremidad_fria_o_morada'
  /* PL-C9 · interna (PI-011) */
  | 'glucosa_con_sintomas'

export const MOTIVO_LABEL: Record<MotivoUrgencia, string> = {
  dolor_toracico: 'dolor en el pecho',
  dificultad_respiratoria: 'dificultad para respirar',
  sintomas_neurologicos_agudos: 'síntomas neurológicos',
  ingesta_accidental_o_sobredosis: 'ingesta accidental o sobredosis',
  sangrado_que_no_para: 'sangrado que no para',
  urgencia_del_embarazo: 'problemas en el embarazo (sangrado, el bebé no se mueve, se rompió la fuente)',
  no_despierta_o_no_reacciona: 'alguien que no despierta o no reacciona',
  fiebre_en_un_bebe: 'fiebre en un bebé',
  herida_con_pus_o_fiebre: 'una herida con pus, abierta o con fiebre',
  extremidad_fria_o_morada: 'un pie o una mano fríos, morados o sin sensibilidad',
  glucosa_con_sintomas: 'azúcar baja con sudor frío, temblor o confusión',
}

/**
 * LO QUE ESTE MÓDULO **NO** DECIDE, Y HAY QUE PEDIRLE AL MÉDICO.
 *
 * Dos de las reglas nuevas viven donde habría que poner una cifra —la edad y la
 * temperatura del lactante febril; el corte de glucosa baja— y **aquí no se
 * pone ninguna**: la regla se dispara por la MENCIÓN, que es el lado seguro, y
 * el umbral queda pendiente con nombre y con dueño. Rellenarlo con «lo
 * habitual» sería exactamente el fallo que `clinical-safety.md` §1 llama el más
 * caro posible.
 *
 * Se exporta para que la pantalla pueda decirlo y para que una prueba pueda
 * exigir que siga dicho.
 */
export const UMBRALES_PENDIENTES = [
  {
    motivo: 'fiebre_en_un_bebe' as MotivoUrgencia,
    falta: 'NEEDS_CLINICAL_REVIEW: edad máxima en días/meses y temperatura a partir de la cual la fiebre del lactante es urgencia',
    quienLoDecide: 'el médico responsable (pediatría)',
    mientrasTanto: 'cualquier mención de fiebre en un bebé o lactante escala; escalar de más es el lado seguro',
  },
  {
    motivo: 'glucosa_con_sintomas' as MotivoUrgencia,
    falta: 'NEEDS_CLINICAL_REVIEW: cifra de glucosa capilar que se considera hipoglucemia grave',
    quienLoDecide: 'el médico responsable (medicina interna)',
    mientrasTanto: 'la mención de azúcar o glucosa junto a síntomas escala, sin mirar ninguna cifra',
  },
] as const

/**
 * EL NÚMERO DE EMERGENCIAS, EN UN SOLO SITIO.
 *
 * Estaba escrito a mano en `mensajeDeUrgencia()` y otra vez, en prosa, dentro
 * del portal del paciente. Dos copias de una vía de contacto divergen el día
 * que una de las dos se ajusta —y la que nadie tocó seguiría mandando a un
 * número que ya no atiende, a alguien que no puede detectar el error.
 *
 * Es MX. Cuando exista el paquete de otro país, esto se lee de ahí; hasta
 * entonces vive aquí, con nombre, para que se pueda encontrar.
 */
export const TELEFONO_EMERGENCIAS = '911'

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
        /(dolor|duele|dolia|opresion|oprime|aprieta|apreta|apretando|presion|arde|ardor|punzada|punzante|pesadez|quema)/.test(t)),
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
      (TOMO_YA.test(t) && SUSTANCIA.test(t)) ||
      /*
       * ── PP-002 · «SE TOMÓ DOBLE DOSIS SIN QUERER» ────────────────────────
       *
       * La regla exigía que la frase nombrara «pastilla / jarabe / frasco», y
       * la palabra que la gente usa —«dosis»— no estaba. «Se tomó doble dosis
       * sin querer, ¿qué hago?» caía en escalación ordinaria.
       *
       * Se añade la CANTIDAD DE MÁS como segunda señal… y con un freno: la
       * misma frase en futuro es una PREGUNTA de permiso, no un accidente.
       * «¿Puedo tomarme el doble?» es la primera de las doce del §0 y tiene que
       * seguir siendo una escalación por `cambio_de_dosis`, no una urgencia:
       * contestar el 911 a quien pregunta antes de hacerlo rompe el canal.
       */
      (TOMO_YA.test(t) && DE_MAS.test(t) && !PIDE_PERMISO.test(t)),
  },

  /* ── PL-C9 · OBSTETRICIA (MG-013, PG-001) ─────────────────────────────── */
  {
    motivo: 'sangrado_que_no_para',
    /*
     * «Sangre» a secas NO entra: «me van a sacar sangre», «estudio de sangre»
     * y «biometría» son la conversación normal de un consultorio, y escalar eso
     * enseña a ignorar el aviso. Lo que entra es el sangrado como HECHO.
     */
    prueba: t =>
      (/\bsangrado\b|\bsangrando\b|hemorragia|no para de sangrar|no deja de sangrar|no me para la sangre|perdi mucha sangre|sangro mucho/.test(t)) &&
      !/(estudio|analisis|laboratorio|muestra|me sacan|sacar sangre|toma de sangre|examen de sangre|donar sangre|banco de sangre)/.test(t),
  },
  {
    motivo: 'urgencia_del_embarazo',
    prueba: t =>
      /no siento (al |a mi )?(bebe|nino|nina|producto)|no siento que se mue|no lo siento mover|no la siento mover|ya no siento que se mue|no lo siento mover|no la siento mover|ya no se mueve|no se mueve (el |mi )?(bebe|nino|nina)|no siento movimient|dejo de moverse/.test(t) ||
      /se me rompio la fuente|rompi la fuente|se me rompieron las membranas|se me sale liquido|estoy botando liquido/.test(t),
  },

  /* ── PL-C9 · PEDIATRÍA (PP-001) ───────────────────────────────────────── */
  {
    motivo: 'no_despierta_o_no_reacciona',
    /*
     * «Mucho sueño desde que empecé el tratamiento» NO es esto, y está en el
     * fixture como caso NO urgente: es un efecto adverso que se escala, no una
     * urgencia. Por eso «muy dormido» sólo cuenta acompañado de que no
     * despierta, de que no responde, o de que se habla de un niño.
     */
    prueba: t =>
      /no (lo |la |le |se )?(puedo )?(despiert|despertar)|no quiere despertar|no reacciona|esta inconsciente|no me contesta ni se mueve/.test(t) ||
      (/(muy dormid|somnolient|adormilad|bien dormid)/.test(t) &&
        /(no (se )?despiert|no responde|no reacciona|bebe|lactante|nino|nina|mi hijo|mi hija|recien nacid)/.test(t)),
  },
  {
    motivo: 'fiebre_en_un_bebe',
    /*
     * NEEDS_CLINICAL_REVIEW (ver `UMBRALES_PENDIENTES`): la edad y la
     * temperatura exactas las decide el médico. Mientras no las dé, cualquier
     * fiebre dicha sobre un bebé o un lactante escala — que es lo que se puede
     * hacer sin inventar una cifra.
     */
    prueba: t =>
      /(fiebre|calentura|temperatura|febril)/.test(t) &&
      /(bebe|bebito|lactante|recien nacid|neonato|mi nene|mi nena|de \d+ (dias|semanas|meses)\b)/.test(t),
  },

  /* ── PL-C9 · POSTOPERATORIO (PC-003) ──────────────────────────────────── */
  {
    motivo: 'herida_con_pus_o_fiebre',
    prueba: t =>
      /(herida|cicatriz|puntos|sutura|incision|operad|cirugia|me operaron)/.test(t) &&
      /(pus|supura|infectad|huele mal|se abrio|se me abrio|se abrieron|roja y caliente|caliente y roja|hinchada y roja|fiebre|calentura)/.test(t),
  },

  /* ── PL-C9 · ORTOPEDIA Y VASCULAR (PO-003) ────────────────────────────── */
  {
    motivo: 'extremidad_fria_o_morada',
    prueba: t =>
      /(pie|pies|mano|manos|dedo|dedos|pierna|brazo|extremidad|tobillo)/.test(t) &&
      /(morad|azul|amoratad|frio|fria|helad|sin sensibilidad|no siento los dedos|no los siento|palid|blanquec)/.test(t),
  },

  /* ── PL-C9 · MEDICINA INTERNA (PI-011) ────────────────────────────────── */
  {
    motivo: 'glucosa_con_sintomas',
    /*
     * NEEDS_CLINICAL_REVIEW (ver `UMBRALES_PENDIENTES`): aquí NO hay ninguna
     * cifra de corte. Lo que dispara es la MENCIÓN del azúcar junto a síntomas,
     * que no exige decidir a partir de cuánto es grave.
     */
    prueba: t =>
      /(glucosa|glucometr|azucar|hipoglucem|glicemia)/.test(t) &&
      /(baja|bajo|bajita|sudo frio|sudor frio|sudando|tembl|mareo|maread|confundid|vision borrosa|me siento mal|no responde|desmay|debil)/.test(t),
  },
]

/** «Ya me lo tomé» — el acto CONSUMADO, no la pregunta de si puede. */
const TOMO_YA = /((me |se )?(tome|tomo|trague|trago|bebi|bebio|comi|comio)|tome de mas|tomo de mas|tome todas|tomo todas)\b/

/** De qué se habla cuando se habla de haberse tomado algo. */
const SUSTANCIA = /(pastilla|medicamento|medicina|tableta|jarabe|frasco|gotas|capsula|comprimido|suspension|ampolleta|inyeccion|dosis|cloro|veneno|pila|caja)/

/** La cantidad de más, dicha sin nombrar el envase. */
const DE_MAS = /(doble|dos veces|dos dosis|dos pastillas|dos tabletas|de mas|de sobra|todas juntas)/

/** Modales de permiso: «¿puedo…?» es una pregunta, no un accidente. */
const PIDE_PERMISO = /(puedo|podria|debo|deberia|se puede|es correcto|esta bien si|me toca)/

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
export type CanalDelPaciente = 'whatsapp' | 'portal'

export function mensajeDeUrgencia(
  telefonoConsultorio: string,
  canal: CanalDelPaciente = 'whatsapp',
): string {
  const tel = String(telefonoConsultorio ?? '').trim()

  /**
   * ── PC-005 · EL FORMATO DE WHATSAPP SE PINTABA CRUDO EN LA WEB ───────────
   *
   * El portal enseñaba literalmente «*Esto puede ser una urgencia médica.*» y
   * «Llame al *911*»: los asteriscos de WhatsApp, tal cual, dentro de una
   * página web. Y decía «este canal es para citas» estando el paciente en la
   * pestaña **Preguntar**, que existe justo para preguntar.
   *
   * Un mismo texto no puede servir a los dos canales: en WhatsApp el número es
   * texto y los asteriscos son negritas; en el portal el número es un botón que
   * marca (`ViaDeUrgencia`) y los asteriscos son basura. Se separan.
   *
   * ── PI-014 · Y NO SE PROMETE LO QUE NO PASA ─────────────────────────────
   *
   * Decía «Avisamos al consultorio». Lo que ocurre de verdad es que la pregunta
   * queda en el worklist y —si hay teléfono— sale un WhatsApp: nadie garantiza
   * que alguien lo lea de madrugada. Se dice así.
   */
  if (canal === 'portal') {
    return [
      'Esto puede ser una urgencia médica.',
      '',
      'No esperes respuesta aquí: nadie está leyendo esta pantalla ahora mismo.',
      `Marca el ${TELEFONO_EMERGENCIAS} o ve al servicio de urgencias más cercano.`,
      ...(tel ? [`El teléfono de tu consultorio es ${tel}.`] : []),
      '',
      'Tu pregunta quedó anotada para tu consultorio, pero puede que nadie la lea hasta que abran.',
    ].join('\n')
  }

  return [
    '🚨 *Esto puede ser una urgencia médica.*',
    '',
    'No espere respuesta por este medio: no hay nadie leyéndolo ahora mismo.',
    '',
    `📞 Llame al *${TELEFONO_EMERGENCIAS}* o acuda al servicio de urgencias más cercano.`,
    ...(tel ? [`📞 Consultorio: ${tel}`] : []),
    '',
    'Su mensaje quedó anotado para el consultorio, pero puede que nadie lo lea hasta que abran.',
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
    `Se le respondió que llame al ${TELEFONO_EMERGENCIAS} o acuda a urgencias. Nadie lo ha atendido.`,
  ].join('\n')
}

/**
 * LO QUE ESTA LISTA **NO** VIGILA, DICHO EN LA PANTALLA (PL-C9).
 *
 * La recomendación por omisión del dueño para PL-C9 pedía que, mientras el
 * vocabulario definitivo no esté firmado por especialidad, «el portal diga qué
 * NO vigila — hoy no lo dice». Esto es esa frase, en un solo sitio, para que la
 * pantalla no la copie a mano y se quede vieja.
 *
 * Es `clinical-safety.md` §5 dicho de cara al paciente: que un cuadro no esté
 * nombrado significa que no se nombra, no que sea benigno.
 */
export const LO_QUE_NO_SE_VIGILA =
  'Esta lista no es una lista de todo lo grave: no incluye golpes en la cabeza, ' +
  'dolor de barriga fuerte, reacciones alérgicas ni pensamientos de hacerte daño. ' +
  'Si algo te asusta y no está aquí, llama igual.'

export const POR_QUE_VA_PRIMERO =
  'Porque el detector de preguntas frecuentes trabaja por subcadena y «me duele ' +
  'el pecho desde hace una hora» contiene «hora»: al paciente con dolor torácico ' +
  'se le contestaba el horario de atención. El fallo era de ORDEN, no de detección.'
