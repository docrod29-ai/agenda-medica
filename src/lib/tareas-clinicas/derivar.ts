/**
 * DE LOS CABOS SUELTOS DE UNA NOTA A TAREAS CON DUEÑO Y FECHA.
 *
 * ── LO QUE PASABA ANTES ──────────────────────────────────────────────────────
 *
 * El médico pide una biometría, lo escribe en el plan, firma y sigue. El
 * pendiente queda dentro de una nota firmada — un documento que, por definición,
 * ya no se toca y que nadie relee salvo que sospeche algo.
 *
 * El estudio se hace, el resultado llega, y ahí muere. No por descuido: porque
 * la frase «solicito biometría» no tiene a quién reclamarle ni cuándo.
 *
 * ── LA REGLA QUE ORDENA ESTE MÓDULO ──────────────────────────────────────────
 *
 * **Sólo se deriva lo que el médico ESCRIBIÓ, nunca lo que se podría inferir.**
 *
 * Un estudio en la orden es un hecho: está en la lista. Que «este paciente
 * debería volver en tres meses» es criterio clínico, y no sale de aquí — si el
 * médico no puso fecha de seguimiento, no se le inventa una.
 *
 * Un worklist que se llena de tareas que nadie pidió se abandona en una semana,
 * y entonces tampoco se ve el estudio que sí importaba.
 *
 * ── LOS PLAZOS ───────────────────────────────────────────────────────────────
 *
 * Un plazo NO es una decisión clínica: es cuándo vuelve a preguntarse por algo
 * que ya se pidió. Se usa uno solo y generoso, y se declara. Poner plazos
 * distintos por tipo de estudio SÍ sería criterio médico y no me corresponde.
 *
 * Módulo PURO.
 */
import type { TareaClinica, Prioridad } from './modelo'

/** Lo mínimo de una nota para poder derivar. */
export interface NotaParaDerivar {
  id?: string
  clinicId: string
  pacienteId: string
  pacienteNombre?: string
  /** Estudios que quedaron pedidos en la orden. */
  estudiosOrden?: string[]
  /** Medicamentos prescritos: si hay, hay receta que entregar. */
  medicamentos?: { nombre?: string }[]
  /** Fecha de seguimiento, sólo si el médico la puso. */
  proximoSeguimiento?: string
  medicoUid?: string
  medicoNombre?: string
}

/**
 * Cuánto tarda en reclamarse un estudio pedido.
 *
 * Catorce días: suficiente para que un laboratorio de rutina esté hecho y
 * revisado sin que la tarea empiece a molestar antes de tiempo, y lo bastante
 * corto para que un resultado olvidado salte dentro del mismo mes.
 *
 * Es un plazo ADMINISTRATIVO, no clínico. Diferenciarlo por tipo de estudio —una
 * urgencia frente a un control— sí sería criterio médico, y ése no sale de aquí:
 * el médico puede cambiar la fecha de cada tarea.
 */
export const DIAS_PARA_RECLAMAR_ESTUDIO = 14

/** Y una receta prescrita se entrega el mismo día o no se entrega. */
export const DIAS_PARA_ENTREGAR_RECETA = 1

const iso = (ms: number) => new Date(ms).toISOString()

/**
 * Las tareas que salen de una nota firmada.
 *
 * Nacen SIN dueño cuando la nota no dice de quién es —y eso es información, no
 * un hueco: las tareas sin dueño son justo las que se pierden, y el worklist las
 * enseña aparte—. Si la nota trae médico, se le asigna: quien pidió el estudio
 * es quien tiene que ver el resultado.
 */
export function tareasDeNota(nota: NotaParaDerivar, ahoraMs: number): Omit<TareaClinica, 'id'>[] {
  const base = {
    clinicId: nota.clinicId,
    patientId: nota.pacienteId,
    patientNombre: nota.pacienteNombre,
    notaId: nota.id,
    estado: 'solicitada' as const,
    creadaEn: iso(ahoraMs),
    origen: 'nota',
    ownerUid: nota.medicoUid,
    ownerNombre: nota.medicoNombre,
  }

  const salida: Omit<TareaClinica, 'id'>[] = []

  /**
   * Los estudios, uno por uno y no «revisar los estudios».
   *
   * Agruparlos en una sola tarea permite cerrarla habiendo mirado sólo el
   * primero, que es exactamente cómo se pierde el segundo.
   */
  for (const estudio of nota.estudiosOrden ?? []) {
    const nombre = String(estudio ?? '').trim()
    if (!nombre) continue
    salida.push({
      ...base,
      tipo: 'estudio_pendiente',
      titulo: nombre,
      detalle: 'Pedido en esta consulta. Se cierra cuando el resultado esté revisado, no cuando el estudio esté hecho.',
      prioridad: 'normal' as Prioridad,
      venceEn: iso(ahoraMs + DIAS_PARA_RECLAMAR_ESTUDIO * 86_400_000),
    })
  }

  const meds = (nota.medicamentos ?? []).filter(m => String(m?.nombre ?? '').trim())
  if (meds.length) {
    salida.push({
      ...base,
      tipo: 'receta_por_entregar',
      titulo: `Entregar receta (${meds.length} medicamento${meds.length === 1 ? '' : 's'})`,
      detalle: 'La receta se generó en la consulta. Se cierra cuando el paciente la tiene.',
      prioridad: 'alta' as Prioridad,
      venceEn: iso(ahoraMs + DIAS_PARA_ENTREGAR_RECETA * 86_400_000),
    })
  }

  /**
   * El seguimiento SÓLO si el médico puso fecha.
   *
   * Inventar un «vuelva en tres meses» sería criterio clínico salido de un
   * archivo de software, y además llenaría el worklist de tareas que nadie
   * pidió — que es como se abandona un worklist.
   */
  const seg = String(nota.proximoSeguimiento ?? '').trim()
  if (seg) {
    const t = Date.parse(seg.length === 10 ? `${seg}T09:00:00` : seg)
    salida.push({
      ...base,
      tipo: 'seguimiento',
      titulo: 'Agendar el seguimiento',
      detalle: `El médico indicó control el ${seg}.`,
      prioridad: 'normal' as Prioridad,
      venceEn: Number.isFinite(t) ? iso(t) : undefined,
    })
  }

  return salida
}

/**
 * La tarea que nace cuando LLEGA un resultado.
 *
 * Es la mitad que faltaba: el estudio hecho no es el final del camino. Nace en
 * `solicitada` —nadie lo ha mirado todavía— y con la prioridad que traiga el
 * resultado: un valor crítico sin revisar es lo más urgente que puede haber en
 * un consultorio.
 */
export function tareaDeResultado(p: {
  clinicId: string
  patientId: string
  patientNombre?: string
  estudio: string
  critico: boolean
  ahoraMs: number
  ownerUid?: string
  ownerNombre?: string
  /**
   * Qué decir en vez de «Valor crítico reportado». Lo usa el camino ambulatorio,
   * donde una tarea cubre una HOJA entera y por tanto puede nombrar QUÉ analitos
   * salieron críticos. El camino hospitalario no lo pasa y conserva su texto.
   */
  detalle?: string
}): Omit<TareaClinica, 'id'> {
  return {
    clinicId: p.clinicId,
    patientId: p.patientId,
    patientNombre: p.patientNombre,
    tipo: 'resultado_por_revisar',
    titulo: `Revisar resultado: ${p.estudio}`,
    detalle: p.detalle ?? (p.critico ? 'Valor crítico reportado.' : undefined),
    prioridad: p.critico ? 'critica' : 'alta',
    estado: 'solicitada',
    creadaEn: iso(p.ahoraMs),
    // Lo crítico vence el mismo día; lo demás, en dos.
    venceEn: iso(p.ahoraMs + (p.critico ? 1 : 2) * 86_400_000),
    origen: 'laboratorio',
    ownerUid: p.ownerUid,
    ownerNombre: p.ownerNombre,
  }
}

/**
 * UNA INTERCONSULTA PEDIDA ES UN CABO SUELTO — REG-570.
 *
 * ── LA FUGA ─────────────────────────────────────────────────────────────────
 *
 * Es la misma que REG-252 cerró para los resultados: la interconsulta vivía sólo
 * dentro de `Internamiento.interconsultas`, un array embebido en el documento del
 * episodio. `tareasVivas` lee `tareas_clinicas`; `cabosDelPaciente` lee
 * `tareas_clinicas`; `estadoDeAccion` clasifica tareas. Ninguno de los tres podía
 * verla. Una interconsulta pedida y no contestada era invisible salvo que alguien
 * abriera esa pestaña de ese episodio y se acordara de mirar.
 *
 * ── POR QUÉ `alta` Y NO `critica` ───────────────────────────────────────────
 *
 * Porque la urgencia de una interconsulta la decide quien la pide, y aquí no hay
 * campo donde lo haya dicho: `Interconsulta` no tiene prioridad. Marcarlas todas
 * críticas sería el defecto de siempre —si todo es crítico, nada lo es— e
 * inventarle una escala de urgencia al motivo sería adivinar. `alta` es lo que
 * corresponde a un pendiente vivo cuyo plazo nadie ha fijado.
 *
 * ── SIN `venceEn`, Y ESO ES EL DATO ─────────────────────────────────────────
 *
 * El plazo tras el cual una interconsulta sin contestar está vencida depende de
 * la especialidad, de la urgencia y del acuerdo del hospital. Es criterio
 * clínico y no está decidido, así que no se pone: `estaVencida` no opina y la
 * tarea no aparece en «Vencidos». Poner «48 h» porque suena razonable metería en
 * rojo pendientes que quizá no lo están, y un grupo «Vencidos» que miente deja
 * de leerse — que es peor que no tenerlo.
 */
export function tareaDeInterconsulta(p: {
  clinicId: string
  patientId: string
  patientNombre?: string
  /** El id de la interconsulta DENTRO del episodio. Da identidad estable. */
  interconsultaId: string
  especialidad: string
  motivo?: string
  ahoraMs: number
  /** A quién se le pidió, si se eligió un médico concreto. */
  ownerUid?: string
  ownerNombre?: string
}): Omit<TareaClinica, 'id'> {
  return {
    clinicId: p.clinicId,
    patientId: p.patientId,
    patientNombre: p.patientNombre,
    tipo: 'interconsulta_pendiente',
    titulo: `Interconsulta a ${p.especialidad}`,
    detalle: p.motivo?.trim() || undefined,
    prioridad: 'alta',
    estado: 'solicitada',
    creadaEn: iso(p.ahoraMs),
    origen: 'hospital',
    origenId: p.interconsultaId,
    ownerUid: p.ownerUid,
    ownerNombre: p.ownerNombre,
  }
}

/**
 * §F3 — una tarea por cada discrepancia entre lo dicho y la lista.
 *
 * Prioridad `alta` y no `critica`: una lista desactualizada es peligrosa a lo
 * largo de las consultas siguientes, no en los próximos minutos. Lo `critico`
 * se reserva para lo que se decide hoy — si todo es crítico, nada lo es.
 *
 * Vence en el mismo plazo que un estudio: si nadie la mira en dos semanas, la
 * lista ya lleva dos semanas mintiéndole a los motores de seguridad.
 */
export function tareasDeReconciliacion(p: {
  clinicId: string
  pacienteId: string
  pacienteNombre?: string
  notaId?: string
  discrepancias: readonly { farmaco: string; frase: string }[]
  texto: (d: { farmaco: string; frase: string }) => string
  medicoUid?: string
  medicoNombre?: string
}, ahoraMs: number): Omit<TareaClinica, 'id'>[] {
  return p.discrepancias.map(d => ({
    clinicId: p.clinicId,
    patientId: p.pacienteId,
    patientNombre: p.pacienteNombre,
    notaId: p.notaId,
    tipo: 'reconciliacion_medicamento' as const,
    titulo: `Reconciliar ${d.farmaco}`,
    detalle: p.texto(d),
    prioridad: 'alta' as const,
    ownerUid: p.medicoUid,
    ownerNombre: p.medicoNombre,
    estado: 'solicitada' as const,
    creadaEn: new Date(ahoraMs).toISOString(),
    venceEn: new Date(ahoraMs + DIAS_PARA_RECLAMAR_ESTUDIO * 86400000).toISOString(),
    origen: 'consulta:reconciliacion',
  }))
}

export const POR_QUE_NO_SE_INFIERE =
  'Porque un worklist que se llena de tareas que nadie pidió se abandona en una ' +
  'semana, y entonces tampoco se ve el estudio que sí importaba. Se deriva lo ' +
  'que el médico ESCRIBIÓ: un estudio en la orden es un hecho; que un paciente ' +
  '«debería volver en tres meses» es criterio clínico y no sale de un archivo ' +
  'de software.'
