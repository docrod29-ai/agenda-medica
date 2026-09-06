/**
 * QUÉ FALTA PARA CERRAR LA CONSULTA — REG-244.
 *
 * ── EL DEFECTO, Y ES DE LOS QUE NO SE VEN ───────────────────────────────────
 *
 * Al firmar, la consulta elegía **un** destino:
 *
 *     con medicamentos            → la receta
 *     sin medicamentos, con estudios → la orden
 *     ninguno                     → el expediente
 *
 * Con medicamentos **y** estudios —que es media consulta de medicina interna—
 * iba a la receta y **la orden se quedaba en el tintero**. El paciente salía con
 * su receta y sin su solicitud de estudios, y nadie se enteraba: la nota estaba
 * firmada, la cita marcada como atendida, todo verde.
 *
 * El comentario del código ya avisaba de la mitad del problema —«antes solo
 * ramificaba a receta y la orden se quedaba en el tintero»— y lo arregló para el
 * caso «sin medicamentos». El caso «con los dos» siguió igual.
 *
 * ── POR QUÉ UNA PANTALLA Y NO OTRO `if` ─────────────────────────────────────
 *
 * Porque el problema no es a cuál de los dos ir: es que **son dos**. Cualquier
 * regla que elija uno deja el otro sin hacer. Lo que hace falta es enseñar lo
 * que queda y dejar que se haga en cualquier orden.
 *
 * ── LO QUE NO CAMBIA, Y ES DELIBERADO ───────────────────────────────────────
 *
 * Cuando sólo hay UN destino, se sigue yendo directo. Ese caso nunca estuvo
 * roto, y meterle una pantalla de por medio sería añadir un clic a la consulta
 * más común para arreglar un problema que esa consulta no tiene.
 *
 * Módulo PURO.
 */

export type QueFalta = 'receta' | 'orden' | 'hoja_del_paciente' | 'seguimiento' | 'cobro' | 'expediente'

export interface PasoDeCierre {
  que: QueFalta
  /** Cómo se llama en la pantalla. */
  titulo: string
  /** Qué pasa si no se hace. Es lo que decide si vale la pena el clic. */
  siNoSeHace: string
  /**
   * A dónde lleva. `null` = se resuelve sin salir de aquí y sin nada que
   * enseñar en pantalla (p. ej. el cobro, que abre su propio modal). Un
   * valor que empieza con `#` también «se resuelve sin salir de aquí», pero
   * SÍ hay algo que enseñar: es el id del elemento al que hay que
   * desplazarse en la propia consulta, no una ruta de Next.js.
   */
  ruta: string | null
}

export interface EstadoAlCerrar {
  patientId: string
  notaId?: string | null
  hayMedicamentos?: boolean
  hayEstudios?: boolean
  /** La clínica pide el cobro al médico al cerrar. */
  pideCobro?: boolean
  /**
   * Fecha ISO (AAAA-MM-DD) que el médico puso en «Próxima consulta», o vacío.
   * Sólo llega recién firmada la nota: el documento de la nota no guarda este
   * campo (va al expediente del paciente y a la tarea del worklist), así que al
   * REABRIR una nota firmada este dato ya no está y el paso no aparece — la
   * tarea «Agendar el seguimiento» del worklist es quien lo recuerda entonces.
   */
  proximoSeguimiento?: string | null
  /** Si está internado, el cierre es otro: vuelve al episodio. */
  internamientoActivo?: string | null
}

/**
 * Lo que queda por hacer, en el orden en que conviene hacerlo.
 *
 * La receta va primero porque es lo que el paciente espera con la mano
 * extendida; el expediente va al final porque no es una tarea, es a dónde se
 * vuelve cuando ya no queda nada.
 */
export function queFaltaParaCerrar(e: EstadoAlCerrar): PasoDeCierre[] {
  const nid = e.notaId ?? null
  const out: PasoDeCierre[] = []

  if (e.hayMedicamentos && nid) out.push({
    que: 'receta',
    titulo: 'Imprimir la receta',
    siNoSeHace: 'El paciente se va sin sus medicamentos por escrito.',
    ruta: `/receta/${e.patientId}/${nid}`,
  })

  if (e.hayEstudios && nid) out.push({
    que: 'orden',
    titulo: 'Imprimir la orden de estudios',
    siNoSeHace: 'El laboratorio no le va a tomar la muestra sin la solicitud.',
    ruta: `/orden/${e.patientId}/${nid}`,
  })

  if (e.hayMedicamentos || e.hayEstudios) out.push({
    que: 'hoja_del_paciente',
    titulo: 'Darle sus instrucciones',
    siNoSeHace: 'Se lleva la receta, pero no cómo tomarla en sus palabras.',
    /**
     * Vive en la propia consulta — no navega a OTRA pantalla — pero antes
     * de V15-NOTE-PLAN-CONTINUITY-001 esto era `null` y el botón salía
     * apagado: el médico veía «Darle sus instrucciones» en la lista y no
     * podía pulsarlo. Un `#` es la señal para quien pinta el panel
     * (`ComoCerrarLaConsulta` en `/consulta/[patientId]`) de que hay que
     * desplazarse al elemento con ese id EN VEZ de navegar — mismo patrón
     * de «sin salir de aquí» (§21, Source Reveal), pero ahora con destino
     * real en vez de un botón muerto.
     */
    ruta: '#hoja-para-el-paciente',
  })

  /**
   * NOTE → … → FOLLOW-UP (V15-NOTE-PLAN-CONTINUITY-001, §33 Fase 8).
   *
   * El eslabón que faltaba de la cadena de cierre. El médico puso fecha de
   * control, la firma derivó la tarea «Agendar el seguimiento»… y el cierre no
   * decía nada: la cita se agendaba después, desde /pendientes, con el
   * paciente ya ido. El momento natural de agendar es AHORA, que sigue aquí.
   *
   * Sólo con forma ISO exacta: es lo único que /citas?d= sabe interpretar
   * (`paramFecha`); cualquier otra cosa aterrizaría en «hoy» sin avisar — un
   * botón que promete llevar al día del control y lleva a otro.
   */
  const seg = String(e.proximoSeguimiento ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) out.push({
    que: 'seguimiento',
    titulo: 'Agendar el seguimiento',
    siNoSeHace: 'El paciente se va sin cita; la tarea queda esperando en Pendientes.',
    ruta: `/citas?d=${seg}`,
  })

  /**
   * EL PASO DEL COBRO DEJA DE SER UN BOTÓN MUERTO — Panel de Lujo ZC-007 (P2).
   *
   * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
   *
   * `ruta: null` hacía que `ComoCerrarLaConsulta` pintara el paso como un botón
   * DESHABILITADO y sin ninguna explicación. Y no era una limitación temporal:
   * el único disparador del modal de cobro corre una sola vez, al firmar
   * (`if (config?.pedirCobroAlCerrar === true) setCobrar(true)`), así que si el
   * médico cerró ese modal ya no había forma de volver a él desde la consulta.
   * Un callejón sin salida con la etiqueta de una tarea pendiente.
   *
   * ── CÓMO SE REPARA, Y POR QUÉ ASÍ ──────────────────────────────────────────
   *
   * El comentario de la propia pantalla de consulta ya decía cuál es la vía
   * normal: **cobra la asistente, desde la ficha de la cita en Citas**. Eso no
   * era un hueco, era una decisión — lo que faltaba era decírselo al médico. El
   * paso lleva ahora la ruta a la agenda del día y su porqué, así que el botón
   * hace algo y explica qué.
   *
   * No se abre un segundo disparador del modal de cobro dentro de la consulta:
   * sería una segunda vía para el mismo acto, y el corte de caja acabaría con
   * dos sitios donde se registra un cobro.
   */
  if (e.pideCobro) out.push({
    que: 'cobro',
    titulo: 'Registrar el cobro en la cita',
    siNoSeHace: 'La consulta no aparece en el corte del día.',
    ruta: '/citas',
  })

  out.push({
    que: 'expediente',
    titulo: 'Volver al expediente',
    siNoSeHace: '',
    ruta: `/expediente/${e.patientId}`,
  })

  return out
}

/**
 * A dónde ir directo, o `null` si hay que enseñar la pantalla.
 *
 * «Directo» significa: hay como mucho **una** cosa que hacer además de volver
 * al expediente. Con dos o más, elegir una deja la otra sin hacer — que es
 * exactamente el defecto.
 */
export function aDondeIrDirecto(e: EstadoAlCerrar): string | null {
  /* Internado: el cierre es volver al episodio, y eso no admite alternativa. */
  if (e.internamientoActivo) return `/hospitalizacion/${e.internamientoActivo}`

  /**
   * El seguimiento tampoco cuenta para forzar el panel — pero por OTRA razón
   * que la hoja: a diferencia de la orden de REG-244 (que sin panel se perdía
   * sin dejar rastro), el seguimiento ya tiene red — la firma derivó su tarea
   * en el worklist. Forzar el panel añadiría un clic a la consulta más común
   * para proteger algo que ya está protegido. Cuando el panel sale de todos
   * modos, el paso está ahí para cerrar el ciclo con el paciente presente.
   */
  const pasos = queFaltaParaCerrar(e).filter(p => p.que !== 'expediente' && p.que !== 'hoja_del_paciente' && p.que !== 'seguimiento')
  if (pasos.length === 0) return `/expediente/${e.patientId}`
  if (pasos.length === 1 && !e.pideCobro) return pasos[0].ruta
  return null
}

export const EL_CASO_QUE_SE_PERDIA =
  'Con medicamentos Y estudios —media consulta de medicina interna— firmar ' +
  'llevaba a la receta y la orden se quedaba sin imprimir. El paciente salía ' +
  'sin su solicitud de estudios y todo se veía correcto: nota firmada, cita ' +
  'atendida.'

export const POR_QUE_NO_OTRO_IF =
  'El problema no es a cuál de los dos ir: es que son dos. Cualquier regla que ' +
  'elija uno deja el otro sin hacer.'

export const POR_QUE_EL_CASO_SIMPLE_NO_CAMBIA =
  'Con un solo destino nunca estuvo roto. Meterle una pantalla de por medio ' +
  'sería añadir un clic a la consulta más común para arreglar un problema que ' +
  'esa consulta no tiene.'

export const POR_QUE_EL_SEGUIMIENTO_NO_FUERZA_EL_PANEL =
  'La orden de REG-244 se perdía sin dejar rastro; el seguimiento no: la firma ' +
  'ya derivó su tarea en el worklist. Forzar el panel añadiría un clic para ' +
  'proteger algo que ya está protegido — el paso aparece cuando el panel sale ' +
  'de todos modos, para agendar con el paciente todavía presente.'
