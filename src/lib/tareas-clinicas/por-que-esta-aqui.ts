/**
 * §10 DEL MASTER LOOP V15 — LAS CUATRO PREGUNTAS QUE TODA ENTRADA DE LA COLA
 * DE CIERRE TIENE QUE CONTESTAR.
 *
 * ── LO QUE PIDE §10, LITERAL ────────────────────────────────────────────────
 *
 *   «Every item answers:
 *      WHY IS THIS HERE?
 *      WHO OWNS IT?
 *      WHAT HAPPENED?
 *      WHAT IS NEXT?»
 *
 * De las cuatro, `/pendientes` contestaba DOS antes de esta rebanada: quién
 * responde (`ownerNombre`) y qué sigue (el botón del siguiente paso). Las otras
 * dos no estaban en la pantalla en ninguna forma.
 *
 * ── EL DATO QUE YA EXISTÍA Y NO LLEGABA ─────────────────────────────────────
 *
 * `TareaClinica.notaId` se declara en el modelo como «de qué consulta salió: es
 * la traza hacia atrás», `derivar.ts:81` lo ESCRIBE en cada tarea derivada de
 * una nota… y el único consumidor en todo el repositorio es `firestore.ts`, que
 * lo usa para componer un id derivado y no duplicar. O sea: la traza se guarda
 * y **no la ve nadie**. Es la regla «el dato tiene que LLEGAR» en su forma más
 * silenciosa — el campo existe, se escribe, las pruebas de contrato pasan, y
 * del otro lado no hay quien lo lea.
 *
 * Esta pieza es quien lo lee.
 *
 * ── POR QUÉ UN MÓDULO PURO Y NO PROSA DENTRO DE LA PANTALLA ─────────────────
 *
 * V15 §1 congela la lógica clínica y permite explícitamente «view models,
 * selectors, presentation-layer adapters». Esto es exactamente eso: no calcula
 * nada clínico, no escribe, no consulta. Traduce campos que ya están escritos a
 * las cuatro respuestas de §10 — y vive fuera del componente desde el primer
 * día, que es lo que pide la regla de diseño para no retroajustar i18n a 78
 * pantallas después.
 *
 * ── LAS TRES DECISIONES QUE NO SON DE ESTILO ────────────────────────────────
 *
 * 1. **AUSENCIA DE DATO NO ES DATO DE AUSENCIA** (regla 4 de seguridad
 *    clínica, y §5 de la regla de la IA de cara al paciente). Una tarea sin
 *    `completadaEn` NO produce el hito «no se ha hecho»: produce la ausencia de
 *    ese hito. Que no conste que el trabajo se hizo no es constancia de que no
 *    se hizo — puede que se hiciera y nadie lo marcara, que es justo el fallo
 *    que esta cola existe para cazar.
 *
 * 2. **`origen` ES UNA CADENA LIBRE EN EL MODELO**, no una unión de tipos:
 *    `origen: string`, con el comentario «quién o qué la creó: 'nota',
 *    'laboratorio', 'manual'». Tres valores documentados y ninguna garantía de
 *    compilador. Lo que no se reconoce **se dice tal cual y se declara que no
 *    consta cómo se abrió** — no se reparte entre los tres conocidos. Es la
 *    regla 5 de seguridad clínica en su versión de datos: que falte un valor
 *    del vocabulario significa que ese caso NO se explica, no que se dé por
 *    bueno el más parecido.
 *
 * 3. **`cerradaPor` ES UN UID, NO UN NOMBRE.** Enseñarlo crudo sería enseñarle
 *    al médico `S3xK9...`; resolverlo a un nombre exige una lectura de otra
 *    colección que esta pieza no hace y que §1 no pide. Se dice **«tú»** cuando
 *    coincide con quien mira —un hecho comprobable ahí mismo— y en cualquier
 *    otro caso el hito **conserva la fecha y calla el autor**. Inventar «lo
 *    cerró el consultorio» sería afirmar algo que el dato no dice.
 *
 * ── LO QUE DE VERDAD SOSTIENE ESTA PANTALLA ─────────────────────────────────
 *
 * La distinción completada≠cerrada (`POR_QUE_COMPLETADA_NO_ES_CERRADA`). Un
 * pendiente con `completadaEn` y sin `cerradaEn` es el estudio hecho, el
 * resultado en el sistema, y nadie que lo haya leído. Ése es el estado que la
 * respuesta a «¿qué ha pasado?» tiene que dejar imposible de confundir con
 * «listo».
 *
 * Módulo PURO — ninguna consulta a Firestore, ningún cálculo clínico, ningún
 * reloj propio (el «ahora» entra por parámetro, como en `estado-de-accion`).
 */
import { type EstadoTarea, type TareaClinica } from './modelo'

/** Un hito de la vida del pendiente. `cuando` falta cuando el dato no consta. */
export interface Hito {
  /** ISO tal como está guardado. Quien pinta decide el formato. */
  cuando?: string
  que: string
  /**
   * El hito que hay que poder distinguir de un vistazo: el trabajo se hizo y
   * NADIE lo ha revisado. Es el único que marca, porque es el único peligroso.
   */
  sinRevisar?: boolean
}

/** La traza hacia atrás, sólo cuando existe de verdad. */
export interface Traza {
  notaId: string
  patientId: string
  /** La ruta a la consulta de la que salió, con la nota ya seleccionada. */
  href: string
}

export interface RespuestaDelPendiente {
  /** WHY IS THIS HERE */
  porQue: string
  /** WHO OWNS IT */
  quienResponde: string
  /** WHAT HAPPENED — en orden, del más viejo al más nuevo. */
  queHaPasado: Hito[]
  /** WHAT IS NEXT */
  queSigue: string
  /** De qué consulta salió, si consta. */
  traza: Traza | null
}

/**
 * QUÉ BOTÓN TOCA AHORA — y vive aquí, no en la pantalla.
 *
 * Estaba declarada dentro de `/pendientes/page.tsx`. Al necesitarla también la
 * respuesta a «¿qué sigue?» habría nacido la segunda copia, y dos definiciones
 * del siguiente paso legal de una tarea clínica es la regla cardinal de este
 * repositorio rota en el sitio más caro: el día que alguien cambie el orden en
 * una, la otra sigue ofreciendo un botón que `cambiarEstado` va a rechazar.
 *
 * Enseñar los siete estados sería enseñar el modelo, no el trabajo.
 */
export function siguientePaso(
  t: Pick<TareaClinica, 'estado' | 'tipo'>,
): { estado: EstadoTarea; texto: string } | null {
  if (t.estado === 'solicitada' || t.estado === 'aceptada') return { estado: 'en_curso', texto: 'Tomarla' }
  /**
   * EL SEGUIMIENTO TIENE UN PASO MÁS QUE LOS DEMÁS (REG-404).
   *
   * Agendar la cita no es haber visto al paciente. El paso siguiente de un
   * seguimiento en curso es `agendada` —queda una cita puesta y el pendiente
   * sigue vivo—, y sólo cuando el paciente viene se marca «ya se hizo».
   *
   * Antes se pasaba de `en_curso` a `completada` de un salto, así que agendar
   * contaba como atender: si el paciente no venía, nada lo reabría.
   */
  if (t.estado === 'en_curso' && t.tipo === 'seguimiento') return { estado: 'agendada', texto: 'Ya quedó agendada' }
  if (t.estado === 'agendada') return { estado: 'completada', texto: 'El paciente vino' }
  if (t.estado === 'en_curso') return { estado: 'completada', texto: 'Ya se hizo' }
  if (t.estado === 'completada') return { estado: 'cerrada', texto: 'Lo revisé — cerrar' }
  return null
}

/**
 * POR QUÉ ESTÁ AQUÍ — el origen, dicho en clínico.
 *
 * `origen` responde «quién lo abrió». **El TIPO no entra en la frase**, y esa
 * decisión la tomó la captura del navegador, no el diseño: la primera versión
 * lo incrustaba (`el plan dejó este ${tipo} abierto`) y con
 * `reconciliacion_medicamento` salió impreso «el plan dejó este reconciliar
 * abierto». `ETIQUETA_TIPO` no es un vocabulario de sustantivos —«Reconciliar»
 * es un verbo, «Pendiente» un adjetivo sustantivado—, así que meterlo en una
 * ranura de sustantivo produce texto roto en cuanto alguien añada una etiqueta
 * nueva, sin romper ninguna prueba.
 *
 * Y no se pierde nada: la tarjeta ya enseña el tipo en su distintivo, una línea
 * por encima, y la lente va al lado. Era redundancia con una trampa dentro.
 */
function porQueEstaAqui(t: Pick<TareaClinica, 'origen' | 'tipo'>): string {
  switch ((t.origen ?? '').trim().toLowerCase()) {
    case 'nota':
      return 'Salió de una consulta: al firmar la nota, el plan lo dejó abierto.'
    case 'laboratorio':
      // Qué llegó lo dice el TIPO en la tarjeta; aquí sólo consta quién abrió.
      return 'Lo abrió el laboratorio, no una consulta: hace falta que alguien lo mire.'
    case 'manual':
      return 'Alguien lo abrió a mano en el consultorio.'
    default:
      // No se reparte entre los tres conocidos. Se dice lo que consta.
      return t.origen
        ? `No consta cómo se abrió: el registro dice «${t.origen}», un origen que esta pantalla no sabe explicar.`
        : 'No consta cómo se abrió.'
  }
}

/**
 * QUÉ HA PASADO — sólo lo que tiene fecha, y en el orden en que pasó.
 *
 * No se rellena la línea de tiempo con los estados por los que la tarea
 * «debería» haber pasado: el modelo sólo sella cuatro momentos (creada,
 * completada, cerrada, y la cancelación por su motivo). Dibujar los seis
 * estados del ciclo con las fechas que faltan inventadas sería exactamente lo
 * que la regla 1 de seguridad clínica prohíbe, aplicado a la trazabilidad.
 */
function queHaPasado(t: TareaClinica, uidQueMira: string): Hito[] {
  const hitos: Hito[] = []

  if (t.creadaEn) hitos.push({ cuando: t.creadaEn, que: 'Se abrió el pendiente.' })

  if (t.completadaEn) {
    hitos.push({
      cuando: t.completadaEn,
      que: 'El trabajo se hizo.',
      // Hecho pero sin cerrar: el hueco entero por el que se pierde un
      // resultado. Se marca aquí y no en la pantalla para que ninguna vista
      // futura pueda pintarlo como si fuera «listo».
      sinRevisar: !t.cerradaEn && t.estado !== 'cancelada',
    })
  }

  if (t.cerradaEn) {
    const mio = !!t.cerradaPor && t.cerradaPor === uidQueMira
    hitos.push({
      cuando: t.cerradaEn,
      que: mio ? 'Lo revisaste y lo cerraste.' : 'Alguien lo revisó y lo cerró.',
    })
  }

  if (t.motivoCancelacion) {
    hitos.push({ que: `Se canceló: ${t.motivoCancelacion}` })
  }

  return hitos
}

/** QUÉ SIGUE — el siguiente paso legal, dicho en una frase. */
function queSigue(t: TareaClinica): string {
  if (t.estado === 'cerrada') return 'Nada: está cerrado. Una tarea cerrada no se reabre.'
  if (t.estado === 'cancelada') return 'Nada: se canceló. Un pendiente cancelado no revive.'
  const paso = siguientePaso(t)
  if (!paso) return 'No hay un paso siguiente para este estado.'
  if (paso.estado === 'cerrada') {
    return 'Falta que alguien lo revise y decida. Hasta entonces no está cerrado, aunque el trabajo ya se hiciera.'
  }
  if (paso.estado === 'completada') return 'Marcar que el trabajo se hizo, cuando se haya hecho.'
  return 'Que alguien lo tome: sin dueño, un pendiente no se hace solo.'
}

/**
 * Las cuatro respuestas de §10 para un pendiente.
 *
 * @param uidQueMira quién está viendo la pantalla. Sólo se usa para poder decir
 *   «lo cerraste tú» sin resolver un uid contra otra colección.
 */
export function responderPorElPendiente(
  t: TareaClinica,
  uidQueMira = '',
): RespuestaDelPendiente {
  return {
    porQue: porQueEstaAqui(t),
    // Sin dueño se DICE que no lo tiene: es la consulta de primera clase del
    // modelo («son las que se pierden»), no un campo vacío que se disimula.
    quienResponde: t.ownerNombre?.trim() || 'Nadie todavía — una tarea sin dueño no se hace sola.',
    queHaPasado: queHaPasado(t, uidQueMira),
    queSigue: queSigue(t),
    traza: t.notaId && t.patientId
      ? {
          notaId: t.notaId,
          patientId: t.patientId,
          // La MISMA forma que ya lee `/consulta/[patientId]` con
          // `searchParams.get('nota')`. Aterriza en la consulta con la nota
          // abierta, que es donde vive el sello de procedencia: la cadena de
          // §21 sigue —pendiente → consulta que lo abrió → procedencia de la
          // nota → segundo exacto del dictado— sin que ningún tramo invente
          // una ruta nueva.
          href: `/consulta/${t.patientId}?nota=${encodeURIComponent(t.notaId)}`,
        }
      : null,
  }
}

export const POR_QUE_LA_TRAZA_IMPORTA =
  'TareaClinica.notaId dice de qué consulta salió el pendiente. Se escribe en ' +
  'cada tarea derivada de una nota desde que existe derivar.ts, y hasta esta ' +
  'rebanada el único que lo leía era el compositor de ids de Firestore. La ' +
  'traza hacia atrás estaba guardada y no llegaba a ninguna pantalla.'
